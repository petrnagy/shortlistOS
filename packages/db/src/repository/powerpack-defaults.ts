import { eq } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import type { boards } from "@kan/db/schema";
import { users } from "@kan/db/schema";

type Transaction = Parameters<Parameters<dbClient["transaction"]>[0]>[0];

export const POWERPACK_ENABLED_DEFAULTS = {
  shortlistIsSalaryDataEnabled: true,
  shortlistIsCompanySentimentEnabled: true,
  shortlistIsMagicInboxEnabled: true,
  shortlistIsCalendarFeedEnabled: true,
  shortlistIsSavedReminderEnabled: true,
  shortlistIsSavedAutoArchiveEnabled: true,
  shortlistIsAppliedFollowUpReminderEnabled: true,
  shortlistIsAppliedGhostedEnabled: true,
  shortlistIsInterviewingNudgeEnabled: true,
  shortlistIsNegotiatingNudgeEnabled: true,
  shortlistIsWeeklyDigestEnabled: true,
  shortlistIsCardAgingEnabled: true,
} as const satisfies Record<
  Extract<keyof typeof boards.$inferInsert, `shortlistIs${string}Enabled`>,
  true
>;

// Always lock the owner before locking boards, including on manual updates.
// Purchases and board creation must share this lock to avoid missing new boards.
export const lockPowerpackOwner = async (tx: Transaction, userId: string) => {
  const [owner] = await tx
    .select({
      shortlistPowerpackActivatedAt: users.shortlistPowerpackActivatedAt,
      shortlistPowerpackExpiresAt: users.shortlistPowerpackExpiresAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .for("no key update");
  return owner;
};

export const hasActivePowerpack = (
  owner: Awaited<ReturnType<typeof lockPowerpackOwner>>,
  now = new Date(),
) =>
  !!owner?.shortlistPowerpackActivatedAt &&
  !!owner.shortlistPowerpackExpiresAt &&
  now >= owner.shortlistPowerpackActivatedAt &&
  now <= owner.shortlistPowerpackExpiresAt;

export const initializedPowerpackDefaults = () => ({
  ...POWERPACK_ENABLED_DEFAULTS,
  shortlistPowerpackSettingsInitializedAt: new Date(),
});
