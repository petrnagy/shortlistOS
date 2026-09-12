import type Stripe from "stripe";

export interface PowerpackFulfillment {
  amountTotal: number;
  currency: string | null;
  productId: string;
  userId: string;
}

export const getPowerpackFulfillment = (
  checkoutSession: Stripe.Checkout.Session,
  expectedProductId: string,
): PowerpackFulfillment | null => {
  if (checkoutSession.mode !== "payment") return null;

  const amountTotal = checkoutSession.amount_total;
  const isPaid = checkoutSession.payment_status === "paid";
  const isNoCostOrder =
    checkoutSession.payment_status === "no_payment_required" &&
    amountTotal === 0;

  if (!isPaid && !isNoCostOrder) return null;
  if (amountTotal === null) return null;

  const productId = checkoutSession.metadata?.productId;
  if (productId !== expectedProductId) return null;

  const userId =
    checkoutSession.metadata?.userId ?? checkoutSession.client_reference_id;
  if (!userId) return null;

  return {
    amountTotal,
    currency: checkoutSession.currency,
    productId,
    userId,
  };
};
