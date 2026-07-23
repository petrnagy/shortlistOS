import { describe, expect, it } from "vitest";

import { formatCompactCurrencyRange } from "./currency";

describe("formatCompactCurrencyRange", () => {
  it("places Czech crowns after the range", () => {
    expect(
      formatCompactCurrencyRange({
        currency: "CZK",
        max: 175000,
        min: 160000,
      }),
    ).toEqual({
      amount: "160k–175k",
      symbol: "Kč",
      symbolPosition: "suffix",
      usesSymbolSpacing: true,
    });
  });

  it("places dollars before the range", () => {
    expect(
      formatCompactCurrencyRange({
        currency: "USD",
        max: 175000,
        min: 160000,
      }),
    ).toEqual({
      amount: "160k–175k",
      symbol: "$",
      symbolPosition: "prefix",
      usesSymbolSpacing: false,
    });
  });

  it("formats a single amount", () => {
    expect(
      formatCompactCurrencyRange({
        currency: "EUR",
        max: null,
        min: 900,
      }),
    ).toMatchObject({
      amount: "900",
      symbol: "€",
      symbolPosition: "prefix",
    });
  });
});
