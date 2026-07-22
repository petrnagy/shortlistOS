ALTER TABLE "card"
ADD COLUMN "shortlist_dataFetchNeeded" boolean DEFAULT false NOT NULL;

CREATE TABLE "shortlist_enrichment_job" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "cardId" bigint NOT NULL,
  "enrichmentType" varchar(20) NOT NULL,
  "status" varchar(20) NOT NULL,
  "requestKey" varchar(64) NOT NULL,
  "requestJson" jsonb NOT NULL,
  "responseJson" jsonb,
  "summary" text,
  "attempts" smallint DEFAULT 0 NOT NULL,
  "maxAttempts" smallint DEFAULT 3 NOT NULL,
  "runAfter" timestamp DEFAULT now() NOT NULL,
  "lockedAt" timestamp,
  "lockedBy" varchar(100),
  "fetchedAt" timestamp,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp
);

ALTER TABLE "shortlist_enrichment_job"
ADD CONSTRAINT "shortlist_enrichment_job_cardId_card_id_fk"
FOREIGN KEY ("cardId") REFERENCES "public"."card"("id")
ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "shortlist_enrichment_job_card_type_idx"
ON "shortlist_enrichment_job" USING btree ("cardId", "enrichmentType");

CREATE INDEX "shortlist_enrichment_job_status_run_after_idx"
ON "shortlist_enrichment_job" USING btree ("status", "runAfter");

CREATE INDEX "shortlist_enrichment_job_request_key_idx"
ON "shortlist_enrichment_job" USING btree ("requestKey");

ALTER TABLE "shortlist_enrichment_job" ENABLE ROW LEVEL SECURITY;
