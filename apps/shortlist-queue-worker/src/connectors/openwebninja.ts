import { z } from "zod";

const OPENWEBNINJA_BASE_URL = "https://api.openwebninja.com";

const nullableNumber = z.number().nullable().catch(null);
const nullableInteger = z.number().int().nullable().catch(null);
const nullableString = z.string().nullable().catch(null);

export const salaryResultSchema = z
  .object({
    confidence: z.string().catch("UNKNOWN"),
    job_title: z.string(),
    location: z.string(),
    max_salary: z.number(),
    median_salary: z.number(),
    min_salary: z.number(),
    publisher_link: z.string().catch(""),
    publisher_name: z.string().catch("Unknown"),
    salary_currency: z.string(),
    salary_period: z.string(),
  })
  .passthrough();

export const salaryResponseSchema = z
  .object({
    data: z.array(salaryResultSchema).catch([]),
    request_id: z.string().optional(),
    status: z.string(),
  })
  .passthrough();

const officeLocationSchema = z.object({
  city: nullableString,
  country: nullableString,
});

export const companyResultSchema = z
  .object({
    business_outlook_rating: nullableNumber,
    career_opportunities_rating: nullableNumber,
    ceo: nullableString,
    ceo_rating: nullableNumber,
    company_description: nullableString,
    company_id: z.number().int(),
    company_link: z.string(),
    company_size: nullableString,
    company_size_category: nullableString,
    company_type: nullableString,
    compensation_and_benefits_rating: nullableNumber,
    culture_and_values_rating: nullableNumber,
    diversity_and_inclusion_rating: nullableNumber,
    headquarters_location: nullableString,
    industry: nullableString,
    job_count: nullableInteger,
    logo: nullableString,
    name: z.string(),
    office_locations: z.array(officeLocationSchema).nullable().catch(null),
    rating: nullableNumber,
    recommend_to_friend_rating: nullableNumber,
    revenue: nullableString,
    review_count: nullableInteger,
    reviews_link: nullableString,
    salary_count: nullableInteger,
    senior_management_rating: nullableNumber,
    stock: nullableString,
    website: nullableString,
    work_life_balance_rating: nullableNumber,
    year_founded: nullableInteger,
  })
  .passthrough();

export const companyResponseSchema = z
  .object({
    data: z.array(companyResultSchema).catch([]),
    request_id: z.string().optional(),
    status: z.string(),
  })
  .passthrough();

export type OpenWebNinjaSalaryResult = z.infer<typeof salaryResultSchema>;
export type OpenWebNinjaCompanyResult = z.infer<typeof companyResultSchema>;

export interface OpenWebNinjaConnectorOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class OpenWebNinjaHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "OpenWebNinjaHttpError";
  }
}

export class OpenWebNinjaConnector {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenWebNinjaConnectorOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? OPENWEBNINJA_BASE_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getJobSalary(input: { jobTitle: string; location: string }) {
    const response = await this.request("/job-salary-data/job-salary", {
      job_title: input.jobTitle,
      location: input.location,
    });
    return salaryResponseSchema.parse(response);
  }

  async searchCompanies(input: { limit?: number; query: string }) {
    const response = await this.request(
      "/realtime-glassdoor-data/company-search",
      {
        limit: String(input.limit ?? 10),
        query: input.query,
      },
    );
    return companyResponseSchema.parse(response);
  }

  private async request(path: string, parameters: Record<string, string>) {
    const url = new URL(path, this.baseUrl);
    for (const [name, value] of Object.entries(parameters)) {
      url.searchParams.set(name, value);
    }

    const response = await this.fetchImpl(url, {
      headers: { "x-api-key": this.apiKey },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new OpenWebNinjaHttpError(
        `OpenWebNinja request failed with ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
        response.status,
      );
    }

    const body: unknown = await response.json();
    return body;
  }
}

export function selectCompanyMatch(
  companies: OpenWebNinjaCompanyResult[],
  input: { companyLocation?: string | null; companyName: string },
): OpenWebNinjaCompanyResult | null {
  const targetName = normalizeCompanyName(input.companyName);
  const exact = companies.find(
    (company) => normalizeCompanyName(company.name) === targetName,
  );
  if (exact) return exact;

  const targetTokens = new Set(targetName.split(" ").filter(Boolean));
  const targetLocation = normalizeText(input.companyLocation ?? "");
  const ranked = companies
    .map((company) => {
      const companyTokens = new Set(
        normalizeCompanyName(company.name).split(" ").filter(Boolean),
      );
      const intersection = [...targetTokens].filter((token) =>
        companyTokens.has(token),
      ).length;
      const union = new Set([...targetTokens, ...companyTokens]).size;
      const nameScore = union > 0 ? intersection / union : 0;
      const location = normalizeText(company.headquarters_location ?? "");
      const locationMatches =
        targetLocation.length > 0 &&
        location.length > 0 &&
        (targetLocation.includes(location) ||
          location.includes(targetLocation));
      return { company, score: nameScore + (locationMatches ? 0.15 : 0) };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  return best && best.score >= 0.85 ? best.company : null;
}

export function summarizeCompany(company: OpenWebNinjaCompanyResult): string {
  const facts: string[] = [];
  if (company.rating !== null) {
    facts.push(
      `an employer rating of ${company.rating.toFixed(1)}/5${company.review_count ? ` from ${company.review_count.toLocaleString("en-US")} reviews` : ""}`,
    );
  }
  if (company.work_life_balance_rating !== null) {
    facts.push(
      `work-life balance rated ${company.work_life_balance_rating.toFixed(1)}/5`,
    );
  }
  if (company.culture_and_values_rating !== null) {
    facts.push(
      `culture and values rated ${company.culture_and_values_rating.toFixed(1)}/5`,
    );
  }
  if (company.recommend_to_friend_rating !== null) {
    const percentage = Math.round(
      company.recommend_to_friend_rating <= 1
        ? company.recommend_to_friend_rating * 100
        : company.recommend_to_friend_rating,
    );
    facts.push(`${percentage}% would recommend the employer to a friend`);
  }

  return facts.length > 0
    ? `Available employer data indicates ${facts.join(", ")}.`
    : `No employer rating details are currently available for ${company.name}.`;
}

export function summarizeSalary(result: OpenWebNinjaSalaryResult): string {
  const formatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: result.salary_currency,
  });
  return `${result.job_title} in ${result.location} typically ranges from ${formatter.format(result.min_salary)} to ${formatter.format(result.max_salary)} per ${result.salary_period.toLowerCase()}, with a median of ${formatter.format(result.median_salary)}.`;
}

function normalizeCompanyName(value: string): string {
  return normalizeText(value)
    .replace(
      /\b(incorporated|inc|limited|ltd|llc|gmbh|sro|s r o|corp|corporation|company|co)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
