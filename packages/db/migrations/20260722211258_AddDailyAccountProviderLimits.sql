ALTER TABLE "card"
ADD COLUMN "shortlist_dataFetchRequestedBy" uuid;

ALTER TABLE "shortlist_enrichment_job"
ADD COLUMN "requestedBy" uuid;

ALTER TABLE "shortlist_provider_request"
ADD COLUMN "accountId" uuid;

ALTER TABLE "card"
ADD CONSTRAINT "card_shortlist_dataFetchRequestedBy_user_id_fk"
FOREIGN KEY ("shortlist_dataFetchRequestedBy") REFERENCES "public"."user"("id")
ON DELETE set null ON UPDATE no action;

ALTER TABLE "shortlist_enrichment_job"
ADD CONSTRAINT "shortlist_enrichment_job_requestedBy_user_id_fk"
FOREIGN KEY ("requestedBy") REFERENCES "public"."user"("id")
ON DELETE set null ON UPDATE no action;

ALTER TABLE "shortlist_provider_request"
ADD CONSTRAINT "shortlist_provider_request_accountId_user_id_fk"
FOREIGN KEY ("accountId") REFERENCES "public"."user"("id")
ON DELETE cascade ON UPDATE no action;

UPDATE "card"
SET "shortlist_dataFetchRequestedBy" = "createdBy"
WHERE "shortlist_dataFetchNeeded" = true
  AND "createdBy" IS NOT NULL;

UPDATE "shortlist_enrichment_job" AS enrichment
SET "requestedBy" = card."createdBy"
FROM "card" AS card
WHERE enrichment."cardId" = card."id"
  AND enrichment."requestedBy" IS NULL;

UPDATE "shortlist_provider_request" AS request
SET "accountId" = source_job."createdBy"
FROM "shortlist_job_queue" AS source_job
WHERE request."sourceJobId" = source_job."id"
  AND request."accountId" IS NULL;

UPDATE "shortlist_provider_request" AS request
SET "accountId" = card."createdBy"
FROM "card" AS card
WHERE request."cardId" = card."id"
  AND request."accountId" IS NULL;

CREATE INDEX "shortlist_provider_request_account_daily_idx"
ON "shortlist_provider_request" USING btree (
  "accountId", "provider", "requestedAt"
);
