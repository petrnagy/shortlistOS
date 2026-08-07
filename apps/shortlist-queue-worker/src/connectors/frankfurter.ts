import { z } from "zod";

const rateResponseSchema = z.object({
  base: z.string(),
  date: z.string(),
  quote: z.string(),
  rate: z.number().positive(),
});

export type FrankfurterRateResponse = z.infer<typeof rateResponseSchema>;

export class FrankfurterConnector {
  constructor(
    private readonly options: {
      baseUrl?: string;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async getRate(base: string, quote: string): Promise<FrankfurterRateResponse> {
    const normalizedBase = base.trim().toUpperCase();
    const normalizedQuote = quote.trim().toUpperCase();
    if (normalizedBase === normalizedQuote) {
      return {
        base: normalizedBase,
        date: new Date().toISOString().slice(0, 10),
        quote: normalizedQuote,
        rate: 1,
      };
    }

    const baseUrl = this.options.baseUrl ?? "https://api.frankfurter.dev";
    const url = new URL(
      `/v2/rate/${encodeURIComponent(normalizedBase)}/${encodeURIComponent(normalizedQuote)}`,
      baseUrl,
    );
    const response = await (this.options.fetchImpl ?? fetch)(url);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Frankfurter request failed with ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
      );
    }
    const body: unknown = await response.json();
    return rateResponseSchema.parse(body);
  }
}
