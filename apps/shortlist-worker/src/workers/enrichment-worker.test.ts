import { describe, expect, it } from "vitest";

import {
  createRequestKey,
  ENRICHMENT_TYPES,
  getRetryDelayMs,
} from "./enrichment-worker";

describe("enrichment queue helpers", () => {
  it("creates stable endpoint-specific cache keys", () => {
    const request = { jobTitle: "Platform Engineer", location: "Prague" };
    expect(createRequestKey(ENRICHMENT_TYPES.SALARY, request)).toBe(
      createRequestKey(ENRICHMENT_TYPES.SALARY, request),
    );
    expect(createRequestKey(ENRICHMENT_TYPES.SALARY, request)).not.toBe(
      createRequestKey(ENRICHMENT_TYPES.COMPANY, request),
    );
  });

  it("uses bounded exponential retry delays", () => {
    expect(getRetryDelayMs(1)).toBe(2_000);
    expect(getRetryDelayMs(2)).toBe(4_000);
    expect(getRetryDelayMs(10)).toBe(60_000);
  });
});
