ALTER TABLE "shortlist_inbox" ADD COLUMN "externId" varchar(250);--> statement-breakpoint
UPDATE "shortlist_inbox" SET "externId" = "id"::text WHERE "externId" IS NULL;--> statement-breakpoint
ALTER TABLE "shortlist_inbox" ALTER COLUMN "externId" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shortlist_inbox_extern_id_idx" ON "shortlist_inbox" USING btree ("externId");
