ALTER TYPE "public"."board_activity_type" ADD VALUE 'board.renamed' BEFORE 'board.deleted';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_authorization_code" (
	"codeHash" varchar(64) PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"clientId" varchar(64) NOT NULL,
	"redirectUri" varchar(2048) NOT NULL,
	"challenge" varchar(43) NOT NULL,
	"resource" varchar(2048) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"consumedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "mcp_authorization_code" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_client" (
	"publicId" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"redirectUris" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_client" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_connection" (
	"publicId" varchar(12) PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"clientId" varchar(64) NOT NULL,
	"clientName" varchar(100) NOT NULL,
	"accessTokenHash" varchar(64) NOT NULL,
	"refreshTokenHash" varchar(64) NOT NULL,
	"accessExpiresAt" timestamp NOT NULL,
	"refreshExpiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp,
	CONSTRAINT "mcp_connection_accessTokenHash_unique" UNIQUE("accessTokenHash"),
	CONSTRAINT "mcp_connection_refreshTokenHash_unique" UNIQUE("refreshTokenHash")
);
--> statement-breakpoint
ALTER TABLE "mcp_connection" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mcp_consumed_refresh_token" (
	"tokenHash" varchar(64) PRIMARY KEY NOT NULL,
	"connectionPublicId" varchar(12) NOT NULL,
	"expiresAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_consumed_refresh_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "board_activity" ADD COLUMN "actorClientName" varchar(100);--> statement-breakpoint
ALTER TABLE "card_activity" ADD COLUMN "actorClientName" varchar(100);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_authorization_code" ADD CONSTRAINT "mcp_authorization_code_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_authorization_code" ADD CONSTRAINT "mcp_authorization_code_clientId_mcp_client_publicId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."mcp_client"("publicId") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_connection" ADD CONSTRAINT "mcp_connection_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_connection" ADD CONSTRAINT "mcp_connection_clientId_mcp_client_publicId_fk" FOREIGN KEY ("clientId") REFERENCES "public"."mcp_client"("publicId") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mcp_consumed_refresh_token" ADD CONSTRAINT "mcp_consumed_refresh_token_connectionPublicId_mcp_connection_publicId_fk" FOREIGN KEY ("connectionPublicId") REFERENCES "public"."mcp_connection"("publicId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mcp_connection_user_idx" ON "mcp_connection" USING btree ("userId");
