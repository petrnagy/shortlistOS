import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { ShortlistAutomationCardType } from "@kan/db/schema";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import {
  boards,
  cardActivities,
  cards,
  cardsToLabels,
  labels,
  lists,
  shortlistAutomationCardQueue,
  users,
} from "@kan/db/schema";
import { createLogger } from "@kan/logger";
import { SHORTLIST_ROBOT_USER } from "@kan/shared/constants";
import { generateUID } from "@kan/shared/utils";

const logger = createLogger("shortlist-automation-card-worker");
const MAX_ATTEMPTS = 3;

export async function enqueueDueCardAutomations(
  db: dbClient,
  now = new Date(),
): Promise<number> {
  const rows = await db
    .select({
      board: boards,
      card: cards,
      listName: lists.name,
      userId: users.id,
    })
    .from(boards)
    .innerJoin(users, eq(boards.createdBy, users.id))
    .innerJoin(
      lists,
      and(eq(lists.boardId, boards.id), isNull(lists.deletedAt)),
    )
    .innerJoin(cards, and(eq(cards.listId, lists.id), isNull(cards.deletedAt)))
    .where(
      and(
        isNull(boards.deletedAt),
        eq(boards.isArchived, false),
        lte(users.shortlistPowerpackActivatedAt, now),
        sql`${users.shortlistPowerpackExpiresAt} >= ${now}`,
      ),
    );

  let inserted = 0;
  for (const row of rows) {
    const stage = row.listName.trim().toLowerCase();
    const lastActivity = row.card.updatedAt ?? row.card.createdAt;
    const ageMs = now.getTime() - lastActivity.getTime();
    const jobs: ShortlistAutomationCardType[] = [];

    if (
      stage === "saved" &&
      row.board.shortlistIsSavedAutoArchiveEnabled &&
      ageMs >= row.board.shortlistSavedAutoArchiveAfterDays * 86_400_000
    ) {
      jobs.push("ARCHIVE_SAVED");
    }
    if (
      stage === "applied" &&
      row.board.shortlistIsAppliedGhostedEnabled &&
      ageMs >= row.board.shortlistAppliedGhostedAfterDays * 86_400_000
    ) {
      jobs.push("MARK_APPLIED_GHOSTED");
    }

    for (const type of jobs) {
      const result = await db
        .insert(shortlistAutomationCardQueue)
        .values({
          boardId: row.board.id,
          userId: row.userId,
          cardId: row.card.id,
          type,
          scheduledFor: now,
          dedupeKey: `${type}:${row.board.id}:${row.card.id}:${lastActivity.toISOString()}`,
        })
        .onConflictDoNothing({ target: shortlistAutomationCardQueue.dedupeKey })
        .returning({ id: shortlistAutomationCardQueue.id });
      inserted += result.length;
    }
  }

  logger.info({ inserted }, "Card automation jobs generated");
  return inserted;
}

export async function processCardAutomationBatch(
  db: dbClient,
  batchSize = 25,
): Promise<{
  selected: number;
  completed: number;
  skipped: number;
  failed: number;
}> {
  let completed = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimNextCardJob(db);
    if (!job) {
      return {
        selected: completed + skipped + failed,
        completed,
        skipped,
        failed,
      };
    }

    try {
      const context = await getEligibleCardContext(db, job);
      if (!context) {
        await finishCardJob(db, job.id, "SKIPPED");
        skipped += 1;
        continue;
      }

      if (job.type === "ARCHIVE_SAVED") {
        await cardRepo.softDelete(db, {
          cardId: context.card.id,
          deletedAt: new Date(),
          deletedBy: SHORTLIST_ROBOT_USER.id,
        });
        await cardActivityRepo.create(db, {
          type: "card.archived",
          cardId: context.card.id,
          createdBy: SHORTLIST_ROBOT_USER.id,
        });
      } else {
        await markCardGhosted(db, context.board.id, context.card.id);
      }

      await finishCardJob(db, job.id, "COMPLETED");
      completed += 1;
    } catch (error) {
      await db
        .update(shortlistAutomationCardQueue)
        .set({
          status: job.attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
          lastError: error instanceof Error ? error.message : String(error),
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(shortlistAutomationCardQueue.id, job.id));
      failed += 1;
    }
  }

  return { selected: completed + skipped + failed, completed, skipped, failed };
}

