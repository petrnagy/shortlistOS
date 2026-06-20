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
import { shortlistClips } from "@kan/db/schema";
import { createLogger } from "@kan/logger";

import { env } from "~/env";
import {
  isAuthorizedBearerRequest,
  isNonEmptyString,
  isRecord,
  resolveOwnedBoardWithActivePowerpack,
} from "../../../utils/shortlistMagic";

const log = createLogger("api:shortlist-magic-clip");

interface MagicClipPayload {
  boardId: string;
  rawHtml: string;
  url: string;
  userId: string;
}

const isMagicClipPayload = (value: unknown): value is MagicClipPayload =>
  isRecord(value) &&
  isNonEmptyString(value.userId) &&
  isNonEmptyString(value.boardId) &&
  isNonEmptyString(value.url) &&
  isNonEmptyString(value.rawHtml);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!env.SHORTLIST_MAGIC_CLIP_WEBHOOK_SECRET) {
    log.error("Shortlist magic clip webhook secret is not configured");

    return res.status(500).json({ message: "Webhook secret is not configured" });
  }

  if (!isAuthorizedBearerRequest(req, env.SHORTLIST_MAGIC_CLIP_WEBHOOK_SECRET)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!isMagicClipPayload(req.body)) {
    return res.status(400).json({ message: "Invalid magic clip payload" });
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
        "Discarding magic clip payload because board ownership or Powerpack access could not be resolved",
      );

      return res.status(200).json({ inserted: 0, skipped: 1 });
    }

    await db.insert(shortlistClips).values({
      createdBy: access.userId,
      boardId: access.boardId,
      url: payload.url.trim(),
      rawHtml: payload.rawHtml,
    });

    return res.status(200).json({ inserted: 1, skipped: 0 });
  } catch (error) {
    log.error({ error }, "Failed to process magic clip webhook");

    return res.status(500).json({ message: "Webhook handler failed" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};
