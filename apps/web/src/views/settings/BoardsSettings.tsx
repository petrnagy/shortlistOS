import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useMemo } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineClipboardDocument,
  HiOutlineClock,
  HiOutlineCurrencyDollar,
  HiOutlineEnvelope,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
} from "react-icons/hi2";

import { Alert } from "~/components/Alert";
import Button from "~/components/Button";
import Toggle from "~/components/Toggle";
import { env } from "~/env";
import { usePopup } from "~/providers/popup";
import type { RouterInputs } from "~/utils/api";
import { api } from "~/utils/api";
import { hasActivePowerpack } from "~/utils/powerpack";

type BoardUpdateInput = Omit<RouterInputs["board"]["update"], "boardPublicId">;

interface BoardsSettingsProps {
  boardPublicId: string;
  isBoardLoaded: boolean;
  isSalaryDataEnabled: boolean;
  isCompanySentimentEnabled: boolean;
  isMagicInboxEnabled: boolean;
  isCalendarFeedEnabled: boolean;
  isSavedReminderEnabled: boolean;
  savedReminderDays: number;
  isSavedAutoArchiveEnabled: boolean;
  savedAutoArchiveDays: number;
  isAppliedFollowUpReminderEnabled: boolean;
  appliedFollowUpReminderDays: number;
  isAppliedGhostedEnabled: boolean;
  appliedGhostedDays: number;
  isInterviewingNudgeEnabled: boolean;
  interviewingNudgeDays: number;
  isNegotiatingNudgeEnabled: boolean;
  negotiatingNudgeDays: number;
  isWeeklyDigestEnabled: boolean;
  isCardAgingEnabled: boolean;
}

interface AutomationCardProps {
  children?: React.ReactNode;
  description: string;
  disabled?: boolean;
  icon: React.ReactNode;
  isChecked: boolean;
  onToggle: () => void;
  title: string;
}

interface ReminderRowProps {
  dayValue: number;
  disabled?: boolean;
  isChecked: boolean;
  label: string;
  onDayChange: (days: number) => void;
  onToggle: () => void;
}

const dayOptions = [
  ...Array.from({ length: 14 }, (_, index) => ({
    label: index === 0 ? t`1 day` : t`${index + 1} days`,
    value: index + 1,
  })),
  { label: t`3 weeks`, value: 21 },
  { label: t`1 month`, value: 30 },
  { label: t`2 months`, value: 60 },
];

const AutomationCard = ({
  children,
  description,
  disabled,
  icon,
  isChecked,
  onToggle,
  title,
}: AutomationCardProps) => (
  <div className="rounded-[8px] border border-light-300 p-5 dark:border-dark-300">
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-light-1000 dark:text-dark-1000">
          {icon}
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <span className="mt-3 inline-flex items-center rounded-[5px] bg-light-200 px-2 py-1 text-sm font-medium text-light-900 dark:bg-dark-200 dark:text-dark-900">
          {isChecked ? t`Enabled` : t`Disabled`}
        </span>
      </div>
      <Toggle
        isChecked={isChecked}
        onChange={onToggle}
        label={title}
        disabled={disabled}
        showLabel={false}
      />
    </div>
    <p className="text-sm leading-6 text-light-900 dark:text-dark-900">
      {description}
    </p>
    {children ? <div className="mt-4">{children}</div> : null}
  </div>
);

