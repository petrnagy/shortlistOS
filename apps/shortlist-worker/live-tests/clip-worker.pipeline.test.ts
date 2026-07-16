/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-24
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { createDrizzleClient } from "@kan/db/client";
import type { dbClient } from "@kan/db/client";
import {
  boards,
  cardActivities,
  cards,
  lists,
  shortlistJobQueue,
  shortlistSourceObjects,
  shortlistWebpageSources,
  users,
  workspaceMembers,
  workspaces,
} from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

import { processClipBatch } from "../src/workers/clip-worker";

const requiredEnv = [
  "POSTGRES_URL",
  "LLM_CONNECTOR_API_KEY",
  "LLM_CONNECTOR_MODEL",
  "SHORTLIST_SOURCE_BUCKET_NAME",
];

const shouldRun = requiredEnv.every((name) => Boolean(process.env[name]));
const maybeDescribe = shouldRun ? describe : describe.skip;

interface CreatedIds {
  userId?: string;
  workspaceId?: number;
  workspaceMemberId?: number;
  boardId?: number;
  listId?: number;
  jobId?: string;
  sourceId?: string;
  objectId?: string;
  cardId?: number;
}

let db: dbClient;
const createdIds: CreatedIds = {};

maybeDescribe("shortlist clip worker pipeline", () => {
  beforeAll(() => {
    db = createDrizzleClient();
  });

  afterEach(async () => {
    await cleanupCreatedRows(db, createdIds);
    resetCreatedIds(createdIds);
    await db.$client.end();
  });

  it("classifies a queued clip, creates a card, marks the clip completed, and cleans up", async () => {
    const fixtureHtml = await readFile(
      fileURLToPath(
        new URL(
          "../../../packages/llm/src/jobs/fixtures/job-posting-classification.test.html",
          import.meta.url,
        ),
      ),
      "utf8",
    );

    await createQueuedClip(db, fixtureHtml, createdIds);

    const result = await processClipBatch(db, {
      apiKey: getRequiredEnv("LLM_CONNECTOR_API_KEY"),
      model: getRequiredEnv("LLM_CONNECTOR_MODEL"),
      retryLimit: 3,
      limit: 1,
    });

    expect(result).toMatchObject({
      selected: 1,
      completed: 1,
      duplicates: 0,
      failed: 0,
      retried: 0,
    });

    const [processedJob] = await db
      .select({
        attempts: shortlistJobQueue.attempts,
        processingLog: shortlistJobQueue.processingLog,
        processedAt: shortlistJobQueue.processedAt,
        status: shortlistJobQueue.status,
      })
      .from(shortlistJobQueue)
      .where(eq(shortlistJobQueue.id, requireCreatedId("jobId", createdIds)));

    expect(processedJob).toBeDefined();
    expect(processedJob?.status).toBe("COMPLETED");
    expect(processedJob?.attempts).toBe(1);
    expect(processedJob?.processedAt).toBeInstanceOf(Date);
    expect(processedJob?.processingLog).toContain("LLM classification finished");
    expect(processedJob?.processingLog).toContain("Created card");

    const [createdCard] = await db
      .select({
        id: cards.id,
        publicId: cards.publicId,
        title: cards.title,
        shortlistCompanyName: cards.shortlistCompanyName,
        shortlistJobPostingUrl: cards.shortlistJobPostingUrl,
        shortlistCardSource: cards.shortlistCardSource,
      })
      .from(cards)
      .innerJoin(lists, eq(cards.listId, lists.id))
      .where(
        and(
          eq(lists.boardId, requireCreatedId("boardId", createdIds)),
          eq(cards.shortlistJobPostingUrl, TEST_CLIP_URL),
          isNull(cards.deletedAt),
        ),
      );

    expect(createdCard).toBeDefined();
    expect(createdCard?.publicId).toHaveLength(12);
    expect(createdCard?.title).toContain("Moodle");
    expect(createdCard?.shortlistCompanyName).toBe("Arden University");
    expect(createdCard?.shortlistJobPostingUrl).toBe(TEST_CLIP_URL);
    expect(createdCard?.shortlistCardSource).toBe("MAGIC_CLIP");

    createdIds.cardId = createdCard?.id;
  });
});

const TEST_CLIP_URL = "https://example.test/jobs/moodle-php-developer";

