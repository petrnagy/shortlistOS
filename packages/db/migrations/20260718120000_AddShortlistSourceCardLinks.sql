ALTER TABLE "shortlist_email_source" ADD COLUMN "inReplyTo" text;
ALTER TABLE "shortlist_email_source" ADD COLUMN "referencesJson" jsonb;
DROP INDEX IF EXISTS "shortlist_email_source_extern_id_idx";
CREATE UNIQUE INDEX "shortlist_email_source_extern_board_idx"
  ON "shortlist_email_source" ("externId", "boardId");
WITH ranked_jobs AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "sourceType", "sourceId", "jobType"
    ORDER BY "createdAt", "id"
  ) AS row_number
  FROM "shortlist_job_queue"
)
DELETE FROM "shortlist_job_queue"
WHERE "id" IN (
  SELECT "id" FROM ranked_jobs WHERE row_number > 1
);
CREATE UNIQUE INDEX "shortlist_job_queue_source_job_idx"
  ON "shortlist_job_queue" ("sourceType", "sourceId", "jobType");

CREATE TABLE "shortlist_source_card" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "sourceType" varchar(20) NOT NULL,
  "sourceId" uuid NOT NULL,
  "cardId" bigint NOT NULL REFERENCES "card"("id") ON DELETE cascade,
  "matchType" varchar(40) NOT NULL,
  "contentHash" varchar(64),
  "classificationJson" jsonb,
  "fieldProvenanceJson" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp
);

CREATE UNIQUE INDEX "shortlist_source_card_source_idx"
  ON "shortlist_source_card" ("sourceType", "sourceId");
CREATE INDEX "shortlist_source_card_card_idx"
  ON "shortlist_source_card" ("cardId");
CREATE INDEX "shortlist_source_card_hash_idx"
  ON "shortlist_source_card" ("contentHash");

ALTER TABLE "shortlist_attachment_source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shortlist_source_object" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shortlist_job_queue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shortlist_source_card" ENABLE ROW LEVEL SECURITY;
