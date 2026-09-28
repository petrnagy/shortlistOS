import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  boards,
  cards,
  shortlistActivityLogs,
  users,
  workspaceMembers,
} from "@kan/db/schema";
import { SHORTLIST_ROBOT_USER } from "@kan/shared/constants";

export type SourceActivityKind = "email" | "web";

export const sourceActivityTypes = [
  "source.web.clipped",
  "source.web.processed",
  "source.web.failed",
  "source.email.received",
  "source.email.processed",
  "source.email.failed",
] as const;

export interface SourceActivityPayload {
  sourceId: string;
  sourceKind: SourceActivityKind;
  sourceTitle: string;
  sourceUrl: string | null;
  reason?: string | null;
}

export async function ensureShortlistRobotUser(db: dbClient) {
  await db
    .insert(users)
    .values({
      id: SHORTLIST_ROBOT_USER.id,
      name: SHORTLIST_ROBOT_USER.name,
      email: SHORTLIST_ROBOT_USER.email,
      emailVerified: true,
      image: SHORTLIST_ROBOT_USER.image,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: SHORTLIST_ROBOT_USER.name,
        email: SHORTLIST_ROBOT_USER.email,
        emailVerified: true,
        image: SHORTLIST_ROBOT_USER.image,
        updatedAt: new Date(),
      },
    });
}

export async function createSourceActivity(
  db: dbClient,
  input: {
    activityType: string;
    activityResult: "SUCCESS" | "FAILED";
    boardId: number;
    cardId?: number | null;
    payload: SourceActivityPayload;
    createdAt?: Date;
  },
) {
  const [activity] = await db
    .insert(shortlistActivityLogs)
    .values({
      userId: SHORTLIST_ROBOT_USER.id,
      boardId: input.boardId,
      cardId: input.cardId ?? null,
      activityType: input.activityType,
      activityResult: input.activityResult,
      activityLog: JSON.stringify(input.payload),
      createdAt: input.createdAt,
    })
    .returning({ id: shortlistActivityLogs.id });

  return activity ?? null;
}

function parseSourceActivityPayload(
  value: string | null,
): SourceActivityPayload {
  if (!value) {
    return {
      sourceId: "",
      sourceKind: "web",
      sourceTitle: "Opportunity",
      sourceUrl: null,
      reason: null,
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<SourceActivityPayload>;
    return {
      sourceId: typeof parsed.sourceId === "string" ? parsed.sourceId : "",
      sourceKind: parsed.sourceKind === "email" ? "email" : "web",
      sourceTitle:
        typeof parsed.sourceTitle === "string" && parsed.sourceTitle.length > 0
          ? parsed.sourceTitle
          : "Opportunity",
      sourceUrl: typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : null,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
    };
  } catch {
    return {
      sourceId: "",
      sourceKind: "web",
      sourceTitle: "Opportunity",
      sourceUrl: null,
      reason: value,
    };
  }
}

export const getPaginatedUserActivities = async (
  db: dbClient,
  userId: string,
  options?: { limit?: number; cursor?: Date },
) => {
  const limit = options?.limit ?? 20;
  const cursor = options?.cursor;
  const rows = await db
    .select({
      id: shortlistActivityLogs.id,
      activityType: shortlistActivityLogs.activityType,
      activityResult: shortlistActivityLogs.activityResult,
      activityLog: shortlistActivityLogs.activityLog,
      createdAt: shortlistActivityLogs.createdAt,
      cardPublicId: cards.publicId,
      cardTitle: cards.title,
      boardPublicId: boards.publicId,
      boardName: boards.name,
      boardType: boards.type,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(shortlistActivityLogs)
    .innerJoin(boards, eq(shortlistActivityLogs.boardId, boards.id))
    .innerJoin(
      workspaceMembers,
      eq(boards.workspaceId, workspaceMembers.workspaceId),
    )
    .leftJoin(
      cards,
      and(eq(shortlistActivityLogs.cardId, cards.id), isNull(cards.deletedAt)),
    )
    .leftJoin(users, eq(shortlistActivityLogs.userId, users.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaceMembers.deletedAt),
        isNull(boards.deletedAt),
        inArray(shortlistActivityLogs.activityType, sourceActivityTypes),
        cursor ? lt(shortlistActivityLogs.createdAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(shortlistActivityLogs.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const activities = rows.slice(0, limit).map((row) => {
    const payload = parseSourceActivityPayload(row.activityLog);
    return {
      publicId: row.id,
      type: row.activityType,
      result: row.activityResult as "SUCCESS" | "FAILED",
      createdAt: row.createdAt,
      sourceKind: payload.sourceKind,
      sourceTitle: payload.sourceTitle,
      sourceUrl: payload.sourceUrl,
      reason: payload.reason,
      card: row.cardPublicId
        ? { publicId: row.cardPublicId, title: row.cardTitle ?? "" }
        : null,
      board: {
        publicId: row.boardPublicId,
        name: row.boardName,
        type: row.boardType,
      },
      user: row.userId
        ? {
            id: row.userId,
            name: row.userName,
            email: row.userEmail ?? "",
            image: row.userImage,
          }
        : null,
    };
  });

  return {
    activities,
    hasMore,
    nextCursor: hasMore
      ? activities[activities.length - 1]?.createdAt
      : undefined,
  };
};
