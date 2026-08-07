/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-15
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { createHash } from "node:crypto";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { JobPostingClassification, OpportunityFacts } from "@kan/llm";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import * as cardAttachmentRepo from "@kan/db/repository/cardAttachment.repo";
import * as cardCommentRepo from "@kan/db/repository/cardComment.repo";
import {
  boards,
  cards,
  lists,
  shortlistEmailSources,
  shortlistJobQueue,
  shortlistSourceCards,
  shortlistSourceObjects,
  shortlistWebpageSources,
  users,
} from "@kan/db/schema";
import {
  classifyJobPostingContent,
  classifyOpportunityFactsContent,
  jobPostingSuccessSchema,
} from "@kan/llm";
import { createLogger } from "@kan/logger";
import {
  SHORTLIST_JOB_STATUSES,
  SHORTLIST_ROBOT_USER,
  SHORTLIST_SOURCE_OBJECT_TYPES,
  SHORTLIST_SOURCE_TYPES,
} from "@kan/shared/constants";
import {
  deleteObject,
  generateUID,
  getObjectBuffer,
  putObject,
} from "@kan/shared/utils";

import { buildCardDescription } from "../utils/build-card-description";
import { extractSourceText } from "../utils/extract-source-text";
import {
  beginProviderRequest,
  completeProviderRequest,
  countDailyAccountProviderRequests,
  failProviderRequest,
  getUtcDayStart,
  linkSourceProviderRequestsToCard,
  PROVIDERS,
  recordDailyProviderLimitNotice,
} from "../utils/provider-requests";

const logger = createLogger("shortlist-queue-worker:source-queue-worker");

const JOB_BATCH_LIMIT = 25;
const SAVED_LIST_NAME = "Saved";

type QueueProcessingStatus =
  (typeof SHORTLIST_JOB_STATUSES)[keyof typeof SHORTLIST_JOB_STATUSES];

interface ProcessShortlistJobQueueBatchOptions {
  accountDailyRequestLimit?: number;
  apiKey: string;
  model: string;
  retryLimit: number;
  limit?: number;
}

interface ProcessShortlistJobQueueBatchResult {
  selected: number;
  completed: number;
  duplicates: number;
  failed: number;
  retried: number;
}

interface QueueJobRow {
  id: string;
  attempts: number;
  boardId: number;
  createdAt: Date;
  createdBy: string;
  maxAttempts: number;
  payloadJson: unknown;
  processingLog: string | null;
  sourceId: string;
  sourceType: string;
  timeZone: string;
}

interface ClassificationSourceContent {
  clippedAt: Date;
  content: string;
  contentKind: "email" | "webpage";
  contentHash: string;
  currentEmailContent: string | null;
  provenance: Record<string, string[]>;
  sourceObjects: ExtractedSourceObject[];
  sourceUrl: string | null;
}

interface ExtractedSourceObject {
  buffer: Buffer | null;
  content: string | null;
  role: "ATTACHMENT" | "CURRENT_EMAIL" | "QUOTED_HISTORY" | "SOURCE";
  sourceObject: SourceObjectForClassification;
  warning: string | null;
}

interface SourceObjectForClassification {
  bucket: string;
  contentType: string;
  fileSize: number;
  metadataJson: unknown;
  objectType: string;
  originalFilename: string;
  s3Key: string;
}

interface DuplicateMatch {
  cardId: number;
  cardPublicId: string;
  reason: string;
  matchType: string;
}

interface ExistingCardSnapshot {
  contactsJson: unknown;
  description: string | null;
  dueDate: Date | null;
  manualUpdatedOnly: boolean;
  shortlistCompanyLocation: string | null;
  shortlistCompanyName: string | null;
  shortlistJobLocation: string | null;
  shortlistJobLocationType: string | null;
  shortlistJobPostingUrl: string | null;
  shortlistJobType: string;
  shortlistSalaryCurrency: string | null;
  shortlistSalaryInterval: string;
  shortlistSalaryMax: number | null;
  shortlistSalaryMin: number | null;
  title: string;
}

export async function processShortlistJobQueueBatch(
  db: dbClient,
  options: ProcessShortlistJobQueueBatchOptions,
): Promise<ProcessShortlistJobQueueBatchResult> {
  const limit = options.limit ?? JOB_BATCH_LIMIT;
  const jobs = await getPendingJobs(db, limit);
  const result: ProcessShortlistJobQueueBatchResult = {
    selected: jobs.length,
    completed: 0,
    duplicates: 0,
    failed: 0,
    retried: 0,
  };

  logger.info({ count: jobs.length }, "Selected shortlist source jobs");

  for (const job of jobs) {
    const status = await processQueueJob(db, job, options);

    if (status === SHORTLIST_JOB_STATUSES.COMPLETED) result.completed += 1;
    if (status === SHORTLIST_JOB_STATUSES.DUPLICATE) result.duplicates += 1;
    if (status === SHORTLIST_JOB_STATUSES.FAILED) result.failed += 1;
    if (status === SHORTLIST_JOB_STATUSES.RETRY) result.retried += 1;
  }

  return result;
}

async function getPendingJobs(
  db: dbClient,
  limit: number,
): Promise<QueueJobRow[]> {
  return db.transaction(async (tx) => {
    const staleLockBefore = new Date(Date.now() - 15 * 60 * 1000);
    const jobs = await tx
      .select({
        id: shortlistJobQueue.id,
        attempts: shortlistJobQueue.attempts,
        boardId: shortlistJobQueue.boardId,
        createdAt: shortlistJobQueue.createdAt,
        createdBy: shortlistJobQueue.createdBy,
        maxAttempts: shortlistJobQueue.maxAttempts,
        payloadJson: shortlistJobQueue.payloadJson,
        processingLog: shortlistJobQueue.processingLog,
        sourceId: shortlistJobQueue.sourceId,
        sourceType: shortlistJobQueue.sourceType,
        timeZone: users.shortlistTimezone,
      })
      .from(shortlistJobQueue)
      .innerJoin(users, eq(shortlistJobQueue.createdBy, users.id))
      .where(
        and(
          or(
            inArray(shortlistJobQueue.status, [
              SHORTLIST_JOB_STATUSES.PENDING,
              SHORTLIST_JOB_STATUSES.RETRY,
            ]),
            and(
              eq(shortlistJobQueue.status, SHORTLIST_JOB_STATUSES.PROCESSING),
              lt(shortlistJobQueue.lockedAt, staleLockBefore),
            ),
          ),
          lte(shortlistJobQueue.runAfter, new Date()),
        ),
      )
      .orderBy(
        asc(shortlistJobQueue.runAfter),
        asc(shortlistJobQueue.createdAt),
      )
      .limit(limit)
      .for("update", { skipLocked: true });

    if (jobs.length > 0) {
      await tx
        .update(shortlistJobQueue)
        .set({
          attempts: sql`${shortlistJobQueue.attempts} + 1`,
          lockedAt: new Date(),
          lockedBy: `shortlist-queue-worker:${process.pid}`,
          status: SHORTLIST_JOB_STATUSES.PROCESSING,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            shortlistJobQueue.id,
            jobs.map((job) => job.id),
          ),
        );
    }

    return jobs;
  });
}

