ALTER TABLE "shortlist_clip" ADD COLUMN "processedAt" timestamp;--> statement-breakpoint
ALTER TABLE "shortlist_clip" ADD COLUMN "processingTries" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shortlist_clip" ADD COLUMN "processingLog" text;--> statement-breakpoint
ALTER TABLE "shortlist_clip" ADD COLUMN "processingResult" varchar(10);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_clip_processed_at_idx" ON "shortlist_clip" USING btree ("processedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_clip_processing_result_idx" ON "shortlist_clip" USING btree ("processingResult");
