/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-20
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import type { dbClient } from "@kan/db/client";
import { createDrizzleClient } from "@kan/db/client";
import { shortlistEmailSources } from "@kan/db/schema";
import { createLogger } from "@kan/logger";
import {
  isSupportedShortlistAttachment,
  SHORTLIST_SOURCE_OBJECT_TYPES,
  SHORTLIST_SOURCE_TYPES,
} from "@kan/shared/constants";

import { env } from "~/env";
import {
  enqueueShortlistSource,
  sanitizeShortlistFilename,
  storeShortlistSourceObject,
} from "~/utils/shortlistSourceIntake";
import {
  getBearerToken,
  resolveMagicInboxRecipientAccess,
} from "../../../utils/shortlistMagic";

const log = createLogger("api:shortlist-magic-inbox");

const MAGIC_INBOX_DOMAIN = env.NEXT_PUBLIC_MAGIC_INBOX_DOMAIN?.toLowerCase();
const BREVO_ATTACHMENT_DOWNLOAD_BASE_URL =
  "https://api.brevo.com/v3/inbound/attachments";

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
  To?: (BrevoMailbox | string)[];
  Recipients?: (BrevoMailbox | string)[];
  Cc?: (BrevoMailbox | string)[];
  ReplyTo?: BrevoMailbox | null;
  SentAtDate?: string;
  Subject?: string;
  RawHtmlBody?: string;
  RawTextBody?: string;
  RawEmailBody?: string;
  RawMime?: string;
  ExtractedMarkdownMessage?: string;
  ExtractedMarkdownSignature?: string;
  SpamScore?: number;
  Attachments?: BrevoAttachment[];
  Headers?: Record<string, string | string[]> | string[];
}

interface BrevoInboundPayload {
  items: BrevoInboundEmail[];
}

interface MagicInboxRecipient {
  boardPublicId: string;
  userPublicSecret: string;
}

const isBrevoInboundPayload = (value: unknown): value is BrevoInboundPayload =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as BrevoInboundPayload).items);

const isAuthorizedBrevoWebhook = (req: NextApiRequest): boolean =>
  !!env.BREVO_MAGIC_INBOX_WEBHOOK_SECRET &&
  getBearerToken(req) === env.BREVO_MAGIC_INBOX_WEBHOOK_SECRET;

const getAddress = (mailbox: BrevoMailbox | string): string | null => {
  if (typeof mailbox === "string") {
    return mailbox;
  }

  return mailbox.Address ?? null;
};

const extractRecipientAddresses = (email: BrevoInboundEmail): string[] => {
  const addresses = new Set<string>();
  const recipientFields = [email.Recipients, email.To, email.Cc];

  for (const field of recipientFields) {
    for (const mailbox of field ?? []) {
      const address = getAddress(mailbox);

      if (address) {
        addresses.add(address);
      }
    }
  }

  return [...addresses];
};

