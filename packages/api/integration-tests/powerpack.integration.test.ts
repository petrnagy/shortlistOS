import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as userRepo from "@kan/db/repository/user.repo";
import { shortlistPowerpackPurchases, users } from "@kan/db/schema";

import { createTestDb, seedTestData } from "./test-db";

describe("Powerpack checkout fulfillment", () => {
  it("grants membership only once when Stripe retries an event", async () => {
    const db = await createTestDb();
    const { user } = await seedTestData(db);
    const input = {
      amountTotal: 0,
      currency: "usd",
      membershipDurationDays: 90,
      productId: "prod_powerpack",
      stripeCheckoutSessionId: "cs_live_powerpack",
      stripeEventId: "evt_live_powerpack",
      userId: user.id,
    };

    const firstResult = await userRepo.grantShortlistPowerpackForCheckout(
      db,
      input,
    );
    const firstUser = await db.query.users.findFirst({
      columns: { shortlistPowerpackExpiresAt: true },
      where: eq(users.id, user.id),
    });

    const retryResult = await userRepo.grantShortlistPowerpackForCheckout(
      db,
      input,
    );
    const retriedUser = await db.query.users.findFirst({
      columns: { shortlistPowerpackExpiresAt: true },
      where: eq(users.id, user.id),
    });
    const purchases = await db.select().from(shortlistPowerpackPurchases);

    expect(firstResult.processed).toBe(true);
    expect(retryResult).toEqual({ processed: false });
    expect(firstUser?.shortlistPowerpackExpiresAt).toEqual(
      retriedUser?.shortlistPowerpackExpiresAt,
    );
    expect(purchases).toHaveLength(1);
  });

  it("deduplicates a Checkout Session even if the event ID changes", async () => {
    const db = await createTestDb();
    const { user } = await seedTestData(db);
    const input = {
      amountTotal: 2900,
      currency: "usd",
      membershipDurationDays: 90,
      productId: "prod_powerpack",
      stripeCheckoutSessionId: "cs_live_same_session",
      stripeEventId: "evt_live_original",
      userId: user.id,
    };

    const firstResult = await userRepo.grantShortlistPowerpackForCheckout(
      db,
      input,
    );
    const duplicateResult = await userRepo.grantShortlistPowerpackForCheckout(
      db,
      { ...input, stripeEventId: "evt_live_duplicate" },
    );

    expect(firstResult.processed).toBe(true);
    expect(duplicateResult).toEqual({ processed: false });
  });
});
