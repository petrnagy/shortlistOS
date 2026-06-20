ALTER TABLE "user" ADD COLUMN "shortlist_userPublicSecret" varchar(255);--> statement-breakpoint
UPDATE "user" SET "shortlist_userPublicSecret" = uuid_generate_v4()::text WHERE "shortlist_userPublicSecret" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_shortlist_feed_secret_idx" ON "user" USING btree ("shortlist_feedSecret");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_shortlist_user_public_secret_idx" ON "user" USING btree ("shortlist_userPublicSecret");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlist_link" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"createdBy" uuid NOT NULL,
	"boardId" bigint NOT NULL,
	"url" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "shortlist_link" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shortlist_clip" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"createdBy" uuid NOT NULL,
	"boardId" bigint NOT NULL,
	"url" text NOT NULL,
	"rawHtml" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "shortlist_clip" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "shortlist_inbox" ADD COLUMN "userId" uuid;--> statement-breakpoint
ALTER TABLE "shortlist_inbox" ADD COLUMN "boardId" bigint;--> statement-breakpoint
UPDATE "shortlist_inbox" SET "userId" = "createdBy" WHERE "userId" IS NULL;--> statement-breakpoint
UPDATE "shortlist_inbox"
SET "boardId" = "list"."boardId"
FROM "card"
INNER JOIN "list" ON "card"."listId" = "list"."id"
WHERE "shortlist_inbox"."cardId" = "card"."id"
  AND "shortlist_inbox"."boardId" IS NULL;--> statement-breakpoint
DELETE FROM "shortlist_inbox" WHERE "userId" IS NULL OR "boardId" IS NULL;--> statement-breakpoint
ALTER TABLE "shortlist_inbox" ALTER COLUMN "userId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shortlist_inbox" ALTER COLUMN "boardId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shortlist_inbox" DROP CONSTRAINT IF EXISTS "shortlist_inbox_cardId_card_id_fk";--> statement-breakpoint
ALTER TABLE "shortlist_inbox" DROP COLUMN IF EXISTS "cardId";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_link" ADD CONSTRAINT "shortlist_link_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_link" ADD CONSTRAINT "shortlist_link_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_clip" ADD CONSTRAINT "shortlist_clip_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_clip" ADD CONSTRAINT "shortlist_clip_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_inbox" ADD CONSTRAINT "shortlist_inbox_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shortlist_inbox" ADD CONSTRAINT "shortlist_inbox_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_link_created_by_idx" ON "shortlist_link" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_link_board_idx" ON "shortlist_link" USING btree ("boardId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_link_created_at_idx" ON "shortlist_link" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_clip_created_by_idx" ON "shortlist_clip" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_clip_board_idx" ON "shortlist_clip" USING btree ("boardId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_clip_created_at_idx" ON "shortlist_clip" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_inbox_user_idx" ON "shortlist_inbox" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shortlist_inbox_board_idx" ON "shortlist_inbox" USING btree ("boardId");
