CREATE TABLE IF NOT EXISTS "shortlist_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"userId" uuid NOT NULL,
	"cardId" bigint,
	"boardId" bigint,
	"activityType" varchar(50) NOT NULL,
	"activityResult" varchar(10) NOT NULL,
	"activityLog" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"took" numeric(10, 4)
);
--> statement-breakpoint
ALTER TABLE "shortlist_activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlist_company_cache" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"companyNameNormalized" varchar(255) NOT NULL,
	"companyDomain" varchar(255),
	"companyDomainRaw" varchar(255),
	"companyRatingAggregated" numeric(2, 1),
	"companySentiment" jsonb,
	"companyMetadata" jsonb,
	"fetchedAt" timestamp,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"took" numeric(10, 4)
);
--> statement-breakpoint
ALTER TABLE "shortlist_company_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlist_inbox" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"createdBy" uuid NOT NULL,
	"cardId" bigint,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"processedAt" timestamp,
	"processingTries" smallint DEFAULT 0 NOT NULL,
	"rawContent" text,
	"contentType" varchar(20) NOT NULL,
	"source" varchar(20) NOT NULL,
	"processingLog" text,
	"processingResult" varchar(10) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shortlist_inbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlist_salary_cache" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"jobTitleNormalized" varchar(255),
	"countryCode" varchar(100),
	"salaryMin" integer,
	"salaryMax" integer,
	"salaryMedian" integer,
	"currency" varchar(10),
	"percentile25" integer,
	"percentile50" integer,
	"percentile75" integer,
	"source" varchar(50),
	"fetchedAt" timestamp,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"took" numeric(10, 4)
);
--> statement-breakpoint
ALTER TABLE "shortlist_salary_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_autoArchiveAfterDays" smallint;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_autoGhostedAfterDays" smallint;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_savedReminderAfterDays" smallint;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_interviewingNudgeAfterDays" smallint;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_negotiatingNudgeAfterDays" smallint;--> statement-breakpoint
ALTER TABLE "board" ADD COLUMN "shortlist_inactivityDigestAfterDays" smallint;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_companyName" varchar(255);--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_jobPostingUrl" text;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryMin" integer;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryMax" integer;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryCurrency" varchar(10);--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryPercentileUS" smallint;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryPercentileEU" smallint;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryPercentileAPAC" smallint;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryPercentileUK" smallint;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_salaryPercentileGlobal" smallint;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_companyRatingAggregated" numeric(2, 1);--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_companySentimentBlob" json;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_companySentimentSummary" text;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_cardSource" varchar(20) DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_jobLocation" varchar(255);--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_jobLocationType" varchar(20);--> statement-breakpoint
ALTER TABLE "card" ADD COLUMN "shortlist_companyLocation" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_stripeCustomerId" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_powerpackActivatedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_powerpackExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_isicVerifiedAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_isicExpiresAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_feedSecret" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_weeklyDigestEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_timezone" varchar(255) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "shortlist_lastActivity" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_activity_log" ADD CONSTRAINT "shortlist_activity_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_activity_log" ADD CONSTRAINT "shortlist_activity_log_cardId_card_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_activity_log" ADD CONSTRAINT "shortlist_activity_log_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_inbox" ADD CONSTRAINT "shortlist_inbox_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_inbox" ADD CONSTRAINT "shortlist_inbox_cardId_card_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_activity_log_user_idx" ON "shortlist_activity_log" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_activity_log_card_idx" ON "shortlist_activity_log" USING btree ("cardId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_activity_log_board_idx" ON "shortlist_activity_log" USING btree ("boardId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_activity_log_activity_type_idx" ON "shortlist_activity_log" USING btree ("activityType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_activity_log_activity_result_idx" ON "shortlist_activity_log" USING btree ("activityResult");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_activity_log_created_at_idx" ON "shortlist_activity_log" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_company_cache_company_name_normalized_idx" ON "shortlist_company_cache" USING btree ("companyNameNormalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_company_cache_company_domain_idx" ON "shortlist_company_cache" USING btree ("companyDomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_company_cache_fetched_at_idx" ON "shortlist_company_cache" USING btree ("fetchedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_company_cache_expires_at_idx" ON "shortlist_company_cache" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_inbox_created_at_idx" ON "shortlist_inbox" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_inbox_processed_at_idx" ON "shortlist_inbox" USING btree ("processedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_inbox_processing_result_idx" ON "shortlist_inbox" USING btree ("processingResult");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_salary_cache_job_title_normalized_idx" ON "shortlist_salary_cache" USING btree ("jobTitleNormalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_salary_cache_country_code_idx" ON "shortlist_salary_cache" USING btree ("countryCode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_salary_cache_fetched_at_idx" ON "shortlist_salary_cache" USING btree ("fetchedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_salary_cache_expires_at_idx" ON "shortlist_salary_cache" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_shortlist_company_name_idx" ON "card" USING btree ("shortlist_companyName");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_shortlist_powerpack_expires_at_idx" ON "user" USING btree ("shortlist_powerpackExpiresAt");