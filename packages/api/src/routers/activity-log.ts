import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as boardActivityRepo from "@kan/db/repository/board-activity.repo";
import * as boardRepo from "@kan/db/repository/board.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import { getImportContext } from "@kan/db/repository/shortlist-intake.repo";
import * as shortlistActivityLogRepo from "@kan/db/repository/shortlistActivityLog.repo";
import { boardActivityTypes } from "@kan/db/schema";
import { generateAvatarUrl } from "@kan/shared/utils";

import { activityItemSchema } from "../schemas";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertUserInWorkspace } from "../utils/auth";
import { assertPermission } from "../utils/permissions";

const cardActivityLogItemSchema = activityItemSchema.extend({
  entityType: z.literal("card"),
  card: z.object({
    publicId: z.string(),
    title: z.string(),
  }),
});

const boardActivityLogItemSchema = z.object({
  actorClientName: z.string().nullable().optional(),
  entityType: z.literal("board"),
  publicId: z.string(),
  type: z.enum(boardActivityTypes),
  createdAt: z.date(),
  board: z.object({
    publicId: z.string().nullable(),
    name: z.string(),
    type: z.enum(["regular", "template"]),
  }),
  user: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      email: z.string(),
      image: z.string().nullable(),
    })
    .nullable(),
});

const activityLogItemSchema = z.discriminatedUnion("entityType", [
  cardActivityLogItemSchema,
  boardActivityLogItemSchema,
  z.object({
    entityType: z.literal("source"),
    publicId: z.string(),
    type: z.string(),
    result: z.enum(["SUCCESS", "FAILED"]),
    createdAt: z.date(),
    sourceKind: z.enum(shortlistActivityLogRepo.sourceActivityKinds),
    attempt: z.number().int().nonnegative().optional(),
    sourceTitle: z.string(),
    sourceUrl: z.string().nullable(),
    reason: z.string().nullable(),
    card: z
      .object({
        publicId: z.string(),
        title: z.string(),
      })
      .nullable(),
    board: z.object({
      publicId: z.string(),
      name: z.string(),
      type: z.enum(["regular", "template"]),
    }),
    user: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string(),
        image: z.string().nullable(),
      })
      .nullable(),
  }),
]);

export const activityLogRouter = createTRPCRouter({
  recordImportFailure: protectedProcedure
    .meta({
      openapi: {
        summary: "Record a failed opportunity import",
        method: "POST",
        path: "/activity-log/import-failure",
        tags: ["Activity Log"],
        protect: true,
      },
    })
    .input(
      z.object({
        boardPublicId: z.string().length(12),
        sourceKind: z.enum(["upload", "link", "text"]),
        sourceTitle: z.string().trim().min(1).max(512),
        sourceUrl: z
          .string()
          .url()
          .max(4096)
          .refine((value) => {
            const url = new URL(value);
            return (
              ["http:", "https:"].includes(url.protocol) &&
              !url.username &&
              !url.password
            );
          })
          .optional(),
        reason: z.enum(["PAGE_FETCH_FAILED", "SUBMISSION_FAILED"]),
      }),
    )
    .output(z.object({ recorded: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId)
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      const board = await boardRepo.getWorkspaceAndBoardIdByBoardPublicId(
        ctx.db,
        input.boardPublicId,
      );
      if (!board)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shortlist not found",
        });
      await assertUserInWorkspace(ctx.db, userId, board.workspaceId);
      await assertPermission(ctx.db, userId, board.workspaceId, "card:create");
      const { user, activeBoard } = await getImportContext(ctx.db, {
        boardId: board.id,
        userId,
      });
      const now = new Date();
      if (
        !activeBoard ||
        !user?.shortlistPowerpackActivatedAt ||
        !user.shortlistPowerpackExpiresAt ||
        now < user.shortlistPowerpackActivatedAt ||
        now > user.shortlistPowerpackExpiresAt
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An active Powerpack and shortlist are required",
        });
      }
      await shortlistActivityLogRepo.ensureShortlistRobotUser(ctx.db);
      await shortlistActivityLogRepo.createSourceActivity(ctx.db, {
        activityType: `source.${input.sourceKind}.failed`,
        activityResult: "FAILED",
        boardId: board.id,
        payload: {
          sourceId: "",
          sourceKind: input.sourceKind,
          sourceTitle: input.sourceTitle,
          sourceUrl: input.sourceUrl ?? null,
          reason:
            input.reason === "PAGE_FETCH_FAILED"
              ? "The website could not be read. Use pasted text or the Web Clipper instead."
              : "The opportunity could not be submitted. Please try again.",
        },
      });
      return { recorded: true };
    }),
  list: protectedProcedure
    .meta({
      openapi: {
        summary: "Get global activity log",
        method: "GET",
        path: "/activity-log",
        description:
          "Retrieves paginated activity across all cards and boards the user can access",
        tags: ["Activity Log"],
        protect: true,
      },
    })
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(20),
        cursor: z.string().datetime().optional(),
      }),
    )
    .output(
      z.object({
        activities: z.array(activityLogItemSchema),
        hasMore: z.boolean(),
        nextCursor: z.string().datetime().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId) {
        throw new TRPCError({
          message: "User not authenticated",
          code: "UNAUTHORIZED",
        });
      }

      const cursor = input.cursor ? new Date(input.cursor) : undefined;
      const [cardResult, boardResult, sourceResult] = await Promise.all([
        cardActivityRepo.getPaginatedUserActivities(ctx.db, userId, {
          limit: input.limit,
          cursor,
        }),
        boardActivityRepo.getPaginatedUserActivities(ctx.db, userId, {
          limit: input.limit,
          cursor,
        }),
        shortlistActivityLogRepo.getPaginatedUserActivities(ctx.db, userId, {
          limit: input.limit,
          cursor,
        }),
      ]);

      const combinedActivities = [
        ...cardResult.activities.map((activity) => {
          const { id: _id, ...activityWithoutId } = activity;

          return {
            ...activityWithoutId,
            entityType: "card" as const,
          };
        }),
        ...boardResult.activities.map((activity) => ({
          ...activity,
          entityType: "board" as const,
        })),
        ...sourceResult.activities.map((activity) => ({
          ...activity,
          result: activity.result,
          reason: activity.reason ?? null,
          entityType: "source" as const,
        })),
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const activities = combinedActivities.slice(0, input.limit);
      const hasMore =
        combinedActivities.length > input.limit ||
        cardResult.hasMore ||
        boardResult.hasMore ||
        sourceResult.hasMore;

      const activitiesWithAvatarUrls = await Promise.all(
        activities.map(async (activity) => {
          const user = activity.user?.image
            ? {
                ...activity.user,
                image: await generateAvatarUrl(activity.user.image),
              }
            : activity.user;

          if (
            activity.entityType === "board" ||
            activity.entityType === "source"
          ) {
            return {
              ...activity,
              user,
            };
          }

          let member = activity.member;
          if (activity.member?.user?.image) {
            const memberAvatarUrl = await generateAvatarUrl(
              activity.member.user.image,
            );
            member = {
              ...activity.member,
              user: {
                ...activity.member.user,
                image: memberAvatarUrl,
              },
            };
          }

          return {
            ...activity,
            user,
            member,
          };
        }),
      );

      const nextCursor = hasMore
        ? activities[activities.length - 1]?.createdAt
        : undefined;

      return {
        activities: activitiesWithAvatarUrls,
        hasMore,
        nextCursor: nextCursor?.toISOString() ?? null,
      };
    }),
});
