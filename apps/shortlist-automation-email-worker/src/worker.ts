import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { ShortlistAutomationEmailType } from "@kan/db/schema";
import {
  boards,
  cards,
  cardsToLabels,
  labels,
  lists,
  shortlistAutomationEmailQueue,
  users,
} from "@kan/db/schema";
import { sendEmail } from "@kan/email";
import { createLogger } from "@kan/logger";

import { getLocalTime, isAutomationSendHour } from "./time";

const logger = createLogger("shortlist-automation-email-worker");
const MAX_ATTEMPTS = 3;

const EMAIL_CONFIG: Record<
  Exclude<ShortlistAutomationEmailType, "WEEKLY_DIGEST">,
  {
    stage: string;
    enabled: keyof typeof boards.$inferSelect;
    days: keyof typeof boards.$inferSelect;
  }
> = {
  SAVED_REMINDER: {
    stage: "saved",
    enabled: "shortlistIsSavedReminderEnabled",
    days: "shortlistSavedReminderAfterDays",
  },
  APPLIED_FOLLOW_UP: {
    stage: "applied",
    enabled: "shortlistIsAppliedFollowUpReminderEnabled",
    days: "shortlistAppliedFollowUpReminderAfterDays",
  },
  INTERVIEWING_NUDGE: {
    stage: "interviewing",
    enabled: "shortlistIsInterviewingNudgeEnabled",
    days: "shortlistInterviewingNudgeAfterDays",
  },
  NEGOTIATING_NUDGE: {
    stage: "negotiating",
    enabled: "shortlistIsNegotiatingNudgeEnabled",
    days: "shortlistNegotiatingNudgeAfterDays",
  },
};

export async function enqueueDueAutomationEmails(
  db: dbClient,
  now = new Date(),
): Promise<number> {
  const rows = await db
    .select({
      board: boards,
      card: cards,
      listName: lists.name,
      user: users,
      ghosted: sql<boolean>`exists (
        select 1 from ${cardsToLabels}
        inner join ${labels} on ${labels.id} = ${cardsToLabels.labelId}
        where ${cardsToLabels.cardId} = ${cards.id}
          and lower(${labels.name}) = 'ghosted'
          and ${labels.deletedAt} is null
      )`,
    })
    .from(boards)
    .innerJoin(users, eq(boards.createdBy, users.id))
    .leftJoin(lists, and(eq(lists.boardId, boards.id), isNull(lists.deletedAt)))
    .leftJoin(
      cards,
      and(
        eq(cards.listId, lists.id),
        isNull(cards.deletedAt),
        eq(cards.manualUpdatedOnly, false),
      ),
    )
    .where(
      and(
        isNull(boards.deletedAt),
        eq(boards.isArchived, false),
        eq(boards.type, "regular"),
        lte(users.shortlistPowerpackActivatedAt, now),
        sql`${users.shortlistPowerpackExpiresAt} >= ${now}`,
      ),
    );

  let inserted = 0;
  const weeklyBoards = new Set<number>();

  for (const row of rows) {
    const local = getLocalTime(now, row.user.shortlistTimezone);
    if (!isAutomationSendHour(local)) continue;

    if (
      row.board.shortlistIsWeeklyDigestEnabled &&
      local.weekday === "Mon" &&
      !weeklyBoards.has(row.board.id)
    ) {
      weeklyBoards.add(row.board.id);
      const result = await db
        .insert(shortlistAutomationEmailQueue)
        .values({
          boardId: row.board.id,
          userId: row.user.id,
          type: "WEEKLY_DIGEST",
          scheduledFor: now,
          dedupeKey: `WEEKLY_DIGEST:${row.user.id}:${row.board.id}:${local.date}`,
        })
        .onConflictDoNothing({
          target: shortlistAutomationEmailQueue.dedupeKey,
        })
        .returning({ id: shortlistAutomationEmailQueue.id });
      inserted += result.length;
    }

    if (!row.card || !row.listName) continue;
    const stage = row.listName.trim().toLowerCase();
    const lastActivity = row.card.updatedAt ?? row.card.createdAt;

    for (const [type, config] of Object.entries(EMAIL_CONFIG) as [
      Exclude<ShortlistAutomationEmailType, "WEEKLY_DIGEST">,
      (typeof EMAIL_CONFIG)[Exclude<
        ShortlistAutomationEmailType,
        "WEEKLY_DIGEST"
      >],
    ][]) {
      if (
        stage !== config.stage ||
        row.board[config.enabled] !== true ||
        (type === "APPLIED_FOLLOW_UP" && row.ghosted)
      )
        continue;
      const days = Number(row.board[config.days]);
      if (now.getTime() - lastActivity.getTime() < days * 86_400_000) continue;

      const result = await db
        .insert(shortlistAutomationEmailQueue)
        .values({
          boardId: row.board.id,
          userId: row.user.id,
          cardId: row.card.id,
          type,
          scheduledFor: now,
          dedupeKey: `${type}:${row.user.id}:${row.board.id}:${row.card.id}:${local.date}`,
        })
        .onConflictDoNothing({
          target: shortlistAutomationEmailQueue.dedupeKey,
        })
        .returning({ id: shortlistAutomationEmailQueue.id });
      inserted += result.length;
    }
  }

  logger.info(
    { inserted, weeklyBoards: weeklyBoards.size },
    "Email jobs generated",
  );
  return inserted;
}

