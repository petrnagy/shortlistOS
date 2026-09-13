CREATE TYPE "public"."board_activity_type" AS ENUM('board.created', 'board.deleted', 'board.archived', 'board.unarchived');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "board_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"publicId" varchar(12) NOT NULL,
	"type" "board_activity_type" NOT NULL,
	"boardId" bigint,
	"boardName" varchar(255) NOT NULL,
	"boardType" "board_type" NOT NULL,
	"workspaceId" bigint NOT NULL,
	"createdBy" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "board_activity_publicId_unique" UNIQUE("publicId")
);
--> statement-breakpoint
ALTER TABLE "board_activity" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_activity" ADD CONSTRAINT "board_activity_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_activity" ADD CONSTRAINT "board_activity_workspaceId_workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "board_activity" ADD CONSTRAINT "board_activity_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_activity_workspace_created_at_idx" ON "board_activity" USING btree ("workspaceId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "board_activity_board_idx" ON "board_activity" USING btree ("boardId");
--> statement-breakpoint
-- Preserve known creation history. Historical archive transitions cannot be reconstructed.
INSERT INTO "board_activity" ("publicId", "type", "boardId", "boardName", "boardType", "workspaceId", "createdBy", "createdAt")
SELECT "publicId", 'board.created', "id", "name", "type", "workspaceId", "createdBy", "createdAt"
FROM "board";
