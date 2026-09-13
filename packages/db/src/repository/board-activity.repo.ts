import { and, desc, eq, isNull, lt } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  boardActivities,
  boards,
  users,
  workspaceMembers,
} from "@kan/db/schema";

export const getPaginatedUserActivities = async (
  db: dbClient,
  userId: string,
  options?: {
    limit?: number;
    cursor?: Date;
  },
) => {
  const limit = options?.limit ?? 20;
  const cursor = options?.cursor;

  const rows = await db
    .select({
      publicId: boardActivities.publicId,
      boardPublicId: boards.publicId,
      name: boardActivities.boardName,
      type: boardActivities.boardType,
      activityType: boardActivities.type,
      createdAt: boardActivities.createdAt,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(boardActivities)
    .leftJoin(
      boards,
      and(eq(boardActivities.boardId, boards.id), isNull(boards.deletedAt)),
    )
    .innerJoin(
      workspaceMembers,
      eq(boardActivities.workspaceId, workspaceMembers.workspaceId),
    )
    .leftJoin(users, eq(boardActivities.createdBy, users.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaceMembers.deletedAt),
        cursor ? lt(boardActivities.createdAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(boardActivities.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    publicId: row.publicId,
    type: row.activityType,
    createdAt: row.createdAt,
    board: {
      publicId: row.boardPublicId,
      name: row.name,
      type: row.type,
    },
    user: row.userId
      ? {
          id: row.userId,
          name: row.userName,
          email: row.userEmail ?? "",
          image: row.userImage,
        }
      : null,
  }));
  const nextCursor = hasMore ? items[items.length - 1]?.createdAt : undefined;

  return {
    activities: items,
    hasMore,
    nextCursor,
  };
};
