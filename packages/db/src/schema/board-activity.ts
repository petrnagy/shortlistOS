import { relations } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { boards, boardTypeEnum } from "./boards";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const boardActivityTypes = [
  "board.created",
  "board.deleted",
  "board.archived",
  "board.unarchived",
] as const;
export const boardActivityTypeEnum = pgEnum(
  "board_activity_type",
  boardActivityTypes,
);

export const boardActivities = pgTable(
  "board_activity",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    publicId: varchar("publicId", { length: 12 }).notNull().unique(),
    type: boardActivityTypeEnum("type").notNull(),
    boardId: bigint("boardId", { mode: "number" }).references(() => boards.id, {
      onDelete: "set null",
    }),
    boardName: varchar("boardName", { length: 255 }).notNull(),
    boardType: boardTypeEnum("boardType").notNull(),
    workspaceId: bigint("workspaceId", { mode: "number" })
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: uuid("createdBy").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("board_activity_workspace_created_at_idx").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("board_activity_board_idx").on(table.boardId),
  ],
).enableRLS();

export const boardActivitiesRelations = relations(
  boardActivities,
  ({ one }) => ({
    board: one(boards, {
      fields: [boardActivities.boardId],
      references: [boards.id],
    }),
    workspace: one(workspaces, {
      fields: [boardActivities.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [boardActivities.createdBy],
      references: [users.id],
    }),
  }),
);
