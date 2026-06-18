import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import { generateAvatarUrl } from "@kan/shared/utils";

import { activityItemSchema } from "../schemas";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const activityLogItemSchema = activityItemSchema.extend({
  card: z.object({
    publicId: z.string(),
    title: z.string(),
  }),
});

export const activityLogRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      openapi: {
        summary: "Get global activity log",
        method: "GET",
        path: "/activity-log",
        description:
          "Retrieves paginated activity across all cards the user can access",
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
      const result = await cardActivityRepo.getPaginatedUserActivities(
        ctx.db,
        userId,
        {
          limit: input.limit,
          cursor,
        },
      );

      const activitiesWithAvatarUrls = await Promise.all(
        result.activities.map(async (activity) => {
          const { id: _id, ...activityWithoutId } = activity;
          const updatedActivity = { ...activityWithoutId };

          if (activity.user?.image) {
            const userAvatarUrl = await generateAvatarUrl(activity.user.image);
            updatedActivity.user = {
              ...activity.user,
              image: userAvatarUrl,
            };
          }

          if (activity.member?.user?.image) {
            const memberAvatarUrl = await generateAvatarUrl(
              activity.member.user.image,
            );
            updatedActivity.member = {
              ...activity.member,
              user: {
                ...activity.member.user,
                image: memberAvatarUrl,
              },
            };
          }

          return updatedActivity;
        }),
      );

      return {
        activities: activitiesWithAvatarUrls,
        hasMore: result.hasMore,
        nextCursor: result.nextCursor?.toISOString() ?? null,
      };
    }),
});
