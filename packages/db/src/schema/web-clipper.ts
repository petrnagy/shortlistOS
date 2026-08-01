/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
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

export const webClipperStatuses = [
  "QUEUED",
  "PROCESSING",
  "CREATED",
  "ALREADY_EXISTS",
  "NOT_A_JOB",
  "FAILED",
] as const;

export const webClipperStatusEnum = pgEnum(
  "web_clipper_status",
  webClipperStatuses,
);

export const webClipperPairingStatuses = [
  "PENDING",
  "APPROVED",
  "DENIED",
  "CONSUMED",
  "EXPIRED",
] as const;

export const webClipperPairingStatusEnum = pgEnum(
  "web_clipper_pairing_status",
  webClipperPairingStatuses,
);

export const webClipperPairings = pgTable(
  "web_clipper_pairing",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    pollTokenHash: varchar("pollTokenHash", { length: 64 }).notNull(),
    authorizationCodeHash: varchar("authorizationCodeHash", { length: 64 }),
    clientId: varchar("clientId", { length: 64 }).notNull(),
    userId: uuid("userId").references(() => users.id, { onDelete: "cascade" }),
    codeChallenge: varchar("codeChallenge", { length: 128 }).notNull(),
    codeChallengeMethod: varchar("codeChallengeMethod", { length: 8 })
      .notNull()
      .default("S256"),
    scopes: text("scopes").array().notNull(),
    extensionVersion: varchar("extensionVersion", { length: 64 }).notNull(),
    browser: varchar("browser", { length: 16 }).notNull(),
    status: webClipperPairingStatusEnum("status").notNull().default("PENDING"),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    approvedAt: timestamp("approvedAt", { withTimezone: true }),
    deniedAt: timestamp("deniedAt", { withTimezone: true }),
    consumedAt: timestamp("consumedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("web_clipper_pairing_poll_token_hash_idx").on(
      table.pollTokenHash,
    ),
    uniqueIndex("web_clipper_pairing_authorization_code_hash_idx").on(
      table.authorizationCodeHash,
    ),
    index("web_clipper_pairing_expiry_idx").on(table.expiresAt),
    index("web_clipper_pairing_user_idx").on(table.userId),
  ],
);

export const webClipperRefreshTokens = pgTable(
  "web_clipper_refresh_token",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    tokenFamilyId: uuid("tokenFamilyId").notNull(),
    parentTokenId: uuid("parentTokenId"),
    clientId: varchar("clientId", { length: 64 }).notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scopes: text("scopes").array().notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("lastUsedAt", { withTimezone: true }),
    rotatedAt: timestamp("rotatedAt", { withTimezone: true }),
    revokedAt: timestamp("revokedAt", { withTimezone: true }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("web_clipper_refresh_token_hash_idx").on(table.tokenHash),
    index("web_clipper_refresh_token_family_idx").on(table.tokenFamilyId),
    index("web_clipper_refresh_token_expiry_idx").on(table.expiresAt),
  ],
);

export const webClipperClips = pgTable(
  "web_clipper_clip",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    boardId: bigint("boardId", { mode: "number" })
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    status: webClipperStatusEnum("status").notNull().default("QUEUED"),
    sourceUrl: text("sourceUrl").notNull(),
    canonicalUrl: text("canonicalUrl"),
    pageTitle: text("pageTitle").notNull(),
    pageLanguage: varchar("pageLanguage", { length: 64 }),
    pageCapturedAt: timestamp("pageCapturedAt", {
      withTimezone: true,
    }).notNull(),
    encryptedHtml: text("encryptedHtml"),
    encryptedJsonLd: text("encryptedJsonLd"),
    extensionVersion: varchar("extensionVersion", { length: 64 }).notNull(),
    browser: varchar("browser", { length: 16 }).notNull(),
    cardId: bigint("cardId", { mode: "number" }).references(() => cards.id, {
      onDelete: "set null",
    }),
    duplicateCardId: bigint("duplicateCardId", {
      mode: "number",
    }).references(() => cards.id, { onDelete: "set null" }),
    resultJobTitle: text("resultJobTitle"),
    resultCompanyName: text("resultCompanyName"),
    resultBoardName: text("resultBoardName"),
    errorCode: varchar("errorCode", { length: 32 }),
    processingStartedAt: timestamp("processingStartedAt", {
      withTimezone: true,
    }),
    completedAt: timestamp("completedAt", { withTimezone: true }),
    rawContentDeletedAt: timestamp("rawContentDeletedAt", {
      withTimezone: true,
    }),
    createdAt: timestamp("createdAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: jsonb("metadata"),
  },
  (table) => [
    index("web_clipper_clip_user_idx").on(table.userId),
    index("web_clipper_clip_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const webClipperClipRelations = relations(
  webClipperClips,
  ({ one }) => ({
    user: one(users, {
      fields: [webClipperClips.userId],
      references: [users.id],
    }),
    board: one(boards, {
      fields: [webClipperClips.boardId],
      references: [boards.id],
    }),
    card: one(cards, {
      fields: [webClipperClips.cardId],
      references: [cards.id],
      relationName: "webClipperCreatedCard",
    }),
    duplicateCard: one(cards, {
      fields: [webClipperClips.duplicateCardId],
      references: [cards.id],
      relationName: "webClipperDuplicateCard",
    }),
  }),
);
