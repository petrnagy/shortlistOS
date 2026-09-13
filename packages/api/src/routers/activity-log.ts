import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as boardActivityRepo from "@kan/db/repository/board-activity.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import { boardActivityTypes } from "@kan/db/schema";
import { generateAvatarUrl } from "@kan/shared/utils";

import { activityItemSchema } from "../schemas";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const cardActivityLogItemSchema = activityItemSchema.extend({
  entityType: z.literal("card"),
  card: z.object({
    publicId: z.string(),
    title: z.string(),
  }),
});

const boardActivityLogItemSchema = z.object({
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
]);

export const activityLogRouter = createTRPCRouter({
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
      const [cardResult, boardResult] = await Promise.all([
        cardActivityRepo.getPaginatedUserActivities(ctx.db, userId, {
          limit: input.limit,
          cursor,
        }),
        boardActivityRepo.getPaginatedUserActivities(ctx.db, userId, {
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
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const activities = combinedActivities.slice(0, input.limit);
      const hasMore =
        combinedActivities.length > input.limit ||
        cardResult.hasMore ||
        boardResult.hasMore;

      const activitiesWithAvatarUrls = await Promise.all(
        activities.map(async (activity) => {
          const user = activity.user?.image
            ? {
                ...activity.user,
                image: await generateAvatarUrl(activity.user.image),
              }
            : activity.user;

          if (activity.entityType === "board") {
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
