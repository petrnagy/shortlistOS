import { describe, expect, it, vi } from "vitest";

import { FrankfurterConnector } from "./frankfurter";

describe("Frankfurter connector", () => {
  it("fetches and validates a currency pair", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          base: "EUR",
          date: "2026-07-22",
          quote: "CZK",
          rate: 25,
        }),
        { status: 200 },
      ),
    );
    const connector = new FrankfurterConnector({ fetchImpl: fetchMock });

    await expect(connector.getRate("eur", "czk")).resolves.toMatchObject({
      base: "EUR",
      quote: "CZK",
      rate: 25,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/rate/EUR/CZK");
  });

  it("does not call the provider for identical currencies", async () => {
    const fetchMock = vi.fn();
    const connector = new FrankfurterConnector({ fetchImpl: fetchMock });

    await expect(connector.getRate("USD", "USD")).resolves.toMatchObject({
      rate: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
