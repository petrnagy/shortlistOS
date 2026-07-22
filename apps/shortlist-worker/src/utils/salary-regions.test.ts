import { describe, expect, it } from "vitest";

import { getSalaryRegionConfig } from "./salary-regions";

describe("salary region configuration", () => {
  it("provides representative defaults capped at ten countries", () => {
    const regions = getSalaryRegionConfig({});

    expect(regions.map((region) => region.key)).toEqual([
      "EU",
      "UK",
      "US",
      "APAC",
      "GLOBAL",
    ]);
    expect(regions.every((region) => region.countries.length <= 10)).toBe(true);
    expect(regions.find((region) => region.key === "EU")?.countries).toEqual([
      "Germany",
      "France",
      "Italy",
      "Spain",
      "Netherlands",
    ]);
  });

  it("parses, trims, and deduplicates environment overrides", () => {
    const regions = getSalaryRegionConfig({
      REGION_SALARY_AVERAGE_COUNTRIES_EU: "Germany, France, germany",
    });

    expect(regions.find((region) => region.key === "EU")?.countries).toEqual([
      "Germany",
      "France",
    ]);
  });

  it("rejects region lists over the ten-country maximum", () => {
    expect(() =>
      getSalaryRegionConfig({
        REGION_SALARY_AVERAGE_COUNTRIES_APAC: Array.from(
          { length: 11 },
          (_, index) => `Country ${index}`,
        ).join(","),
      }),
    ).toThrow("cannot contain more than 10 countries");
  });
});