async function processQueueJob(
  db: dbClient,
  job: QueueJobRow,
  options: ProcessShortlistJobQueueBatchOptions,
): Promise<QueueProcessingStatus> {
  const attempt = job.attempts + 1;
  let incompleteCreatedCardId: number | null = null;
  const uploadedCardObjectKeys: string[] = [];
  const log = createProcessingLog(job.processingLog, [
    `Attempt ${attempt} started.`,
    `Source type: ${job.sourceType}`,
    `Source id: ${job.sourceId}`,
  ]);

  try {
    await ensureShortlistRobotUser(db);

    const board = await getBoard(db, job.boardId, job.sourceType);

    if (!board) {
      return finishJobWithStatus(db, job, {
        attempt,
        log,
        message: `Board ${job.boardId} was not found.`,
        status: SHORTLIST_JOB_STATUSES.FAILED,
      });
    }

    const savedList = await getSavedList(db, job.boardId);

    if (!savedList) {
      return finishJobWithStatus(db, job, {
        attempt,
        log,
        message: `List "${SAVED_LIST_NAME}" was not found in board ${board.publicId}.`,
        status: SHORTLIST_JOB_STATUSES.FAILED,
      });
    }

    const sourceContent = await getClassificationSourceContent(db, job);
    const existingLink = await findLinkedCard(db, job);
    const llmRequestLimit = options.accountDailyRequestLimit ?? 250;
    const dayStart = getUtcDayStart();
    if (
      (await countDailyAccountProviderRequests(
        db,
        job.createdBy,
        PROVIDERS.LLM,
        dayStart,
      )) >= llmRequestLimit
    ) {
      if (existingLink) {
        await addLlmLimitNotice(
          db,
          existingLink.cardId,
          job.createdBy,
          dayStart,
        );
      }
      return deferJobForDailyLimit(db, job, {
        log,
        message: "This account has reached its daily LLM classification limit.",
      });
    }
    const timeZone = normalizeUserTimeZone(job.timeZone);
    const classification =
      job.sourceType === SHORTLIST_SOURCE_TYPES.EMAIL
        ? await classifyEmailSourcesIndependently({
            apiKey: options.apiKey,
            classifySource: (classificationInput) =>
              runTrackedLlmRequest(
                db,
                job,
                existingLink?.cardId ?? null,
                "OPPORTUNITY_FACTS_CLASSIFICATION",
                {
                  model: options.model,
                  sourceRole: classificationInput.sourceRole,
                },
                llmRequestLimit,
                () => classifyOpportunityFactsContent(classificationInput),
              ),
            existingTitle: existingLink?.card.title ?? null,
            model: options.model,
            sourceContent,
            timeZone,
          })
        : await runTrackedLlmRequest(
            db,
            job,
            existingLink?.cardId ?? null,
            "JOB_POSTING_CLASSIFICATION",
            { model: options.model, sourceType: job.sourceType },
            llmRequestLimit,
            () =>
              classifyJobPostingContent({
                apiKey: options.apiKey,
                model: options.model,
                htmlContent: sourceContent.content,
                sourceUrl: sourceContent.sourceUrl,
                clippedAt: sourceContent.clippedAt,
                contentKind: sourceContent.contentKind,
                timeZone,
              }),
          );

    let processingLog = appendLog(
      log,
      `LLM classification finished using ${classification.model}.`,
    );

    if (!classification.classification.isJobOpportunity) {
      await finishJob(db, job.id, {
        attempts: attempt,
        error: classification.classification.rejectionReason,
        processingLog: appendLog(
          processingLog,
          `Classification rejected this source: ${classification.classification.rejectionReason}`,
        ),
        status: SHORTLIST_JOB_STATUSES.FAILED,
      });

      return SHORTLIST_JOB_STATUSES.FAILED;
    }

    const cardInput = buildCardInput(
      classification.classification,
      sourceContent.sourceUrl,
      job.sourceType,
    );
    processingLog = appendLog(
      processingLog,
      `Prepared card "${cardInput.title}" for Saved list.`,
    );

    const duplicate = existingLink
      ? {
          cardId: existingLink.cardId,
          cardPublicId: existingLink.cardPublicId,
          reason: "same email thread",
          matchType: "EMAIL_THREAD",
        }
      : await findDuplicateCard(
          db,
          job.boardId,
          sourceContent.sourceUrl,
          sourceContent.contentHash,
          classification.classification,
        );

    if (duplicate) {
      await linkSourceProviderRequestsToCard(db, job.id, duplicate.cardId);
      const updateResult = await enrichDuplicateCard(db, {
        classification: classification.classification,
        duplicate,
        job,
        sourceContent,
        uploadedCardObjectKeys,
      });

      await finishJob(db, job.id, {
        attempts: attempt,
        error: null,
        processingLog: appendLog(
          processingLog,
          `${updateResult.changedFields.length > 0 ? "Updated" : "Linked"} card ${duplicate.cardPublicId}: ${duplicate.reason}.`,
        ),
        status:
          updateResult.changedFields.length > 0
            ? SHORTLIST_JOB_STATUSES.COMPLETED
            : SHORTLIST_JOB_STATUSES.DUPLICATE,
      });

      return updateResult.changedFields.length > 0
        ? SHORTLIST_JOB_STATUSES.COMPLETED
        : SHORTLIST_JOB_STATUSES.DUPLICATE;
    }

    const createdCard = await cardRepo.create(db, {
      ...cardInput,
      createdBy: SHORTLIST_ROBOT_USER.id,
      listId: savedList.id,
      workspaceId: board.workspaceId,
      position: "end",
    });
    incompleteCreatedCardId = createdCard.id;

    await linkSourceProviderRequestsToCard(db, job.id, createdCard.id);

    await addRobotProcessingHistory(db, {
      boardWorkspaceId: board.workspaceId,
      cardId: createdCard.id,
      cardPublicId: createdCard.publicId,
      job,
      sourceContent,
      uploadedCardObjectKeys,
    });

    await linkSourceToCard(db, {
      cardId: createdCard.id,
      classification: classification.classification,
      contentHash: sourceContent.contentHash,
      job,
      matchType: "CREATED",
      provenance: sourceContent.provenance,
    });
    incompleteCreatedCardId = null;

    await finishJob(db, job.id, {
      attempts: attempt,
      error: null,
      processingLog: appendLog(
        processingLog,
        `Created card ${createdCard.publicId} in "${SAVED_LIST_NAME}".`,
      ),
      status: SHORTLIST_JOB_STATUSES.COMPLETED,
    });

    return SHORTLIST_JOB_STATUSES.COMPLETED;
  } catch (error) {
    const attachmentsBucket = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME;
    if (attachmentsBucket && incompleteCreatedCardId) {
      await Promise.all(
        uploadedCardObjectKeys.map((s3Key) =>
          deleteObject(attachmentsBucket, s3Key).catch((cleanupError) => {
            logger.error(
              { error: formatError(cleanupError), s3Key },
              "Failed to clean up an incomplete card attachment object",
            );
          }),
        ),
      );
    }
    if (incompleteCreatedCardId) {
      try {
        await cardRepo.softDelete(db, {
          cardId: incompleteCreatedCardId,
          deletedAt: new Date(),
          deletedBy: SHORTLIST_ROBOT_USER.id,
        });
      } catch (cleanupError) {
        logger.error(
          {
            cardId: incompleteCreatedCardId,
            error: formatError(cleanupError),
          },
          "Failed to hide an incompletely audited shortlist card",
        );
      }
    }

    if (error instanceof DailyProviderLimitError) {
      return deferJobForDailyLimit(db, job, {
        log,
        message: formatError(error),
      });
    }

    const shouldRetry = shouldRetryJob(
      attempt,
      job.maxAttempts,
      options.retryLimit,
    );
    const status = shouldRetry
      ? SHORTLIST_JOB_STATUSES.RETRY
      : SHORTLIST_JOB_STATUSES.FAILED;
    const errorMessage = formatError(error);

    await finishJob(db, job.id, {
      attempts: attempt,
      error: errorMessage,
      processingLog: appendLog(
        log,
        `${shouldRetry ? "Retrying" : "Failed permanently"} after error: ${errorMessage}`,
      ),
      status,
    });

    logger.error(
      {
        error: errorMessage,
        errorDetails: serializeError(error),
        jobId: job.id,
        status,
      },
      "Shortlist job failed",
    );

    return status;
  }
}

async function runTrackedLlmRequest<T>(
  db: dbClient,
  job: QueueJobRow,
  cardId: number | null,
  endpoint: string,
  requestJson: unknown,
  accountDailyRequestLimit: number,
  operation: () => Promise<T>,
): Promise<T> {
  const dayStart = getUtcDayStart();
  if (
    (await countDailyAccountProviderRequests(
      db,
      job.createdBy,
      PROVIDERS.LLM,
      dayStart,
    )) >= accountDailyRequestLimit
  ) {
    if (cardId !== null) {
      await addLlmLimitNotice(db, cardId, job.createdBy, dayStart);
    }
    throw new DailyProviderLimitError(
      "This account has reached its daily LLM classification limit.",
    );
  }

  const historyId = await beginProviderRequest(db, {
    accountId: job.createdBy,
    cardId,
    endpoint,
    provider: PROVIDERS.LLM,
    requestJson,
    sourceJobId: job.id,
  });
  try {
    const result = await operation();
    await completeProviderRequest(db, historyId, { completed: true });
    return result;
  } catch (error) {
    await failProviderRequest(db, historyId, formatError(error));
    throw error;
  }
}

class DailyProviderLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyProviderLimitError";
  }
}

async function getClassificationSourceContent(
  db: dbClient,
  job: QueueJobRow,
): Promise<ClassificationSourceContent> {
  const objects = await db
    .select({
      bucket: shortlistSourceObjects.bucket,
      contentType: shortlistSourceObjects.contentType,
      fileSize: shortlistSourceObjects.fileSize,
      metadataJson: shortlistSourceObjects.metadataJson,
      objectType: shortlistSourceObjects.objectType,
      originalFilename: shortlistSourceObjects.originalFilename,
      s3Key: shortlistSourceObjects.s3Key,
    })
    .from(shortlistSourceObjects)
    .where(
      and(
        eq(shortlistSourceObjects.sourceType, job.sourceType),
        eq(shortlistSourceObjects.sourceId, job.sourceId),
      ),
    )
    .orderBy(
      asc(shortlistSourceObjects.createdAt),
      asc(shortlistSourceObjects.id),
    );

  const selectedObjects = selectClassifiableObjects(job.sourceType, objects);

  if (selectedObjects.length === 0) {
    throw new Error(`No classifiable object found for source ${job.sourceId}`);
  }

  const extractedObjects: ExtractedSourceObject[] = [];
  for (const selected of selectedObjects) {
    let buffer: Buffer;
    try {
      buffer = await getObjectBuffer(
        selected.sourceObject.bucket,
        selected.sourceObject.s3Key,
      );
    } catch (error) {
      extractedObjects.push({
        buffer: null,
        content: null,
        role: selected.role,
        sourceObject: selected.sourceObject,
        warning: `Download failed: ${formatError(error)}`,
      });
      continue;
    }
    let content: string | null = null;
    let warning: string | null = null;

    if (selected.shouldExtract) {
      try {
        content = await extractSourceText({
          buffer,
          contentType: selected.sourceObject.contentType,
          filename: selected.sourceObject.originalFilename,
        });
      } catch (error) {
        warning = formatError(error);
      }
    }

    extractedObjects.push({
      buffer,
      content,
      role: selected.role,
      sourceObject: selected.sourceObject,
      warning,
    });
  }

  const usableObjects = extractedObjects.filter(
    (object): object is ExtractedSourceObject & { content: string } =>
      !!object.content?.trim(),
  );
  if (usableObjects.length === 0) {
    const errors = extractedObjects
      .map((object) => object.warning)
      .filter(Boolean)
      .join("; ");
    throw new Error(
      errors || `No text could be extracted from source ${job.sourceId}`,
    );
  }

  const webpage =
    job.sourceType === SHORTLIST_SOURCE_TYPES.WEBPAGE
      ? await getWebpageSource(db, job.sourceId)
      : null;

  const orderedObjects = [...usableObjects].sort(
    (left, right) =>
      sourceRolePriority(left.role) - sourceRolePriority(right.role),
  );
  const content = orderedObjects
    .map(
      (object) =>
        `<section><h2>SOURCE: ${object.role} (${escapeHtml(object.sourceObject.originalFilename)})</h2><pre>${escapeHtml(object.content)}</pre></section>`,
    )
    .join("\n");

  const contentHash = createHash("sha256");
  for (const object of extractedObjects) {
    if (object.buffer) contentHash.update(object.buffer);
  }

  return {
    clippedAt: job.createdAt,
    content,
    contentKind:
      job.sourceType === SHORTLIST_SOURCE_TYPES.EMAIL ? "email" : "webpage",
    contentHash: contentHash.digest("hex"),
    currentEmailContent:
      orderedObjects.find((object) => object.role === "CURRENT_EMAIL")
        ?.content ?? null,
    provenance: orderedObjects.reduce<Record<string, string[]>>(
      (provenance, object) => {
        (provenance[object.role] ??= []).push(
          object.sourceObject.originalFilename,
        );
        return provenance;
      },
      {},
    ),
    sourceObjects: extractedObjects,
    sourceUrl: webpage?.url ?? getPayloadSourceUrl(job.payloadJson),
  };
}

interface ClassifiedEmailSource {
  facts: OpportunityFacts;
  filename: string;
  model: string;
  rawResponse: unknown;
  role: "ATTACHMENT" | "CURRENT_EMAIL" | "QUOTED_HISTORY";
  warnings: string[];
}

const MERGEABLE_FACT_FIELDS = [
  "jobTitle",
  "jobTitleNormalized",
  "jobTitleDisplay",
  "jobTitleBroader",
  "jobTitleAtoms",
  "salaryLookupTitles",
  "companyName",
  "companyWebsiteUrl",
  "companyHQ",
  "sourceJobId",
  "requisitionId",
  "postingStatus",
  "description",
  "salaryMin",
  "salaryMax",
  "salarySingle",
  "salaryCurrency",
  "salaryPeriod",
  "salarySource",
  "salaryOriginalText",
  "workSchedule",
  "engagementType",
  "engagementTypeSource",
  "locationType",
  "jobLocations",
  "remoteLocationRestriction",
  "applicationDeadline",
  "interviewDateTime",
  "contactsJson",
  "equityMentioned",
] as const satisfies readonly (keyof OpportunityFacts)[];

export async function classifyEmailSourcesIndependently(input: {
  apiKey: string;
  classifySource?: (
    input: Parameters<typeof classifyOpportunityFactsContent>[0],
  ) => ReturnType<typeof classifyOpportunityFactsContent>;
  existingTitle: string | null;
  model: string;
  sourceContent: ClassificationSourceContent;
  timeZone: string;
}) {
  const sources = input.sourceContent.sourceObjects.filter(
    (
      source,
    ): source is ExtractedSourceObject & {
      content: string;
      role: ClassifiedEmailSource["role"];
    } =>
      !!source.content?.trim() &&
      (source.role === "CURRENT_EMAIL" ||
        source.role === "ATTACHMENT" ||
        source.role === "QUOTED_HISTORY"),
  );
  const classified: ClassifiedEmailSource[] = [];
  const classificationErrors: string[] = [];

  const classificationResults = await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await (
          input.classifySource ?? classifyOpportunityFactsContent
        )({
          apiKey: input.apiKey,
          model: input.model,
          htmlContent: source.content,
          sourceUrl: input.sourceContent.sourceUrl,
          clippedAt: input.sourceContent.clippedAt,
          contentKind: "email",
          sourceRole: source.role,
          timeZone: input.timeZone,
        });
        return {
          classified: {
            facts: result.facts,
            filename: source.sourceObject.originalFilename,
            model: result.model,
            rawResponse: result.rawResponse,
            role: source.role,
            warnings: result.warnings,
          } satisfies ClassifiedEmailSource,
          error: null,
        };
      } catch (error) {
        return {
          classified: null,
          error: `${source.sourceObject.originalFilename}: ${formatError(error)}`,
        };
      }
    }),
  );

  for (const result of classificationResults) {
    if (result.classified) classified.push(result.classified);
    if (result.error) classificationErrors.push(result.error);
  }

  if (classified.length === 0 && classificationErrors.length > 0) {
    throw new Error(
      `Every email source classification failed: ${classificationErrors.join("; ")}`,
    );
  }

  const classification = mergeOpportunityFactsDeterministically(
    classified,
    input.existingTitle,
  );

  return {
    classification,
    model: classified.map((source) => source.model).join(", ") || input.model,
    rawResponse: classified.map((source) => source.rawResponse),
    warnings: [
      ...classified.flatMap((source) => source.warnings),
      ...classificationErrors,
    ],
  };
}

