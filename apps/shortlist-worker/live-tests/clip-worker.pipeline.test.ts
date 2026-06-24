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
  shortlistClips,
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
];

const shouldRun = requiredEnv.every((name) => Boolean(process.env[name]));
const maybeDescribe = shouldRun ? describe : describe.skip;

interface CreatedIds {
  userId?: string;
  workspaceId?: number;
  workspaceMemberId?: number;
  boardId?: number;
  listId?: number;
  clipId?: string;
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

    const [processedClip] = await db
      .select({
        processingResult: shortlistClips.processingResult,
        processingTries: shortlistClips.processingTries,
        processingLog: shortlistClips.processingLog,
        processedAt: shortlistClips.processedAt,
      })
      .from(shortlistClips)
      .where(eq(shortlistClips.id, requireCreatedId("clipId", createdIds)));

    expect(processedClip).toBeDefined();
    expect(processedClip?.processingResult).toBe("COMPLETED");
    expect(processedClip?.processingTries).toBe(1);
    expect(processedClip?.processedAt).toBeInstanceOf(Date);
    expect(processedClip?.processingLog).toContain("LLM classification finished");
    expect(processedClip?.processingLog).toContain("Created card");

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
  const clipId = randomUUID();
  const email = `clip-worker-${testRunId}@example.test`;

  ids.userId = userId;
  ids.clipId = clipId;

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

  await database.insert(shortlistClips).values({
    id: clipId,
    createdBy: userId,
    boardId: board.id,
    url: TEST_CLIP_URL,
    rawHtml,
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
  ids.clipId = undefined;
  ids.cardId = undefined;
}

async function cleanupCreatedRows(
  database: dbClient,
  ids: CreatedIds,
): Promise<void> {
  if (ids.clipId) {
    await database
      .delete(shortlistClips)
      .where(eq(shortlistClips.id, ids.clipId));
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
