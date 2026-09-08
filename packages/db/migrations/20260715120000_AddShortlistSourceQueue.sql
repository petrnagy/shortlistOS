ALTER TABLE "shortlist_clip" RENAME TO "shortlist_webpage_source";--> statement-breakpoint
ALTER TABLE "shortlist_inbox" RENAME TO "shortlist_email_source";--> statement-breakpoint

DROP INDEX IF EXISTS "shortlist_clip_created_by_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_clip_board_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_clip_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_clip_processed_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_clip_processing_result_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_inbox_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_inbox_board_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_inbox_created_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_inbox_processed_at_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_inbox_processing_result_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shortlist_inbox_extern_id_idx";--> statement-breakpoint

ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "sourceType";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "rawHtml";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "fileS3Key";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "fileOriginalFilename";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "fileContentType";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "fileSize";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "processedAt";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "processingTries";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "processingLog";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" DROP COLUMN IF EXISTS "processingResult";--> statement-breakpoint
ALTER TABLE "shortlist_webpage_source" ADD COLUMN "metadataJson" jsonb;--> statement-breakpoint

ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "userId";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "processedAt";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "processingTries";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "rawContent";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "contentType";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "source";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "processingLog";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" DROP COLUMN IF EXISTS "processingResult";--> statement-breakpoint
ALTER TABLE "shortlist_email_source" ADD COLUMN "fromEmail" text;--> statement-breakpoint
ALTER TABLE "shortlist_email_source" ADD COLUMN "fromName" text;--> statement-breakpoint
ALTER TABLE "shortlist_email_source" ADD COLUMN "subject" text;--> statement-breakpoint
ALTER TABLE "shortlist_email_source" ADD COLUMN "sentAt" timestamp;--> statement-breakpoint
ALTER TABLE "shortlist_email_source" ADD COLUMN "hasSupportedAttachment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shortlist_email_source" ADD COLUMN "metadataJson" jsonb;--> statement-breakpoint

CREATE TABLE "shortlist_attachment_source" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "createdBy" uuid NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "boardId" bigint NOT NULL REFERENCES "board"("id") ON DELETE cascade,
  "originalFilename" text NOT NULL,
  "contentType" text NOT NULL,
  "fileSize" bigint NOT NULL,
  "metadataJson" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp
);--> statement-breakpoint

CREATE TABLE "shortlist_source_object" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "createdBy" uuid NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "boardId" bigint NOT NULL REFERENCES "board"("id") ON DELETE cascade,
  "sourceType" varchar(20) NOT NULL,
  "sourceId" uuid NOT NULL,
  "objectType" varchar(30) NOT NULL,
  "bucket" text NOT NULL,
  "s3Key" text NOT NULL,
  "originalFilename" text NOT NULL,
  "contentType" text NOT NULL,
  "fileSize" bigint NOT NULL,
  "metadataJson" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "shortlist_job_queue" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "jobType" varchar(30) NOT NULL,
  "status" varchar(20) NOT NULL,
  "sourceType" varchar(20) NOT NULL,
  "sourceId" uuid NOT NULL,
  "createdBy" uuid NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "boardId" bigint NOT NULL REFERENCES "board"("id") ON DELETE cascade,
  "payloadJson" jsonb,
  "attempts" smallint DEFAULT 0 NOT NULL,
  "maxAttempts" smallint DEFAULT 3 NOT NULL,
  "runAfter" timestamp DEFAULT now() NOT NULL,
  "lockedAt" timestamp,
  "lockedBy" varchar(100),
  "processedAt" timestamp,
  "error" text,
  "processingLog" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp
);--> statement-breakpoint

CREATE INDEX "shortlist_attachment_source_created_by_idx" ON "shortlist_attachment_source" ("createdBy");--> statement-breakpoint
CREATE INDEX "shortlist_attachment_source_board_idx" ON "shortlist_attachment_source" ("boardId");--> statement-breakpoint
CREATE INDEX "shortlist_attachment_source_created_at_idx" ON "shortlist_attachment_source" ("createdAt");--> statement-breakpoint
CREATE INDEX "shortlist_email_source_created_by_idx" ON "shortlist_email_source" ("createdBy");--> statement-breakpoint
CREATE INDEX "shortlist_email_source_board_idx" ON "shortlist_email_source" ("boardId");--> statement-breakpoint
CREATE INDEX "shortlist_email_source_created_at_idx" ON "shortlist_email_source" ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_email_source_extern_id_idx" ON "shortlist_email_source" ("externId");--> statement-breakpoint
CREATE INDEX "shortlist_webpage_source_created_by_idx" ON "shortlist_webpage_source" ("createdBy");--> statement-breakpoint
CREATE INDEX "shortlist_webpage_source_board_idx" ON "shortlist_webpage_source" ("boardId");--> statement-breakpoint
CREATE INDEX "shortlist_webpage_source_created_at_idx" ON "shortlist_webpage_source" ("createdAt");--> statement-breakpoint
CREATE INDEX "shortlist_source_object_created_by_idx" ON "shortlist_source_object" ("createdBy");--> statement-breakpoint
CREATE INDEX "shortlist_source_object_board_idx" ON "shortlist_source_object" ("boardId");--> statement-breakpoint
CREATE INDEX "shortlist_source_object_source_idx" ON "shortlist_source_object" ("sourceType", "sourceId");--> statement-breakpoint
CREATE INDEX "shortlist_source_object_type_idx" ON "shortlist_source_object" ("objectType");--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_source_object_s3_key_idx" ON "shortlist_source_object" ("bucket", "s3Key");--> statement-breakpoint
CREATE INDEX "shortlist_job_queue_status_idx" ON "shortlist_job_queue" ("status");--> statement-breakpoint
CREATE INDEX "shortlist_job_queue_run_after_idx" ON "shortlist_job_queue" ("runAfter");--> statement-breakpoint
CREATE INDEX "shortlist_job_queue_source_idx" ON "shortlist_job_queue" ("sourceType", "sourceId");--> statement-breakpoint
CREATE INDEX "shortlist_job_queue_board_idx" ON "shortlist_job_queue" ("boardId");--> statement-breakpoint
CREATE INDEX "shortlist_job_queue_created_by_idx" ON "shortlist_job_queue" ("createdBy");--> statement-breakpoint
