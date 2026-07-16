/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-15
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { and, asc, eq, inArray, isNull, lte } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import * as cardAttachmentRepo from "@kan/db/repository/cardAttachment.repo";
import * as cardCommentRepo from "@kan/db/repository/cardComment.repo";
import * as cardRepo from "@kan/db/repository/card.repo";
import {
  boards,
  cards,
  lists,
  shortlistJobQueue,
  shortlistSourceObjects,
  shortlistWebpageSources,
  users,
} from "@kan/db/schema";
import type { JobPostingClassification } from "@kan/llm";
import { classifyJobPostingContent } from "@kan/llm";
import { createLogger } from "@kan/logger";
import {
  SHORTLIST_JOB_STATUSES,
  SHORTLIST_ROBOT_USER,
  SHORTLIST_SOURCE_OBJECT_TYPES,
  SHORTLIST_SOURCE_TYPES,
} from "@kan/shared/constants";
import { generateUID, getObjectBuffer, putObject } from "@kan/shared/utils";

import { extractSourceText } from "../utils/extract-source-text";

const logger = createLogger("shortlist-worker:source-queue-worker");

const JOB_BATCH_LIMIT = 25;
const SAVED_LIST_NAME = "Saved";

type QueueProcessingStatus =
  (typeof SHORTLIST_JOB_STATUSES)[keyof typeof SHORTLIST_JOB_STATUSES];

interface ProcessShortlistJobQueueBatchOptions {
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
}

interface ClassificationSourceContent {
  clippedAt: Date;
  content: string;
  contentKind: "email" | "webpage";
  sourceObject: SourceObjectForClassification;
  sourceObjectBuffer: Buffer;
  sourceUrl: string | null;
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
  return db
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
    })
    .from(shortlistJobQueue)
    .where(
      and(
        inArray(shortlistJobQueue.status, [
          SHORTLIST_JOB_STATUSES.PENDING,
          SHORTLIST_JOB_STATUSES.RETRY,
        ]),
        lte(shortlistJobQueue.runAfter, new Date()),
      ),
    )
    .orderBy(asc(shortlistJobQueue.runAfter), asc(shortlistJobQueue.createdAt))
    .limit(limit);
}

async function processQueueJob(
  db: dbClient,
  job: QueueJobRow,
  options: ProcessShortlistJobQueueBatchOptions,
): Promise<QueueProcessingStatus> {
  const attempt = job.attempts + 1;
  const log = createProcessingLog(job.processingLog, [
    `Attempt ${attempt} started.`,
    `Source type: ${job.sourceType}`,
    `Source id: ${job.sourceId}`,
  ]);

  await markJobProcessing(db, job.id, attempt);

  try {
    await ensureShortlistRobotUser(db);

    const board = await getBoard(db, job.boardId);

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
    const classification = await classifyJobPostingContent({
      apiKey: options.apiKey,
      model: options.model,
      htmlContent: sourceContent.content,
      sourceUrl: sourceContent.sourceUrl,
      clippedAt: sourceContent.clippedAt,
      contentKind: sourceContent.contentKind,
    });

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
    );
    processingLog = appendLog(
      processingLog,
      `Prepared card "${cardInput.title}" for Saved list.`,
    );

    const duplicate = await findDuplicateCard(
      db,
      job.boardId,
      sourceContent.sourceUrl,
      classification.classification,
    );

    if (duplicate) {
      await finishJob(db, job.id, {
        attempts: attempt,
        error: duplicate.reason,
        processingLog: appendLog(
          processingLog,
          `Duplicate of card ${duplicate.cardPublicId}: ${duplicate.reason}.`,
        ),
        status: SHORTLIST_JOB_STATUSES.DUPLICATE,
      });

      return SHORTLIST_JOB_STATUSES.DUPLICATE;
    }

    const createdCard = await cardRepo.create(db, {
      ...cardInput,
      createdBy: SHORTLIST_ROBOT_USER.id,
      listId: savedList.id,
      workspaceId: board.workspaceId,
      position: "end",
    });

    await addRobotProcessingHistory(db, {
      boardWorkspaceId: board.workspaceId,
      cardId: createdCard.id,
      cardPublicId: createdCard.publicId,
      job,
      sourceContent,
    });

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
    const shouldRetry = attempt < Math.min(job.maxAttempts, options.retryLimit);
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
    );

  const sourceObject = selectClassifiableObject(job.sourceType, objects);

  if (!sourceObject) {
    throw new Error(`No classifiable object found for source ${job.sourceId}`);
  }

  const buffer = await getObjectBuffer(sourceObject.bucket, sourceObject.s3Key);
  const webpage = job.sourceType === SHORTLIST_SOURCE_TYPES.WEBPAGE
    ? await getWebpageSource(db, job.sourceId)
    : null;

  return {
    clippedAt: job.createdAt,
    content: await extractSourceText({
      buffer,
      contentType: sourceObject.contentType,
      filename: sourceObject.originalFilename,
    }),
    contentKind:
      job.sourceType === SHORTLIST_SOURCE_TYPES.EMAIL ? "email" : "webpage",
    sourceObject,
    sourceObjectBuffer: buffer,
    sourceUrl: webpage?.url ?? getPayloadSourceUrl(job.payloadJson),
  };
}

