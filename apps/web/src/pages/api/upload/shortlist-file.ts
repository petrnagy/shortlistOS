import type { NextApiRequest, NextApiResponse } from "next";

import type { dbClient } from "@kan/db/client";
import { createNextApiContext } from "@kan/api/trpc";
import { withApiLogging } from "@kan/api/utils/apiLogging";
import { assertPermission } from "@kan/api/utils/permissions";
import { withRateLimit } from "@kan/api/utils/rateLimit";
import * as boardRepo from "@kan/db/repository/board.repo";
import { shortlistAttachmentSources } from "@kan/db/schema";
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

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const config = {
  api: {
    bodyParser: false,
  },
};

export default withRateLimit(
  { points: 30, duration: 60 },
  withApiLogging(async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const { user, db } = await createNextApiContext(req);

      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      return processAuthenticatedShortlistFileUpload(req, res, {
        db,
        userId: user.id,
      });
    } catch {
      return res.status(500).json({ error: "Internal server error" });
    }
  }),
);

export async function processAuthenticatedShortlistFileUpload(
  req: NextApiRequest,
  res: NextApiResponse,
  context: { db: dbClient; userId: string },
) {
  const { db, userId } = context;

  try {
    const bucket = env.SHORTLIST_SOURCE_BUCKET_NAME;
    if (!bucket) {
      return res
        .status(500)
        .json({ error: "Shortlist source bucket not configured" });
    }

    const boardPublicId = req.query.boardPublicId;
    if (typeof boardPublicId !== "string" || boardPublicId.length < 12) {
      return res.status(400).json({ error: "Invalid boardPublicId" });
    }

    const contentType = req.headers["content-type"];
    const contentLengthHeader = req.headers["content-length"];
    const contentLength = contentLengthHeader
      ? Number.parseInt(contentLengthHeader, 10)
      : NaN;

    if (typeof contentType !== "string") {
      return res.status(400).json({ error: "Missing content type" });
    }

    if (!Number.isFinite(contentLength) || contentLength <= 0) {
      return res
        .status(400)
        .json({ error: "Missing or invalid content length" });
    }

    if (contentLength > MAX_SIZE_BYTES) {
      return res.status(400).json({ error: "File too large" });
    }

    const originalFilenameHeader =
      (req.headers["x-original-filename"] as string | undefined) ?? "";

    if (!isSupportedShortlistAttachment(originalFilenameHeader)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const board = await boardRepo.getWorkspaceAndBoardIdByBoardPublicId(
      db,
      boardPublicId,
    );

    if (!board) {
      return res.status(404).json({ error: "Board not found" });
    }

    try {
      await assertPermission(db, userId, board.workspaceId, "card:create");
    } catch {
      return res.status(403).json({ error: "Permission denied" });
    }

    const sanitizedFilename = sanitizeShortlistFilename(originalFilenameHeader);
    const [source] = await db
      .insert(shortlistAttachmentSources)
      .values({
        boardId: board.id,
        contentType,
        createdBy: userId,
        fileSize: contentLength,
        metadataJson: {
          boardPublicId,
          originalFilename: originalFilenameHeader,
        },
        originalFilename: sanitizedFilename,
      })
      .returning({ id: shortlistAttachmentSources.id });

    if (!source) {
      return res.status(500).json({ error: "Failed to create source" });
    }

    const object = await storeShortlistSourceObject({
      db,
      bucket,
      body: req,
      boardId: board.id,
      boardPublicId,
      contentLength,
      contentType,
      createdBy: userId,
      filename: sanitizedFilename,
      metadata: {
        "original-filename": sanitizedFilename,
      },
      objectType: SHORTLIST_SOURCE_OBJECT_TYPES.ATTACHMENT_FILE,
      sourceId: source.id,
      sourceType: SHORTLIST_SOURCE_TYPES.ATTACHMENT,
    });

    const jobId = await enqueueShortlistSource({
      db,
      boardId: board.id,
      createdBy: userId,
      payloadJson: {
        objectId: object.id,
        s3Key: object.s3Key,
        fileContentType: contentType,
        fileOriginalFilename: sanitizedFilename,
        fileSize: contentLength,
      },
      sourceId: source.id,
      sourceType: SHORTLIST_SOURCE_TYPES.ATTACHMENT,
    });

    return res.status(200).json({ jobId, sourceId: source.id });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}
