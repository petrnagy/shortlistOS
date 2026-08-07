import {
  bigint,
  bigserial,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { boards } from "./boards";
import { cards } from "./cards";
import { users } from "./users";

export const shortlistAutomationJobStatuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
] as const;
export const shortlistAutomationJobStatusEnum = pgEnum(
  "shortlist_automation_job_status",
  shortlistAutomationJobStatuses,
);

export const shortlistAutomationEmailTypes = [
  "SAVED_REMINDER",
  "APPLIED_FOLLOW_UP",
  "INTERVIEWING_NUDGE",
  "NEGOTIATING_NUDGE",
  "WEEKLY_DIGEST",
] as const;
export type ShortlistAutomationEmailType =
  (typeof shortlistAutomationEmailTypes)[number];
export const shortlistAutomationEmailTypeEnum = pgEnum(
  "shortlist_automation_email_type",
  shortlistAutomationEmailTypes,
);

export const shortlistAutomationCardTypes = [
  "ARCHIVE_SAVED",
  "MARK_APPLIED_GHOSTED",
] as const;
export type ShortlistAutomationCardType =
  (typeof shortlistAutomationCardTypes)[number];
export const shortlistAutomationCardTypeEnum = pgEnum(
  "shortlist_automation_card_type",
  shortlistAutomationCardTypes,
);

const commonQueueColumns = () => ({
  id: bigserial("id", { mode: "number" }).primaryKey(),
  dedupeKey: varchar("dedupeKey", { length: 255 }).notNull(),
  boardId: bigint("boardId", { mode: "number" })
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  cardId: bigint("cardId", { mode: "number" }).references(() => cards.id, {
    onDelete: "cascade",
  }),
  scheduledFor: timestamp("scheduledFor").notNull(),
  status: shortlistAutomationJobStatusEnum("status")
    .notNull()
    .default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  lockedAt: timestamp("lockedAt"),
  lockedBy: varchar("lockedBy", { length: 255 }),
  lastError: text("lastError"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const shortlistAutomationEmailQueue = pgTable(
  "shortlist_automation_email_queue",
  {
    ...commonQueueColumns(),
    type: shortlistAutomationEmailTypeEnum("type").notNull(),
    sentAt: timestamp("sentAt"),
  },
  (table) => [
    uniqueIndex("shortlist_automation_email_dedupe_idx").on(table.dedupeKey),
    index("shortlist_automation_email_pending_idx").on(
      table.status,
      table.scheduledFor,
    ),
    index("shortlist_automation_email_board_idx").on(table.boardId),
    index("shortlist_automation_email_user_idx").on(table.userId),
  ],
).enableRLS();

export const shortlistAutomationCardQueue = pgTable(
  "shortlist_automation_card_queue",
  {
    ...commonQueueColumns(),
    type: shortlistAutomationCardTypeEnum("type").notNull(),
  },
  (table) => [
    uniqueIndex("shortlist_automation_card_dedupe_idx").on(table.dedupeKey),
    index("shortlist_automation_card_pending_idx").on(
      table.status,
      table.scheduledFor,
    ),
    index("shortlist_automation_card_board_idx").on(table.boardId),
    index("shortlist_automation_card_card_idx").on(table.cardId),
  ],
).enableRLS();
