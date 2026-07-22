CREATE TABLE "shortlist_provider_request" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "cardId" bigint,
  "sourceJobId" uuid,
  "enrichmentJobId" uuid,
  "provider" varchar(30) NOT NULL,
  "endpoint" varchar(80) NOT NULL,
  "status" varchar(20) NOT NULL,
  "requestKey" varchar(64) NOT NULL,
  "jobTitleNormalized" varchar(255),
  "location" varchar(255),
  "regionKey" varchar(20),
  "requestJson" jsonb NOT NULL,
  "responseJson" jsonb,
  "duplicateOfId" uuid,
  "error" text,
  "requestedAt" timestamp DEFAULT now() NOT NULL,
  "fetchedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp
);

ALTER TABLE "shortlist_provider_request"
ADD CONSTRAINT "shortlist_provider_request_cardId_card_id_fk"
FOREIGN KEY ("cardId") REFERENCES "public"."card"("id")
ON DELETE cascade ON UPDATE no action;

ALTER TABLE "shortlist_provider_request"
ADD CONSTRAINT "shortlist_provider_request_sourceJobId_shortlist_job_queue_id_fk"
FOREIGN KEY ("sourceJobId") REFERENCES "public"."shortlist_job_queue"("id")
ON DELETE set null ON UPDATE no action;

ALTER TABLE "shortlist_provider_request"
ADD CONSTRAINT "shortlist_provider_request_enrichmentJobId_shortlist_enrichment_job_id_fk"
FOREIGN KEY ("enrichmentJobId") REFERENCES "public"."shortlist_enrichment_job"("id")
ON DELETE set null ON UPDATE no action;

CREATE INDEX "shortlist_provider_request_card_provider_idx"
ON "shortlist_provider_request" USING btree ("cardId", "provider");

CREATE INDEX "shortlist_provider_request_salary_cache_idx"
ON "shortlist_provider_request" USING btree (
  "provider", "endpoint", "location", "fetchedAt"
);

CREATE INDEX "shortlist_provider_request_title_idx"
ON "shortlist_provider_request" USING btree ("jobTitleNormalized");

CREATE INDEX "shortlist_provider_request_request_key_idx"
ON "shortlist_provider_request" USING btree ("requestKey");

CREATE INDEX "shortlist_provider_request_source_job_idx"
ON "shortlist_provider_request" USING btree ("sourceJobId");

CREATE INDEX "shortlist_provider_request_enrichment_job_idx"
ON "shortlist_provider_request" USING btree ("enrichmentJobId");

ALTER TABLE "shortlist_provider_request" ENABLE ROW LEVEL SECURITY;
