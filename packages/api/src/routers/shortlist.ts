import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import * as shortlistRepo from "@kan/db/repository/shortlist.repo";
import { boards, users } from "@kan/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const hasActivePowerpack = (
  user: {
    shortlistPowerpackActivatedAt?: Date | null;
    shortlistPowerpackExpiresAt?: Date | null;
  },
  now = new Date(),
) => {
  const { shortlistPowerpackActivatedAt, shortlistPowerpackExpiresAt } = user;

  return (
    !!shortlistPowerpackActivatedAt &&
    !!shortlistPowerpackExpiresAt &&
    now >= shortlistPowerpackActivatedAt &&
    now <= shortlistPowerpackExpiresAt
  );
};

export const shortlistRouter = createTRPCRouter({
  createMagicLink: protectedProcedure
    .meta({
      openapi: {
        summary: "Create a shortlist Magic Link",
        method: "POST",
        path: "/shortlist/magic-link",
        description: "Queues a URL for shortlist Magic Link card creation.",
        tags: ["Shortlist"],
        protect: true,
      },
    })
    .input(
      z.object({
        boardPublicId: z.string().min(1).max(12),
        url: z.string().trim().url().max(4096),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      const rows = await ctx.db
        .select({
          boardId: boards.id,
          shortlistPowerpackActivatedAt: users.shortlistPowerpackActivatedAt,
          shortlistPowerpackExpiresAt: users.shortlistPowerpackExpiresAt,
        })
        .from(boards)
        .innerJoin(users, eq(boards.createdBy, users.id))
        .where(
          and(
            eq(boards.publicId, input.boardPublicId),
            eq(boards.createdBy, userId),
            eq(users.id, userId),
            isNull(boards.deletedAt),
          ),
        )
        .limit(1);

      const access = rows[0];

      if (!access) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not own this board.",
        });
      }

      if (!hasActivePowerpack(access)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Magic Link requires an active Powerpack.",
        });
      }

      const createdLink = await shortlistRepo.createShortlistLink(ctx.db, {
        boardId: access.boardId,
        createdBy: userId,
        url: input.url,
      });

      if (!createdLink) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create Magic Link.",
        });
      }

      return createdLink;
    }),
});
