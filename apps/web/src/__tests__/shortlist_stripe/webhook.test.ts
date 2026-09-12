import { Readable } from "node:stream";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import handler from "../../pages/api/shortlist_stripe/webhook";

const { mockCreateNextApiContext, mockGrantPowerpackForCheckout, mockLogger } =
  vi.hoisted(() => ({
    mockCreateNextApiContext: vi.fn(() => Promise.resolve({ db: {} })),
    mockGrantPowerpackForCheckout: vi.fn(() =>
      Promise.resolve({ processed: true }),
    ),
    mockLogger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  }));

vi.mock("~/env", () => ({
  env: {
    STRIPE_POWERPACK_PRODUCT_ID: "prod_powerpack",
    STRIPE_SECRET_KEY: "sk_test_placeholder",
    STRIPE_SHORTLIST_WEBHOOK_SECRET: "whsec_powerpack",
  },
}));

vi.mock("@kan/api/trpc", () => ({
  createNextApiContext: mockCreateNextApiContext,
}));

vi.mock("@kan/db/repository/user.repo", () => ({
  grantShortlistPowerpackForCheckout: mockGrantPowerpackForCheckout,
}));

vi.mock("@kan/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

const stripe = new Stripe("sk_test_placeholder");

const createEventPayload = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    api_version: "2025-06-30.basil",
    created: 1_789_221_600,
    data: {
      object: {
        amount_total: 0,
        client_reference_id: "user-123",
        currency: "usd",
        id: "cs_live_powerpack",
        metadata: {
          productId: "prod_powerpack",
          userId: "user-123",
        },
        mode: "payment",
        object: "checkout.session",
        payment_status: "no_payment_required",
        ...overrides,
      },
    },
    id: "evt_live_powerpack",
    livemode: true,
    object: "event",
    pending_webhooks: 1,
    request: null,
    type: "checkout.session.completed",
  });

const createRequest = (payload: string, signature?: string) => {
  const request = Readable.from([payload]) as unknown as NextApiRequest;
  request.headers = signature ? { "stripe-signature": signature } : {};
  request.method = "POST";
  request.url = "/api/shortlist_stripe/webhook";
  return request;
};

const createResponse = () => {
  const response = {
    json: vi.fn<(body: unknown) => NextApiResponse>(),
    status: vi.fn<(code: number) => NextApiResponse>(),
  };

  response.status.mockReturnValue(response as unknown as NextApiResponse);
  response.json.mockReturnValue(response as unknown as NextApiResponse);

  return response as unknown as NextApiResponse & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
};

describe("Powerpack Stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a correctly signed no-cost Powerpack completion", async () => {
    const payload = createEventPayload();
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_powerpack",
    });
    const response = createResponse();

    await handler(createRequest(payload, signature), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ received: true });
    expect(mockGrantPowerpackForCheckout).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        amountTotal: 0,
        productId: "prod_powerpack",
        stripeCheckoutSessionId: "cs_live_powerpack",
        stripeEventId: "evt_live_powerpack",
        userId: "user-123",
      }),
    );
  });

  it("rejects an invalid Stripe signature", async () => {
    const payload = createEventPayload();
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_wrong",
    });
    const response = createResponse();

    await handler(createRequest(payload, signature), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(mockGrantPowerpackForCheckout).not.toHaveBeenCalled();
  });

  it("acknowledges but does not fulfil another product", async () => {
    const payload = createEventPayload({
      metadata: { productId: "prod_other", userId: "user-123" },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_powerpack",
    });
    const response = createResponse();

    await handler(createRequest(payload, signature), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(mockGrantPowerpackForCheckout).not.toHaveBeenCalled();
  });

  it("rejects requests without a Stripe signature", async () => {
    const response = createResponse();

    await handler(createRequest(createEventPayload()), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "No signature found",
    });
    expect(mockCreateNextApiContext).not.toHaveBeenCalled();
  });
});
