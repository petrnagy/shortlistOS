import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  boards,
  cardActivities,
  cardAttachments,
  cards,
  checklistItems,
  checklists,
  comments,
  labels,
  lists,
  users,
  workspaceMembers,
} from "@kan/db/schema";

export const getUserExportData = async (db: dbClient, userId: string) => {
  const user = await db.query.users.findFirst({
    columns: {
      email: true,
      emailVerified: true,
      name: true,
      image: true,
      createdAt: true,
      updatedAt: true,
      shortlistPowerpackActivatedAt: true,
      shortlistPowerpackExpiresAt: true,
      shortlistTimezone: true,
      shortlistLastActivity: true,
    },
    where: eq(users.id, userId),
  });

  if (!user) return null;

  const memberships = await db.query.workspaceMembers.findMany({
    columns: {
      publicId: true,
      workspaceId: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      workspace: {
        columns: {
          publicId: true,
          name: true,
          description: true,
          slug: true,
          plan: true,
          weekStartDay: true,
          cardPrefix: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    where: and(
      eq(workspaceMembers.userId, userId),
      eq(workspaceMembers.status, "active"),
      isNull(workspaceMembers.deletedAt),
    ),
    orderBy: [asc(workspaceMembers.createdAt)],
  });

  const workspaceIds = [
    ...new Set(memberships.map((membership) => membership.workspaceId)),
  ];

  const shortlists =
    workspaceIds.length === 0
      ? []
      : await db.query.boards.findMany({
          columns: {
            publicId: true,
            name: true,
            description: true,
            slug: true,
            visibility: true,
            isArchived: true,
            createdAt: true,
            updatedAt: true,
            shortlistIsSalaryDataEnabled: true,
            shortlistIsCompanySentimentEnabled: true,
            shortlistIsMagicInboxEnabled: true,
            shortlistIsCalendarFeedEnabled: true,
            shortlistIsSavedReminderEnabled: true,
            shortlistSavedReminderAfterDays: true,
            shortlistIsSavedAutoArchiveEnabled: true,
            shortlistSavedAutoArchiveAfterDays: true,
            shortlistIsAppliedFollowUpReminderEnabled: true,
            shortlistAppliedFollowUpReminderAfterDays: true,
            shortlistIsAppliedGhostedEnabled: true,
            shortlistAppliedGhostedAfterDays: true,
            shortlistIsInterviewingNudgeEnabled: true,
            shortlistInterviewingNudgeAfterDays: true,
            shortlistIsNegotiatingNudgeEnabled: true,
            shortlistNegotiatingNudgeAfterDays: true,
            shortlistIsWeeklyDigestEnabled: true,
            shortlistIsCardAgingEnabled: true,
          },
          with: {
            workspace: {
              columns: {
                publicId: true,
                name: true,
                slug: true,
                cardPrefix: true,
              },
            },
            labels: {
              columns: {
                publicId: true,
                name: true,
                colourCode: true,
                createdAt: true,
                updatedAt: true,
              },
              where: isNull(labels.deletedAt),
              orderBy: [asc(labels.createdAt)],
            },
            lists: {
              columns: {
                publicId: true,
                name: true,
                index: true,
                createdAt: true,
                updatedAt: true,
              },
              with: {
                cards: {
                  columns: {
                    publicId: true,
                    title: true,
                    description: true,
                    index: true,
                    cardNumber: true,
                    createdAt: true,
                    updatedAt: true,
                    dueDate: true,
                    manualUpdatedOnly: true,
                    shortlistCompanyName: true,
                    shortlistJobPostingUrl: true,
                    shortlistSalaryMin: true,
                    shortlistSalaryMax: true,
                    shortlistSalaryCurrency: true,
                    shortlistSalaryInterval: true,
                    shortlistSalaryData: true,
                    shortlistCompanyRatingAggregated: true,
                    shortlistCompanySentimentBlob: true,
                    shortlistCompanySentimentSummary: true,
                    shortlistCardSource: true,
                    shortlistJobLocation: true,
                    shortlistJobLocationType: true,
                    shortlistJobType: true,
                    shortlistCompanyLocation: true,
                  },
                  with: {
                    labels: {
                      with: {
                        label: {
                          columns: {
                            publicId: true,
                            name: true,
                            colourCode: true,
                          },
                        },
                      },
                    },
                    members: {
                      with: {
                        member: {
                          columns: {
                            publicId: true,
                            email: true,
                            role: true,
                            status: true,
                            deletedAt: true,
                          },
                          with: {
                            user: {
                              columns: {
                                name: true,
                                email: true,
                                image: true,
                              },
                            },
                          },
                        },
                      },
                    },
                    comments: {
                      columns: {
                        publicId: true,
                        comment: true,
                        createdAt: true,
                        updatedAt: true,
                      },
                      with: {
                        createdBy: {
                          columns: {
                            name: true,
                            email: true,
                            image: true,
                          },
                        },
                      },
                      where: isNull(comments.deletedAt),
                      orderBy: [asc(comments.createdAt)],
                    },
                    attachments: {
                      columns: {
                        publicId: true,
                        originalFilename: true,
                        contentType: true,
                        size: true,
                        s3Key: true,
                        createdAt: true,
                      },
                      where: isNull(cardAttachments.deletedAt),
                      orderBy: [asc(cardAttachments.createdAt)],
                    },
                    checklists: {
                      columns: {
                        publicId: true,
                        name: true,
                        index: true,
                        createdAt: true,
                        updatedAt: true,
                      },
                      with: {
                        items: {
                          columns: {
                            publicId: true,
                            title: true,
                            completed: true,
                            index: true,
                            createdAt: true,
                            updatedAt: true,
                          },
                          where: isNull(checklistItems.deletedAt),
                          orderBy: [asc(checklistItems.index)],
                        },
                      },
                      where: isNull(checklists.deletedAt),
                      orderBy: [asc(checklists.index)],
                    },
                    activities: {
                      columns: {
                        publicId: true,
                        type: true,
                        createdAt: true,
                        fromIndex: true,
                        toIndex: true,
                        fromTitle: true,
                        toTitle: true,
                        fromDescription: true,
                        toDescription: true,
                        fromDueDate: true,
                        toDueDate: true,
                      },
                      with: {
                        fromList: {
                          columns: {
                            publicId: true,
                            name: true,
                          },
                        },
                        toList: {
                          columns: {
                            publicId: true,
                            name: true,
                          },
                        },
                        label: {
                          columns: {
                            publicId: true,
                            name: true,
                            colourCode: true,
                          },
                        },
                        member: {
                          columns: {
                            publicId: true,
                            email: true,
                          },
                        },
                        user: {
                          columns: {
                            name: true,
                            email: true,
                            image: true,
                          },
                        },
                        comment: {
                          columns: {
                            publicId: true,
                            comment: true,
                            createdAt: true,
                            updatedAt: true,
                          },
                        },
                        attachment: {
                          columns: {
                            publicId: true,
                            originalFilename: true,
                            contentType: true,
                            size: true,
                          },
                        },
                      },
                      orderBy: [asc(cardActivities.createdAt)],
                    },
                  },
                  where: isNull(cards.deletedAt),
                  orderBy: [asc(cards.index)],
                },
              },
              where: isNull(lists.deletedAt),
              orderBy: [asc(lists.index)],
            },
          },
          where: and(
            inArray(boards.workspaceId, workspaceIds),
            isNull(boards.deletedAt),
            eq(boards.type, "regular"),
          ),
          orderBy: [asc(boards.createdAt)],
        });

  return {
    user,
    memberships,
    shortlists,
  };
};