const ReminderRow = ({
  dayValue,
  disabled,
  isChecked,
  label,
  onDayChange,
  onToggle,
}: ReminderRowProps) => (
  <div className="flex flex-col gap-3 rounded-[8px] border border-light-200 bg-light-50 p-3 dark:border-dark-300 dark:bg-dark-100 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center gap-3">
      <Toggle
        isChecked={isChecked}
        onChange={onToggle}
        label={label}
        disabled={disabled}
        showLabel={false}
      />
      <span className="text-sm leading-6 text-light-800 dark:text-dark-900">
        {label}
      </span>
    </div>
    <select
      value={dayValue}
      disabled={disabled || !isChecked}
      onChange={(event) => onDayChange(Number(event.target.value))}
      className="h-8 w-24 rounded-md border-0 bg-light-100 px-2 text-xs text-light-1000 shadow-sm ring-1 ring-inset ring-light-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-200 dark:text-dark-1000 dark:ring-dark-400"
    >
      {dayOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const BoardsSettings = ({
  boardPublicId,
  isBoardLoaded,
  isSalaryDataEnabled,
  isCompanySentimentEnabled,
  isMagicInboxEnabled,
  isCalendarFeedEnabled,
  isSavedReminderEnabled,
  savedReminderDays,
  isSavedAutoArchiveEnabled,
  savedAutoArchiveDays,
  isAppliedFollowUpReminderEnabled,
  appliedFollowUpReminderDays,
  isAppliedGhostedEnabled,
  appliedGhostedDays,
  isInterviewingNudgeEnabled,
  interviewingNudgeDays,
  isNegotiatingNudgeEnabled,
  negotiatingNudgeDays,
  isWeeklyDigestEnabled,
  isCardAgingEnabled,
}: BoardsSettingsProps) => {
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const { data: user } = api.user.getUser.useQuery();
  const userHasActivePowerpack = hasActivePowerpack(user);
  const displayPowerpackToggle = (isEnabled: boolean) =>
    userHasActivePowerpack && isEnabled;

  const calendarFeedUrl = useMemo(() => {
    const origin =
      typeof window === "undefined"
        ? "https://app.shortlistos.co"
        : window.location.origin;
    const key = encodeURIComponent(user?.shortlistFeedSecret ?? "");

    return `${origin}/calendar/shortlist/${boardPublicId || "board"}.ics?key=${key}`;
  }, [boardPublicId, user?.shortlistFeedSecret]);

  const magicInboxAddress = useMemo(() => {
    const domain = env.NEXT_PUBLIC_MAGIC_INBOX_DOMAIN ?? "";

    return `${boardPublicId || "board"}.${user?.shortlistUserPublicSecret ?? "user"}@${domain}`;
  }, [boardPublicId, user?.shortlistUserPublicSecret]);

  const updateBoard = api.board.update.useMutation({
    onError: (error) => {
      showPopup({
        header: t`Unable to update board`,
        message:
          error.message ||
          t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSuccess: async () => {
      await utils.board.byId.invalidate({ boardPublicId });
    },
  });

  const isDisabled =
    !boardPublicId ||
    !isBoardLoaded ||
    !userHasActivePowerpack ||
    updateBoard.isPending;

  const mockupsDisabled =
    !boardPublicId ||
    !isBoardLoaded ||
    !userHasActivePowerpack ||
    updateBoard.isPending;

  const updatePowerpackSetting = (updates: BoardUpdateInput) => {
    if (mockupsDisabled) return;

    updateBoard.mutate({
      boardPublicId,
      ...updates,
    });
  };

  const handleCardAgingToggle = () => {
    if (isDisabled) return;

    updateBoard.mutate({
      boardPublicId,
      shortlistIsCardAgingEnabled: !isCardAgingEnabled,
    });
  };

  const handleCopyCalendarFeed = () => {
    void navigator.clipboard.writeText(calendarFeedUrl).then(
      () => {
        showPopup({
          header: t`Calendar feed copied`,
          message: t`Paste it into Google Calendar, Outlook, or any app that supports iCal feeds.`,
          icon: "success",
        });
      },
      () => {
        showPopup({
          header: t`Unable to copy link`,
          message: t`Please copy it manually from the field.`,
          icon: "error",
        });
      },
    );
  };

  const handleCopyMagicInboxAddress = () => {
    void navigator.clipboard.writeText(magicInboxAddress).then(
      () => {
        showPopup({
          header: t`Magic Inbox address copied`,
          message: t`Forward or send emails to this address to add them to this shortlist.`,
          icon: "success",
        });
      },
      () => {
        showPopup({
          header: t`Unable to copy address`,
          message: t`Please copy it manually from the field.`,
          icon: "error",
        });
      },
    );
  };

  return (
    <section className="mb-8 border-t border-light-300 pt-8 dark:border-dark-300">
      <div className="mb-4 flex items-center gap-2">
        <HiOutlineShieldCheck className="h-5 w-5 text-light-900 dark:text-dark-900" />
        <h2 className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
          {t`Automation`}
        </h2>
      </div>

      {!userHasActivePowerpack && (
        <p className="mb-4 rounded-[8px] border border-light-300 bg-light-100 px-4 py-3 text-sm leading-6 text-light-800 dark:border-dark-300 dark:bg-dark-100 dark:text-dark-900">
          {t`Get the Powerpack to automate your job search.`}{" "}
          <Link
            href="/settings/powerpack"
            className="text-brand-600 dark:text-brand-500 font-semibold hover:underline"
          >
            {t`Upgrade now`}
          </Link>
        </p>
      )}

      <div className="space-y-4">
        <AutomationCard
          icon={<HiOutlineClock className="h-4 w-4" />}
          title={t`Card aging`}
          description={t`Show visual aging effects on cards based on last activity. Cards older than 1 week gradually receive a stronger warm tint as they age.`}
          isChecked={displayPowerpackToggle(isCardAgingEnabled)}
          onToggle={handleCardAgingToggle}
          disabled={isDisabled}
        />

        <AutomationCard
          icon={<HiOutlineCurrencyDollar className="h-4 w-4" />}
          title={t`Automatic salary data`}
          description={t`Automatically enriches each opportunity with salary benchmarks across the US, EU, UK, APAC, and global markets, so you can quickly see how an offer compares locally and worldwide.`}
          isChecked={displayPowerpackToggle(isSalaryDataEnabled)}
          onToggle={() =>
            updatePowerpackSetting({
              shortlistIsSalaryDataEnabled: !isSalaryDataEnabled,
            })
          }
          disabled={mockupsDisabled}
        />

        <AutomationCard
          icon={<HiOutlineSparkles className="h-4 w-4" />}
          title={t`Company sentiment`}
          description={t`Automatically researches the company behind each opening across social networks, hiring portals, funding news, layoff signals, and other public sources, then summarizes the rating, risks, and recent context for you.`}
          isChecked={displayPowerpackToggle(isCompanySentimentEnabled)}
          onToggle={() =>
            updatePowerpackSetting({
              shortlistIsCompanySentimentEnabled: !isCompanySentimentEnabled,
            })
          }
          disabled={mockupsDisabled}
        />

        <AutomationCard
          icon={<HiOutlineEnvelope className="h-4 w-4" />}
          title={t`Email to this shortlist`}
          description={t`Generate a special email address where you can forward any job offer from a recruiter, friend, or newsletter. You can also forward updates about opportunities that already exist in your workspace.`}
          isChecked={displayPowerpackToggle(isMagicInboxEnabled)}
          onToggle={() =>
            updatePowerpackSetting({
              shortlistIsMagicInboxEnabled: !isMagicInboxEnabled,
            })
          }
          disabled={mockupsDisabled}
        >
          {displayPowerpackToggle(isMagicInboxEnabled) ? (
            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={magicInboxAddress}
                  className="min-w-0 flex-1 rounded-md border-0 bg-light-100 px-3 py-2 text-sm text-light-900 shadow-sm ring-1 ring-inset ring-light-300 dark:bg-dark-200 dark:text-dark-900 dark:ring-dark-400"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={mockupsDisabled}
                  onClick={handleCopyMagicInboxAddress}
                  iconLeft={<HiOutlineClipboardDocument className="h-4 w-4" />}
                >
                  {t`Copy`}
                </Button>
              </div>
              <Alert variant="info" title={t`Keep this address private`}>
                {t`Do not share this address with anyone, and do not publish it anywhere.`}
              </Alert>
            </div>
          ) : null}
        </AutomationCard>

        <AutomationCard
          icon={<HiOutlineCalendarDays className="h-4 w-4" />}
          title={t`Calendar feed`}
          description={t`Export all planned interviews from this shortlist as an iCal feed for Google Calendar, Outlook, or any calendar app. Never miss an interview again.`}
          isChecked={displayPowerpackToggle(isCalendarFeedEnabled)}
          onToggle={() =>
            updatePowerpackSetting({
              shortlistIsCalendarFeedEnabled: !isCalendarFeedEnabled,
            })
          }
          disabled={mockupsDisabled}
        >
          <div className="space-y-3">
            {displayPowerpackToggle(isCalendarFeedEnabled) ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={calendarFeedUrl}
                  className="min-w-0 flex-1 rounded-md border-0 bg-light-100 px-3 py-2 text-sm text-light-900 shadow-sm ring-1 ring-inset ring-light-300 dark:bg-dark-200 dark:text-dark-900 dark:ring-dark-400"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={mockupsDisabled}
                  onClick={handleCopyCalendarFeed}
                  iconLeft={<HiOutlineClipboardDocument className="h-4 w-4" />}
                >
                  {t`Copy`}
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {t`How to subscribe in`}:
              <Link
                href="#google-calendar-ics-guide"
                target="_blank"
                rel="noreferrer"
                className="text-light-900 underline underline-offset-4 dark:text-dark-900"
              >
                {t`Google Calendar`}
              </Link>
              ·
              <Link
                href="#outlook-calendar-ics-guide"
                target="_blank"
                rel="noreferrer"
                className="text-light-900 underline underline-offset-4 dark:text-dark-900"
              >
                {t`Outlook.com`}
              </Link>
            </div>
          </div>
        </AutomationCard>

        <div className="rounded-[8px] border border-light-300 p-5 dark:border-dark-300">
          <div className="mb-4">
            <div className="flex items-center gap-2 text-light-1000 dark:text-dark-1000">
              <HiOutlineBellAlert className="h-4 w-4" />
              <p className="text-sm font-semibold">{t`Email reminders`}</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-light-900 dark:text-dark-900">
              {t`Stay on top of opportunities that have gone quiet before they slip through the cracks.`}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-light-800 dark:text-dark-800">
                {t`Stuck in Saved`}
              </h3>
              <div className="space-y-2">
                <ReminderRow
                  label={t`Send me an email reminder`}
                  isChecked={displayPowerpackToggle(isSavedReminderEnabled)}
                  onToggle={() =>
                    updatePowerpackSetting({
                      shortlistIsSavedReminderEnabled:
                        !isSavedReminderEnabled,
                    })
                  }
                  dayValue={savedReminderDays}
                  onDayChange={(days) =>
                    updatePowerpackSetting({
                      shortlistSavedReminderAfterDays: days,
                    })
                  }
                  disabled={mockupsDisabled}
                />
                <ReminderRow
                  label={t`Automatically archive`}
                  isChecked={displayPowerpackToggle(isSavedAutoArchiveEnabled)}
                  onToggle={() =>
                    updatePowerpackSetting({
                      shortlistIsSavedAutoArchiveEnabled:
                        !isSavedAutoArchiveEnabled,
                    })
                  }
                  dayValue={savedAutoArchiveDays}
                  onDayChange={(days) =>
                    updatePowerpackSetting({
                      shortlistSavedAutoArchiveAfterDays: days,
                    })
                  }
                  disabled={mockupsDisabled}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-light-800 dark:text-dark-800">
                {t`Stuck in Applied`}
              </h3>
              <div className="space-y-2">
                <ReminderRow
                  label={t`Follow-up reminder`}
                  isChecked={displayPowerpackToggle(
                    isAppliedFollowUpReminderEnabled,
                  )}
                  onToggle={() =>
                    updatePowerpackSetting({
                      shortlistIsAppliedFollowUpReminderEnabled:
                        !isAppliedFollowUpReminderEnabled,
                    })
                  }
                  dayValue={appliedFollowUpReminderDays}
                  onDayChange={(days) =>
                    updatePowerpackSetting({
                      shortlistAppliedFollowUpReminderAfterDays: days,
                    })
                  }
                  disabled={mockupsDisabled}
                />
                <ReminderRow
                  label={t`Mark the opportunity as ghosted`}
                  isChecked={displayPowerpackToggle(isAppliedGhostedEnabled)}
                  onToggle={() =>
                    updatePowerpackSetting({
                      shortlistIsAppliedGhostedEnabled:
                        !isAppliedGhostedEnabled,
                    })
                  }
                  dayValue={appliedGhostedDays}
                  onDayChange={(days) =>
                    updatePowerpackSetting({
                      shortlistAppliedGhostedAfterDays: days,
                    })
                  }
                  disabled={mockupsDisabled}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-light-800 dark:text-dark-800">
                {t`Stuck in Interviewing`}
              </h3>
              <ReminderRow
                label={t`Nudge me to follow up with the recruiter`}
                isChecked={displayPowerpackToggle(isInterviewingNudgeEnabled)}
                onToggle={() =>
                  updatePowerpackSetting({
                    shortlistIsInterviewingNudgeEnabled:
                      !isInterviewingNudgeEnabled,
                  })
                }
                dayValue={interviewingNudgeDays}
                onDayChange={(days) =>
                  updatePowerpackSetting({
                    shortlistInterviewingNudgeAfterDays: days,
                  })
                }
                disabled={mockupsDisabled}
              />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-light-800 dark:text-dark-800">
                {t`Stuck in Negotiating`}
              </h3>
              <ReminderRow
                label={t`Nudge me to revisit the negotiation`}
                isChecked={displayPowerpackToggle(isNegotiatingNudgeEnabled)}
                onToggle={() =>
                  updatePowerpackSetting({
                    shortlistIsNegotiatingNudgeEnabled:
                      !isNegotiatingNudgeEnabled,
                  })
                }
                dayValue={negotiatingNudgeDays}
                onDayChange={(days) =>
                  updatePowerpackSetting({
                    shortlistNegotiatingNudgeAfterDays: days,
                  })
                }
                disabled={mockupsDisabled}
              />
            </div>
          </div>
        </div>

        <AutomationCard
          icon={<HiOutlineChartBar className="h-4 w-4" />}
          title={t`Weekly digest`}
          description={t`Send me a weekly summary of every opportunity in this shortlist, including which ones need attention next.`}
          isChecked={displayPowerpackToggle(isWeeklyDigestEnabled)}
          onToggle={() =>
            updatePowerpackSetting({
              shortlistIsWeeklyDigestEnabled: !isWeeklyDigestEnabled,
            })
          }
          disabled={mockupsDisabled}
        />
      </div>
    </section>
  );
};

export default BoardsSettings;
