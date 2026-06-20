import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useMemo, useState } from "react";
import {
  HiOutlineClipboardDocument,
  HiOutlineShieldCheck,
} from "react-icons/hi2";

import Button from "~/components/Button";
import Toggle from "~/components/Toggle";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";
import { hasActivePowerpack } from "~/utils/powerpack";

interface BoardsSettingsProps {
  boardPublicId: string;
  isBoardLoaded: boolean;
  isCardAgingEnabled: boolean;
}

interface AutomationCardProps {
  children?: React.ReactNode;
  description: string;
  disabled?: boolean;
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

const dayOptions = Array.from({ length: 14 }, (_, index) => index + 1);

const AutomationCard = ({
  children,
  description,
  disabled,
  isChecked,
  onToggle,
  title,
}: AutomationCardProps) => (
  <div className="rounded-[8px] border border-light-300 p-5 dark:border-dark-300">
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
          {title}
        </p>
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
    <p className="text-sm leading-6 text-light-700 dark:text-dark-800">
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
      disabled={disabled}
      onChange={(event) => onDayChange(Number(event.target.value))}
      className="h-8 w-24 rounded-md border-0 bg-light-100 px-2 text-xs text-light-1000 shadow-sm ring-1 ring-inset ring-light-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-dark-200 dark:text-dark-1000 dark:ring-dark-400"
    >
      {dayOptions.map((days) => (
        <option key={days} value={days}>
          {days === 1 ? t`1 day` : t`${days} days`}
        </option>
      ))}
    </select>
  </div>
);

const BoardsSettings = ({
  boardPublicId,
  isBoardLoaded,
  isCardAgingEnabled,
}: BoardsSettingsProps) => {
  const { showPopup } = usePopup();
  const utils = api.useUtils();
  const { data: user } = api.user.getUser.useQuery();
  const userHasActivePowerpack = hasActivePowerpack(user);

  const [salaryDataEnabled, setSalaryDataEnabled] = useState(false);
  const [companySentimentEnabled, setCompanySentimentEnabled] = useState(false);
  const [googleCalendarFeedEnabled, setGoogleCalendarFeedEnabled] =
    useState(false);
  const [savedReminderEnabled, setSavedReminderEnabled] = useState(false);
  const [savedReminderDays, setSavedReminderDays] = useState(7);
  const [savedArchiveEnabled, setSavedArchiveEnabled] = useState(false);
  const [savedArchiveDays, setSavedArchiveDays] = useState(14);
  const [appliedFollowUpEnabled, setAppliedFollowUpEnabled] = useState(false);
  const [appliedReminderEnabled, setAppliedReminderEnabled] = useState(false);
  const [appliedReminderDays, setAppliedReminderDays] = useState(7);
  const [appliedGhostedEnabled, setAppliedGhostedEnabled] = useState(false);
  const [appliedGhostedDays, setAppliedGhostedDays] = useState(14);
  const [interviewingNudgeEnabled, setInterviewingNudgeEnabled] =
    useState(false);
  const [interviewingNudgeDays, setInterviewingNudgeDays] = useState(3);
  const [negotiatingNudgeEnabled, setNegotiatingNudgeEnabled] = useState(false);
  const [negotiatingNudgeDays, setNegotiatingNudgeDays] = useState(3);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(false);

  const calendarFeedUrl = useMemo(() => {
    const origin =
      typeof window === "undefined" ? "https://app.shortlistos.co" : window.location.origin;

    return `${origin}/api/shortlist_calendar/${boardPublicId || "board"}.ics`;
  }, [boardPublicId]);

  const updateBoard = api.board.update.useMutation({
    onError: (error) => {
      showPopup({
        header: t`Unable to update board`,
        message:
          error.message || t`Please try again later, or contact customer support.`,
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

  const mockupsDisabled = !boardPublicId || !isBoardLoaded || !userHasActivePowerpack;

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
            className="font-semibold text-brand-600 hover:underline dark:text-brand-500"
          >
            {t`Upgrade now`}
          </Link>
        </p>
      )}

      <div className="space-y-4">
        <AutomationCard
          title={t`Card aging`}
          description={t`Show visual aging effects on cards based on last activity. Cards older than 1 week show progressive aging from faded to parchment style.`}
          isChecked={isCardAgingEnabled}
          onToggle={handleCardAgingToggle}
          disabled={isDisabled}
        />

        <AutomationCard
          title={t`Automatic salary data`}
          description={t`Automatically enriches each opportunity with salary benchmarks across the US, EU, UK, APAC, and global markets, so you can quickly see how an offer compares locally and worldwide.`}
          isChecked={salaryDataEnabled}
          onToggle={() => setSalaryDataEnabled((value) => !value)}
          disabled={mockupsDisabled}
        />

        <AutomationCard
          title={t`Company sentiment`}
          description={t`Automatically researches the company behind each opening across social networks, hiring portals, funding news, layoff signals, and other public sources, then summarizes the rating, risks, and recent context for you.`}
          isChecked={companySentimentEnabled}
          onToggle={() => setCompanySentimentEnabled((value) => !value)}
          disabled={mockupsDisabled}
        />

        <AutomationCard
          title={t`Google calendar feed`}
          description={t`Export all planned interviews from this shortlist as an iCal feed for Google Calendar, Outlook, or any calendar app. Never miss an interview again.`}
          isChecked={googleCalendarFeedEnabled}
          onToggle={() => setGoogleCalendarFeedEnabled((value) => !value)}
          disabled={mockupsDisabled}
        >
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
        </AutomationCard>

        <div className="rounded-[8px] border border-light-300 p-5 dark:border-dark-300">
          <div className="mb-4">
            <p className="text-sm font-semibold text-light-1000 dark:text-dark-1000">
              {t`Email reminders`}
            </p>
            <p className="mt-2 text-sm leading-6 text-light-700 dark:text-dark-800">
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
                  isChecked={savedReminderEnabled}
                  onToggle={() => setSavedReminderEnabled((value) => !value)}
                  dayValue={savedReminderDays}
                  onDayChange={setSavedReminderDays}
                  disabled={mockupsDisabled}
                />
                <ReminderRow
                  label={t`Automatically archive`}
                  isChecked={savedArchiveEnabled}
                  onToggle={() => setSavedArchiveEnabled((value) => !value)}
                  dayValue={savedArchiveDays}
                  onDayChange={setSavedArchiveDays}
                  disabled={mockupsDisabled}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-light-800 dark:text-dark-800">
                {t`Stuck in Applied`}
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-[8px] border border-light-200 bg-light-50 p-3 dark:border-dark-300 dark:bg-dark-100">
                  <Toggle
                    isChecked={appliedFollowUpEnabled}
                    onChange={() =>
                      setAppliedFollowUpEnabled((value) => !value)
                    }
                    label={t`Follow-up reminder`}
                    disabled={mockupsDisabled}
                    showLabel={false}
                  />
                  <span className="text-sm leading-6 text-light-800 dark:text-dark-900">
                    {t`Follow-up reminder`}
                  </span>
                </div>
                <ReminderRow
                  label={t`Remind me to ping the company`}
                  isChecked={appliedReminderEnabled}
                  onToggle={() => setAppliedReminderEnabled((value) => !value)}
                  dayValue={appliedReminderDays}
                  onDayChange={setAppliedReminderDays}
                  disabled={mockupsDisabled}
                />
                <ReminderRow
                  label={t`Mark the opportunity as ghosted`}
                  isChecked={appliedGhostedEnabled}
                  onToggle={() => setAppliedGhostedEnabled((value) => !value)}
                  dayValue={appliedGhostedDays}
                  onDayChange={setAppliedGhostedDays}
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
                isChecked={interviewingNudgeEnabled}
                onToggle={() => setInterviewingNudgeEnabled((value) => !value)}
                dayValue={interviewingNudgeDays}
                onDayChange={setInterviewingNudgeDays}
                disabled={mockupsDisabled}
              />
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-light-800 dark:text-dark-800">
                {t`Stuck in Negotiating`}
              </h3>
              <ReminderRow
                label={t`Nudge me to revisit the negotiation`}
                isChecked={negotiatingNudgeEnabled}
                onToggle={() => setNegotiatingNudgeEnabled((value) => !value)}
                dayValue={negotiatingNudgeDays}
                onDayChange={setNegotiatingNudgeDays}
                disabled={mockupsDisabled}
              />
            </div>
          </div>
        </div>

        <AutomationCard
          title={t`Weekly digest`}
          description={t`Send me a weekly summary of every opportunity in this shortlist, including which ones need attention next.`}
          isChecked={weeklyDigestEnabled}
          onToggle={() => setWeeklyDigestEnabled((value) => !value)}
          disabled={mockupsDisabled}
        />
      </div>
    </section>
  );
};

export default BoardsSettings;
