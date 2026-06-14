import type { NextApiRequest, NextApiResponse } from "next";
import { env } from "next-runtime-env";
import Stripe from "stripe";

import { createNextApiContext } from "@kan/api/trpc";
import { withApiLogging } from "@kan/api/utils/apiLogging";
import { withRateLimit } from "@kan/api/utils/rateLimit";

import {
  POWERPACK_CHECKOUT_CANCEL_PATH,
  POWERPACK_CHECKOUT_SUCCESS_PATH,
  POWERPACK_MEMBERSHIP_DURATION_DAYS,
  POWERPACK_PRICE_AMOUNT_CENTS,
  POWERPACK_PRICE_CURRENCY,
  POWERPACK_STRIPE_PRODUCT_ID,
} from "~/config/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export default withRateLimit(
  { points: 100, duration: 60 },
  withApiLogging(async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const { user } = await createNextApiContext(req);

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        loginUrl: `/login?next=${encodeURIComponent("/settings/powerpack")}`,
      });
    }

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");

    if (!baseUrl) {
      return res.status(500).json({ error: "Missing NEXT_PUBLIC_BASE_URL" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: POWERPACK_PRICE_CURRENCY,
            unit_amount: POWERPACK_PRICE_AMOUNT_CENTS,
            product: POWERPACK_STRIPE_PRODUCT_ID,
          },
        },
      ],
      success_url: `${baseUrl}${POWERPACK_CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${POWERPACK_CHECKOUT_CANCEL_PATH}`,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        userId: user.id,
        userEmail: user.email ?? "",
        membershipDurationDays: String(POWERPACK_MEMBERSHIP_DURATION_DAYS),
        productId: POWERPACK_STRIPE_PRODUCT_ID,
      },
    });

    return res.status(200).json({ sessionId: session.id });
  }),
);
