import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const shortlistPowerpackPurchases = pgTable(
  "shortlist_powerpack_purchase",
  {
    id: uuid("id")
      .default(sql`uuid_generate_v4()`)
      .primaryKey(),
    stripeEventId: varchar("stripeEventId", { length: 255 }).notNull(),
    stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", {
      length: 255,
    }).notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: varchar("productId", { length: 255 }).notNull(),
    amountTotal: integer("amountTotal").notNull(),
    currency: varchar("currency", { length: 3 }),
    processedAt: timestamp("processedAt").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shortlist_powerpack_purchase_stripe_event_idx").on(
      table.stripeEventId,
    ),
    uniqueIndex("shortlist_powerpack_purchase_checkout_session_idx").on(
      table.stripeCheckoutSessionId,
    ),
    index("shortlist_powerpack_purchase_user_idx").on(table.userId),
  ],
).enableRLS();
