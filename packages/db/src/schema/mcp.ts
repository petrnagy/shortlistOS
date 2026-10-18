import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const mcpClients = pgTable("mcp_client", {
  publicId: varchar("publicId", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  redirectUris: jsonb("redirectUris").$type<string[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}).enableRLS();

export const mcpConnections = pgTable(
  "mcp_connection",
  {
    publicId: varchar("publicId", { length: 12 }).primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: varchar("clientId", { length: 64 })
      .notNull()
      .references(() => mcpClients.publicId),
    clientName: varchar("clientName", { length: 100 }).notNull(),
    accessTokenHash: varchar("accessTokenHash", { length: 64 })
      .notNull()
      .unique(),
    refreshTokenHash: varchar("refreshTokenHash", { length: 64 })
      .notNull()
      .unique(),
    accessExpiresAt: timestamp("accessExpiresAt").notNull(),
    refreshExpiresAt: timestamp("refreshExpiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  (t) => [index("mcp_connection_user_idx").on(t.userId)],
).enableRLS();

export const mcpAuthorizationCodes = pgTable("mcp_authorization_code", {
  codeHash: varchar("codeHash", { length: 64 }).primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  clientId: varchar("clientId", { length: 64 })
    .notNull()
    .references(() => mcpClients.publicId),
  redirectUri: varchar("redirectUri", { length: 2048 }).notNull(),
  challenge: varchar("challenge", { length: 43 }).notNull(),
  resource: varchar("resource", { length: 2048 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
}).enableRLS();

export const mcpConsumedRefreshTokens = pgTable("mcp_consumed_refresh_token", {
  tokenHash: varchar("tokenHash", { length: 64 }).primaryKey(),
  connectionPublicId: varchar("connectionPublicId", { length: 12 })
    .notNull()
    .references(() => mcpConnections.publicId, { onDelete: "cascade" }),
  expiresAt: timestamp("expiresAt").notNull(),
}).enableRLS();
