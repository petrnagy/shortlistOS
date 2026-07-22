import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { boards } from "./boards";
import { cards } from "./cards";
import { users } from "./users";

export const shortlistAttachmentSources = pgTable(
  "shortlist_attachment_source",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    originalFilename: text("originalFilename").notNull(),
    contentType: text("contentType").notNull(),
    fileSize: bigint("fileSize", { mode: "number" }).notNull(),
    metadataJson: jsonb("metadataJson"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    index("shortlist_attachment_source_created_by_idx").on(table.createdBy),
    index("shortlist_attachment_source_board_idx").on(table.boardId),
    index("shortlist_attachment_source_created_at_idx").on(table.createdAt),
  ],
).enableRLS();

export const shortlistAttachmentSourcesRelations = relations(
  shortlistAttachmentSources,
  ({ one }) => ({
    createdByUser: one(users, {
      fields: [shortlistAttachmentSources.createdBy],
      references: [users.id],
      relationName: "shortlistAttachmentSourcesCreatedByUser",
    }),
    board: one(boards, {
      fields: [shortlistAttachmentSources.boardId],
      references: [boards.id],
      relationName: "shortlistAttachmentSourcesBoard",
    }),
  }),
);

export const shortlistEmailSources = pgTable(
  "shortlist_email_source",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    externId: varchar("externId", { length: 250 }).notNull(),
    fromEmail: text("fromEmail"),
    fromName: text("fromName"),
    subject: text("subject"),
    inReplyTo: text("inReplyTo"),
    referencesJson: jsonb("referencesJson"),
    sentAt: timestamp("sentAt"),
    hasSupportedAttachment: boolean("hasSupportedAttachment")
      .notNull()
      .default(false),
    metadataJson: jsonb("metadataJson"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    index("shortlist_email_source_created_by_idx").on(table.createdBy),
    index("shortlist_email_source_board_idx").on(table.boardId),
    index("shortlist_email_source_created_at_idx").on(table.createdAt),
    uniqueIndex("shortlist_email_source_extern_board_idx").on(
      table.externId,
      table.boardId,
    ),
  ],
).enableRLS();

export const shortlistEmailSourcesRelations = relations(
  shortlistEmailSources,
  ({ one }) => ({
    createdByUser: one(users, {
      fields: [shortlistEmailSources.createdBy],
      references: [users.id],
      relationName: "shortlistEmailSourcesCreatedByUser",
    }),
    board: one(boards, {
      fields: [shortlistEmailSources.boardId],
      references: [boards.id],
      relationName: "shortlistEmailSourcesBoard",
    }),
  }),
);

export const shortlistWebpageSources = pgTable(
  "shortlist_webpage_source",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    metadataJson: jsonb("metadataJson"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    index("shortlist_webpage_source_created_by_idx").on(table.createdBy),
    index("shortlist_webpage_source_board_idx").on(table.boardId),
    index("shortlist_webpage_source_created_at_idx").on(table.createdAt),
  ],
).enableRLS();

export const shortlistWebpageSourcesRelations = relations(
  shortlistWebpageSources,
  ({ one }) => ({
    createdByUser: one(users, {
      fields: [shortlistWebpageSources.createdBy],
      references: [users.id],
      relationName: "shortlistWebpageSourcesCreatedByUser",
    }),
    board: one(boards, {
      fields: [shortlistWebpageSources.boardId],
      references: [boards.id],
      relationName: "shortlistWebpageSourcesBoard",
    }),
  }),
);

