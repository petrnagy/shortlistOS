/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-20
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { createHash } from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";

import { createDrizzleClient } from "@kan/db/client";
import { shortlistInboundEmailJobs } from "@kan/db/schema";
import { createLogger } from "@kan/logger";

import { env } from "~/env";
import {
  getBearerToken,
  resolveMagicInboxRecipientAccess,
} from "../../../utils/shortlistMagic";

const log = createLogger("api:shortlist-magic-inbox");

const MAGIC_INBOX_DOMAIN = env.NEXT_PUBLIC_MAGIC_INBOX_DOMAIN?.toLowerCase();

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
  let inserted = 0;
  let duplicates = 0;
  let skipped = 0;

  try {
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
              externId: item.MessageId,
            },
            "Skipping Brevo inbound email because board ownership or Powerpack access could not be resolved",
          );
          continue;
        }

        const idempotencyKey = createHash("sha256")
          .update(
            `${item.MessageId}\0${recipient.boardPublicId}.${recipient.userPublicSecret}`,
          )
          .digest("hex");
        const persistedRows = await db
          .insert(shortlistInboundEmailJobs)
          .values({
            idempotencyKey,
            externId: item.MessageId,
            createdBy: access.userId,
            boardId: access.boardId,
            boardPublicId: recipient.boardPublicId,
            payloadJson: item,
            status: "PENDING",
          })
          .onConflictDoUpdate({
            target: shortlistInboundEmailJobs.idempotencyKey,
            set: {
              payloadJson: item,
              runAfter: sql`CASE WHEN ${shortlistInboundEmailJobs.status} = 'PENDING' THEN NOW() ELSE ${shortlistInboundEmailJobs.runAfter} END`,
              updatedAt: new Date(),
            },
            setWhere: sql`${shortlistInboundEmailJobs.status} IN ('PENDING', 'RETRY')`,
          })
          .returning({ id: shortlistInboundEmailJobs.id });

        if (persistedRows.length > 0) {
          inserted += 1;
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
    log.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Failed to persist Brevo magic inbox webhook jobs",
    );

    return res.status(500).json({ message: "Webhook handler failed" });
  }
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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
