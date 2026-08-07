import { describe, expect, it } from "vitest";

import { OpenWebNinjaHttpError } from "../connectors/openwebninja";
import {
  createRequestKey,
  ENRICHMENT_TYPES,
  getRetryDelayMs,
  isRetriableEnrichmentError,
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

  it("does not retry permanent OpenWebNinja client errors", () => {
    expect(
      isRetriableEnrichmentError(new OpenWebNinjaHttpError("Forbidden", 403)),
    ).toBe(false);
    expect(
      isRetriableEnrichmentError(
        new OpenWebNinjaHttpError("Rate limited", 429),
      ),
    ).toBe(true);
    expect(
      isRetriableEnrichmentError(new OpenWebNinjaHttpError("Unavailable", 503)),
    ).toBe(true);
  });
});
