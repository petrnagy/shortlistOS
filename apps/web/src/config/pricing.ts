export const POWERPACK_PRICE_AMOUNT = 39;
export const POWERPACK_PRICE_CURRENCY = "USD";

/** Pre-formatted display string, e.g. "$39" */
export const POWERPACK_PRICE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: POWERPACK_PRICE_CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(POWERPACK_PRICE_AMOUNT);
