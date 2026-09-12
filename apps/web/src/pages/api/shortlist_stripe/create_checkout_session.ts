/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-20
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
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
} from "~/config/pricing";
import { env as serverEnv } from "~/env";

const stripe = new Stripe(serverEnv.STRIPE_SECRET_KEY ?? "");

interface CreatePowerpackCheckoutSessionBody {
  withPowerpack?: string;
}

export default withRateLimit(
  { points: 100, duration: 60 },
  withApiLogging(async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!serverEnv.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }

    const productId = serverEnv.STRIPE_POWERPACK_PRODUCT_ID;

    if (!productId) {
      return res
        .status(500)
        .json({ error: "Stripe Powerpack product is not configured" });
    }

    const body =
      req.body && typeof req.body === "object"
        ? (req.body as CreatePowerpackCheckoutSessionBody)
        : {};
    const withPowerpack = body.withPowerpack === "yes";
    const powerpackSettingsPath = withPowerpack
      ? "/settings/powerpack?withPowerpack=yes"
      : "/settings/powerpack";

    const { user } = await createNextApiContext(req);

    if (!user?.id) {
      return res.status(401).json({
        error: "Unauthorized",
        loginUrl: `/login?next=${encodeURIComponent(powerpackSettingsPath)}`,
      });
    }

    const baseUrl = env("NEXT_PUBLIC_BASE_URL");

    if (!baseUrl) {
      return res.status(500).json({ error: "Missing NEXT_PUBLIC_BASE_URL" });
    }

    const powerpackIntentQuery = withPowerpack ? "&withPowerpack=yes" : "";
    const powerpackIntentCancelQuery = withPowerpack
      ? "?withPowerpack=yes"
      : "";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: POWERPACK_PRICE_CURRENCY,
            unit_amount: POWERPACK_PRICE_AMOUNT_CENTS,
            product: productId,
          },
        },
      ],
      success_url: `${baseUrl}${POWERPACK_CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}${powerpackIntentQuery}`,
      cancel_url: `${baseUrl}${POWERPACK_CHECKOUT_CANCEL_PATH}${powerpackIntentCancelQuery}`,
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        userId: user.id,
        userEmail: user.email,
        membershipDurationDays: String(POWERPACK_MEMBERSHIP_DURATION_DAYS),
        productId,
      },
    });

    return res.status(200).json({ sessionId: session.id });
  }),
);