export function mergeOpportunityFactsDeterministically(
  sources: ClassifiedEmailSource[],
  existingTitle: string | null,
): JobPostingClassification {
  const relevant = sources.filter((source) => source.facts.isRelevant);
  if (relevant.length === 0) {
    return {
      isJobOpportunity: false,
      pageType: "OTHER",
      rejectionReason:
        sources.find((source) => source.facts.rejectionReason)?.facts
          .rejectionReason ?? "The email contains no job-opportunity facts.",
    };
  }

  const history = relevant.filter((source) => source.role === "QUOTED_HISTORY");
  const current = relevant.filter((source) => source.role === "CURRENT_EMAIL");
  const attachments = relevant.filter((source) => source.role === "ATTACHMENT");
  const merged: Partial<OpportunityFacts> = {};

  // Lowest to highest priority. Reversing supplemental attachments makes the
  // earliest attachment win while still keeping quoted history at the bottom.
  for (const source of history) assignFacts(merged, source.facts, "fill");
  for (const source of attachments.slice(1).reverse()) {
    assignFacts(merged, source.facts, "overwrite");
  }
  for (const source of current) assignFacts(merged, source.facts, "overwrite");
  if (attachments[0]) assignFacts(merged, attachments[0].facts, "overwrite");

  const explicitCorrections = new Set(
    current.flatMap((source) => source.facts.explicitCorrections),
  );
  for (const field of explicitCorrections) {
    if (!isMergeableFactField(field)) continue;
    const correctingSource = current.find((source) =>
      hasFactValue(source.facts[field]),
    );
    if (correctingSource)
      merged[field] = correctingSource.facts[field] as never;
  }

  merged.description = mergeSourceDescriptions(
    attachments,
    current,
    history,
    explicitCorrections.has("description"),
  );
  merged.contactsJson = mergeSourceArrays(
    relevant.flatMap((source) => source.facts.contactsJson ?? []),
  ) as OpportunityFacts["contactsJson"];
  merged.jobLocations = mergeSourceArrays(
    relevant.flatMap((source) => source.facts.jobLocations ?? []),
  ) as string[];

  const jobTitle =
    (typeof merged.jobTitle === "string" && merged.jobTitle.trim()
      ? merged.jobTitle
      : null) ?? existingTitle;
  if (!jobTitle?.trim()) {
    return {
      isJobOpportunity: false,
      pageType: "OTHER",
      rejectionReason:
        "The combined email sources did not contain a job title and were not linked to an existing opportunity.",
    };
  }

  const fieldEvidence = relevant.flatMap((source) =>
    MERGEABLE_FACT_FIELDS.filter((field) =>
      hasFactValue(source.facts[field]),
    ).map((field) => ({
      field,
      quote:
        source.facts.fieldEvidence.find((evidence) => evidence.field === field)
          ?.quote ?? null,
      source: source.role,
    })),
  );

  return jobPostingSuccessSchema.parse({
    ...merged,
    explicitCorrections: [...explicitCorrections],
    fieldEvidence,
    isJobOpportunity: true,
    jobTitle,
    pageType: "JOB_POSTING",
  });
}

function assignFacts(
  target: Partial<OpportunityFacts>,
  source: OpportunityFacts,
  mode: "fill" | "overwrite",
) {
  for (const field of MERGEABLE_FACT_FIELDS) {
    const value = source[field];
    if (!hasFactValue(value)) continue;
    if (mode === "fill" && hasFactValue(target[field])) continue;
    target[field] = value as never;
  }
}

