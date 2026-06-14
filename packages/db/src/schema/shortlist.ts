import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  json,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { boards } from "./boards";
import { cards } from "./cards";
import { users } from "./users";

export const shortlistInbox = pgTable(
  "shortlist_inbox",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: bigint("cardId", { mode: "number" }).references(() => cards.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
    processedAt: timestamp("processedAt"),
    processingTries: smallint("processingTries").notNull().default(0),
    rawContent: text("rawContent"),
    contentType: varchar("contentType", { length: 20 }).notNull(),
    source: varchar("source", { length: 20 }).notNull(),
    processingLog: text("processingLog"),
    processingResult: varchar("processingResult", { length: 10 }).notNull(),
  },
  (table) => [
    index("shortlist_inbox_created_at_idx").on(table.createdAt),
    index("shortlist_inbox_processed_at_idx").on(table.processedAt),
    index("shortlist_inbox_processing_result_idx").on(table.processingResult),
  ],
).enableRLS();

export const shortlistInboxRelations = relations(shortlistInbox, ({ one }) => ({
  createdByUser: one(users, {
    fields: [shortlistInbox.createdBy],
    references: [users.id],
    relationName: "shortlistInboxCreatedByUser",
  }),
  card: one(cards, {
    fields: [shortlistInbox.cardId],
    references: [cards.id],
    relationName: "shortlistInboxCard",
  }),
}));

export const shortlistSalaryCache = pgTable(
  "shortlist_salary_cache",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    jobTitleNormalized: varchar("jobTitleNormalized", { length: 255 }),
    countryCode: varchar("countryCode", { length: 100 }),
    salaryMin: integer("salaryMin"),
    salaryMax: integer("salaryMax"),
    salaryMedian: integer("salaryMedian"),
    currency: varchar("currency", { length: 10 }),
    percentile25: integer("percentile25"),
    percentile50: integer("percentile50"),
    percentile75: integer("percentile75"),
    source: varchar("source", { length: 50 }),
    fetchedAt: timestamp("fetchedAt"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
    took: numeric("took", {
      precision: 10,
      scale: 4,
    }),
  },
  (table) => [
    index("shortlist_salary_cache_job_title_normalized_idx").on(
      table.jobTitleNormalized,
    ),
    index("shortlist_salary_cache_country_code_idx").on(table.countryCode),
    index("shortlist_salary_cache_fetched_at_idx").on(table.fetchedAt),
    index("shortlist_salary_cache_expires_at_idx").on(table.expiresAt),
  ],
).enableRLS();

export const shortlistCompanyCache = pgTable(
  "shortlist_company_cache",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    companyNameNormalized: varchar("companyNameNormalized", {
      length: 255,
    }).notNull(),
    companyDomain: varchar("companyDomain", { length: 255 }),
    companyDomainRaw: varchar("companyDomainRaw", { length: 255 }),
    companyRatingAggregated: numeric("companyRatingAggregated", {
      precision: 2,
      scale: 1,
    }),
    companySentiment: jsonb("companySentiment"),
    companyMetadata: jsonb("companyMetadata"),
    fetchedAt: timestamp("fetchedAt"),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
    took: numeric("took", {
      precision: 10,
      scale: 4,
    }),
  },
  (table) => [
    index("shortlist_company_cache_company_name_normalized_idx").on(
      table.companyNameNormalized,
    ),
    index("shortlist_company_cache_company_domain_idx").on(table.companyDomain),
    index("shortlist_company_cache_fetched_at_idx").on(table.fetchedAt),
    index("shortlist_company_cache_expires_at_idx").on(table.expiresAt),
  ],
).enableRLS();

export const shortlistActivityLogs = pgTable(
  "shortlist_activity_log",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: bigint("cardId", { mode: "number" }).references(() => cards.id, {
      onDelete: "set null",
    }),
    boardId: bigint("boardId", { mode: "number" }).references(() => boards.id, {
      onDelete: "set null",
    }),
    activityType: varchar("activityType", { length: 50 }).notNull(),
    activityResult: varchar("activityResult", { length: 10 }).notNull(),
    activityLog: text("activityLog"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    took: numeric("took", {
      precision: 10,
      scale: 4,
    }),
  },
  (table) => [
    index("shortlist_activity_log_user_idx").on(table.userId),
    index("shortlist_activity_log_card_idx").on(table.cardId),
    index("shortlist_activity_log_board_idx").on(table.boardId),
    index("shortlist_activity_log_activity_type_idx").on(table.activityType),
    index("shortlist_activity_log_activity_result_idx").on(
      table.activityResult,
    ),
    index("shortlist_activity_log_created_at_idx").on(table.createdAt),
  ],
).enableRLS();

export const shortlistActivityLogsRelations = relations(
  shortlistActivityLogs,
  ({ one }) => ({
    user: one(users, {
      fields: [shortlistActivityLogs.userId],
      references: [users.id],
      relationName: "shortlistActivityLogsUser",
    }),
    card: one(cards, {
      fields: [shortlistActivityLogs.cardId],
      references: [cards.id],
      relationName: "shortlistActivityLogsCard",
    }),
    board: one(boards, {
      fields: [shortlistActivityLogs.boardId],
      references: [boards.id],
      relationName: "shortlistActivityLogsBoard",
    }),
  }),
);
