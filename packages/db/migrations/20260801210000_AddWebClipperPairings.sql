/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-08-01
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
CREATE TYPE "public"."web_clipper_pairing_status" AS ENUM('PENDING', 'APPROVED', 'DENIED', 'CONSUMED', 'EXPIRED');
--> statement-breakpoint
CREATE TABLE "web_clipper_pairing" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"pollTokenHash" varchar(64) NOT NULL,
	"authorizationCodeHash" varchar(64),
	"clientId" varchar(64) NOT NULL,
	"userId" uuid,
	"codeChallenge" varchar(128) NOT NULL,
	"codeChallengeMethod" varchar(8) DEFAULT 'S256' NOT NULL,
	"scopes" text[] NOT NULL,
	"extensionVersion" varchar(64) NOT NULL,
	"browser" varchar(16) NOT NULL,
	"status" "web_clipper_pairing_status" DEFAULT 'PENDING' NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"approvedAt" timestamp with time zone,
	"deniedAt" timestamp with time zone,
	"consumedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "web_clipper_pairing_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "web_clipper_pairing_poll_token_hash_idx" ON "web_clipper_pairing" USING btree ("pollTokenHash");
--> statement-breakpoint
CREATE UNIQUE INDEX "web_clipper_pairing_authorization_code_hash_idx" ON "web_clipper_pairing" USING btree ("authorizationCodeHash");
--> statement-breakpoint
CREATE INDEX "web_clipper_pairing_expiry_idx" ON "web_clipper_pairing" USING btree ("expiresAt");
--> statement-breakpoint
CREATE INDEX "web_clipper_pairing_user_idx" ON "web_clipper_pairing" USING btree ("userId");
--> statement-breakpoint
DROP TABLE "web_clipper_authorization_transaction";
--> statement-breakpoint
DROP TABLE "web_clipper_authorization_code";
