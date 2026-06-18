import Link from "next/link";
import { t } from "@lingui/core/macro";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

import type { GetActivityLogOutput } from "@kan/api/types";
import { authClient } from "@kan/auth/client";

import Avatar from "~/components/Avatar";
import { PageHead } from "~/components/PageHead";
import { useLocalisation } from "~/hooks/useLocalisation";
import { api } from "~/utils/api";
import { getAvatarUrl } from "~/utils/helpers";
import {
  getActivityIcon,
  getActivityText,
  getUserDisplayName,
} from "~/views/card/components/ActivityList";

const ACTIVITY_LOG_PAGE_SIZE = 20;

type ActivityLogItem = GetActivityLogOutput["activities"][number];

const getCardLinkConnector = (type: string) => {
  if (type === "card.created") return "";
  if (
    type === "card.updated.attachment.added" ||
    type === "card.updated.member.added"
  ) {
    return t`to`;
  }
  if (
    type === "card.updated.attachment.removed" ||
    type === "card.updated.member.removed"
  ) {
    return t`from`;
  }
  return t`on`;
};

export default function ActivityLog() {
  const { dateLocale } = useLocalisation();
  const { data: sessionData } = authClient.useSession();
  const utils = api.useUtils();
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isFetching } = api.activityLog.list.useQuery({
    limit: ACTIVITY_LOG_PAGE_SIZE,
  });

  useEffect(() => {
    if (!data) return;

    setActivities(data.activities);
    setHasMore(data.hasMore);
  }, [data]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || activities.length === 0) return;

    const lastActivity = activities[activities.length - 1];
    if (!lastActivity) return;

    setIsLoadingMore(true);
    try {
      const nextPage = await utils.activityLog.list.fetch({
        limit: ACTIVITY_LOG_PAGE_SIZE,
        cursor: new Date(lastActivity.createdAt).toISOString(),
      });

      const existingIds = new Set(
        activities.map((activity) => activity.publicId),
      );
      const newActivities = nextPage.activities.filter(
        (activity) => !existingIds.has(activity.publicId),
      );
      setActivities((current) => [...current, ...newActivities]);
      setHasMore(nextPage.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const isInitialLoading = isFetching && activities.length === 0;

  return (
    <>
      <PageHead title={t`Activity log`} />

      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="h-full max-h-[calc(100vdh-3rem)] overflow-y-auto md:max-h-[calc(100vdh-4rem)]">
          <div className="m-auto max-w-[1100px] px-5 py-6 md:px-28 md:py-12">
            <div className="mb-8 flex w-full justify-between">
              <h1 className="font-bold tracking-tight text-neutral-900 dark:text-dark-1000 sm:text-[1.2rem]">
                {t`Activity log`}
              </h1>
            </div>

            <div className="mb-8 border-t border-light-300 pt-8 dark:border-dark-300">
              {isInitialLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-light-300 dark:bg-dark-300" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-light-300 dark:bg-dark-300" />
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-light-900 dark:text-dark-800">
                  {t`No activity yet.`}
                </p>
              ) : (
                <div className="flex flex-col space-y-4">
                  {activities.map((activity, index) => {
                    const activityText = getActivityText({
                      type: activity.type,
                      toTitle: activity.toTitle,
                      fromList: activity.fromList?.name ?? null,
                      toList: activity.toList?.name ?? null,
                      memberName: activity.member?.user?.name ?? null,
                      memberEmail: activity.member?.user?.email ?? null,
                      isSelf: activity.member?.user?.id === sessionData?.user.id,
                      label: activity.label?.name ?? null,
                      fromTitle: activity.fromTitle ?? null,
                      fromDescription: activity.fromDescription ?? null,
                      toDescription: activity.toDescription ?? null,
                      fromDueDate: activity.fromDueDate ?? null,
                      toDueDate: activity.toDueDate ?? null,
                      dateLocale,
                      attachmentName:
                        activity.attachment?.originalFilename ?? null,
                    });

                    if (!activityText) return null;

                    const cardLinkConnector = getCardLinkConnector(
                      activity.type,
                    );

                    return (
                      <div
                        key={activity.publicId}
                        className="relative flex items-center space-x-2"
                      >
                        <div className="relative">
                          <Avatar
                            size="sm"
                            name={activity.user?.name ?? ""}
                            email={activity.user?.email ?? ""}
                            imageUrl={
                              getAvatarUrl(activity.user?.image ?? null) ||
                              undefined
                            }
                            icon={getActivityIcon(
                              activity.type,
                              activity.fromList?.index,
                              activity.toList?.index,
                            )}
                            isLoading={isFetching || isLoadingMore}
                          />
                          {index !== activities.length - 1 && (
                            <div className="absolute bottom-[-14px] left-1/2 top-[30px] w-0.5 -translate-x-1/2 bg-light-600 dark:bg-dark-600" />
                          )}
                        </div>
                        <p className="text-sm">
                          <span className="font-medium dark:text-dark-1000">{`${getUserDisplayName(activity.user)} `}</span>
                          <span className="space-x-1 text-light-900 dark:text-dark-800">
                            {activityText}
                          </span>{" "}
                          {cardLinkConnector && (
                            <span className="text-light-900 dark:text-dark-800">
                              {cardLinkConnector}{" "}
                            </span>
                          )}
                          <Link
                            href={`/cards/${activity.card.publicId}`}
                            className="font-medium text-light-1000 underline underline-offset-2 hover:text-light-900 dark:text-dark-1000 dark:hover:text-dark-900"
                          >
                            {activity.card.title}
                          </Link>
                          <span className="mx-1 text-light-900 dark:text-dark-800">
                            ·
                          </span>
                          <span className="space-x-1 text-light-900 dark:text-dark-800">
                            {formatDistanceToNow(new Date(activity.createdAt), {
                              addSuffix: true,
                              locale: dateLocale,
                            })}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasMore && activities.length > 0 && (
                <div className="flex justify-center pt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={isFetching || isLoadingMore}
                    className="text-sm font-medium text-light-900 hover:text-light-1000 disabled:opacity-50 dark:text-dark-800 dark:hover:text-dark-1000"
                  >
                    {isLoadingMore ? t`Loading...` : t`Load older updates`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