export async function processAutomationEmailBatch(
  db: dbClient,
  batchSize = 25,
): Promise<{
  selected: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimNextEmailJob(db);
    if (!job)
      return { selected: sent + skipped + failed, sent, skipped, failed };

    try {
      const context = await getEligibleEmailContext(db, job);
      if (!context) {
        await finishEmailJob(db, job.id, "SKIPPED");
        skipped += 1;
        continue;
      }

      await sendAutomationEmail(db, job.type, context);
      await db
        .update(shortlistAutomationEmailQueue)
        .set({
          status: "COMPLETED",
          sentAt: new Date(),
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(shortlistAutomationEmailQueue.id, job.id));
      sent += 1;
    } catch (error) {
      const attempts = job.attempts;
      await db
        .update(shortlistAutomationEmailQueue)
        .set({
          status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
          scheduledFor: new Date(Date.now() + 60 * 60 * 1000),
          lastError: error instanceof Error ? error.message : String(error),
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date(),
        })
        .where(eq(shortlistAutomationEmailQueue.id, job.id));
      failed += 1;
    }
  }

  return { selected: sent + skipped + failed, sent, skipped, failed };
}

async function claimNextEmailJob(db: dbClient) {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(shortlistAutomationEmailQueue)
      .where(
        and(
          eq(shortlistAutomationEmailQueue.status, "PENDING"),
          lte(shortlistAutomationEmailQueue.scheduledFor, new Date()),
          or(
            isNull(shortlistAutomationEmailQueue.lockedAt),
            lte(
              shortlistAutomationEmailQueue.lockedAt,
              new Date(Date.now() - 60 * 60 * 1000),
            ),
          ),
        ),
      )
      .orderBy(asc(shortlistAutomationEmailQueue.scheduledFor))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!job) return null;

    const [claimed] = await tx
      .update(shortlistAutomationEmailQueue)
      .set({
        status: "PROCESSING",
        attempts: job.attempts + 1,
        lockedAt: new Date(),
        lockedBy: `email-worker:${process.pid}`,
        updatedAt: new Date(),
      })
      .where(eq(shortlistAutomationEmailQueue.id, job.id))
      .returning();
    return claimed ?? null;
  });
}

