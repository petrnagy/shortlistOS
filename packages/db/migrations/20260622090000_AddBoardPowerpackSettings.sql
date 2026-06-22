ALTER TABLE "board" RENAME COLUMN "shortlist_autoArchiveAfterDays" TO "shortlist_savedAutoArchiveAfterDays";--> statement-breakpoint
ALTER TABLE "board" RENAME COLUMN "shortlist_autoGhostedAfterDays" TO "shortlist_appliedGhostedAfterDays";--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isSalaryDataEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isCompanySentimentEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isMagicInboxEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isCalendarFeedEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isSavedReminderEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isSavedAutoArchiveEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isAppliedFollowUpReminderEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_appliedFollowUpReminderAfterDays" smallint DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isAppliedGhostedEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isInterviewingNudgeEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isNegotiatingNudgeEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_isWeeklyDigestEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_savedReminderAfterDays" SET DEFAULT 7;--> statement-breakpoint
UPDATE "board" SET "shortlist_savedReminderAfterDays" = 7 WHERE "shortlist_savedReminderAfterDays" IS NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_savedReminderAfterDays" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_savedAutoArchiveAfterDays" SET DEFAULT 14;--> statement-breakpoint
UPDATE "board" SET "shortlist_savedAutoArchiveAfterDays" = 14 WHERE "shortlist_savedAutoArchiveAfterDays" IS NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_savedAutoArchiveAfterDays" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_appliedGhostedAfterDays" SET DEFAULT 14;--> statement-breakpoint
UPDATE "board" SET "shortlist_appliedGhostedAfterDays" = 14 WHERE "shortlist_appliedGhostedAfterDays" IS NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_appliedGhostedAfterDays" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_interviewingNudgeAfterDays" SET DEFAULT 3;--> statement-breakpoint
UPDATE "board" SET "shortlist_interviewingNudgeAfterDays" = 3 WHERE "shortlist_interviewingNudgeAfterDays" IS NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_interviewingNudgeAfterDays" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_negotiatingNudgeAfterDays" SET DEFAULT 3;--> statement-breakpoint
UPDATE "board" SET "shortlist_negotiatingNudgeAfterDays" = 3 WHERE "shortlist_negotiatingNudgeAfterDays" IS NULL;--> statement-breakpoint
ALTER TABLE "board" ALTER COLUMN "shortlist_negotiatingNudgeAfterDays" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "board" DROP COLUMN "shortlist_inactivityDigestAfterDays";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "shortlist_weeklyDigestEnabled";
