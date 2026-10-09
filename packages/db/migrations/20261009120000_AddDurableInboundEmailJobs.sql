CREATE TABLE "shortlist_inbound_email_job" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"idempotencyKey" varchar(64) NOT NULL,
	"externId" varchar(250) NOT NULL,
	"createdBy" uuid NOT NULL,
	"boardId" bigint NOT NULL,
	"boardPublicId" varchar(64) NOT NULL,
	"payloadJson" jsonb NOT NULL,
	"sourceId" uuid,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"maxAttempts" smallint DEFAULT 5 NOT NULL,
	"runAfter" timestamp DEFAULT now() NOT NULL,
	"lockedAt" timestamp,
	"lockedBy" varchar(100),
	"completedAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	CONSTRAINT "shortlist_inbound_email_job_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "user"("id") ON DELETE cascade,
	CONSTRAINT "shortlist_inbound_email_job_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "board"("id") ON DELETE cascade,
	CONSTRAINT "shortlist_inbound_email_job_sourceId_shortlist_email_source_id_fk" FOREIGN KEY ("sourceId") REFERENCES "shortlist_email_source"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_inbound_email_job_idempotency_idx" ON "shortlist_inbound_email_job" USING btree ("idempotencyKey");
--> statement-breakpoint
CREATE INDEX "shortlist_inbound_email_job_status_run_after_idx" ON "shortlist_inbound_email_job" USING btree ("status","runAfter");
--> statement-breakpoint
CREATE INDEX "shortlist_inbound_email_job_board_idx" ON "shortlist_inbound_email_job" USING btree ("boardId");
