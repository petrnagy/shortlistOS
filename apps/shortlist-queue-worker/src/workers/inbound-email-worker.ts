import { createHash } from "node:crypto";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { ensureShortlistRobotUser } from "@kan/db/repository/shortlistActivityLog.repo";
import {
  shortlistActivityLogs,
  shortlistEmailSources,
  shortlistInboundEmailJobs,
  shortlistJobQueue,
  shortlistSourceObjects,
} from "@kan/db/schema";
import { createLogger } from "@kan/logger";
import {
  isSupportedShortlistAttachment,
  SHORTLIST_JOB_STATUSES,
  SHORTLIST_JOB_TYPES,
  SHORTLIST_ROBOT_USER,
  SHORTLIST_SOURCE_OBJECT_TYPES,
  SHORTLIST_SOURCE_TYPES,
} from "@kan/shared/constants";
import { putObject } from "@kan/shared/utils";

const logger = createLogger("shortlist-queue-worker:inbound-email-worker");
const BREVO_ATTACHMENT_DOWNLOAD_BASE_URL =
  "https://api.brevo.com/v3/inbound/attachments";
const MAX_BATCH_SIZE = 20;
const MAX_RETRY_DELAY_MS = 5 * 60_000;
const STALE_LOCK_MS = 3 * 60_000;
const REQUEST_TIMEOUT_MS = 20_000;

interface BrevoMailbox {
  Address?: string;
  Name?: string;
}

interface BrevoAttachment {
  Name?: string;
  ContentType?: string;
  ContentLength?: number;
  Content?: string;
  Base64Content?: string;
  DownloadToken?: string;
  DownloadUrl?: string;
  Url?: string;
}

interface BrevoInboundEmail {
  Uuid?: string[];
  MessageId?: string;
  From?: BrevoMailbox;
  SentAtDate?: string;
  Subject?: string;
  RawHtmlBody?: string;
  RawTextBody?: string;
  RawEmailBody?: string;
  RawMime?: string;
  ExtractedMarkdownMessage?: string;
  SpamScore?: number;
  Attachments?: BrevoAttachment[];
  Headers?: Record<string, string | string[]> | string[];
}

interface InboundJob {
  id: string;
  idempotencyKey: string;
  externId: string;
  createdBy: string;
  boardId: number;
  boardPublicId: string;
  payloadJson: unknown;
  sourceId: string | null;
  attempts: number;
  maxAttempts: number;
}

interface ProcessInboundEmailBatchOptions {
  apiKey?: string;
  bucket: string;
  limit?: number;
  workerId?: string;
}

export interface ProcessInboundEmailBatchResult {
  selected: number;
  completed: number;
  failed: number;
  retried: number;
}

class InboundEmailError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly statusCode?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "InboundEmailError";
  }
}

export async function processInboundEmailBatch(
  db: dbClient,
  options: ProcessInboundEmailBatchOptions,
): Promise<ProcessInboundEmailBatchResult> {
  const workerId = options.workerId ?? `inbound-${process.pid}`;
  const jobs = await claimInboundEmailJobs(db, options, workerId);
  const result: ProcessInboundEmailBatchResult = {
    selected: jobs.length,
    completed: 0,
    failed: 0,
    retried: 0,
  };

  for (const job of jobs) {
    logger.info(
      { jobId: job.id, attempt: job.attempts, status: "PROCESSING" },
      "Processing inbound magic inbox email",
    );
    try {
      await processInboundEmail(db, job, options);
      const completed = await completeJob(db, job, workerId);
      if (completed) {
        result.completed += 1;
        logger.info(
          { jobId: job.id, attempt: job.attempts, status: "COMPLETED" },
          "Completed inbound magic inbox email",
        );
      }
    } catch (error) {
      const failure = normalizeFailure(error);
      const retry = shouldRetry(job, failure);
      const runAfter = retry
        ? new Date(Date.now() + retryDelay(job.attempts, failure))
        : null;
      await db
        .update(shortlistInboundEmailJobs)
        .set({
          status: retry ? "RETRY" : "FAILED",
          lastError: failure.message,
          lockedAt: null,
          lockedBy: null,
          runAfter: runAfter ?? new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(shortlistInboundEmailJobs.id, job.id),
            eq(shortlistInboundEmailJobs.status, "PROCESSING"),
            eq(shortlistInboundEmailJobs.lockedBy, workerId),
          ),
        );

      if (retry) result.retried += 1;
      else result.failed += 1;

      logger.warn(
        {
          jobId: job.id,
          attempt: job.attempts,
          status: retry ? "RETRY" : "FAILED",
          error: failure.message,
          errorType: error instanceof Error ? error.name : "UnknownError",
          retryAt: runAfter?.toISOString() ?? null,
        },
        "Inbound magic inbox email processing failed",
      );
    }
  }

  return result;
}

