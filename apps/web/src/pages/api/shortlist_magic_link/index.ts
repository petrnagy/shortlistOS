/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-20
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { createDrizzleClient } from "@kan/db/client";
import { shortlistLinks } from "@kan/db/schema";
import { createLogger } from "@kan/logger";

import { env } from "~/env";
import {
  isAuthorizedBearerRequest,
  isNonEmptyString,
  isRecord,
  resolveOwnedBoardWithActivePowerpack,
} from "../../../utils/shortlistMagic";

const log = createLogger("api:shortlist-magic-link");

interface MagicLinkPayload {
  boardId: string;
  url: string;
  userId: string;
}

const isMagicLinkPayload = (value: unknown): value is MagicLinkPayload =>
  isRecord(value) &&
  isNonEmptyString(value.userId) &&
  isNonEmptyString(value.boardId) &&
  isNonEmptyString(value.url);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!env.SHORTLIST_MAGIC_LINK_WEBHOOK_SECRET) {
    log.error("Shortlist magic link webhook secret is not configured");

    return res.status(500).json({ message: "Webhook secret is not configured" });
  }

  if (!isAuthorizedBearerRequest(req, env.SHORTLIST_MAGIC_LINK_WEBHOOK_SECRET)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!isMagicLinkPayload(req.body)) {
    return res.status(400).json({ message: "Invalid magic link payload" });
  }

  const payload = req.body;
  const db = createDrizzleClient();

  try {
    const access = await resolveOwnedBoardWithActivePowerpack(db, {
      boardPublicId: payload.boardId,
      userId: payload.userId,
    });

    if (!access) {
      log.warn(
        { boardPublicId: payload.boardId, userId: payload.userId },
        "Discarding magic link payload because board ownership or Powerpack access could not be resolved",
      );

      return res.status(200).json({ inserted: 0, skipped: 1 });
    }

    await db.insert(shortlistLinks).values({
      createdBy: access.userId,
      boardId: access.boardId,
      url: payload.url.trim(),
    });

    return res.status(200).json({ inserted: 1, skipped: 0 });
  } catch (error) {
    log.error({ error }, "Failed to process magic link webhook");

    return res.status(500).json({ message: "Webhook handler failed" });
  }
}
