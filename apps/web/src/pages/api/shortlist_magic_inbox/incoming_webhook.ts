/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-20
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";

import { createDrizzleClient } from "@kan/db/client";
import { boards, shortlistInbox, users } from "@kan/db/schema";
import { createLogger } from "@kan/logger";

import { env } from "~/env";

const log = createLogger("api:shortlist-magic-inbox");

const MAGIC_INBOX_DOMAIN = "magic-inbox.shortlistos.co";
const BREVO_SOURCE = "BREVO";
const BREVO_CONTENT_TYPE = "application/json";
const INBOX_PROCESSING_RESULT_RETRY = "RETRY";
const INBOX_PROCESSING_LOG = "Received from Brevo and awaiting processing.";

interface BrevoMailbox {
  Address?: string;
  Name?: string;
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
  ExtractedMarkdownMessage?: string;
  ExtractedMarkdownSignature?: string;
  SpamScore?: number;
  Attachments?: unknown[];
  Headers?: Record<string, string | string[]> | string[];
}

interface BrevoInboundPayload {
  items: BrevoInboundEmail[];
}

interface MagicInboxRecipient {
  boardPublicId: string;
  userHash: string;
}

const isBrevoInboundPayload = (value: unknown): value is BrevoInboundPayload =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as BrevoInboundPayload).items);

const getHeaderValue = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const getBearerToken = (req: NextApiRequest): string | null => {
  const authorization = getHeaderValue(req.headers.authorization);

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return getHeaderValue(req.headers.bearer)?.trim() ?? null;
};

const isAuthorizedBrevoWebhook = (req: NextApiRequest): boolean => {
  const actualSecret = getBearerToken(req);

  return (
    !!env.BREVO_MAGIC_INBOX_WEBHOOK_SECRET &&
    actualSecret === env.BREVO_MAGIC_INBOX_WEBHOOK_SECRET
  );
};

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

    if (!localPart || domain?.toLowerCase() !== MAGIC_INBOX_DOMAIN) {
      continue;
    }

    const [boardPublicId, userHash, extraSegment] = localPart.split(".");

    if (
      boardPublicId &&
      userHash &&
      !extraSegment &&
      /^[a-zA-Z0-9_-]{1,64}$/.test(boardPublicId) &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(userHash)
    ) {
      recipients.set(`${boardPublicId}.${userHash}`, {
        boardPublicId,
        userHash,
      });
    }
  }

  return [...recipients.values()];
};

const resolveBoardOwner = async (
  db: ReturnType<typeof createDrizzleClient>,
  boardPublicId: string,
) => {
  const rows = await db
    .select({ userId: users.id })
    .from(boards)
    .innerJoin(users, eq(boards.createdBy, users.id))
    .where(and(eq(boards.publicId, boardPublicId), isNull(boards.deletedAt)))
    .limit(1);

  return rows[0]?.userId ?? null;
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

    return res.status(500).json({ message: "Webhook secret is not configured" });
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
        const ownerId = await resolveBoardOwner(db, recipient.boardPublicId);

        if (!ownerId) {
          skipped += 1;
          log.warn(
            {
              boardPublicId: recipient.boardPublicId,
              userHash: recipient.userHash,
              externId: item.MessageId,
            },
            "Skipping Brevo inbound email because board owner could not be resolved",
          );
          continue;
        }

        const insertedRows = await db
          .insert(shortlistInbox)
          .values({
            createdBy: ownerId,
            cardId: null,
            externId: item.MessageId,
            rawContent: JSON.stringify(item),
            contentType: BREVO_CONTENT_TYPE,
            source: BREVO_SOURCE,
            processedAt: null,
            processingTries: 0,
            processingResult: INBOX_PROCESSING_RESULT_RETRY,
            processingLog: INBOX_PROCESSING_LOG,
          })
          .onConflictDoNothing({ target: shortlistInbox.externId })
          .returning({ id: shortlistInbox.id });

        if (insertedRows.length > 0) {
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
    log.error({ error }, "Failed to process Brevo magic inbox webhook");

    return res.status(500).json({ message: "Webhook handler failed" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
