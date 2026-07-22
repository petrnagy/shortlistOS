export const SALARY_REGION_KEYS = ["EU", "UK", "US", "APAC", "GLOBAL"] as const;

export type SalaryRegionKey = (typeof SALARY_REGION_KEYS)[number];

export interface SalaryRegionConfig {
  countries: string[];
  key: SalaryRegionKey;
}

const DEFAULT_COUNTRIES: Record<SalaryRegionKey, string[]> = {
  EU: ["Germany", "France", "Italy", "Spain", "Netherlands"],
  UK: ["United Kingdom"],
  US: ["United States"],
  APAC: [
    "India",
    "China",
    "Indonesia",
    "Pakistan",
    "Bangladesh",
    "Japan",
    "Philippines",
    "Vietnam",
    "Thailand",
    "South Korea",
  ],
  GLOBAL: [
    "India",
    "China",
    "United States",
    "Indonesia",
    "Pakistan",
    "Nigeria",
    "Brazil",
    "Bangladesh",
    "Russia",
    "Mexico",
  ],
};

export function getSalaryRegionConfig(
  environment: Record<string, string | undefined> = process.env,
): SalaryRegionConfig[] {
  return SALARY_REGION_KEYS.map((key) => ({
    countries: parseCountries(
      environment[`REGION_SALARY_AVERAGE_COUNTRIES_${key}`],
      DEFAULT_COUNTRIES[key],
      key,
    ),
    key,
  }));
}

function parseCountries(
  value: string | undefined,
  fallback: string[],
  region: SalaryRegionKey,
): string[] {
  const countries = (value?.trim() ? value.split(",") : fallback)
    .map((country) => country.trim())
    .filter(Boolean)
    .filter(
      (country, index, values) =>
        values.findIndex(
          (candidate) => candidate.toLowerCase() === country.toLowerCase(),
        ) === index,
    );

  if (countries.length === 0) {
    throw new Error(
      `Salary region ${region} must contain at least one country`,
    );
  }
  if (countries.length > 10) {
    throw new Error(
      `Salary region ${region} cannot contain more than 10 countries`,
    );
  }
  return countries;
}
