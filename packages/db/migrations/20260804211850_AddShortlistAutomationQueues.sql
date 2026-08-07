-- Custom SQL migration file, put your code below! --
CREATE TYPE "public"."shortlist_automation_job_status" AS ENUM(
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'SKIPPED'
);
--> statement-breakpoint
CREATE TYPE "public"."shortlist_automation_email_type" AS ENUM(
  'SAVED_REMINDER',
  'APPLIED_FOLLOW_UP',
  'INTERVIEWING_NUDGE',
  'NEGOTIATING_NUDGE',
  'WEEKLY_DIGEST'
);
--> statement-breakpoint
CREATE TYPE "public"."shortlist_automation_card_type" AS ENUM(
  'ARCHIVE_SAVED',
  'MARK_APPLIED_GHOSTED'
);
--> statement-breakpoint
CREATE TABLE "shortlist_automation_email_queue" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "dedupeKey" varchar(255) NOT NULL,
  "boardId" bigint NOT NULL,
  "userId" uuid NOT NULL,
  "cardId" bigint,
  "scheduledFor" timestamp NOT NULL,
  "status" "shortlist_automation_job_status" DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lockedAt" timestamp,
  "lockedBy" varchar(255),
  "lastError" text,
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "type" "shortlist_automation_email_type" NOT NULL,
  "sentAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "shortlist_automation_card_queue" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "dedupeKey" varchar(255) NOT NULL,
  "boardId" bigint NOT NULL,
  "userId" uuid NOT NULL,
  "cardId" bigint,
  "scheduledFor" timestamp NOT NULL,
  "status" "shortlist_automation_job_status" DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lockedAt" timestamp,
  "lockedBy" varchar(255),
  "lastError" text,
  "completedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "type" "shortlist_automation_card_type" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shortlist_automation_email_queue" ADD CONSTRAINT "shortlist_automation_email_queue_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shortlist_automation_email_queue" ADD CONSTRAINT "shortlist_automation_email_queue_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shortlist_automation_email_queue" ADD CONSTRAINT "shortlist_automation_email_queue_cardId_card_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shortlist_automation_card_queue" ADD CONSTRAINT "shortlist_automation_card_queue_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shortlist_automation_card_queue" ADD CONSTRAINT "shortlist_automation_card_queue_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "shortlist_automation_card_queue" ADD CONSTRAINT "shortlist_automation_card_queue_cardId_card_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."card"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_automation_email_dedupe_idx" ON "shortlist_automation_email_queue" USING btree ("dedupeKey");
--> statement-breakpoint
CREATE INDEX "shortlist_automation_email_pending_idx" ON "shortlist_automation_email_queue" USING btree ("status", "scheduledFor");
--> statement-breakpoint
CREATE INDEX "shortlist_automation_email_board_idx" ON "shortlist_automation_email_queue" USING btree ("boardId");
--> statement-breakpoint
CREATE INDEX "shortlist_automation_email_user_idx" ON "shortlist_automation_email_queue" USING btree ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_automation_card_dedupe_idx" ON "shortlist_automation_card_queue" USING btree ("dedupeKey");
--> statement-breakpoint
CREATE INDEX "shortlist_automation_card_pending_idx" ON "shortlist_automation_card_queue" USING btree ("status", "scheduledFor");
--> statement-breakpoint
CREATE INDEX "shortlist_automation_card_board_idx" ON "shortlist_automation_card_queue" USING btree ("boardId");
--> statement-breakpoint
CREATE INDEX "shortlist_automation_card_card_idx" ON "shortlist_automation_card_queue" USING btree ("cardId");
--> statement-breakpoint
ALTER TABLE "shortlist_automation_email_queue" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "shortlist_automation_card_queue" ENABLE ROW LEVEL SECURITY;