export const parseMagicInboxRecipientsFromBrevoEmail = (
  email: BrevoInboundEmail,
): MagicInboxRecipient[] => {
  const recipients = new Map<string, MagicInboxRecipient>();

  for (const address of extractRecipientAddresses(email)) {
    const [localPart, domain] = address.split("@");

    if (
      !MAGIC_INBOX_DOMAIN ||
      !localPart ||
      domain?.toLowerCase() !== MAGIC_INBOX_DOMAIN
    ) {
      continue;
    }

    const [boardPublicId, userPublicSecret, extraSegment] =
      localPart.split(".");

    if (
      boardPublicId &&
      userPublicSecret &&
      !extraSegment &&
      /^[a-zA-Z0-9_-]{1,64}$/.test(boardPublicId) &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(userPublicSecret)
    ) {
      recipients.set(`${boardPublicId}.${userPublicSecret}`, {
        boardPublicId,
        userPublicSecret,
      });
    }
  }

  return [...recipients.values()];
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!env.BREVO_MAGIC_INBOX_WEBHOOK_SECRET) {
    log.error("Brevo magic inbox webhook secret is not configured");

    return res
      .status(500)
      .json({ message: "Webhook secret is not configured" });
  }

  if (!env.NEXT_PUBLIC_MAGIC_INBOX_DOMAIN) {
    log.error("Magic inbox domain is not configured");

    return res
      .status(500)
      .json({ message: "Magic inbox domain is not configured" });
  }

  if (!isAuthorizedBrevoWebhook(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!isBrevoInboundPayload(req.body)) {
    return res.status(400).json({ message: "Invalid Brevo payload" });
  }

  const payload = req.body;
  const db = createDrizzleClient();
  const bucket = env.SHORTLIST_SOURCE_BUCKET_NAME;
  let inserted = 0;
  let duplicates = 0;
  let skipped = 0;

  try {
    if (!bucket) {
      log.error("Shortlist source bucket is not configured");

      return res
        .status(500)
        .json({ message: "Shortlist source bucket is not configured" });
    }

    for (const item of payload.items) {
      if (!item.MessageId) {
        skipped += 1;
        log.warn("Skipping Brevo inbound email without MessageId");
        continue;
      }

      const magicInboxRecipients =
        parseMagicInboxRecipientsFromBrevoEmail(item);

      if (magicInboxRecipients.length === 0) {
        skipped += 1;
        log.warn(
          { externId: item.MessageId },
          "Skipping Brevo inbound email without a magic inbox recipient",
        );
        continue;
      }

      for (const recipient of magicInboxRecipients) {
        const access = await resolveMagicInboxRecipientAccess(db, recipient);

        if (!access) {
          skipped += 1;
          log.warn(
            {
              boardPublicId: recipient.boardPublicId,
              userPublicSecret: recipient.userPublicSecret,
              externId: item.MessageId,
            },
            "Skipping Brevo inbound email because board ownership or Powerpack access could not be resolved",
          );
          continue;
        }

        const supportedAttachments = getSupportedAttachments(item);
        const inReplyTo = getEmailHeader(item, "in-reply-to");
        const references = parseMessageIdList(
          getEmailHeader(item, "references"),
        );
        const insertedRows = await db
          .insert(shortlistEmailSources)
          .values({
            createdBy: access.userId,
            boardId: access.boardId,
            externId: item.MessageId,
            fromEmail: item.From?.Address ?? null,
            fromName: item.From?.Name ?? null,
            hasSupportedAttachment: supportedAttachments.length > 0,
            inReplyTo,
            metadataJson: {
              brevoUuid: item.Uuid ?? null,
              boardPublicId: recipient.boardPublicId,
              recipient: `${recipient.boardPublicId}.${recipient.userPublicSecret}`,
              spamScore: item.SpamScore ?? null,
            },
            referencesJson: references,
            sentAt: parseBrevoDate(item.SentAtDate),
            subject: item.Subject ?? null,
          })
          .onConflictDoNothing({
            target: [
              shortlistEmailSources.externId,
              shortlistEmailSources.boardId,
            ],
          })
          .returning({ id: shortlistEmailSources.id });

        if (insertedRows.length > 0) {
          inserted += 1;
          await storeBrevoEmailObjects({
            access,
            bucket,
            db,
            email: item,
            recipient,
            sourceId: insertedRows[0]?.id,
            supportedAttachments,
          });
        } else {
          duplicates += 1;
        }
      }
    }

    log.info(
      {
        received: payload.items.length,
        inserted,
        duplicates,
        skipped,
      },
      "Processed Brevo magic inbox webhook",
    );

    return res.status(200).json({
      received: payload.items.length,
      inserted,
      duplicates,
      skipped,
    });
  } catch (error) {
    log.error({ error }, "Failed to process Brevo magic inbox webhook");

    return res.status(500).json({ message: "Webhook handler failed" });
  }
}

