/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-20
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { createDrizzleClient } from "@kan/db/client";
import { shortlistWebpageSources } from "@kan/db/schema";
import { createLogger } from "@kan/logger";
import {
  SHORTLIST_SOURCE_OBJECT_TYPES,
  SHORTLIST_SOURCE_TYPES,
} from "@kan/shared/constants";

import { env } from "~/env";
import {
  enqueueShortlistSource,
  storeShortlistSourceObject,
} from "~/utils/shortlistSourceIntake";
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
    const bucket = env.SHORTLIST_SOURCE_BUCKET_NAME;

    if (!bucket) {
      log.error("Shortlist source bucket is not configured");

      return res
        .status(500)
        .json({ message: "Shortlist source bucket is not configured" });
    }

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

    const sourceUrl = payload.url.trim();
    const htmlBuffer = Buffer.from(payload.rawHtml, "utf8");
    const [source] = await db
      .insert(shortlistWebpageSources)
      .values({
        boardId: access.boardId,
        createdBy: access.userId,
        metadataJson: {
          boardPublicId: payload.boardId,
        },
        url: sourceUrl,
      })
      .returning({ id: shortlistWebpageSources.id });

    if (!source) {
      log.error("Failed to create shortlist webpage source");

      return res.status(500).json({ message: "Failed to create source" });
    }

    const object = await storeShortlistSourceObject({
      db,
      bucket,
      body: htmlBuffer,
      boardId: access.boardId,
      boardPublicId: payload.boardId,
      contentLength: htmlBuffer.byteLength,
      contentType: "text/html",
      createdBy: access.userId,
      filename: "webpage.html",
      metadata: {
        "source-url": sourceUrl,
      },
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.WEBPAGE_HTML,
      sourceId: source.id,
      sourceType: SHORTLIST_SOURCE_TYPES.WEBPAGE,
    });

    await enqueueShortlistSource({
      db,
      boardId: access.boardId,
      createdBy: access.userId,
      payloadJson: {
        objectId: object.id,
        s3Key: object.s3Key,
        sourceUrl,
      },
      sourceId: source.id,
      sourceType: SHORTLIST_SOURCE_TYPES.WEBPAGE,
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