export function getInboundRetryDelayMs(
  attempts: number,
  retryAfterMs?: number,
  randomValue = Math.random(),
): number {
  if (retryAfterMs !== undefined) {
    return Math.max(0, retryAfterMs);
  }
  const base = Math.min(
    MAX_RETRY_DELAY_MS,
    1_000 * 2 ** Math.max(0, attempts - 1),
  );
  const jitter = 0.75 + Math.min(1, Math.max(0, randomValue)) * 0.5;
  return Math.min(MAX_RETRY_DELAY_MS, Math.round(base * jitter));
}

async function claimInboundEmailJobs(
  db: dbClient,
  options: ProcessInboundEmailBatchOptions,
  workerId: string,
): Promise<InboundJob[]> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_LOCK_MS);
  return db.transaction(async (tx) => {
    const jobs = await tx
      .select({
        id: shortlistInboundEmailJobs.id,
        idempotencyKey: shortlistInboundEmailJobs.idempotencyKey,
        externId: shortlistInboundEmailJobs.externId,
        createdBy: shortlistInboundEmailJobs.createdBy,
        boardId: shortlistInboundEmailJobs.boardId,
        boardPublicId: shortlistInboundEmailJobs.boardPublicId,
        payloadJson: shortlistInboundEmailJobs.payloadJson,
        sourceId: shortlistInboundEmailJobs.sourceId,
        attempts: shortlistInboundEmailJobs.attempts,
        maxAttempts: shortlistInboundEmailJobs.maxAttempts,
      })
      .from(shortlistInboundEmailJobs)
      .where(
        and(
          lte(shortlistInboundEmailJobs.runAfter, now),
          or(
            eq(shortlistInboundEmailJobs.status, "PENDING"),
            eq(shortlistInboundEmailJobs.status, "RETRY"),
            and(
              eq(shortlistInboundEmailJobs.status, "PROCESSING"),
              lte(shortlistInboundEmailJobs.lockedAt, staleBefore),
            ),
          ),
        ),
      )
      .orderBy(asc(shortlistInboundEmailJobs.runAfter))
      .limit(Math.min(MAX_BATCH_SIZE, options.limit ?? MAX_BATCH_SIZE))
      .for("update", { skipLocked: true });

    for (const job of jobs) {
      await tx
        .update(shortlistInboundEmailJobs)
        .set({
          attempts: sql`${shortlistInboundEmailJobs.attempts} + 1`,
          lockedAt: now,
          lockedBy: workerId,
          status: "PROCESSING",
          updatedAt: now,
        })
        .where(eq(shortlistInboundEmailJobs.id, job.id));
      job.attempts += 1;
    }
    return jobs;
  });
}

