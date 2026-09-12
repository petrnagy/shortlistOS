import type Stripe from "stripe";
import { describe, expect, it } from "vitest";

import { getPowerpackFulfillment } from "./stripe-powerpack";

const PRODUCT_ID = "prod_powerpack";

const createCheckoutSession = (
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session =>
  ({
    amount_total: 2900,
    client_reference_id: "user-123",
    currency: "usd",
    id: "cs_test_123",
    metadata: {
      productId: PRODUCT_ID,
      userId: "user-123",
    },
    mode: "payment",
    object: "checkout.session",
    payment_status: "paid",
    ...overrides,
  }) as Stripe.Checkout.Session;

describe("getPowerpackFulfillment", () => {
  it("accepts a paid Powerpack Checkout Session", () => {
    expect(
      getPowerpackFulfillment(createCheckoutSession(), PRODUCT_ID),
    ).toEqual({
      amountTotal: 2900,
      currency: "usd",
      productId: PRODUCT_ID,
      userId: "user-123",
    });
  });

  it("accepts a completed no-cost Powerpack order", () => {
    expect(
      getPowerpackFulfillment(
        createCheckoutSession({
          amount_total: 0,
          payment_status: "no_payment_required",
        }),
        PRODUCT_ID,
      ),
    ).toEqual({
      amountTotal: 0,
      currency: "usd",
      productId: PRODUCT_ID,
      userId: "user-123",
    });
  });

  it.each([
    { amount_total: 2900, payment_status: "no_payment_required" as const },
    { amount_total: 0, payment_status: "unpaid" as const },
    { amount_total: null, payment_status: "paid" as const },
    { mode: "subscription" as const },
    { metadata: { productId: "prod_other", userId: "user-123" } },
    { client_reference_id: null, metadata: { productId: PRODUCT_ID } },
  ])("rejects an invalid fulfillment session %#", (overrides) => {
    expect(
      getPowerpackFulfillment(
        createCheckoutSession(overrides as Partial<Stripe.Checkout.Session>),
        PRODUCT_ID,
      ),
    ).toBeNull();
  });
});
