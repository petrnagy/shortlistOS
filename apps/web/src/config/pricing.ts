export const POWERPACK_PRICE_AMOUNT = 29;
export const POWERPACK_PRICE_CURRENCY = "USD";
export const POWERPACK_MEMBERSHIP_DURATION_DAYS = 90;
// prod
//export const POWERPACK_STRIPE_PRODUCT_ID = "prod_UhmDqdKIYf1V9R";
// test
export const POWERPACK_STRIPE_PRODUCT_ID = "prod_Uhn3nH22Qn3PYE";
export const POWERPACK_CHECKOUT_SUCCESS_PATH = "/settings/powerpack/success";
export const POWERPACK_CHECKOUT_CANCEL_PATH = "/settings/powerpack";

export const POWERPACK_PRICE_AMOUNT_CENTS = Math.round(
  POWERPACK_PRICE_AMOUNT * 100,
);

/** Pre-formatted display string, e.g. "$39" */
export const POWERPACK_PRICE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: POWERPACK_PRICE_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(POWERPACK_PRICE_AMOUNT);