async function processInboundEmail(
  db: dbClient,
  job: InboundJob,
  options: ProcessInboundEmailBatchOptions,
) {
  const email = parseEmail(job.payloadJson);
  if (!email.MessageId || email.MessageId !== job.externId) {
    throw new InboundEmailError(
      "Stored email is missing its stable MessageId.",
      false,
    );
  }
  const bodyObjects = getEmailBodyObjects(email);
  if (bodyObjects.length === 0) {
    throw new InboundEmailError(
      "Stored email has no supported body content.",
      false,
    );
  }

  const attachments = (email.Attachments ?? []).filter(
    (attachment) =>
      !!attachment.Name && isSupportedShortlistAttachment(attachment.Name),
  );
  const [insertedSource] = await db
    .insert(shortlistEmailSources)
    .values({
      createdBy: job.createdBy,
      boardId: job.boardId,
      externId: job.externId,
      fromEmail: email.From?.Address ?? null,
      fromName: email.From?.Name ?? null,
      hasSupportedAttachment: attachments.length > 0,
      inReplyTo: getEmailHeader(email, "in-reply-to"),
      metadataJson: {
        brevoUuid: email.Uuid ?? null,
        boardPublicId: job.boardPublicId,
        inboundJobId: job.id,
        spamScore: email.SpamScore ?? null,
      },
      referencesJson: parseMessageIdList(getEmailHeader(email, "references")),
      sentAt: parseBrevoDate(email.SentAtDate),
      subject: email.Subject ?? null,
    })
    .onConflictDoNothing({
      target: [shortlistEmailSources.externId, shortlistEmailSources.boardId],
    })
    .returning({ id: shortlistEmailSources.id });
  let sourceId = insertedSource?.id ?? job.sourceId;
  if (!sourceId) {
    const [existing] = await db
      .select({ id: shortlistEmailSources.id })
      .from(shortlistEmailSources)
      .where(
        and(
          eq(shortlistEmailSources.externId, job.externId),
          eq(shortlistEmailSources.boardId, job.boardId),
        ),
      )
      .limit(1);
    sourceId = existing?.id ?? null;
  }
  if (!sourceId) throw new Error("Email source could not be created.");
  await db
    .update(shortlistInboundEmailJobs)
    .set({ sourceId, updatedAt: new Date() })
    .where(eq(shortlistInboundEmailJobs.id, job.id));
  job.sourceId = sourceId;

  const objectIds = new Set<string>();
  for (const [index, item] of bodyObjects.entries()) {
    const object = await storeInboundObject(db, {
      job,
      bucket: options.bucket,
      body: Buffer.from(item.content, "utf8"),
      contentType: item.contentType,
      filename: item.filename,
      objectType: item.objectType,
      sourceId,
      objectIndex: `body-${index}`,
    });
    objectIds.add(object.id);
  }

  for (const [index, attachment] of attachments.entries()) {
    const downloaded = await getAttachmentUpload(attachment, options.apiKey);
    const object = await storeInboundObject(db, {
      job,
      bucket: options.bucket,
      body: downloaded.buffer,
      contentType: downloaded.contentType,
      filename: downloaded.filename,
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
      sourceId,
      objectIndex: `attachment-${index}`,
      metadata: {
        "original-filename": sanitizeFilename(downloaded.filename),
        "source-order": String(index),
      },
    });
    objectIds.add(object.id);
  }

  const queuePayload = {
    messageId: email.MessageId,
    objectIds: [...objectIds],
    subject: email.Subject ?? null,
  };
  const [sourceJob] = await db
    .insert(shortlistJobQueue)
    .values({
      boardId: job.boardId,
      createdBy: job.createdBy,
      jobType: SHORTLIST_JOB_TYPES.CLASSIFY_SOURCE,
      payloadJson: queuePayload,
      sourceId,
      sourceType: SHORTLIST_SOURCE_TYPES.EMAIL,
      status: SHORTLIST_JOB_STATUSES.PENDING,
    })
    .onConflictDoNothing({
      target: [
        shortlistJobQueue.sourceType,
        shortlistJobQueue.sourceId,
        shortlistJobQueue.jobType,
      ],
    })
    .returning({ id: shortlistJobQueue.id });
  if (!sourceJob?.id) {
    const [existingJob] = await db
      .select({
        id: shortlistJobQueue.id,
        status: shortlistJobQueue.status,
      })
      .from(shortlistJobQueue)
      .where(
        and(
          eq(shortlistJobQueue.sourceType, SHORTLIST_SOURCE_TYPES.EMAIL),
          eq(shortlistJobQueue.sourceId, sourceId),
          eq(shortlistJobQueue.jobType, SHORTLIST_JOB_TYPES.CLASSIFY_SOURCE),
        ),
      )
      .limit(1);
    if (!existingJob)
      throw new Error("Email source processing was not queued.");
    if (existingJob.status === SHORTLIST_JOB_STATUSES.FAILED) {
      throw new InboundEmailError(
        "Existing email source processing job is failed and requires replay.",
        false,
      );
    }
  }
}