function selectClassifiableObject(
  sourceType: string,
  objects: {
    bucket: string;
    contentType: string;
    fileSize: number;
    metadataJson: unknown;
    objectType: string;
    originalFilename: string;
    s3Key: string;
  }[],
) {
  if (sourceType === SHORTLIST_SOURCE_TYPES.EMAIL) {
    return (
      objects.find(
        (object) =>
          object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_HTML,
      ) ??
      objects.find(
        (object) =>
          object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_TEXT,
      ) ??
      objects.find(
        (object) =>
          object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_EML,
      ) ??
      objects.find(
        (object) =>
          object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
      )
    );
  }

  return objects.find((object) =>
    sourceType === SHORTLIST_SOURCE_TYPES.WEBPAGE
      ? object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.WEBPAGE_HTML
      : object.objectType === SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
  );
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
  },
) {
  const filename = getDisplayFilename(args.sourceContent.sourceObject);
  const intakeLabel = getSourceIntakeLabel(args.job.sourceType);

  await createRobotCommentActivity(
    db,
    args.cardId,
    `Received ${filename} via ${intakeLabel}`,
  );

  await createRobotCommentActivity(
    db,
    args.cardId,
    `Converted ${filename} into a job opportunity`,
  );

  const attachment = await attachOriginalSourceFile(db, {
    buffer: args.sourceContent.sourceObjectBuffer,
    cardId: args.cardId,
    cardPublicId: args.cardPublicId,
    contentType: args.sourceContent.sourceObject.contentType,
    filename,
    fileSize: args.sourceContent.sourceObject.fileSize,
    workspaceId: args.boardWorkspaceId,
  });

  await createRobotCommentActivity(
    db,
    args.cardId,
    `Original file: ${attachment.originalFilename}`,
  );
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
  },
) {
  const bucket = process.env.NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME;

  if (!bucket) {
    throw new Error("Attachments bucket is not configured");
  }

  const sanitizedFilename = sanitizeFilename(args.filename);
  const s3Key = `${args.workspaceId}/${args.cardPublicId}/${generateUID()}-${sanitizedFilename}`;

  await putObject(bucket, s3Key, args.buffer, args.contentType);

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

async function markJobProcessing(
  db: dbClient,
  jobId: string,
  attempts: number,
) {
  await db
    .update(shortlistJobQueue)
    .set({
      attempts,
      lockedAt: new Date(),
      lockedBy: "shortlist-worker",
      status: SHORTLIST_JOB_STATUSES.PROCESSING,
      updatedAt: new Date(),
    })
    .where(eq(shortlistJobQueue.id, jobId));
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
      status: values.status,
      updatedAt: new Date(),
    })
    .where(eq(shortlistJobQueue.id, jobId));
}

async function getBoard(db: dbClient, boardId: number) {
  return db.query.boards.findFirst({
    columns: {
      id: true,
      publicId: true,
      workspaceId: true,
    },
    where: and(eq(boards.id, boardId), isNull(boards.deletedAt)),
  });
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
) {
  const title = classification.jobTitleDisplay ?? classification.jobTitle;
  const salaryInterval = mapSalaryPeriodToCardInterval(
    classification.salaryPeriod,
  );

  return {
    title: title?.trim() ?? "Untitled opportunity",
    description: classification.description ?? "",
    dueDate: parseDate(classification.applicationDeadline),
    contactsJson: classification.contactsJson,
    shortlistCompanyName: classification.companyName,
    shortlistJobPostingUrl: sourceUrl,
    shortlistSalaryMin: classification.salaryMin,
    shortlistSalaryMax: classification.salaryMax,
    shortlistSalaryCurrency: classification.salaryCurrency,
    shortlistSalaryInterval: salaryInterval,
    shortlistCardSource: "MAGIC_CLIP",
    shortlistJobLocation: formatJobLocation(classification),
    shortlistJobLocationType: mapLocationType(classification.locationType),
    shortlistJobType: mapWorkSchedule(classification.workSchedule),
    shortlistCompanyLocation: classification.companyHQ,
  };
}

async function findDuplicateCard(
  db: dbClient,
  boardId: number,
  sourceUrl: string | null,
  classification: Extract<JobPostingClassification, { isJobOpportunity: true }>,
): Promise<DuplicateMatch | null> {
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
        reason: "same source URL",
      };
    }

    const titleMatches =
      normalizedTitle.length > 0 && normalizeText(card.title) === normalizedTitle;
    const companyMatches =
      normalizedCompany.length > 0 &&
      normalizeText(card.shortlistCompanyName) === normalizedCompany;
    const locationMatches =
      (normalizedLocation.length > 0 &&
        normalizeText(card.shortlistJobLocation) === normalizedLocation) ||
      (normalizedLocationType.length > 0 &&
        normalizeText(card.shortlistJobLocationType) === normalizedLocationType);

    if (titleMatches && companyMatches && locationMatches) {
      return {
        cardId: card.cardId,
        cardPublicId: card.cardPublicId,
        reason: "same title, company, and location signal",
      };
    }
  }

  return null;
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

function parseDate(value: string | null): Date | null {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
