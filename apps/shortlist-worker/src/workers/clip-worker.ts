/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-24
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import * as cardRepo from "@kan/db/repository/card.repo";
import {
  boards,
  cards,
  lists,
  shortlistClips,
} from "@kan/db/schema";
import {
  classifyJobPostingContent,
} from "@kan/llm";
import type { JobPostingClassification } from "@kan/llm";
import { createLogger } from "@kan/logger";

const logger = createLogger("shortlist-worker:clip-worker");

const CLIP_BATCH_LIMIT = 25;
const SAVED_LIST_NAME = "Saved";

const CLIP_PROCESSING_RESULTS = {
  COMPLETED: "COMPLETED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  RETRY: "RETRY",
} as const;

type ClipProcessingResult =
  (typeof CLIP_PROCESSING_RESULTS)[keyof typeof CLIP_PROCESSING_RESULTS];

interface ProcessClipBatchOptions {
  apiKey: string;
  model: string;
  retryLimit: number;
  limit?: number;
}

interface ProcessClipBatchResult {
  selected: number;
  completed: number;
  duplicates: number;
  failed: number;
  retried: number;
}

interface ClipRow {
  id: string;
  createdBy: string;
  boardId: number;
  url: string;
  rawHtml: string;
  createdAt: Date;
  processingTries: number;
  processingLog: string | null;
}

interface DuplicateMatch {
  cardId: number;
  cardPublicId: string;
  reason: string;
}

export async function processClipBatch(
  db: dbClient,
  options: ProcessClipBatchOptions,
): Promise<ProcessClipBatchResult> {
  const limit = options.limit ?? CLIP_BATCH_LIMIT;
  const clips = await getPendingClips(db, limit);
  const result: ProcessClipBatchResult = {
    selected: clips.length,
    completed: 0,
    duplicates: 0,
    failed: 0,
    retried: 0,
  };

  logger.info({
    count: clips.length,
  }, "Selected shortlist clips for processing");

  for (const clip of clips) {
    const status = await processClip(db, clip, options);

    if (status === CLIP_PROCESSING_RESULTS.COMPLETED) result.completed += 1;
    if (status === CLIP_PROCESSING_RESULTS.DUPLICATE) result.duplicates += 1;
    if (status === CLIP_PROCESSING_RESULTS.FAILED) result.failed += 1;
    if (status === CLIP_PROCESSING_RESULTS.RETRY) result.retried += 1;
  }

  return result;
}

