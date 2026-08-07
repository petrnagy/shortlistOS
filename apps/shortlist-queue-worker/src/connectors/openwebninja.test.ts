import { describe, expect, it, vi } from "vitest";

import {
  OpenWebNinjaConnector,
  selectCompanyMatch,
  summarizeCompany,
  summarizeSalary,
} from "./openwebninja";

const company = (overrides: Record<string, unknown> = {}) => ({
  business_outlook_rating: 0.72,
  career_opportunities_rating: 4.1,
  ceo: "Jane Doe",
  ceo_rating: 0.8,
  company_description: "A software company",
  company_id: 123,
  company_link: "https://glassdoor.test/acme",
  company_size: "201 to 500 Employees",
  company_size_category: "MEDIUM",
  company_type: "Company - Private",
  compensation_and_benefits_rating: 4.2,
  culture_and_values_rating: 4.4,
  diversity_and_inclusion_rating: 4,
  headquarters_location: "Prague, Czechia",
  industry: "Software",
  job_count: 10,
  logo: null,
  name: "Acme GmbH",
  office_locations: [],
  rating: 4.3,
  recommend_to_friend_rating: 0.81,
  revenue: null,
  review_count: 125,
  reviews_link: "https://glassdoor.test/acme/reviews",
  salary_count: 80,
  senior_management_rating: 3.9,
  stock: null,
  website: "https://acme.test",
  work_life_balance_rating: 4.5,
  year_founded: 2010,
  ...overrides,
});

describe("OpenWebNinja connector", () => {
  it("sends authenticated salary parameters and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              confidence: "CONFIDENT",
              job_title: "Platform Engineer",
              location: "Prague, Czechia",
              max_salary: 120_000,
              median_salary: 100_000,
              min_salary: 80_000,
              publisher_link: "https://example.test/salary",
              publisher_name: "Employer data",
              salary_currency: "EUR",
              salary_period: "YEAR",
            },
          ],
          request_id: "request-1",
          status: "OK",
        }),
        { status: 200 },
      ),
    );
    const connector = new OpenWebNinjaConnector({
      apiKey: "secret",
      baseUrl: "https://openwebninja.test",
      fetchImpl: fetchMock,
    });

    const response = await connector.getJobSalary({
      jobTitle: "Platform Engineer",
      location: "Prague, Czechia",
    });

    expect(response.data[0]?.median_salary).toBe(100_000);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.searchParams.get("job_title")).toBe("Platform Engineer");
    expect(url.searchParams.get("location")).toBe("Prague, Czechia");
    expect(init.headers).toEqual({ "x-api-key": "secret" });
  });

  it("throws a useful error for a failed provider request", async () => {
    const connector = new OpenWebNinjaConnector({
      apiKey: "secret",
      fetchImpl: vi
        .fn()
        .mockResolvedValue(new Response("rate limited", { status: 429 })),
    });

    await expect(connector.searchCompanies({ query: "Acme" })).rejects.toThrow(
      "429: rate limited",
    );
  });
});

describe("deterministic OpenWebNinja mapping", () => {
  it("prefers an exact normalized company name", () => {
    const match = selectCompanyMatch(
      [company({ company_id: 1, name: "Acme Services" }), company()],
      { companyLocation: "Prague", companyName: "ACME, s.r.o." },
    );
    expect(match?.company_id).toBe(123);
  });

  it("does not guess when no company result is sufficiently confident", () => {
    expect(
      selectCompanyMatch([company({ name: "Acme Coffee Shop" })], {
        companyLocation: "Berlin",
        companyName: "Acme Software Holdings",
      }),
    ).toBeNull();
  });

  it("builds deterministic plain-English summaries", () => {
    expect(summarizeCompany(company())).toContain(
      "Available employer data indicates an employer rating of 4.3/5 from 125 reviews",
    );
    expect(
      summarizeSalary({
        confidence: "CONFIDENT",
        job_title: "Platform Engineer",
        location: "Prague",
        max_salary: 120_000,
        median_salary: 100_000,
        min_salary: 80_000,
        publisher_link: "https://example.test",
        publisher_name: "Employer data",
        salary_currency: "EUR",
        salary_period: "YEAR",
      }),
    ).toContain("€80,000 to €120,000 per year");
  });
});