async function createQueuedClip(
  database: dbClient,
  rawHtml: string,
  ids: CreatedIds,
): Promise<void> {
  const testRunId = generateUID();
  const userId = randomUUID();
  const jobId = randomUUID();
  const objectId = randomUUID();
  const sourceId = randomUUID();
  const email = `clip-worker-${testRunId}@example.test`;

  ids.userId = userId;
  ids.jobId = jobId;
  ids.objectId = objectId;
  ids.sourceId = sourceId;

  await database.insert(users).values({
    id: userId,
    email,
    emailVerified: true,
    name: "Clip Worker Test",
    shortlistPowerpackActivatedAt: new Date(),
    shortlistPowerpackExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const [workspace] = await database
    .insert(workspaces)
    .values({
      publicId: generateUID(),
      name: "Clip Worker Test Workspace",
      slug: `clip-worker-${testRunId}`,
      createdBy: userId,
    })
    .returning({ id: workspaces.id });

  if (!workspace) throw new Error("Failed to create test workspace");
  ids.workspaceId = workspace.id;

  const [workspaceMember] = await database
    .insert(workspaceMembers)
    .values({
      publicId: generateUID(),
      email,
      userId,
      workspaceId: workspace.id,
      createdBy: userId,
      role: "admin",
      status: "active",
    })
    .returning({ id: workspaceMembers.id });

  ids.workspaceMemberId = workspaceMember?.id;

  const [board] = await database
    .insert(boards)
    .values({
      publicId: generateUID(),
      name: "Clip Worker Test Board",
      slug: `clip-worker-board-${testRunId}`,
      createdBy: userId,
      workspaceId: workspace.id,
    })
    .returning({ id: boards.id });

  if (!board) throw new Error("Failed to create test board");
  ids.boardId = board.id;

  const [savedList] = await database
    .insert(lists)
    .values({
      publicId: generateUID(),
      name: "Saved",
      index: 0,
      createdBy: userId,
      boardId: board.id,
    })
    .returning({ id: lists.id });

  if (!savedList) throw new Error("Failed to create test Saved list");
  ids.listId = savedList.id;

  await database.insert(shortlistWebpageSources).values({
    id: sourceId,
    createdBy: userId,
    boardId: board.id,
    url: TEST_CLIP_URL,
    metadataJson: { testRunId },
  });

  await database.insert(shortlistSourceObjects).values({
    id: objectId,
    boardId: board.id,
    bucket: getRequiredEnv("SHORTLIST_SOURCE_BUCKET_NAME"),
    contentType: "text/html",
    createdBy: userId,
    fileSize: Buffer.byteLength(rawHtml, "utf8"),
    objectType: "WEBPAGE_HTML",
    originalFilename: "webpage.html",
    s3Key: `live-tests/${testRunId}/webpage.html`,
    sourceId,
    sourceType: "WEBPAGE",
  });

  await database.insert(shortlistJobQueue).values({
    id: jobId,
    boardId: board.id,
    createdBy: userId,
    jobType: "CLASSIFY_SOURCE",
    payloadJson: {
      objectId,
      sourceUrl: TEST_CLIP_URL,
    },
    sourceId,
    sourceType: "WEBPAGE",
    status: "PENDING",
  });
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) throw new Error(`${name} is required`);

  return value;
}

function requireCreatedId<Key extends keyof CreatedIds>(
  key: Key,
  ids: CreatedIds,
): NonNullable<CreatedIds[Key]> {
  const value = ids[key];

  if (value === undefined) {
    throw new Error(`${String(key)} was not created`);
  }

  return value as NonNullable<CreatedIds[Key]>;
}

function resetCreatedIds(ids: CreatedIds): void {
  ids.userId = undefined;
  ids.workspaceId = undefined;
  ids.workspaceMemberId = undefined;
  ids.boardId = undefined;
  ids.listId = undefined;
  ids.jobId = undefined;
  ids.objectId = undefined;
  ids.sourceId = undefined;
  ids.cardId = undefined;
}

async function cleanupCreatedRows(
  database: dbClient,
  ids: CreatedIds,
): Promise<void> {
  if (ids.jobId) {
    await database
      .delete(shortlistJobQueue)
      .where(eq(shortlistJobQueue.id, ids.jobId));
  }

  if (ids.objectId) {
    await database
      .delete(shortlistSourceObjects)
      .where(eq(shortlistSourceObjects.id, ids.objectId));
  }

  if (ids.sourceId) {
    await database
      .delete(shortlistWebpageSources)
      .where(eq(shortlistWebpageSources.id, ids.sourceId));
  }

  if (ids.cardId) {
    await database
      .delete(cardActivities)
      .where(eq(cardActivities.cardId, ids.cardId));

    await database.delete(cards).where(eq(cards.id, ids.cardId));
  }

  if (ids.listId) {
    await database.delete(lists).where(eq(lists.id, ids.listId));
  }

  if (ids.boardId) {
    await database.delete(boards).where(eq(boards.id, ids.boardId));
  }

  if (ids.workspaceMemberId) {
    await database
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.id, ids.workspaceMemberId));
  }

  if (ids.workspaceId) {
    await database.delete(workspaces).where(eq(workspaces.id, ids.workspaceId));
  }

  if (ids.userId) {
    await database.delete(users).where(eq(users.id, ids.userId));
  }
}