export const shortlistSourceObjects = pgTable(
  "shortlist_source_object",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    sourceType: varchar("sourceType", { length: 20 }).notNull(),
    sourceId: uuid("sourceId").notNull(),
    objectType: varchar("objectType", { length: 30 }).notNull(),
    bucket: text("bucket").notNull(),
    s3Key: text("s3Key").notNull(),
    originalFilename: text("originalFilename").notNull(),
    contentType: text("contentType").notNull(),
    fileSize: bigint("fileSize", { mode: "number" }).notNull(),
    metadataJson: jsonb("metadataJson"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("shortlist_source_object_created_by_idx").on(table.createdBy),
    index("shortlist_source_object_board_idx").on(table.boardId),
    index("shortlist_source_object_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
    index("shortlist_source_object_type_idx").on(table.objectType),
    uniqueIndex("shortlist_source_object_s3_key_idx").on(
      table.bucket,
      table.s3Key,
    ),
  ],
).enableRLS();

export const shortlistSourceObjectsRelations = relations(
  shortlistSourceObjects,
  ({ one }) => ({
    createdByUser: one(users, {
      fields: [shortlistSourceObjects.createdBy],
      references: [users.id],
      relationName: "shortlistSourceObjectsCreatedByUser",
    }),
    board: one(boards, {
      fields: [shortlistSourceObjects.boardId],
      references: [boards.id],
      relationName: "shortlistSourceObjectsBoard",
    }),
  }),
);

export const shortlistJobQueue = pgTable(
  "shortlist_job_queue",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    jobType: varchar("jobType", { length: 30 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    sourceType: varchar("sourceType", { length: 20 }).notNull(),
    sourceId: uuid("sourceId").notNull(),
    createdBy: uuid("createdBy")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    payloadJson: jsonb("payloadJson"),
    attempts: smallint("attempts").notNull().default(0),
    maxAttempts: smallint("maxAttempts").notNull().default(3),
    runAfter: timestamp("runAfter").notNull().defaultNow(),
    lockedAt: timestamp("lockedAt"),
    lockedBy: varchar("lockedBy", { length: 100 }),
    processedAt: timestamp("processedAt"),
    error: text("error"),
    processingLog: text("processingLog"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    index("shortlist_job_queue_status_idx").on(table.status),
    index("shortlist_job_queue_run_after_idx").on(table.runAfter),
    index("shortlist_job_queue_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
    uniqueIndex("shortlist_job_queue_source_job_idx").on(
      table.sourceType,
      table.sourceId,
      table.jobType,
    ),
    index("shortlist_job_queue_board_idx").on(table.boardId),
    index("shortlist_job_queue_created_by_idx").on(table.createdBy),
  ],
).enableRLS();

export const shortlistJobQueueRelations = relations(
  shortlistJobQueue,
  ({ one }) => ({
    createdByUser: one(users, {
      fields: [shortlistJobQueue.createdBy],
      references: [users.id],
      relationName: "shortlistJobQueueCreatedByUser",
    }),
    board: one(boards, {
      fields: [shortlistJobQueue.boardId],
      references: [boards.id],
      relationName: "shortlistJobQueueBoard",
    }),
  }),
);

export const shortlistEnrichmentJobs = pgTable(
  "shortlist_enrichment_job",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    cardId: bigint("cardId", { mode: "number" })
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    enrichmentType: varchar("enrichmentType", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    requestKey: varchar("requestKey", { length: 64 }).notNull(),
    requestJson: jsonb("requestJson").notNull(),
    responseJson: jsonb("responseJson"),
    summary: text("summary"),
    attempts: smallint("attempts").notNull().default(0),
    maxAttempts: smallint("maxAttempts").notNull().default(3),
    runAfter: timestamp("runAfter").notNull().defaultNow(),
    lockedAt: timestamp("lockedAt"),
    lockedBy: varchar("lockedBy", { length: 100 }),
    fetchedAt: timestamp("fetchedAt"),
    error: text("error"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    uniqueIndex("shortlist_enrichment_job_card_type_idx").on(
      table.cardId,
      table.enrichmentType,
    ),
    index("shortlist_enrichment_job_status_run_after_idx").on(
      table.status,
      table.runAfter,
    ),
    index("shortlist_enrichment_job_request_key_idx").on(table.requestKey),
  ],
).enableRLS();

export const shortlistEnrichmentJobsRelations = relations(
  shortlistEnrichmentJobs,
  ({ one }) => ({
    card: one(cards, {
      fields: [shortlistEnrichmentJobs.cardId],
      references: [cards.id],
      relationName: "shortlistEnrichmentJobsCard",
    }),
  }),
);

export const shortlistSourceCards = pgTable(
  "shortlist_source_card",
  {
    id: uuid("id")
      .notNull()
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    sourceType: varchar("sourceType", { length: 20 }).notNull(),
    sourceId: uuid("sourceId").notNull(),
    cardId: bigint("cardId", { mode: "number" })
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    matchType: varchar("matchType", { length: 40 }).notNull(),
    contentHash: varchar("contentHash", { length: 64 }),
    classificationJson: jsonb("classificationJson"),
    fieldProvenanceJson: jsonb("fieldProvenanceJson"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt"),
  },
  (table) => [
    uniqueIndex("shortlist_source_card_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
    index("shortlist_source_card_card_idx").on(table.cardId),
    index("shortlist_source_card_hash_idx").on(table.contentHash),
  ],
).enableRLS();

export const shortlistSourceCardsRelations = relations(
  shortlistSourceCards,
  ({ one }) => ({
    card: one(cards, {
      fields: [shortlistSourceCards.cardId],
      references: [cards.id],
      relationName: "shortlistSourceCardsCard",
    }),
  }),
);

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
