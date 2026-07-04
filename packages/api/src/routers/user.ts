import { TRPCError } from "@trpc/server";
import { z } from "zod";

import * as exportRepo from "@kan/db/repository/export.repo";
import * as userRepo from "@kan/db/repository/user.repo";
import { generateAttachmentUrl, generateAvatarUrl } from "@kan/shared/utils";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const exportPersonSchema = z
  .object({
    name: z.string().nullable(),
    email: z.string(),
    profilePictureUrl: z.string().nullable(),
  })
  .nullable();

const userDataExportSchema = z.object({
  exportedAt: z.date(),
  account: z.object({
    email: z.string(),
    emailVerified: z.boolean(),
    name: z.string().nullable(),
    profilePictureUrl: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    shortlistPowerpackActivatedAt: z.date().nullable(),
    shortlistPowerpackExpiresAt: z.date().nullable(),
    shortlistTimezone: z.string(),
    shortlistLastActivity: z.date().nullable(),
    workspaces: z.array(z.unknown()),
  }),
  shortlists: z.array(z.unknown()),
});

export const userRouter = createTRPCRouter({
  getUser: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/users/me",
        summary: "Get user",
        description:
          "Retrieves the currently authenticated user's profile information",
        tags: ["Users"],
        protect: true,
      },
    })
    .input(z.void())
    .output(
      z.object({
        id: z.string(),
        email: z.string(),
        name: z.string().nullable(),
        image: z.string().nullable(),
        stripeCustomerId: z.string().nullable(),
        shortlistPowerpackActivatedAt: z.date().nullable(),
        shortlistPowerpackExpiresAt: z.date().nullable(),
        shortlistFeedSecret: z.string().nullable(),
        shortlistUserPublicSecret: z.string().nullable(),
        hasPassword: z.boolean(),
        hasMagicLinkAccount: z.boolean(),
        apiKey: z
          .object({
            id: z.number(),
            prefix: z.string().nullable(),
          })
          .nullable(),
      }),
    )
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const result = await userRepo.getById(ctx.db, userId);

      if (!result) {
        throw new TRPCError({
          message: `User not found`,
          code: "NOT_FOUND",
        });
      }

      const apiKey = result.apiKeys[0];

      // Generate presigned URL for avatar
      const imageUrl = await generateAvatarUrl(result.image);

      return {
        ...result,
        image: imageUrl,
        hasPassword: result.hasPassword,
        hasMagicLinkAccount: result.hasMagicLinkAccount,
        apiKey: apiKey ? { id: apiKey.id, prefix: apiKey.prefix } : null,
      };
    }),
  update: protectedProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/users",
        summary: "Update user",
        description:
          "Updates the currently authenticated user's profile information",
        tags: ["Users"],
        protect: true,
      },
    })
    .input(
      z.object({
        name: z.string().optional(),
        image: z.string().optional(),
      }),
    )
    .output(
      z.object({
        name: z.string().nullable(),
        image: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const result = await userRepo.update(ctx.db, userId, input);

      if (!result) {
        throw new TRPCError({
          message: `User not found`,
          code: "NOT_FOUND",
        });
      }

      // Generate presigned URL for avatar
      const imageUrl = await generateAvatarUrl(result.image);

      return {
        ...result,
        image: imageUrl,
      };
    }),
  setPassword: protectedProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/users/me/password",
        summary: "Set password",
        description:
          "Sets a password for a user who signed up via magic link and has no password yet",
        tags: ["Users"],
        protect: true,
      },
    })
    .input(
      z.object({
        newPassword: z
          .string()
          .min(8, "Password must be at least 8 characters"),
      }),
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const existing = await userRepo.getById(ctx.db, userId);

      if (!existing) {
        throw new TRPCError({
          message: `User not found`,
          code: "NOT_FOUND",
        });
      }

      if (existing.hasPassword) {
        throw new TRPCError({
          message: `Password already set; use change password instead`,
          code: "BAD_REQUEST",
        });
      }

      try {
        await ctx.auth.api.setPassword({ newPassword: input.newPassword });
      } catch {
        throw new TRPCError({
          message: "Failed to set password",
          code: "INTERNAL_SERVER_ERROR",
        });
      }

      return { success: true };
    }),
  exportData: protectedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/users/me/export",
        summary: "Export user data",
        description:
          "Exports the currently authenticated user's account and shortlist data as JSON",
        tags: ["Users"],
        protect: true,
      },
    })
    .input(z.void())
    .output(userDataExportSchema)
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;

      if (!userId)
        throw new TRPCError({
          message: `User not authenticated`,
          code: "UNAUTHORIZED",
        });

      const exportData = await exportRepo.getUserExportData(ctx.db, userId);

      if (!exportData) {
        throw new TRPCError({
          message: `User not found`,
          code: "NOT_FOUND",
        });
      }

      const formatPerson = async (
        person: {
          name: string | null;
          email: string;
          image?: string | null;
        } | null,
      ): Promise<z.infer<typeof exportPersonSchema>> => {
        if (!person) return null;

        return {
          name: person.name,
          email: person.email,
          profilePictureUrl: await generateAvatarUrl(person.image),
        };
      };

      const shortlists = await Promise.all(
        exportData.shortlists.map(async (shortlist) => ({
          id: shortlist.publicId,
          name: shortlist.name,
          description: shortlist.description,
          slug: shortlist.slug,
          visibility: shortlist.visibility,
          defaultLists: false,
          isArchived: shortlist.isArchived,
          createdAt: shortlist.createdAt,
          updatedAt: shortlist.updatedAt,
          workspace: {
            id: shortlist.workspace.publicId,
            name: shortlist.workspace.name,
            slug: shortlist.workspace.slug,
            cardPrefix: shortlist.workspace.cardPrefix,
          },
          settings: {
            salaryDataEnabled: shortlist.shortlistIsSalaryDataEnabled,
            companySentimentEnabled:
              shortlist.shortlistIsCompanySentimentEnabled,
            magicInboxEnabled: shortlist.shortlistIsMagicInboxEnabled,
            calendarFeedEnabled: shortlist.shortlistIsCalendarFeedEnabled,
            savedReminderEnabled: shortlist.shortlistIsSavedReminderEnabled,
            savedReminderAfterDays: shortlist.shortlistSavedReminderAfterDays,
            savedAutoArchiveEnabled:
              shortlist.shortlistIsSavedAutoArchiveEnabled,
            savedAutoArchiveAfterDays:
              shortlist.shortlistSavedAutoArchiveAfterDays,
            appliedFollowUpReminderEnabled:
              shortlist.shortlistIsAppliedFollowUpReminderEnabled,
            appliedFollowUpReminderAfterDays:
              shortlist.shortlistAppliedFollowUpReminderAfterDays,
            appliedGhostedEnabled: shortlist.shortlistIsAppliedGhostedEnabled,
            appliedGhostedAfterDays: shortlist.shortlistAppliedGhostedAfterDays,
            interviewingNudgeEnabled:
              shortlist.shortlistIsInterviewingNudgeEnabled,
            interviewingNudgeAfterDays:
              shortlist.shortlistInterviewingNudgeAfterDays,
            negotiatingNudgeEnabled:
              shortlist.shortlistIsNegotiatingNudgeEnabled,
            negotiatingNudgeAfterDays:
              shortlist.shortlistNegotiatingNudgeAfterDays,
            weeklyDigestEnabled: shortlist.shortlistIsWeeklyDigestEnabled,
            cardAgingEnabled: shortlist.shortlistIsCardAgingEnabled,
          },
          labels: shortlist.labels.map((label) => ({
            id: label.publicId,
            name: label.name,
            color: label.colourCode,
            createdAt: label.createdAt,
            updatedAt: label.updatedAt,
          })),
          customFields: [],
          lists: await Promise.all(
            shortlist.lists.map(async (list) => ({
              id: list.publicId,
              name: list.name,
              index: list.index,
              createdAt: list.createdAt,
              updatedAt: list.updatedAt,
              cards: await Promise.all(
                list.cards.map(async (card) => ({
                  id: card.publicId,
                  name: card.title,
                  description: card.description,
                  index: card.index,
                  cardNumber: card.cardNumber,
                  createdAt: card.createdAt,
                  updatedAt: card.updatedAt,
                  dueDate: card.dueDate,
                  manualUpdatedOnly: card.manualUpdatedOnly,
                  shortlistFields: {
                    companyName: card.shortlistCompanyName,
                    jobPostingUrl: card.shortlistJobPostingUrl,
                    salaryMin: card.shortlistSalaryMin,
                    salaryMax: card.shortlistSalaryMax,
                    salaryCurrency: card.shortlistSalaryCurrency,
                    salaryInterval: card.shortlistSalaryInterval,
                    salaryData: card.shortlistSalaryData,
                    companyRatingAggregated:
                      card.shortlistCompanyRatingAggregated,
                    companySentiment: card.shortlistCompanySentimentBlob,
                    companySentimentSummary:
                      card.shortlistCompanySentimentSummary,
                    cardSource: card.shortlistCardSource,
                    jobLocation: card.shortlistJobLocation,
                    jobLocationType: card.shortlistJobLocationType,
                    jobType: card.shortlistJobType,
                    companyLocation: card.shortlistCompanyLocation,
                  },
                  idLabels: card.labels.map(({ label }) => label.publicId),
                  labels: card.labels.map(({ label }) => ({
                    id: label.publicId,
                    name: label.name,
                    color: label.colourCode,
                  })),
                  members: await Promise.all(
                    card.members
                      .map(({ member }) => member)
                      .filter((member) => member.deletedAt === null)
                      .map(async (member) => ({
                        id: member.publicId,
                        email: member.email,
                        role: member.role,
                        status: member.status,
                        user: await formatPerson(member.user),
                      })),
                  ),
                  comments: await Promise.all(
                    card.comments.map(async (comment) => ({
                      id: comment.publicId,
                      comment: comment.comment,
                      createdAt: comment.createdAt,
                      updatedAt: comment.updatedAt,
                      createdBy: await formatPerson(comment.createdBy),
                    })),
                  ),
                  attachments: await Promise.all(
                    card.attachments.map(async (attachment) => ({
                      id: attachment.publicId,
                      originalFilename: attachment.originalFilename,
                      contentType: attachment.contentType,
                      size: attachment.size,
                      url: await generateAttachmentUrl(attachment.s3Key),
                      createdAt: attachment.createdAt,
                    })),
                  ),
                  checklists: card.checklists.map((checklist) => ({
                    id: checklist.publicId,
                    name: checklist.name,
                    index: checklist.index,
                    createdAt: checklist.createdAt,
                    updatedAt: checklist.updatedAt,
                    items: checklist.items.map((item) => ({
                      id: item.publicId,
                      title: item.title,
                      completed: item.completed,
                      index: item.index,
                      createdAt: item.createdAt,
                      updatedAt: item.updatedAt,
                    })),
                  })),
                  activity: await Promise.all(
                    card.activities.map(async (activity) => ({
                      id: activity.publicId,
                      type: activity.type,
                      createdAt: activity.createdAt,
                      fromIndex: activity.fromIndex,
                      toIndex: activity.toIndex,
                      fromTitle: activity.fromTitle,
                      toTitle: activity.toTitle,
                      fromDescription: activity.fromDescription,
                      toDescription: activity.toDescription,
                      fromDueDate: activity.fromDueDate,
                      toDueDate: activity.toDueDate,
                      fromList: activity.fromList
                        ? {
                            id: activity.fromList.publicId,
                            name: activity.fromList.name,
                          }
                        : null,
                      toList: activity.toList
                        ? {
                            id: activity.toList.publicId,
                            name: activity.toList.name,
                          }
                        : null,
                      label: activity.label
                        ? {
                            id: activity.label.publicId,
                            name: activity.label.name,
                            color: activity.label.colourCode,
                          }
                        : null,
                      member: activity.member
                        ? {
                            id: activity.member.publicId,
                            email: activity.member.email,
                          }
                        : null,
                      user: await formatPerson(activity.user),
                      comment: activity.comment
                        ? {
                            id: activity.comment.publicId,
                            comment: activity.comment.comment,
                            createdAt: activity.comment.createdAt,
                            updatedAt: activity.comment.updatedAt,
                          }
                        : null,
                      attachment: activity.attachment
                        ? {
                            id: activity.attachment.publicId,
                            originalFilename:
                              activity.attachment.originalFilename,
                            contentType: activity.attachment.contentType,
                            size: activity.attachment.size,
                          }
                        : null,
                    })),
                  ),
                })),
              ),
            })),
          ),
        })),
      );

      return {
        exportedAt: new Date(),
        account: {
          email: exportData.user.email,
          emailVerified: exportData.user.emailVerified,
          name: exportData.user.name,
          profilePictureUrl: await generateAvatarUrl(exportData.user.image),
          createdAt: exportData.user.createdAt,
          updatedAt: exportData.user.updatedAt,
          shortlistPowerpackActivatedAt:
            exportData.user.shortlistPowerpackActivatedAt,
          shortlistPowerpackExpiresAt:
            exportData.user.shortlistPowerpackExpiresAt,
          shortlistTimezone: exportData.user.shortlistTimezone,
          shortlistLastActivity: exportData.user.shortlistLastActivity,
          workspaces: exportData.memberships.map((membership) => ({
            id: membership.workspace.publicId,
            name: membership.workspace.name,
            description: membership.workspace.description,
            slug: membership.workspace.slug,
            plan: membership.workspace.plan,
            weekStartDay: membership.workspace.weekStartDay,
            cardPrefix: membership.workspace.cardPrefix,
            createdAt: membership.workspace.createdAt,
            updatedAt: membership.workspace.updatedAt,
            membership: {
              id: membership.publicId,
              email: membership.email,
              role: membership.role,
              status: membership.status,
              createdAt: membership.createdAt,
              updatedAt: membership.updatedAt,
            },
          })),
        },
        shortlists,
      };
    }),
});