async function storeInboundObject(
  db: dbClient,
  input: {
    job: InboundJob;
    bucket: string;
    body: Buffer;
    contentType: string;
    filename: string;
    objectType: string;
    sourceId: string;
    objectIndex: string;
    metadata?: Record<string, string>;
  },
): Promise<{ id: string }> {
  const filename = sanitizeFilename(input.filename);
  const objectKeyHash = createHash("sha256")
    .update(`${input.job.idempotencyKey}\0${input.objectIndex}`)
    .digest("hex");
  const s3Key = [
    input.job.boardId,
    input.job.boardPublicId,
    "email",
    input.objectType.toLowerCase(),
    `${objectKeyHash}-${filename}`,
  ].join("/");
  const [existing] = await db
    .select({ id: shortlistSourceObjects.id })
    .from(shortlistSourceObjects)
    .where(
      and(
        eq(shortlistSourceObjects.bucket, input.bucket),
        eq(shortlistSourceObjects.s3Key, s3Key),
      ),
    )
    .limit(1);
  if (existing) return existing;

  await putObject(input.bucket, s3Key, input.body, input.contentType);
  const [object] = await db
    .insert(shortlistSourceObjects)
    .values({
      boardId: input.job.boardId,
      bucket: input.bucket,
      contentType: input.contentType,
      createdBy: input.job.createdBy,
      fileSize: input.body.byteLength,
      metadataJson: {
        "board-public-id": input.job.boardPublicId,
        "object-type": input.objectType,
        "source-id": input.sourceId,
        "source-type": SHORTLIST_SOURCE_TYPES.EMAIL,
        "uploaded-by-user-id": input.job.createdBy,
        ...(input.metadata ?? {}),
      },
      objectType: input.objectType,
      originalFilename: filename,
      s3Key,
      sourceId: input.sourceId,
      sourceType: SHORTLIST_SOURCE_TYPES.EMAIL,
    })
    .onConflictDoNothing({
      target: [shortlistSourceObjects.bucket, shortlistSourceObjects.s3Key],
    })
    .returning({ id: shortlistSourceObjects.id });
  if (object) return object;
  const [stored] = await db
    .select({ id: shortlistSourceObjects.id })
    .from(shortlistSourceObjects)
    .where(
      and(
        eq(shortlistSourceObjects.bucket, input.bucket),
        eq(shortlistSourceObjects.s3Key, s3Key),
      ),
    )
    .limit(1);
  if (!stored) throw new Error("Inbound email object metadata was not stored.");
  return stored;
}

async function completeJob(db: dbClient, job: InboundJob, workerId: string) {
  await ensureShortlistRobotUser(db);
  const email = parseEmail(job.payloadJson);
  return db.transaction(async (tx) => {
    const [completed] = await tx
      .update(shortlistInboundEmailJobs)
      .set({
        status: "COMPLETED",
        payloadJson: { MessageId: job.externId },
        completedAt: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(shortlistInboundEmailJobs.id, job.id),
          eq(shortlistInboundEmailJobs.status, "PROCESSING"),
          eq(shortlistInboundEmailJobs.lockedBy, workerId),
          isNull(shortlistInboundEmailJobs.completedAt),
        ),
      )
      .returning({ id: shortlistInboundEmailJobs.id });
    if (!completed) return false;
    const sourceId = job.sourceId;
    const title = email.Subject?.trim() ?? "Email opportunity";
    const sourceUrl = email.From?.Address
      ? `mailto:${email.From.Address}?subject=${encodeURIComponent(title)}`
      : null;
    await tx.insert(shortlistActivityLogs).values({
      userId: SHORTLIST_ROBOT_USER.id,
      boardId: job.boardId,
      activityType: "source.email.received",
      activityResult: "SUCCESS",
      activityLog: JSON.stringify({
        sourceId,
        sourceKind: "email",
        sourceTitle: title,
        sourceUrl,
      }),
    });
    return true;
  });
}

async function getAttachmentUpload(
  attachment: BrevoAttachment,
  apiKey?: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const filename = sanitizeFilename(attachment.Name ?? "attachment");
  const contentType = attachment.ContentType ?? "application/octet-stream";
  if (attachment.Base64Content ?? attachment.Content) {
    return {
      buffer: Buffer.from(
        attachment.Base64Content ?? attachment.Content ?? "",
        "base64",
      ),
      contentType,
      filename,
    };
  }

  const downloadUrl = attachment.DownloadUrl ?? attachment.Url;
  let url: string;
  let headers: HeadersInit | undefined;
  if (downloadUrl) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(downloadUrl);
    } catch {
      throw new InboundEmailError(
        "Brevo provided an invalid attachment URL.",
        false,
      );
    }
    if (parsedUrl.protocol !== "https:") {
      throw new InboundEmailError(
        "Brevo attachment URL must use HTTPS.",
        false,
      );
    }
    url = parsedUrl.toString();
  } else if (attachment.DownloadToken) {
    if (!apiKey) {
      throw new InboundEmailError(
        "BREVO_API_KEY is not configured for attachment downloads.",
        false,
      );
    }
    url = `${BREVO_ATTACHMENT_DOWNLOAD_BASE_URL}/${encodeURIComponent(attachment.DownloadToken)}`;
    headers = { "api-key": apiKey };
  } else {
    throw new InboundEmailError(
      "Supported Brevo attachment has no downloadable content.",
      false,
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new InboundEmailError(
      "Attachment download network error or timeout.",
      true,
    );
  }
  if (!response.ok) {
    const status = response.status;
    const retryable = status === 404 || status === 429 || status >= 500;
    const retryAfterMs = getRetryAfterMs(response.headers.get("retry-after"));
    throw new InboundEmailError(
      `Brevo attachment download failed (HTTP ${status}).`,
      retryable,
      status,
      retryAfterMs,
    );
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? contentType,
    filename,
  };
}

