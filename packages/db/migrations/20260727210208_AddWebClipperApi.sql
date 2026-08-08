/*
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
DO $$ BEGIN
 CREATE TYPE "public"."web_clipper_status" AS ENUM('QUEUED', 'PROCESSING', 'CREATED', 'ALREADY_EXISTS', 'NOT_A_JOB', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_clipper_authorization_code" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"codeHash" varchar(64) NOT NULL,
	"clientId" varchar(64) NOT NULL,
	"userId" uuid NOT NULL,
	"redirectUri" text NOT NULL,
	"codeChallenge" varchar(128) NOT NULL,
	"scopes" text[] NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_clipper_clip" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"userId" uuid NOT NULL,
	"boardId" bigint NOT NULL,
	"status" "web_clipper_status" DEFAULT 'QUEUED' NOT NULL,
	"sourceUrl" text NOT NULL,
	"canonicalUrl" text,
	"pageTitle" text NOT NULL,
	"pageLanguage" varchar(64),
	"pageCapturedAt" timestamp with time zone NOT NULL,
	"encryptedHtml" text,
	"encryptedJsonLd" text,
	"extensionVersion" varchar(64) NOT NULL,
	"browser" varchar(16) NOT NULL,
	"cardId" bigint,
	"duplicateCardId" bigint,
	"resultJobTitle" text,
	"resultCompanyName" text,
	"resultBoardName" text,
	"errorCode" varchar(32),
	"processingStartedAt" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"rawContentDeletedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "web_clipper_refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"tokenFamilyId" uuid NOT NULL,
	"parentTokenId" uuid,
	"clientId" varchar(64) NOT NULL,
	"userId" uuid NOT NULL,
	"scopes" text[] NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"lastUsedAt" timestamp with time zone,
	"rotatedAt" timestamp with time zone,
	"revokedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "web_clipper_authorization_code" ADD CONSTRAINT "web_clipper_authorization_code_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "web_clipper_clip" ADD CONSTRAINT "web_clipper_clip_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "web_clipper_clip" ADD CONSTRAINT "web_clipper_clip_boardId_board_id_fk" FOREIGN KEY ("boardId") REFERENCES "public"."board"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "web_clipper_clip" ADD CONSTRAINT "web_clipper_clip_cardId_card_id_fk" FOREIGN KEY ("cardId") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "web_clipper_clip" ADD CONSTRAINT "web_clipper_clip_duplicateCardId_card_id_fk" FOREIGN KEY ("duplicateCardId") REFERENCES "public"."card"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "web_clipper_refresh_token" ADD CONSTRAINT "web_clipper_refresh_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_clipper_authorization_code_hash_idx" ON "web_clipper_authorization_code" USING btree ("codeHash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_clipper_authorization_code_expiry_idx" ON "web_clipper_authorization_code" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_clipper_clip_user_idx" ON "web_clipper_clip" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_clipper_clip_status_created_idx" ON "web_clipper_clip" USING btree ("status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "web_clipper_refresh_token_hash_idx" ON "web_clipper_refresh_token" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_clipper_refresh_token_family_idx" ON "web_clipper_refresh_token" USING btree ("tokenFamilyId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_clipper_refresh_token_expiry_idx" ON "web_clipper_refresh_token" USING btree ("expiresAt");