function hasFactValue(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function isMergeableFactField(
  field: string,
): field is (typeof MERGEABLE_FACT_FIELDS)[number] {
  return (MERGEABLE_FACT_FIELDS as readonly string[]).includes(field);
}

function mergeSourceDescriptions(
  attachments: ClassifiedEmailSource[],
  current: ClassifiedEmailSource[],
  history: ClassifiedEmailSource[],
  currentExplicitlyCorrectsDescription: boolean,
): string | undefined {
  const ordered = currentExplicitlyCorrectsDescription
    ? current
    : [...attachments, ...current, ...history];
  const descriptions = ordered
    .map((source) => source.facts.description?.trim())
    .filter((description): description is string => !!description);
  const unique: string[] = [];
  for (const description of descriptions) {
    if (
      unique.some(
        (existing) =>
          normalizeText(existing).includes(normalizeText(description)) ||
          normalizeText(description).includes(normalizeText(existing)),
      )
    ) {
      continue;
    }
    unique.push(description);
  }
  return unique.length > 0 ? unique.join("\n\n") : undefined;
}

function mergeSourceArrays(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalizeText(JSON.stringify(value));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function selectClassifiableObjects(
  sourceType: string,
  objects: SourceObjectForClassification[],
): {
  role: ExtractedSourceObject["role"];
  shouldExtract: boolean;
  sourceObject: SourceObjectForClassification;
}[] {
  if (sourceType === SHORTLIST_SOURCE_TYPES.EMAIL) {
    const current = objects.find(
      (object) =>
        object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_CURRENT,
    );
    const html = objects.find(
      (object) =>
        object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_HTML,
    );
    const text = objects.find(
      (object) =>
        object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_TEXT,
    );
    const body = current ?? html ?? text;

    const selected = objects
      .filter(
        (object) =>
          object === body ||
          (current !== undefined && object === html) ||
          object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_EML ||
          object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
      )
      .map((object) => ({
        role:
          object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE
            ? ("ATTACHMENT" as const)
            : object === body
              ? ("CURRENT_EMAIL" as const)
              : ("QUOTED_HISTORY" as const),
        shouldExtract:
          object.objectType !== SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_EML ||
          !body,
        sourceObject: object,
      }));
    const attachments = selected
      .filter((source) => source.role === "ATTACHMENT")
      .sort(
        (left, right) =>
          getSourceObjectOrder(left.sourceObject.metadataJson) -
          getSourceObjectOrder(right.sourceObject.metadataJson),
      );
    let attachmentIndex = 0;

    return selected.map((source) => {
      if (source.role !== "ATTACHMENT") return source;
      return attachments[attachmentIndex++] ?? source;
    });
  }

  const object = objects.find((candidate) =>
    sourceType === SHORTLIST_SOURCE_TYPES.WEBPAGE
      ? candidate.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.WEBPAGE_HTML
      : candidate.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
  );

  return object
    ? [
        {
          role:
            sourceType === SHORTLIST_SOURCE_TYPES.ATTACHMENT
              ? "ATTACHMENT"
              : "SOURCE",
          shouldExtract: true,
          sourceObject: object,
        },
      ]
    : [];
}

function getSourceObjectOrder(metadata: unknown): number {
  if (!metadata || typeof metadata !== "object") {
    return Number.MAX_SAFE_INTEGER;
  }
  const value = (metadata as Record<string, unknown>)["source-order"];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0
    ? parsed
    : Number.MAX_SAFE_INTEGER;
}

function sourceRolePriority(role: ExtractedSourceObject["role"]): number {
  if (role === "CURRENT_EMAIL") return 0;
  if (role === "ATTACHMENT") return 1;
  if (role === "QUOTED_HISTORY") return 2;
  return 1;
}

async function getWebpageSource(db: dbClient, sourceId: string) {
  return db.query.shortlistWebpageSources.findFirst({
    columns: { url: true },
    where: eq(shortlistWebpageSources.id, sourceId),
  });
}

function getPayloadSourceUrl(payload: unknown): string | null {
  if (
    payload &&
    typeof payload === "object" &&
    "sourceUrl" in payload &&
    typeof payload.sourceUrl === "string"
  ) {
    return payload.sourceUrl;
  }

  return null;
}

async function ensureShortlistRobotUser(db: dbClient) {
  await db
    .insert(users)
    .values({
      id: SHORTLIST_ROBOT_USER.id,
      name: SHORTLIST_ROBOT_USER.name,
      email: SHORTLIST_ROBOT_USER.email,
      emailVerified: true,
      image: SHORTLIST_ROBOT_USER.image,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: SHORTLIST_ROBOT_USER.name,
        email: SHORTLIST_ROBOT_USER.email,
        emailVerified: true,
        image: SHORTLIST_ROBOT_USER.image,
        updatedAt: new Date(),
      },
    });
}

async function addRobotProcessingHistory(
  db: dbClient,
  args: {
    boardWorkspaceId: number;
    cardId: number;
    cardPublicId: string;
    job: QueueJobRow;
    sourceContent: ClassificationSourceContent;
    uploadedCardObjectKeys: string[];
  },
) {
  const sourceFiles = getSourceFilesForCard(args.sourceContent.sourceObjects);
  const filenames = sourceFiles.map((source) =>
    getDisplayFilename(source.sourceObject),
  );
  const intakeLabel = getSourceIntakeLabel(args.job.sourceType);

  await createRobotCommentActivity(
    db,
    args.cardId,
    `Received ${filenames.join(", ")} via ${intakeLabel}`,
  );

  await createRobotCommentActivity(
    db,
    args.cardId,
    `Processed ${args.sourceContent.sourceObjects.filter((source) => source.content).length} source part(s) into opportunity information`,
  );

  const attachedFilenames: string[] = [];
  for (const source of sourceFiles) {
    const filename = getDisplayFilename(source.sourceObject);
    const attachment = await attachOriginalSourceFile(db, {
      buffer: source.buffer,
      cardId: args.cardId,
      cardPublicId: args.cardPublicId,
      contentType: source.sourceObject.contentType,
      filename,
      fileSize: source.sourceObject.fileSize,
      workspaceId: args.boardWorkspaceId,
      onUploaded: (s3Key) => args.uploadedCardObjectKeys.push(s3Key),
    });
    attachedFilenames.push(attachment.originalFilename);
  }

  await createRobotCommentActivity(
    db,
    args.cardId,
    `Original source${attachedFilenames.length === 1 ? "" : "s"}: ${attachedFilenames.join(", ")}`,
  );

  const warnings = args.sourceContent.sourceObjects.filter(
    (source) => source.warning,
  );
  if (warnings.length > 0) {
    await createRobotCommentActivity(
      db,
      args.cardId,
      `Some source files could not be parsed: ${warnings
        .map(
          (source) =>
            `${source.sourceObject.originalFilename} (${source.warning})`,
        )
        .join(", ")}`,
    );
  }
}

function getSourceFilesForCard(
  sources: ExtractedSourceObject[],
): (ExtractedSourceObject & { buffer: Buffer })[] {
  const downloadedSources = sources.filter(
    (source): source is ExtractedSourceObject & { buffer: Buffer } =>
      source.buffer !== null,
  );
  const eml = sources.find(
    (source) =>
      source.sourceObject.objectType ===
      SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_EML,
  );
  const attachments = downloadedSources.filter(
    (source) =>
      source.sourceObject.objectType ===
      SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
  );

  if (eml?.buffer) return [{ ...eml, buffer: eml.buffer }, ...attachments];
  if (attachments.length > 0) {
    const body = downloadedSources.find(
      (source) => source.role === "CURRENT_EMAIL",
    );
    return body ? [body, ...attachments] : attachments;
  }

  return downloadedSources
    .filter((source) => source.role !== "QUOTED_HISTORY")
    .slice(0, 1);
}

async function createRobotCommentActivity(
  db: dbClient,
  cardId: number,
  text: string,
) {
  const comment = await cardCommentRepo.create(db, {
    cardId,
    comment: `<p>${escapeHtml(text)}</p>`,
    createdBy: SHORTLIST_ROBOT_USER.id,
    shortlistIsSystem: true,
  });

  if (!comment?.id) {
    throw new Error("Failed to create shortlist robot comment");
  }

  await cardActivityRepo.create(db, {
    type: "card.updated.comment.added",
    cardId,
    commentId: comment.id,
    toComment: comment.comment,
    createdBy: SHORTLIST_ROBOT_USER.id,
  });

  logger.info(
    {
      cardId,
      commentId: comment.id,
      text,
    },
    "Shortlist robot comment created",
  );
}

const LLM_LIMIT_COMMENT =
  "Your account has reached its daily automated classification limit. This source will be retried tomorrow. If you need a higher limit, contact us at support@shortlistos.co.";

async function addLlmLimitNotice(
  db: dbClient,
  cardId: number,
  accountId: string,
  dayStart: Date,
) {
  const shouldCreate = await recordDailyProviderLimitNotice(db, {
    accountId,
    cardId,
    provider: PROVIDERS.LLM,
    since: dayStart,
  });
  if (shouldCreate) {
    await createRobotCommentActivity(db, cardId, LLM_LIMIT_COMMENT);
  }
}

async function attachOriginalSourceFile(
  db: dbClient,
  args: {
    buffer: Buffer;
    cardId: number;
    cardPublicId: string;
    contentType: string;
    filename: string;
    fileSize: number;
    workspaceId: number;
    onUploaded?: (s3Key: string) => void;
  },
) {
  const bucket = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME;

  if (!bucket) {
    throw new Error("Attachments bucket is not configured");
  }

  const sanitizedFilename = sanitizeFilename(args.filename);
  const s3Key = `${args.workspaceId}/${args.cardPublicId}/${generateUID()}-${sanitizedFilename}`;

  await putObject(bucket, s3Key, args.buffer, args.contentType);
  args.onUploaded?.(s3Key);

  const attachment = await cardAttachmentRepo.create(db, {
    cardId: args.cardId,
    filename: sanitizedFilename,
    originalFilename: truncateFilename(args.filename),
    contentType: args.contentType,
    size: args.fileSize,
    s3Key,
    createdBy: SHORTLIST_ROBOT_USER.id,
  });

  if (!attachment?.id) {
    throw new Error("Failed to create original source attachment");
  }

  await cardActivityRepo.create(db, {
    type: "card.updated.attachment.added",
    cardId: args.cardId,
    attachmentId: attachment.id,
    toTitle: attachment.originalFilename,
    createdBy: SHORTLIST_ROBOT_USER.id,
  });

  logger.info(
    {
      attachmentId: attachment.id,
      bucket,
      cardId: args.cardId,
      filename: attachment.originalFilename,
      s3Key,
    },
    "Attached original shortlist source file to card",
  );

  return attachment;
}

function getSourceIntakeLabel(sourceType: string) {
  if (sourceType === SHORTLIST_SOURCE_TYPES.ATTACHMENT) return "Upload";
  if (sourceType === SHORTLIST_SOURCE_TYPES.EMAIL) return "Email";
  if (sourceType === SHORTLIST_SOURCE_TYPES.WEBPAGE) return "Web clipper";

  return sourceType;
}

function getDisplayFilename(sourceObject: SourceObjectForClassification) {
  const metadataFilename = getMetadataFilename(sourceObject.metadataJson);
  return truncateFilename(metadataFilename ?? sourceObject.originalFilename);
}

function getMetadataFilename(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const metadataRecord = metadata as Record<string, unknown>;

  for (const key of [
    "originalFilename",
    "original-filename",
    "fileOriginalFilename",
  ]) {
    if (typeof metadataRecord[key] === "string") {
      const value = metadataRecord[key];
      if (value.trim()) return value.trim();
    }
  }

  return null;
}

function sanitizeFilename(filename: string) {
  return truncateFilename(filename.replace(/[^a-zA-Z0-9._-]/g, "_"));
}

function truncateFilename(filename: string) {
  return (filename.trim() || "file").substring(0, 200);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function finishJobWithStatus(
  db: dbClient,
  job: QueueJobRow,
  values: {
    attempt: number;
    log: string;
    message: string;
    status: QueueProcessingStatus;
  },
) {
  await finishJob(db, job.id, {
    attempts: values.attempt,
    error: values.message,
    processingLog: appendLog(values.log, values.message),
    status: values.status,
  });

  return values.status;
}

async function deferJobForDailyLimit(
  db: dbClient,
  job: QueueJobRow,
  values: { log: string; message: string },
): Promise<QueueProcessingStatus> {
  const tomorrowUtc = new Date(
    getUtcDayStart().getTime() + 24 * 60 * 60 * 1_000,
  );
  await db
    .update(shortlistJobQueue)
    .set({
      attempts: job.attempts,
      error: values.message,
      lockedAt: null,
      lockedBy: null,
      processedAt: null,
      processingLog: appendLog(
        values.log,
        `${values.message} Deferred until ${tomorrowUtc.toISOString()}.`,
      ),
      runAfter: tomorrowUtc,
      status: SHORTLIST_JOB_STATUSES.RETRY,
      updatedAt: new Date(),
    })
    .where(eq(shortlistJobQueue.id, job.id));
  return SHORTLIST_JOB_STATUSES.RETRY;
}

async function finishJob(
  db: dbClient,
  jobId: string,
  values: {
    attempts: number;
    error: string | null;
    processingLog: string;
    status: QueueProcessingStatus;
  },
) {
  await db
    .update(shortlistJobQueue)
    .set({
      attempts: values.attempts,
      error: values.error,
      lockedAt: null,
      lockedBy: null,
      processedAt:
        values.status === SHORTLIST_JOB_STATUSES.RETRY ? null : new Date(),
      processingLog: values.processingLog,
      runAfter:
        values.status === SHORTLIST_JOB_STATUSES.RETRY
          ? new Date(Date.now() + getJobRetryDelayMs(values.attempts))
          : new Date(),
      status: values.status,
      updatedAt: new Date(),
    })
    .where(eq(shortlistJobQueue.id, jobId));
}

export function shouldRetryJob(
  attempt: number,
  maxAttempts: number,
  configuredRetryLimit: number,
): boolean {
  return attempt < Math.min(maxAttempts, configuredRetryLimit);
}

export function getJobRetryDelayMs(attempt: number): number {
  return Math.min(60_000, 2 ** attempt * 1_000);
}

export function normalizeUserTimeZone(timeZone: string): string {
  const trimmed = timeZone.trim();
  if (!trimmed) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format();
    return trimmed;
  } catch {
    return "UTC";
  }
}

async function getBoard(
  db: dbClient,
  boardId: number,
  sourceType: QueueJobRow["sourceType"],
) {
  const [board] = await db
    .select({
      id: boards.id,
      publicId: boards.publicId,
      workspaceId: boards.workspaceId,
    })
    .from(boards)
    .innerJoin(users, eq(boards.createdBy, users.id))
    .where(
      and(
        eq(boards.id, boardId),
        eq(boards.isArchived, false),
        isNull(boards.deletedAt),
        lte(users.shortlistPowerpackActivatedAt, new Date()),
        gte(users.shortlistPowerpackExpiresAt, new Date()),
        sourceType === SHORTLIST_SOURCE_TYPES.EMAIL
          ? eq(boards.shortlistIsMagicInboxEnabled, true)
          : undefined,
      ),
    )
    .limit(1);
  return board;
}

async function getSavedList(db: dbClient, boardId: number) {
  return db.query.lists.findFirst({
    columns: {
      id: true,
      publicId: true,
    },
    where: and(
      eq(lists.boardId, boardId),
      eq(lists.name, SAVED_LIST_NAME),
      isNull(lists.deletedAt),
    ),
  });
}

function buildCardInput(
  classification: Extract<JobPostingClassification, { isJobOpportunity: true }>,
  sourceUrl: string | null,
  sourceType: string,
) {
  const title = classification.jobTitleDisplay ?? classification.jobTitle;
  const salaryInterval = mapSalaryPeriodToCardInterval(
    classification.salaryPeriod,
  );

  return {
    title: title.trim() || "Untitled opportunity",
    description: appendImportedOpportunityDetails(
      buildCardDescription(
        classification.description,
        classification.applicationDeadline,
      ),
      classification,
    ),
    dueDate: parseInterviewDate(classification.interviewDateTime),
    contactsJson: classification.contactsJson,
    shortlistCompanyName: classification.companyName,
    shortlistJobPostingUrl: sourceUrl,
    shortlistSalaryMin: classification.salaryMin,
    shortlistSalaryMax: classification.salaryMax,
    shortlistSalaryCurrency: classification.salaryCurrency,
    shortlistSalaryInterval: salaryInterval,
    shortlistCardSource: mapCardSource(sourceType),
    shortlistJobLocation: formatJobLocation(classification),
    shortlistJobLocationType: mapLocationType(classification.locationType),
    shortlistJobType: mapWorkSchedule(classification.workSchedule),
    shortlistCompanyLocation: classification.companyHQ,
  };
}

function parseInterviewDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function appendImportedOpportunityDetails(
  description: string,
  classification: Extract<JobPostingClassification, { isJobOpportunity: true }>,
): string {
  const details: [string, string | null][] = [
    ["Company website", classification.companyWebsiteUrl],
    ["Source job ID", classification.sourceJobId],
    ["Requisition ID", classification.requisitionId],
    [
      "Posting status",
      classification.postingStatus === "UNKNOWN"
        ? null
        : classification.postingStatus,
    ],
    ["Engagement type", classification.engagementType],
    ["Salary as published", classification.salaryOriginalText],
    ["Equity", classification.equityMentioned ? "Mentioned" : null],
  ];
  const paragraphs = details
    .filter((detail): detail is [string, string] => !!detail[1]?.trim())
    .map(
      ([label, value]) =>
        `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`,
    )
    .join("");

  return `${description}${paragraphs}`;
}

async function findDuplicateCard(
  db: dbClient,
  boardId: number,
  sourceUrl: string | null,
  contentHash: string,
  classification: Extract<JobPostingClassification, { isJobOpportunity: true }>,
): Promise<DuplicateMatch | null> {
  const sourceIdentifierMatches = await db
    .select({
      cardId: cards.id,
      cardPublicId: cards.publicId,
      classificationJson: shortlistSourceCards.classificationJson,
    })
    .from(shortlistSourceCards)
    .innerJoin(cards, eq(shortlistSourceCards.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(lists.boardId, boardId), isNull(cards.deletedAt)));
  const sourceJobId = normalizeText(classification.sourceJobId);
  const requisitionId = normalizeText(classification.requisitionId);

  for (const candidate of sourceIdentifierMatches) {
    const previous = getClassificationIdentifiers(candidate.classificationJson);
    if (
      (sourceJobId && sourceJobId === previous.sourceJobId) ||
      (requisitionId && requisitionId === previous.requisitionId)
    ) {
      return {
        cardId: candidate.cardId,
        cardPublicId: candidate.cardPublicId,
        matchType: "EXTERNAL_JOB_ID",
        reason: "same external job identifier",
      };
    }
  }

  const hashMatch = await db
    .select({ cardId: cards.id, cardPublicId: cards.publicId })
    .from(shortlistSourceCards)
    .innerJoin(cards, eq(shortlistSourceCards.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(
      and(
        eq(shortlistSourceCards.contentHash, contentHash),
        eq(lists.boardId, boardId),
        isNull(cards.deletedAt),
      ),
    )
    .limit(1);

  if (hashMatch[0]) {
    return {
      ...hashMatch[0],
      matchType: "CONTENT_HASH",
      reason: "same source content",
    };
  }

  const boardCards = await db
    .select({
      cardId: cards.id,
      cardPublicId: cards.publicId,
      title: cards.title,
      shortlistCompanyName: cards.shortlistCompanyName,
      shortlistJobLocation: cards.shortlistJobLocation,
      shortlistJobLocationType: cards.shortlistJobLocationType,
      shortlistJobPostingUrl: cards.shortlistJobPostingUrl,
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(
      and(
        eq(lists.boardId, boardId),
        isNull(lists.deletedAt),
        isNull(cards.deletedAt),
      ),
    );

  const normalizedSourceUrl = normalizeUrl(sourceUrl);
  const normalizedTitle = normalizeText(
    classification.jobTitleNormalized ??
      classification.jobTitleDisplay ??
      classification.jobTitle,
  );
  const normalizedCompany = normalizeText(classification.companyName);
  const normalizedLocation = normalizeText(formatJobLocation(classification));
  const normalizedLocationType = normalizeText(
    mapLocationType(classification.locationType),
  );

  for (const card of boardCards) {
    if (
      normalizedSourceUrl &&
      normalizeUrl(card.shortlistJobPostingUrl) === normalizedSourceUrl
    ) {
      return {
        cardId: card.cardId,
        cardPublicId: card.cardPublicId,
        matchType: "SOURCE_URL",
        reason: "same source URL",
      };
    }

    const titleMatches =
      normalizedTitle.length > 0 &&
      normalizeText(card.title) === normalizedTitle;
    const companyMatches =
      normalizedCompany.length > 0 &&
      normalizeText(card.shortlistCompanyName) === normalizedCompany;
    const locationMatches =
      (normalizedLocation.length > 0 &&
        normalizeText(card.shortlistJobLocation) === normalizedLocation) ||
      (normalizedLocationType.length > 0 &&
        normalizeText(card.shortlistJobLocationType) ===
          normalizedLocationType);

    if (titleMatches && companyMatches && locationMatches) {
      return {
        cardId: card.cardId,
        cardPublicId: card.cardPublicId,
        matchType: "IDENTITY_FIELDS",
        reason: "same title, company, and location signal",
      };
    }

    const titleSimilarity = tokenSimilarity(
      normalizedTitle,
      normalizeText(card.title),
    );
    const locationCompatible =
      locationMatches ||
      (!normalizedLocation && !normalizedLocationType) ||
      (!normalizeText(card.shortlistJobLocation) &&
        !normalizeText(card.shortlistJobLocationType));
    if (companyMatches && locationCompatible && titleSimilarity >= 0.8) {
      return {
        cardId: card.cardId,
        cardPublicId: card.cardPublicId,
        matchType: "FUZZY_IDENTITY",
        reason: `high-confidence title/company match (${Math.round(titleSimilarity * 100)}%)`,
      };
    }
  }

  return null;
}

export function tokenSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(" ").filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) =>
    rightTokens.has(token),
  );
  const union = new Set([...leftTokens, ...rightTokens]);
  return intersection.length / union.size;
}

function getClassificationIdentifiers(value: unknown): {
  requisitionId: string;
  sourceJobId: string;
} {
  if (!value || typeof value !== "object") {
    return { requisitionId: "", sourceJobId: "" };
  }
  const classification = value as Record<string, unknown>;
  return {
    requisitionId: normalizeText(
      typeof classification.requisitionId === "string"
        ? classification.requisitionId
        : null,
    ),
    sourceJobId: normalizeText(
      typeof classification.sourceJobId === "string"
        ? classification.sourceJobId
        : null,
    ),
  };
}

function mapCardSource(sourceType: string): string {
  if (sourceType === SHORTLIST_SOURCE_TYPES.EMAIL) return "EMAIL_INBOX";
  if (sourceType === SHORTLIST_SOURCE_TYPES.WEBPAGE) return "WEB_CLIPPER";
  if (sourceType === SHORTLIST_SOURCE_TYPES.ATTACHMENT) return "FILE_UPLOAD";
  return "MANUAL";
}

async function findLinkedCard(db: dbClient, job: QueueJobRow) {
  const direct = await db
    .select({
      card: cards,
      cardId: cards.id,
      cardPublicId: cards.publicId,
    })
    .from(shortlistSourceCards)
    .innerJoin(cards, eq(shortlistSourceCards.cardId, cards.id))
    .where(
      and(
        eq(shortlistSourceCards.sourceType, job.sourceType),
        eq(shortlistSourceCards.sourceId, job.sourceId),
        isNull(cards.deletedAt),
      ),
    )
    .limit(1);
  if (direct[0]) return direct[0];
  if (job.sourceType !== SHORTLIST_SOURCE_TYPES.EMAIL) return null;

  const email = await db.query.shortlistEmailSources.findFirst({
    columns: { inReplyTo: true, referencesJson: true },
    where: eq(shortlistEmailSources.id, job.sourceId),
  });
  const referencedMessageIds = [
    email?.inReplyTo,
    ...getStringArray(email?.referencesJson),
  ].filter((value): value is string => !!value);
  if (referencedMessageIds.length === 0) return null;

  const linkedCandidates = await db
    .select({
      card: cards,
      cardId: cards.id,
      cardPublicId: cards.publicId,
      externId: shortlistEmailSources.externId,
    })
    .from(shortlistEmailSources)
    .innerJoin(
      shortlistSourceCards,
      and(
        eq(shortlistSourceCards.sourceType, SHORTLIST_SOURCE_TYPES.EMAIL),
        eq(shortlistSourceCards.sourceId, shortlistEmailSources.id),
      ),
    )
    .innerJoin(cards, eq(shortlistSourceCards.cardId, cards.id))
    .where(
      and(
        eq(shortlistEmailSources.boardId, job.boardId),
        isNull(cards.deletedAt),
      ),
    );
  const normalizedReferences = new Set(
    referencedMessageIds.map(normalizeMessageId),
  );
  const linked = linkedCandidates.find((candidate) =>
    normalizedReferences.has(normalizeMessageId(candidate.externId)),
  );

  return linked ?? null;
}

function normalizeMessageId(value: string): string {
  return value.trim().toLowerCase().replace(/^<|>$/g, "");
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function enrichDuplicateCard(
  db: dbClient,
  args: {
    classification: Extract<
      JobPostingClassification,
      { isJobOpportunity: true }
    >;
    duplicate: DuplicateMatch;
    job: QueueJobRow;
    sourceContent: ClassificationSourceContent;
    uploadedCardObjectKeys: string[];
  },
) {
  const context = await db
    .select({ card: cards, workspaceId: boards.workspaceId })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(eq(cards.id, args.duplicate.cardId))
    .limit(1);
  const existing = context[0];
  if (!existing) throw new Error("Duplicate card no longer exists");

  const incoming = buildCardInput(
    args.classification,
    args.sourceContent.sourceUrl,
    args.job.sourceType,
  );
  const evidenceFields = new Set(
    args.classification.fieldEvidence
      .filter((evidence) => !evidence.source.includes("EXISTING_CARD"))
      .map((evidence) => evidence.field),
  );
  const { changedFields, patch } = buildEnrichmentPatch(
    existing.card,
    incoming,
    new Set(args.classification.explicitCorrections),
    args.duplicate.matchType === "EMAIL_THREAD" || evidenceFields.size > 0
      ? evidenceFields
      : undefined,
  );

  if (changedFields.length > 0) {
    await cardRepo.update(db, patch, {
      cardPublicId: args.duplicate.cardPublicId,
    });
    await createUpdateActivities(db, existing.card, patch, changedFields);
  }

  await addRobotProcessingHistory(db, {
    boardWorkspaceId: existing.workspaceId,
    cardId: args.duplicate.cardId,
    cardPublicId: args.duplicate.cardPublicId,
    job: args.job,
    sourceContent: args.sourceContent,
    uploadedCardObjectKeys: args.uploadedCardObjectKeys,
  });
  await createRobotCommentActivity(
    db,
    args.duplicate.cardId,
    changedFields.length > 0
      ? `Updated opportunity fields: ${changedFields.join(", ")}`
      : "This source matched the opportunity but contained no safe new field changes",
  );
  await linkSourceToCard(db, {
    cardId: args.duplicate.cardId,
    classification: args.classification,
    contentHash: args.sourceContent.contentHash,
    job: args.job,
    matchType: args.duplicate.matchType,
    provenance: args.sourceContent.provenance,
  });

  return { changedFields };
}

export function buildEnrichmentPatch(
  existing: ExistingCardSnapshot,
  incoming: ReturnType<typeof buildCardInput>,
  explicitCorrections: Set<string>,
  newInformationFields?: Set<string>,
) {
  const patch: Parameters<typeof cardRepo.update>[1] = {};
  const changedFields: string[] = [];
  if (existing.manualUpdatedOnly) return { changedFields, patch };

  const add = <K extends keyof typeof patch>(
    key: K,
    label: string,
    current: (typeof existing)[keyof typeof existing],
    next: (typeof patch)[K],
    classificationField: string,
  ) => {
    if (
      newInformationFields &&
      !newInformationFields.has(classificationField)
    ) {
      return;
    }
    const currentEmpty =
      current === null || current === undefined || current === "";
    const nextEmpty = next === null || next === undefined || next === "";
    if (nextEmpty || Object.is(current, next)) return;
    if (!currentEmpty && !explicitCorrections.has(classificationField)) return;
    patch[key] = next;
    changedFields.push(label);
  };

  add("title", "Title", existing.title, incoming.title, "jobTitle");
  add(
    "dueDate",
    "Interview date",
    existing.dueDate,
    incoming.dueDate,
    "interviewDateTime",
  );
  add(
    "shortlistCompanyName",
    "Company name",
    existing.shortlistCompanyName,
    incoming.shortlistCompanyName,
    "companyName",
  );
  add(
    "shortlistJobPostingUrl",
    "Job URL",
    existing.shortlistJobPostingUrl,
    incoming.shortlistJobPostingUrl,
    "sourceUrl",
  );
  add(
    "shortlistSalaryMin",
    "Minimum salary",
    existing.shortlistSalaryMin,
    incoming.shortlistSalaryMin,
    "salaryMin",
  );
  add(
    "shortlistSalaryMax",
    "Maximum salary",
    existing.shortlistSalaryMax,
    incoming.shortlistSalaryMax,
    "salaryMax",
  );
  add(
    "shortlistSalaryCurrency",
    "Salary currency",
    existing.shortlistSalaryCurrency,
    incoming.shortlistSalaryCurrency,
    "salaryCurrency",
  );
  add(
    "shortlistSalaryInterval",
    "Salary interval",
    existing.shortlistSalaryInterval,
    incoming.shortlistSalaryInterval,
    "salaryPeriod",
  );
  add(
    "shortlistJobLocation",
    "Job location",
    existing.shortlistJobLocation,
    incoming.shortlistJobLocation,
    "jobLocations",
  );
  add(
    "shortlistJobLocationType",
    "Location type",
    existing.shortlistJobLocationType,
    incoming.shortlistJobLocationType,
    "locationType",
  );
  add(
    "shortlistJobType",
    "Contract",
    existing.shortlistJobType,
    incoming.shortlistJobType,
    "workSchedule",
  );
  add(
    "shortlistCompanyLocation",
    "Company HQ",
    existing.shortlistCompanyLocation,
    incoming.shortlistCompanyLocation,
    "companyHQ",
  );

  if (!newInformationFields || newInformationFields.has("description")) {
    const mergedDescription = mergeDescription(
      existing.description,
      incoming.description,
    );
    if (mergedDescription !== existing.description) {
      patch.description = mergedDescription;
      changedFields.push("Description");
    }
  }
  if (!newInformationFields || newInformationFields.has("contactsJson")) {
    const mergedContacts = mergeContacts(
      existing.contactsJson,
      incoming.contactsJson,
    );
    if (
      JSON.stringify(mergedContacts) !==
      JSON.stringify(existing.contactsJson ?? [])
    ) {
      patch.contactsJson = mergedContacts;
      changedFields.push("Contacts");
    }
  }

  return { changedFields, patch };
}

export function mergeDescription(
  current: string | null,
  incoming: string,
): string {
  if (!incoming.trim()) return current ?? "";
  if (!current?.trim()) return incoming;
  if (normalizeText(current).includes(normalizeText(incoming))) return current;
  return `${current}\n\n<p><strong>Additional imported information</strong></p>\n${incoming}`;
}

export function mergeContacts(current: unknown, incoming: unknown): unknown[] {
  const currentContacts: unknown[] = Array.isArray(current)
    ? (current as unknown[])
    : [];
  const incomingContacts: unknown[] = Array.isArray(incoming)
    ? (incoming as unknown[])
    : [];
  const seen = new Set(
    currentContacts.map((contact) => normalizeText(JSON.stringify(contact))),
  );
  return [
    ...currentContacts,
    ...incomingContacts.filter((contact) => {
      const key = normalizeText(JSON.stringify(contact));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

async function createUpdateActivities(
  db: dbClient,
  existing: ExistingCardSnapshot & { id: number },
  patch: Parameters<typeof cardRepo.update>[1],
  changedFields: string[],
) {
  const activities = changedFields.map((field) => {
    if (field === "Title") {
      return {
        type: "card.updated.title" as const,
        cardId: existing.id,
        createdBy: SHORTLIST_ROBOT_USER.id,
        fromTitle: existing.title,
        toTitle: patch.title,
      };
    }
    if (field === "Description") {
      return {
        type: "card.updated.description" as const,
        cardId: existing.id,
        createdBy: SHORTLIST_ROBOT_USER.id,
        fromDescription: existing.description ?? undefined,
        toDescription: patch.description,
      };
    }
    if (field === "Interview date") {
      return {
        type: existing.dueDate
          ? ("card.updated.dueDate.updated" as const)
          : ("card.updated.dueDate.added" as const),
        cardId: existing.id,
        createdBy: SHORTLIST_ROBOT_USER.id,
        fromDueDate: existing.dueDate ?? undefined,
        toDueDate: patch.dueDate ?? undefined,
      };
    }
    const key = activityFieldToCardKey(field);
    return {
      type: "card.updated.shortlistField" as const,
      cardId: existing.id,
      createdBy: SHORTLIST_ROBOT_USER.id,
      fromTitle: field,
      fromDescription: stringifyActivityValue(key ? existing[key] : null),
      toDescription: stringifyActivityValue(key ? patch[key] : null),
    };
  });
  await cardActivityRepo.bulkCreate(db, activities);
}

function activityFieldToCardKey(
  field: string,
): keyof ExistingCardSnapshot | null {
  const keys: Record<string, keyof ExistingCardSnapshot> = {
    "Company name": "shortlistCompanyName",
    "Job URL": "shortlistJobPostingUrl",
    "Minimum salary": "shortlistSalaryMin",
    "Maximum salary": "shortlistSalaryMax",
    "Salary currency": "shortlistSalaryCurrency",
    "Salary interval": "shortlistSalaryInterval",
    "Job location": "shortlistJobLocation",
    "Location type": "shortlistJobLocationType",
    Contract: "shortlistJobType",
    "Company HQ": "shortlistCompanyLocation",
    Contacts: "contactsJson",
  };
  return keys[field] ?? null;
}

function stringifyActivityValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function linkSourceToCard(
  db: dbClient,
  args: {
    cardId: number;
    classification: Extract<
      JobPostingClassification,
      { isJobOpportunity: true }
    >;
    contentHash: string;
    job: QueueJobRow;
    matchType: string;
    provenance: Record<string, string[]>;
  },
) {
  await db
    .insert(shortlistSourceCards)
    .values({
      cardId: args.cardId,
      classificationJson: args.classification,
      contentHash: args.contentHash,
      fieldProvenanceJson: {
        fields: args.classification.fieldEvidence,
        sources: args.provenance,
      },
      matchType: args.matchType,
      sourceId: args.job.sourceId,
      sourceType: args.job.sourceType,
    })
    .onConflictDoUpdate({
      target: [shortlistSourceCards.sourceType, shortlistSourceCards.sourceId],
      set: {
        cardId: args.cardId,
        classificationJson: args.classification,
        contentHash: args.contentHash,
        fieldProvenanceJson: {
          fields: args.classification.fieldEvidence,
          sources: args.provenance,
        },
        matchType: args.matchType,
        updatedAt: new Date(),
      },
    });
}

function createProcessingLog(
  currentLog: string | null,
  entries: string[],
): string {
  return entries.reduce(
    (log, entry) => appendLog(log, entry),
    currentLog?.trim() ?? "",
  );
}

function appendLog(currentLog: string, entry: string): string {
  const line = `[${new Date().toISOString()}] ${entry}`;

  return currentLog ? `${currentLog}\n${line}` : line;
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;

  return String(error);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  return Object.fromEntries(
    Object.getOwnPropertyNames(error).map((propertyName) => [
      propertyName,
      (error as unknown as Record<string, unknown>)[propertyName],
    ]),
  );
}

function normalizeText(value: string | null | undefined): string {
  return value
    ? value
        .trim()
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function normalizeUrl(value: string | null | undefined): string {
  if (!value) return "";

  try {
    const url = new URL(value);
    url.hash = "";

    for (const param of Array.from(url.searchParams.keys())) {
      if (param.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(param);
      }
    }

    url.hostname = url.hostname.toLowerCase();

    return url.toString().replace(/\/$/, "");
  } catch {
    return normalizeText(value);
  }
}

function formatJobLocation(
  classification: Extract<JobPostingClassification, { isJobOpportunity: true }>,
): string | null {
  if (classification.jobLocations.length > 0) {
    return classification.jobLocations.join(", ");
  }

  return classification.remoteLocationRestriction;
}

function mapLocationType(value: string | null): string | null {
  if (value === "REMOTE") return "remote";
  if (value === "HYBRID") return "hybrid";
  if (value === "ON_SITE") return "onsite";

  return null;
}

function mapWorkSchedule(value: string | null): string {
  if (value === "PART_TIME") return "PART_TIME";

  return "FULL_TIME";
}

function mapSalaryPeriodToCardInterval(value: string | null): string {
  if (value === "ANNUAL") return "PER_YEAR";
  if (value === "MONTHLY") return "PER_MONTH";
  if (value === "WEEKLY") return "PER_WEEK";
  if (value === "DAILY") return "PER_DAY";
  if (value === "HOURLY") return "PER_HOUR";

  return "PER_MONTH";
}