function parseEmail(value: unknown): BrevoInboundEmail {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InboundEmailError("Stored email payload is invalid.", false);
  }
  return value as BrevoInboundEmail;
}

function normalizeFailure(error: unknown): InboundEmailError {
  if (error instanceof InboundEmailError) return error;
  return new InboundEmailError(
    "Inbound email storage or queue operation failed.",
    true,
  );
}

function shouldRetry(job: InboundJob, error: InboundEmailError): boolean {
  if (!error.retryable || job.attempts >= job.maxAttempts) return false;
  if (error.statusCode === 404 && job.attempts >= 3) return false;
  return true;
}

function retryDelay(attempts: number, error: InboundEmailError): number {
  if (error.statusCode === 429 && error.retryAfterMs !== undefined) {
    return getInboundRetryDelayMs(attempts, error.retryAfterMs);
  }
  return getInboundRetryDelayMs(attempts);
}

function getRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp)
    ? undefined
    : Math.max(0, timestamp - Date.now());
}

function getEmailBodyObjects(email: BrevoInboundEmail) {
  const objects: {
    content: string;
    contentType: string;
    filename: string;
    objectType: string;
  }[] = [];
  const currentMessage = getCurrentEmailMessage(email);
  if (currentMessage) {
    objects.push({
      ...currentMessage,
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_CURRENT,
    });
  }
  if (email.RawHtmlBody) {
    objects.push({
      content: email.RawHtmlBody,
      contentType: "text/html",
      filename: "email.html",
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_HTML,
    });
  }
  if (email.RawTextBody) {
    objects.push({
      content: email.RawTextBody,
      contentType: "text/plain",
      filename: "email.txt",
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_TEXT,
    });
  }
  const rawEmail = email.RawEmailBody ?? email.RawMime;
  if (rawEmail) {
    objects.push({
      content: rawEmail,
      contentType: "message/rfc822",
      filename: "email.eml",
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_EML,
    });
  }
  return objects;
}

function getCurrentEmailMessage(
  email: BrevoInboundEmail,
): { content: string; contentType: string; filename: string } | null {
  if (email.ExtractedMarkdownMessage?.trim()) {
    return {
      content: email.ExtractedMarkdownMessage.trim(),
      contentType: "text/markdown",
      filename: "email-current.md",
    };
  }
  if (email.RawTextBody?.trim()) {
    const content = email.RawTextBody.split(
      /\n(?:On .+wrote:|From:\s.+|-{2,}\s*Original Message\s*-{2,})/i,
    )[0]?.trim();
    return content
      ? { content, contentType: "text/plain", filename: "email-current.txt" }
      : null;
  }
  if (email.RawHtmlBody?.trim()) {
    const content = email.RawHtmlBody.split(
      /<(?:blockquote|div[^>]+class=["'][^"']*(?:gmail_quote|yahoo_quoted)[^"']*["'])/i,
    )[0]?.trim();
    return content
      ? { content, contentType: "text/html", filename: "email-current.html" }
      : null;
  }
  return null;
}

function getEmailHeader(
  email: BrevoInboundEmail,
  headerName: string,
): string | null {
  if (!email.Headers) return null;
  if (Array.isArray(email.Headers)) {
    const prefix = `${headerName.toLowerCase()}:`;
    const header = email.Headers.find((value) =>
      value.toLowerCase().startsWith(prefix),
    );
    return header ? header.slice(header.indexOf(":") + 1).trim() : null;
  }
  const entry = Object.entries(email.Headers).find(
    ([name]) => name.toLowerCase() === headerName.toLowerCase(),
  );
  const value = entry?.[1];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function parseMessageIdList(value: string | null): string[] {
  if (!value) return [];
  return value.match(/<[^>]+>/g) ?? value.split(/\s+/).filter(Boolean);
}

function parseBrevoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeFilename(filename: string): string {
  return (
    filename
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 200) || "file"
  );
}
