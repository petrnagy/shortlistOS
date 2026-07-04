import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as feedbackRepo from "@kan/db/repository/feedback.repo";
import { sendEmail } from "@kan/email";
import { createLogger } from "@kan/logger";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const log = createLogger("feedback-router");

export const feedbackRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({
      enabled: false,
      openapi: { enabled: false, method: "POST", path: "/feedback" },
    })
    .input(
      z.object({
        feedback: z.string().min(1),
        url: z.string().min(1),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.user;

      if (!user)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const result = await feedbackRepo.create(ctx.db, {
        feedback: input.feedback,
        createdBy: user.id,
        url: input.url,
      });

      if (!result?.id)
        throw new TRPCError({
          message: `Unable to create feedback`,
          code: "INTERNAL_SERVER_ERROR",
        });

      const feedbackEmailTo = process.env.FEEDBACK_EMAIL_TO;

      if (feedbackEmailTo) {
        try {
          log.info(
            { feedbackId: result.id },
            "Sending feedback notification email",
          );

          await sendEmail(
            feedbackEmailTo,
            `New shortlistOS feedback from ${user.email}`,
            "FEEDBACK_NOTIFICATION",
            {
              feedback: input.feedback,
              feedbackUrl: input.url,
              userEmail: user.email,
              userName: user.name ?? "",
            },
          );

          log.info(
            { feedbackId: result.id },
            "Feedback notification email sent",
          );
        } catch (error) {
          log.error(
            { err: error, feedbackId: result.id },
            "Failed to send feedback notification email",
          );
        }
      } else {
        log.warn(
          { feedbackId: result.id },
          "FEEDBACK_EMAIL_TO is not configured; feedback saved without email notification",
        );
      }

      return { success: true };
    }),
});
