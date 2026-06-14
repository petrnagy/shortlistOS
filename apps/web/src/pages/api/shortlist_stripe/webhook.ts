import { randomUUID } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import type { Readable } from "node:stream";
import Stripe from "stripe";

import { createNextApiContext } from "@kan/api/trpc";
import * as userRepo from "@kan/db/repository/user.repo";
import { createLogger } from "@kan/logger";

import { POWERPACK_MEMBERSHIP_DURATION_DAYS } from "~/config/pricing";

const log = createLogger("api");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

async function buffer(readable: Readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const start = Date.now();
  const requestId = randomUUID();
  const procedure = req.url?.split("?")[0] ?? "/api/shortlist_stripe/webhook";

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ message: "Stripe is not configured" });
  }

  const webhookSecret = process.env.STRIPE_SHORTLIST_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res
      .status(500)
      .json({ message: "Webhook secret is not configured" });
  }

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ message: "No signature found" });
  }

  try {
    const buf = await buffer(req);
    const rawBody = buf.toString("utf8");

    const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

    const { db } = await createNextApiContext(req);

    switch (event.type) {
      case "checkout.session.completed": {
        const checkoutSession = event.data.object;
        const metadataUserId = checkoutSession.metadata?.userId;
        const userId = metadataUserId ?? checkoutSession.client_reference_id;

        if (!userId) {
          break;
        }

        if (checkoutSession.payment_status !== "paid") {
          break;
        }

        await userRepo.grantShortlistPowerpack(
          db,
          userId,
          POWERPACK_MEMBERSHIP_DURATION_DAYS,
        );

        break;
      }
      default:
        log.warn({ eventType: event.type }, "Unhandled Stripe event type");
    }

    log.info(
      {
        requestId,
        procedure,
        transport: "rest",
        duration: Date.now() - start,
        status: 200,
        input: { eventType: event.type, eventId: event.id },
      },
      "API OK",
    );

    return res.status(200).json({ received: true });
  } catch (err) {
    log.error(
      {
        requestId,
        procedure,
        transport: "rest",
        duration: Date.now() - start,
        status: 400,
        err,
      },
      "API error",
    );

    return res.status(400).json({ message: "Webhook handler failed" });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
