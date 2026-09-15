ALTER TABLE "board" ADD COLUMN "shortlist_powerpackSettingsInitializedAt" timestamp;
--> statement-breakpoint
-- Legacy boards have no reliable settings history, including all-disabled choices.
-- Preserve their configuration on unarchive. First purchases still initialize active boards.
UPDATE "board" SET "shortlist_powerpackSettingsInitializedAt" = CURRENT_TIMESTAMP;
