import type { Readable } from "node:stream";

import { Upload } from "@aws-sdk/lib-storage";

import type { dbClient } from "@kan/db/client";
import {
  shortlistJobQueue,
  shortlistSourceObjects,
} from "@kan/db/schema";
import { createS3Client, generateUID } from "@kan/shared/utils";
import {
  SHORTLIST_JOB_STATUSES,
  SHORTLIST_JOB_TYPES,
  type ShortlistSourceObjectType,
  type ShortlistSourceType,
} from "@kan/shared/constants";

interface StoreShortlistSourceObjectInput {
  db: dbClient;
  bucket: string;
  body: Buffer | Readable | string;
  boardId: number;
  boardPublicId: string;
  contentLength: number;
  contentType: string;
  createdBy: string;
  filename: string;
  metadata?: Record<string, string>;
  objectType: ShortlistSourceObjectType;
  sourceId: string;
  sourceType: ShortlistSourceType;
}

interface EnqueueShortlistSourceInput {
  db: dbClient;
  boardId: number;
  createdBy: string;
  payloadJson?: Record<string, unknown>;
  sourceId: string;
  sourceType: ShortlistSourceType;
}

export async function storeShortlistSourceObject(
  input: StoreShortlistSourceObjectInput,
) {
  const sanitizedFilename = sanitizeShortlistFilename(input.filename);
  const s3Key = buildShortlistSourceS3Key({
    boardId: input.boardId,
    boardPublicId: input.boardPublicId,
    filename: sanitizedFilename,
    objectType: input.objectType,
    sourceType: input.sourceType,
  });

  await new Upload({
    client: createS3Client(),
    params: {
      Bucket: input.bucket,
      Key: s3Key,
      Body: input.body,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
      Metadata: {
        "board-public-id": input.boardPublicId,
        "object-type": input.objectType,
        "source-id": input.sourceId,
        "source-type": input.sourceType,
        "uploaded-by-user-id": input.createdBy,
        ...(input.metadata ?? {}),
      },
    },
    leavePartsOnError: false,
  }).done();

  const [object] = await input.db
    .insert(shortlistSourceObjects)
    .values({
      boardId: input.boardId,
      bucket: input.bucket,
      contentType: input.contentType,
      createdBy: input.createdBy,
      fileSize: input.contentLength,
      metadataJson: input.metadata ?? null,
      objectType: input.objectType,
      originalFilename: sanitizedFilename,
      s3Key,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
    })
    .returning({ id: shortlistSourceObjects.id });

  return {
    id: object?.id ?? null,
    s3Key,
  };
}

export async function enqueueShortlistSource(input: EnqueueShortlistSourceInput) {
  const [job] = await input.db
    .insert(shortlistJobQueue)
    .values({
      boardId: input.boardId,
      createdBy: input.createdBy,
      jobType: SHORTLIST_JOB_TYPES.CLASSIFY_SOURCE,
      payloadJson: input.payloadJson ?? null,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      status: SHORTLIST_JOB_STATUSES.PENDING,
    })
    .returning({ id: shortlistJobQueue.id });

  return job?.id ?? null;
}

export function sanitizeShortlistFilename(filename: string): string {
  return (
    filename
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 200) || "file"
  );
}

function buildShortlistSourceS3Key(input: {
  boardId: number;
  boardPublicId: string;
  filename: string;
  objectType: ShortlistSourceObjectType;
  sourceType: ShortlistSourceType;
}) {
  return [
    input.boardId,
    input.boardPublicId,
    input.sourceType.toLowerCase(),
    input.objectType.toLowerCase(),
    `${generateUID()}-${input.filename}`,
  ].join("/");
}
