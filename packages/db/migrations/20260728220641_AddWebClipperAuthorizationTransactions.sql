/*
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-29
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
CREATE TABLE IF NOT EXISTS "web_clipper_authorization_transaction" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"clientId" varchar(64) NOT NULL,
	"userId" uuid NOT NULL,
	"redirectUri" text NOT NULL,
	"state" varchar(1024) NOT NULL,
	"codeChallenge" varchar(128) NOT NULL,
	"scopes" text[] NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"consumedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "web_clipper_authorization_transaction" ADD CONSTRAINT "web_clipper_authorization_transaction_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_clipper_authorization_transaction_expiry_idx" ON "web_clipper_authorization_transaction" USING btree ("expiresAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "web_clipper_authorization_transaction_user_idx" ON "web_clipper_authorization_transaction" USING btree ("userId");