async function claimNextCardJob(db: dbClient) {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(shortlistAutomationCardQueue)
      .where(
        and(
          eq(shortlistAutomationCardQueue.status, "PENDING"),
          lte(shortlistAutomationCardQueue.scheduledFor, new Date()),
          or(
            isNull(shortlistAutomationCardQueue.lockedAt),
            lte(
              shortlistAutomationCardQueue.lockedAt,
              new Date(Date.now() - 60 * 60 * 1000),
            ),
          ),
        ),
      )
      .orderBy(asc(shortlistAutomationCardQueue.scheduledFor))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;

    const [claimed] = await tx
      .update(shortlistAutomationCardQueue)
      .set({
        status: "PROCESSING",
        attempts: job.attempts + 1,
        lockedAt: new Date(),
        lockedBy: `card-worker:${process.pid}`,
        updatedAt: new Date(),
      })
      .where(eq(shortlistAutomationCardQueue.id, job.id))
      .returning();
    return claimed ?? null;
  });
}

async function getEligibleCardContext(
  db: dbClient,
  job: typeof shortlistAutomationCardQueue.$inferSelect,
) {
  if (!job.cardId) return null;
  const [row] = await db
    .select({ board: boards, card: cards, listName: lists.name })
    .from(boards)
    .innerJoin(
      users,
      and(eq(users.id, job.userId), eq(boards.createdBy, users.id)),
    )
    .innerJoin(
      lists,
      and(eq(lists.boardId, boards.id), isNull(lists.deletedAt)),
    )
    .innerJoin(
      cards,
      and(
        eq(cards.id, job.cardId),
        eq(cards.listId, lists.id),
        isNull(cards.deletedAt),
      ),
    )
    .where(
      and(
        eq(boards.id, job.boardId),
        isNull(boards.deletedAt),
        eq(boards.isArchived, false),
        lte(users.shortlistPowerpackActivatedAt, new Date()),
        sql`${users.shortlistPowerpackExpiresAt} >= now()`,
      ),
    )
    .limit(1);
  if (!row) return null;

  const stage = row.listName.trim().toLowerCase();
  if (job.type === "ARCHIVE_SAVED") {
    return row.board.shortlistIsSavedAutoArchiveEnabled && stage === "saved"
      ? row
      : null;
  }
  return row.board.shortlistIsAppliedGhostedEnabled && stage === "applied"
    ? row
    : null;
}

async function markCardGhosted(
  db: dbClient,
  boardId: number,
  cardId: number,
): Promise<void> {
  await db.transaction(async (tx) => {
    let [ghostedLabel] = await tx
      .select({ id: labels.id })
      .from(labels)
      .where(
        and(
          eq(labels.boardId, boardId),
          sql`lower(${labels.name}) = 'ghosted'`,
          isNull(labels.deletedAt),
        ),
      )
      .limit(1);

    if (!ghostedLabel) {
      [ghostedLabel] = await tx
        .insert(labels)
        .values({
          publicId: generateUID(),
          boardId,
          name: "Ghosted",
          colourCode: "#737373",
          createdBy: SHORTLIST_ROBOT_USER.id,
        })
        .returning({ id: labels.id });
    }
    if (!ghostedLabel) throw new Error("Unable to create Ghosted label");

    const attached = await tx
      .insert(cardsToLabels)
      .values({ cardId, labelId: ghostedLabel.id })
      .onConflictDoNothing()
      .returning({ cardId: cardsToLabels.cardId });

    if (attached.length > 0) {
      await tx.insert(cardActivities).values({
        publicId: generateUID(),
        type: "card.updated.label.added",
        cardId,
        labelId: ghostedLabel.id,
        createdBy: SHORTLIST_ROBOT_USER.id,
      });
    }
  });
}

async function finishCardJob(
  db: dbClient,
  id: number,
  status: "COMPLETED" | "SKIPPED",
): Promise<void> {
  await db
    .update(shortlistAutomationCardQueue)
    .set({
      status,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(shortlistAutomationCardQueue.id, id));
}