async function getPendingClips(
  db: dbClient,
  limit: number,
): Promise<ClipRow[]> {
  return db
    .select({
      id: shortlistClips.id,
      createdBy: shortlistClips.createdBy,
      boardId: shortlistClips.boardId,
      url: shortlistClips.url,
      rawHtml: shortlistClips.rawHtml,
      createdAt: shortlistClips.createdAt,
      processingTries: shortlistClips.processingTries,
      processingLog: shortlistClips.processingLog,
    })
    .from(shortlistClips)
    .where(
      or(
        isNull(shortlistClips.processingResult),
        eq(shortlistClips.processingResult, CLIP_PROCESSING_RESULTS.RETRY),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${shortlistClips.processingResult} IS NULL THEN 0 ELSE 1 END`,
      asc(shortlistClips.createdAt),
    )
    .limit(limit);
}

async function processClip(
  db: dbClient,
  clip: ClipRow,
  options: ProcessClipBatchOptions,
): Promise<ClipProcessingResult> {
  const attempt = clip.processingTries + 1;
  const log = createProcessingLog(clip.processingLog, [
    `Attempt ${attempt} started.`,
    `Clip URL: ${clip.url}`,
    `Clipped at: ${clip.createdAt.toISOString()}`,
  ]);

  logger.info({
    clipId: clip.id,
    boardId: clip.boardId,
    attempt,
  }, "Processing shortlist clip");

  try {
    const board = await getBoard(db, clip.boardId);

    if (!board) {
      await finishClip(db, clip.id, {
        processingTries: attempt,
        processingResult: CLIP_PROCESSING_RESULTS.FAILED,
        processingLog: appendLog(log, `Board ${clip.boardId} was not found.`),
      });
      return CLIP_PROCESSING_RESULTS.FAILED;
    }

    const savedList = await getSavedList(db, clip.boardId);

    if (!savedList) {
      await finishClip(db, clip.id, {
        processingTries: attempt,
        processingResult: CLIP_PROCESSING_RESULTS.FAILED,
        processingLog: appendLog(
          log,
          `List "${SAVED_LIST_NAME}" was not found in board ${board.publicId}.`,
        ),
      });
      return CLIP_PROCESSING_RESULTS.FAILED;
    }

    const classification = await classifyJobPostingContent({
      apiKey: options.apiKey,
      model: options.model,
      htmlContent: clip.rawHtml,
      sourceUrl: clip.url,
      clippedAt: clip.createdAt,
    });

    let processingLog = appendLog(
      log,
      `LLM classification finished using ${classification.model}.`,
    );

    if (!classification.classification.isJobOpportunity) {
      await finishClip(db, clip.id, {
        processingTries: attempt,
        processingResult: CLIP_PROCESSING_RESULTS.FAILED,
        processingLog: appendLog(
          processingLog,
          `Classification rejected this clip: ${classification.classification.rejectionReason}`,
        ),
      });
      return CLIP_PROCESSING_RESULTS.FAILED;
    }

    const cardInput = buildCardInput(classification.classification, clip);
    processingLog = appendLog(
      processingLog,
      `Prepared card "${cardInput.title}" for Saved list.`,
    );

    const duplicate = await findDuplicateCard(
      db,
      clip.boardId,
      clip.url,
      classification.classification,
    );

    if (duplicate) {
      await finishClip(db, clip.id, {
        processingTries: attempt,
        processingResult: CLIP_PROCESSING_RESULTS.DUPLICATE,
        processingLog: appendLog(
          processingLog,
          `Duplicate of card ${duplicate.cardPublicId}: ${duplicate.reason}.`,
        ),
      });
      return CLIP_PROCESSING_RESULTS.DUPLICATE;
    }

    const createdCard = await cardRepo.create(db, {
      ...cardInput,
      createdBy: clip.createdBy,
      listId: savedList.id,
      workspaceId: board.workspaceId,
      position: "end",
    });

    await finishClip(db, clip.id, {
      processingTries: attempt,
      processingResult: CLIP_PROCESSING_RESULTS.COMPLETED,
      processingLog: appendLog(
        processingLog,
        `Created card ${createdCard.publicId} in "${SAVED_LIST_NAME}".`,
      ),
    });

    return CLIP_PROCESSING_RESULTS.COMPLETED;
  } catch (error) {
    const shouldRetry = attempt < options.retryLimit;
    const processingResult = shouldRetry
      ? CLIP_PROCESSING_RESULTS.RETRY
      : CLIP_PROCESSING_RESULTS.FAILED;

    await finishClip(db, clip.id, {
      processingTries: attempt,
      processingResult,
      processingLog: appendLog(
        log,
        `${shouldRetry ? "Retrying" : "Failed permanently"} after error: ${formatError(error)}`,
      ),
    });

    logger.error({
      clipId: clip.id,
      processingResult,
      error,
    }, "Shortlist clip processing failed");

    return processingResult;
  }
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
  clip: ClipRow,
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
    shortlistJobPostingUrl: clip.url,
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
  sourceUrl: string,
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

async function finishClip(
  db: dbClient,
  clipId: string,
  values: {
    processingTries: number;
    processingResult: ClipProcessingResult;
    processingLog: string;
  },
) {
  await db
    .update(shortlistClips)
    .set({
      processedAt: new Date(),
      processingTries: values.processingTries,
      processingLog: values.processingLog,
      processingResult: values.processingResult,
      updatedAt: new Date(),
    })
    .where(eq(shortlistClips.id, clipId));
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