async function storeBrevoEmailObjects(input: {
  access: { boardId: number; userId: string };
  bucket: string;
  db: dbClient;
  email: BrevoInboundEmail;
  recipient: MagicInboxRecipient;
  sourceId: string | undefined;
  supportedAttachments: BrevoAttachment[];
}) {
  if (!input.sourceId) {
    throw new Error("Email source id was not returned");
  }

  const objectIds: string[] = [];
  const bodyObjects = getEmailBodyObjects(input.email);

  for (const bodyObject of bodyObjects) {
    const buffer = Buffer.from(bodyObject.content, "utf8");
    const object = await storeShortlistSourceObject({
      db: input.db,
      bucket: input.bucket,
      body: buffer,
      boardId: input.access.boardId,
      boardPublicId: input.recipient.boardPublicId,
      contentLength: buffer.byteLength,
      contentType: bodyObject.contentType,
      createdBy: input.access.userId,
      filename: bodyObject.filename,
      metadata: {
        "message-id": input.email.MessageId ?? "",
      },
      objectType: bodyObject.objectType,
      sourceId: input.sourceId,
      sourceType: SHORTLIST_SOURCE_TYPES.EMAIL,
    });

    if (object.id) objectIds.push(object.id);
  }

  for (const [
    attachmentIndex,
    supportedAttachment,
  ] of input.supportedAttachments.entries()) {
    const attachment = await getAttachmentUpload(supportedAttachment);

    if (!attachment) {
      log.warn(
        {
          attachmentName: supportedAttachment.Name,
          messageId: input.email.MessageId,
        },
        "Skipping supported Brevo attachment because no downloadable content was provided",
      );
      continue;
    }

    const object = await storeShortlistSourceObject({
      db: input.db,
      bucket: input.bucket,
      body: attachment.buffer,
      boardId: input.access.boardId,
      boardPublicId: input.recipient.boardPublicId,
      contentLength: attachment.buffer.byteLength,
      contentType: attachment.contentType,
      createdBy: input.access.userId,
      filename: attachment.filename,
      metadata: {
        "message-id": input.email.MessageId ?? "",
        "original-filename": sanitizeShortlistFilename(attachment.filename),
        "source-order": String(attachmentIndex),
      },
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
      sourceId: input.sourceId,
      sourceType: SHORTLIST_SOURCE_TYPES.EMAIL,
    });

    if (object.id) objectIds.push(object.id);
  }

  await enqueueShortlistSource({
    db: input.db,
    boardId: input.access.boardId,
    createdBy: input.access.userId,
    payloadJson: {
      messageId: input.email.MessageId,
      objectIds,
      subject: input.email.Subject ?? null,
    },
    sourceId: input.sourceId,
    sourceType: SHORTLIST_SOURCE_TYPES.EMAIL,
  });
}

function getEmailBodyObjects(email: BrevoInboundEmail): Array<{
  content: string;
  contentType: string;
  filename: string;
  objectType:
    | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_HTML
    | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_CURRENT
    | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_TEXT
    | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_EML;
}> {
  const objects: Array<{
    content: string;
    contentType: string;
    filename: string;
    objectType:
      | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_HTML
      | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_CURRENT
      | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_TEXT
      | typeof SHORTLIST_SOURCE_OBJECT_TYPES.EMAIL_EML;
  }> = [];

  const currentMessage = getCurrentEmailMessage(email);
  if (currentMessage) {
    objects.push({
      content: currentMessage.content,
      contentType: currentMessage.contentType,
      filename: currentMessage.filename,
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

export function getCurrentEmailMessage(
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

function getSupportedAttachments(email: BrevoInboundEmail): BrevoAttachment[] {
  return (email.Attachments ?? []).filter(
    (attachment) =>
      !!attachment.Name && isSupportedShortlistAttachment(attachment.Name),
  );
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

  const bracketed = value.match(/<[^>]+>/g);
  return bracketed ?? value.split(/\s+/).filter(Boolean);
}

async function getAttachmentUpload(
  attachment: BrevoAttachment,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const filename = attachment.Name
    ? sanitizeShortlistFilename(attachment.Name)
    : "attachment";
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
  if (downloadUrl) {
    return fetchAttachmentFromUrl({
      contentType,
      filename,
      url: downloadUrl,
    });
  }

  if (!attachment.DownloadToken) return null;

  if (!env.BREVO_API_KEY) {
    log.warn(
      { attachmentName: attachment.Name },
      "Skipping Brevo attachment download because BREVO_API_KEY is not configured",
    );

    return null;
  }

  return fetchAttachmentFromUrl({
    contentType,
    filename,
    headers: {
      "api-key": env.BREVO_API_KEY,
    },
    url: `${BREVO_ATTACHMENT_DOWNLOAD_BASE_URL}/${encodeURIComponent(
      attachment.DownloadToken,
    )}`,
  });
}

async function fetchAttachmentFromUrl(input: {
  contentType: string;
  filename: string;
  headers?: HeadersInit;
  url: string;
}): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const response = await fetch(input.url, {
    headers: input.headers,
  });

  if (!response.ok) return null;

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? input.contentType,
    filename: input.filename,
  };
}

function parseBrevoDate(value: string | undefined): Date | null {
  if (!value) return null;

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
