/*
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-09-12
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
CREATE TABLE "shortlist_powerpack_purchase" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"stripeEventId" varchar(255) NOT NULL,
	"stripeCheckoutSessionId" varchar(255) NOT NULL,
	"userId" uuid NOT NULL,
	"productId" varchar(255) NOT NULL,
	"amountTotal" integer NOT NULL,
	"currency" varchar(3),
	"processedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shortlist_powerpack_purchase" ADD CONSTRAINT "shortlist_powerpack_purchase_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_powerpack_purchase_stripe_event_idx" ON "shortlist_powerpack_purchase" USING btree ("stripeEventId");
--> statement-breakpoint
CREATE UNIQUE INDEX "shortlist_powerpack_purchase_checkout_session_idx" ON "shortlist_powerpack_purchase" USING btree ("stripeCheckoutSessionId");
--> statement-breakpoint
CREATE INDEX "shortlist_powerpack_purchase_user_idx" ON "shortlist_powerpack_purchase" USING btree ("userId");
--> statement-breakpoint
ALTER TABLE "shortlist_powerpack_purchase" ENABLE ROW LEVEL SECURITY;