async function getEligibleEmailContext(
  db: dbClient,
  job: typeof shortlistAutomationEmailQueue.$inferSelect,
) {
  const [row] = await db
    .select({
      board: boards,
      card: cards,
      listName: lists.name,
      user: users,
      ghosted: sql<boolean>`exists (
        select 1 from ${cardsToLabels}
        inner join ${labels} on ${labels.id} = ${cardsToLabels.labelId}
        where ${cardsToLabels.cardId} = ${cards.id}
          and lower(${labels.name}) = 'ghosted'
          and ${labels.deletedAt} is null
      )`,
    })
    .from(boards)
    .innerJoin(
      users,
      and(eq(boards.createdBy, users.id), eq(users.id, job.userId)),
    )
    .leftJoin(
      cards,
      and(
        job.cardId === null ? sql`false` : eq(cards.id, job.cardId),
        isNull(cards.deletedAt),
        eq(cards.manualUpdatedOnly, false),
      ),
    )
    .leftJoin(lists, and(eq(cards.listId, lists.id), isNull(lists.deletedAt)))
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
  if (!row || !isEmailTypeEnabled(job.type, row.board)) return null;
  if (job.type !== "WEEKLY_DIGEST" && (!row.card || !row.listName)) return null;
  if (job.type === "APPLIED_FOLLOW_UP" && row.ghosted) return null;
  return row;
}

function isEmailTypeEnabled(
  type: ShortlistAutomationEmailType,
  board: typeof boards.$inferSelect,
): boolean {
  if (type === "WEEKLY_DIGEST") return board.shortlistIsWeeklyDigestEnabled;
  return board[EMAIL_CONFIG[type].enabled] === true;
}

async function sendAutomationEmail(
  db: dbClient,
  type: ShortlistAutomationEmailType,
  context: NonNullable<Awaited<ReturnType<typeof getEligibleEmailContext>>>,
) {
  const baseUrl = (
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.shortlistos.co"
  ).replace(/\/$/, "");
  const actionUrl = context.card
    ? `${baseUrl}/boards/${context.board.publicId}?card=${context.card.publicId}`
    : `${baseUrl}/boards/${context.board.publicId}`;
  const common = {
    boardName: context.board.name,
    actionUrl,
    cardTitle: context.card?.title ?? "",
  };

  if (type === "WEEKLY_DIGEST") {
    const counts = await getDigestCounts(db, context.board.id);
    await sendEmail(
      context.user.email,
      `Your weekly ${context.board.name} digest`,
      "SHORTLIST_WEEKLY_DIGEST",
      { ...common, summary: counts },
    );
    return;
  }

  const templates = {
    SAVED_REMINDER: [
      "Opportunity waiting in Saved",
      "SHORTLIST_SAVED_REMINDER",
    ],
    APPLIED_FOLLOW_UP: ["Time to follow up", "SHORTLIST_APPLIED_FOLLOW_UP"],
    INTERVIEWING_NUDGE: [
      "Keep your interview moving",
      "SHORTLIST_INTERVIEWING_NUDGE",
    ],
    NEGOTIATING_NUDGE: [
      "Your negotiation needs attention",
      "SHORTLIST_NEGOTIATING_NUDGE",
    ],
  } as const;
  const [subject, template] = templates[type];
  await sendEmail(context.user.email, subject, template, common);
}

async function getDigestCounts(db: dbClient, boardId: number): Promise<string> {
  const rows = await db
    .select({ stage: lists.name, count: sql<number>`count(${cards.id})::int` })
    .from(lists)
    .leftJoin(
      cards,
      and(
        eq(cards.listId, lists.id),
        isNull(cards.deletedAt),
        eq(cards.manualUpdatedOnly, false),
      ),
    )
    .where(and(eq(lists.boardId, boardId), isNull(lists.deletedAt)))
    .groupBy(lists.id, lists.name)
    .orderBy(asc(lists.index));
  return rows.map((row) => `${row.stage}: ${row.count}`).join(" · ");
}

async function finishEmailJob(
  db: dbClient,
  id: number,
  status: "SKIPPED",
): Promise<void> {
  await db
    .update(shortlistAutomationEmailQueue)
    .set({
      status,
      completedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(shortlistAutomationEmailQueue.id, id));
}
