import { createHash } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import type { dbClient } from "@kan/db/client";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import * as cardCommentRepo from "@kan/db/repository/cardComment.repo";
import { boards, cards, lists, shortlistEnrichmentJobs } from "@kan/db/schema";
import { createLogger } from "@kan/logger";
import { SHORTLIST_ROBOT_USER } from "@kan/shared/constants";

import type {
  OpenWebNinjaCompanyResult,
  OpenWebNinjaSalaryResult,
} from "../connectors/openwebninja";
import type {
  SalaryRegionConfig,
  SalaryRegionKey,
} from "../utils/salary-regions";
import { FrankfurterConnector } from "../connectors/frankfurter";
import {
  OpenWebNinjaConnector,
  OpenWebNinjaHttpError,
  salaryResponseSchema,
  selectCompanyMatch,
  summarizeCompany,
} from "../connectors/openwebninja";
import {
  beginProviderRequest,
  completeProviderRequest,
  countDailyAccountProviderRequests,
  createProviderRequestKey,
  failProviderRequest,
  findFreshRequestByKey,
  findReusableSalaryRequest,
  getUtcDayStart,
  normalizeJobTitle,
  normalizeLocation,
  PROVIDERS,
  recordDailyProviderLimitNotice,
  recordDuplicateProviderRequest,
} from "../utils/provider-requests";
import { getSalaryRegionConfig } from "../utils/salary-regions";

const logger = createLogger("shortlist-worker:enrichment-worker");
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const DEFAULT_BATCH_LIMIT = 25;

export const ENRICHMENT_TYPES = {
  COMPANY: "COMPANY",
  SALARY: "SALARY",
} as const;

export const ENRICHMENT_STATUSES = {
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  RETRY: "RETRY",
} as const;

type EnrichmentType = (typeof ENRICHMENT_TYPES)[keyof typeof ENRICHMENT_TYPES];
type EnrichmentStatus =
  (typeof ENRICHMENT_STATUSES)[keyof typeof ENRICHMENT_STATUSES];

const salaryRequestSchema = z.object({
  jobTitle: z.string().min(1),
  location: z.string().min(1),
});
const companyRequestSchema = z.object({
  companyLocation: z.string().nullable(),
  companyName: z.string().min(1),
});

interface EnrichmentJobRow {
  attempts: number;
  cardCreatedBy: string | null;
  cardId: number;
  cardPublicId: string;
  companyEnabled: boolean;
  enrichmentType: string;
  id: string;
  manualUpdatedOnly: boolean;
  maxAttempts: number;
  requestJson: unknown;
  requestedBy: string | null;
  salaryEnabled: boolean;
  salaryCurrency: string | null;
  salaryInterval: string;
}

interface EnrichmentProcessingOptions {
  accountDailyRequestLimit?: number;
  apiKey: string;
  baseUrl?: string;
  cacheReuseDays?: number;
  fetchImpl?: typeof fetch;
  frankfurterBaseUrl?: string;
  fxFetchImpl?: typeof fetch;
  limit?: number;
  regionConfig?: SalaryRegionConfig[];
  retryLimit?: number;
}

export async function prepareEnrichmentQueue(
  db: dbClient,
  options: { limit?: number; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const rows = await db
    .select({
      cardId: cards.id,
      cardCreatedBy: cards.createdBy,
      companyEnabled: boards.shortlistIsCompanySentimentEnabled,
      companyLocation: cards.shortlistCompanyLocation,
      companyName: cards.shortlistCompanyName,
      jobLocation: cards.shortlistJobLocation,
      jobTitle: cards.title,
      manualUpdatedOnly: cards.manualUpdatedOnly,
      requestedBy: cards.shortlistDataFetchRequestedBy,
      salaryEnabled: boards.shortlistIsSalaryDataEnabled,
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        eq(cards.shortlistDataFetchNeeded, true),
        isNull(cards.deletedAt),
        isNull(boards.deletedAt),
      ),
    )
    .orderBy(asc(cards.updatedAt), asc(cards.id))
    .limit(options.limit ?? 100);

  let queued = 0;
  let cached = 0;
  let skipped = 0;

  for (const row of rows) {
    await db
      .update(cards)
      .set({
        shortlistDataFetchNeeded: false,
        shortlistDataFetchRequestedBy: null,
      })
      .where(eq(cards.id, row.cardId));

    if (row.manualUpdatedOnly) {
      skipped += 1;
      continue;
    }

    const requests: {
      request: Record<string, unknown>;
      type: EnrichmentType;
    }[] = [];
    if (row.salaryEnabled && row.jobTitle.trim() && row.jobLocation?.trim()) {
      requests.push({
        request: {
          jobTitle: row.jobTitle.trim(),
          location: row.jobLocation.trim(),
        },
        type: ENRICHMENT_TYPES.SALARY,
      });
    }
    if (row.companyEnabled && row.companyName?.trim()) {
      requests.push({
        request: {
          companyLocation: nonEmptyOrNull(row.companyLocation),
          companyName: row.companyName.trim(),
        },
        type: ENRICHMENT_TYPES.COMPANY,
      });
    }

    if (requests.length === 0) {
      skipped += 1;
      continue;
    }

    for (const item of requests) {
      const requestJson = normalizeRequest(item.request);
      const requestKey = createRequestKey(item.type, requestJson);
      const existing = await db.query.shortlistEnrichmentJobs.findFirst({
        columns: {
          fetchedAt: true,
          requestKey: true,
          status: true,
        },
        where: (jobs, { and: andWhere, eq: eqWhere }) =>
          andWhere(
            eqWhere(jobs.cardId, row.cardId),
            eqWhere(jobs.enrichmentType, item.type),
          ),
      });
      const fresh =
        existing?.status === ENRICHMENT_STATUSES.COMPLETED &&
        existing.requestKey === requestKey &&
        existing.fetchedAt !== null &&
        existing.fetchedAt.getTime() > now.getTime() - CACHE_TTL_MS;
      if (fresh) {
        cached += 1;
        continue;
      }
      if (
        existing &&
        existing.requestKey === requestKey &&
        inArrayValue(existing.status, [
          ENRICHMENT_STATUSES.PENDING,
          ENRICHMENT_STATUSES.PROCESSING,
          ENRICHMENT_STATUSES.RETRY,
        ])
      ) {
        cached += 1;
        continue;
      }

      await db
        .insert(shortlistEnrichmentJobs)
        .values({
          attempts: 0,
          cardId: row.cardId,
          enrichmentType: item.type,
          error: null,
          fetchedAt: null,
          lockedAt: null,
          lockedBy: null,
          requestJson,
          requestKey,
          requestedBy: row.requestedBy ?? row.cardCreatedBy,
          responseJson: null,
          runAfter: now,
          status: ENRICHMENT_STATUSES.PENDING,
          summary: null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            shortlistEnrichmentJobs.cardId,
            shortlistEnrichmentJobs.enrichmentType,
          ],
          set: {
            attempts: 0,
            error: null,
            fetchedAt: null,
            lockedAt: null,
            lockedBy: null,
            requestJson,
            requestKey,
            requestedBy: row.requestedBy ?? row.cardCreatedBy,
            responseJson: null,
            runAfter: now,
            status: ENRICHMENT_STATUSES.PENDING,
            summary: null,
            updatedAt: now,
          },
        });
      queued += 1;
    }
  }

  return { cached, queued, selected: rows.length, skipped };
}

export async function processEnrichmentQueueBatch(
  db: dbClient,
  options: EnrichmentProcessingOptions,
) {
  const jobs = await claimJobs(db, options.limit ?? DEFAULT_BATCH_LIMIT);
  const connector = new OpenWebNinjaConnector({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl,
  });
  const fxConnector = new FrankfurterConnector({
    baseUrl: options.frankfurterBaseUrl,
    fetchImpl: options.fxFetchImpl,
  });
  const result = { completed: 0, failed: 0, retried: 0, selected: jobs.length };

  for (const job of jobs) {
    const status = await processJob(db, job, connector, fxConnector, {
      cacheReuseDays: options.cacheReuseDays ?? 30,
      accountDailyRequestLimit: options.accountDailyRequestLimit ?? 250,
      regionConfig: options.regionConfig ?? getSalaryRegionConfig(),
      retryLimit: options.retryLimit ?? 3,
    });
    if (status === ENRICHMENT_STATUSES.COMPLETED) result.completed += 1;
    if (status === ENRICHMENT_STATUSES.RETRY) result.retried += 1;
    if (status === ENRICHMENT_STATUSES.FAILED) result.failed += 1;
  }

  return result;
}

async function claimJobs(
  db: dbClient,
  limit: number,
): Promise<EnrichmentJobRow[]> {
  return db.transaction(async (tx) => {
    const staleLockBefore = new Date(Date.now() - 15 * 60 * 1_000);
    const jobs = await tx
      .select({
        attempts: shortlistEnrichmentJobs.attempts,
        cardCreatedBy: cards.createdBy,
        cardId: shortlistEnrichmentJobs.cardId,
        cardPublicId: cards.publicId,
        companyEnabled: boards.shortlistIsCompanySentimentEnabled,
        enrichmentType: shortlistEnrichmentJobs.enrichmentType,
        id: shortlistEnrichmentJobs.id,
        manualUpdatedOnly: cards.manualUpdatedOnly,
        maxAttempts: shortlistEnrichmentJobs.maxAttempts,
        requestJson: shortlistEnrichmentJobs.requestJson,
        requestedBy: shortlistEnrichmentJobs.requestedBy,
        salaryEnabled: boards.shortlistIsSalaryDataEnabled,
        salaryCurrency: cards.shortlistSalaryCurrency,
        salaryInterval: cards.shortlistSalaryInterval,
      })
      .from(shortlistEnrichmentJobs)
      .innerJoin(cards, eq(shortlistEnrichmentJobs.cardId, cards.id))
      .innerJoin(lists, eq(cards.listId, lists.id))
      .innerJoin(boards, eq(lists.boardId, boards.id))
      .where(
        and(
          or(
            inArray(shortlistEnrichmentJobs.status, [
              ENRICHMENT_STATUSES.PENDING,
              ENRICHMENT_STATUSES.RETRY,
            ]),
            and(
              eq(
                shortlistEnrichmentJobs.status,
                ENRICHMENT_STATUSES.PROCESSING,
              ),
              lt(shortlistEnrichmentJobs.lockedAt, staleLockBefore),
            ),
          ),
          lte(shortlistEnrichmentJobs.runAfter, new Date()),
          isNull(cards.deletedAt),
        ),
      )
      .orderBy(
        asc(shortlistEnrichmentJobs.runAfter),
        asc(shortlistEnrichmentJobs.createdAt),
      )
      .limit(limit)
      .for("update", { skipLocked: true });

    if (jobs.length > 0) {
      await tx
        .update(shortlistEnrichmentJobs)
        .set({
          attempts: sql`${shortlistEnrichmentJobs.attempts} + 1`,
          lockedAt: new Date(),
          lockedBy: `shortlist-enrichment-worker:${process.pid}`,
          status: ENRICHMENT_STATUSES.PROCESSING,
          updatedAt: new Date(),
        })
        .where(
          inArray(
            shortlistEnrichmentJobs.id,
            jobs.map((job) => job.id),
          ),
        );
    }

    return jobs;
  });
}

async function processJob(
  db: dbClient,
  job: EnrichmentJobRow,
  connector: OpenWebNinjaConnector,
  fxConnector: FrankfurterConnector,
  options: {
    accountDailyRequestLimit: number;
    cacheReuseDays: number;
    regionConfig: SalaryRegionConfig[];
    retryLimit: number;
  },
): Promise<EnrichmentStatus> {
  const attempt = job.attempts + 1;
  try {
    if (job.manualUpdatedOnly || !isTypeEnabled(job)) {
      await completeJob(db, job.id, {
        responseJson: null,
        summary: "Enrichment was disabled before this job ran.",
      });
      return ENRICHMENT_STATUSES.COMPLETED;
    }

    if (job.enrichmentType === ENRICHMENT_TYPES.SALARY) {
      const request = salaryRequestSchema.parse(job.requestJson);
      const result = await processSalaryJob(
        db,
        job,
        request,
        connector,
        fxConnector,
        options,
      );
      await completeJob(db, job.id, result);
    } else if (job.enrichmentType === ENRICHMENT_TYPES.COMPANY) {
      const request = companyRequestSchema.parse(job.requestJson);
      const result = await processCompanyJob(db, job, request, connector, {
        accountDailyRequestLimit: options.accountDailyRequestLimit,
      });
      await completeJob(db, job.id, result);
    } else {
      throw new Error(`Unsupported enrichment type ${job.enrichmentType}`);
    }

    return ENRICHMENT_STATUSES.COMPLETED;
  } catch (error) {
    const message = formatError(error);
    const shouldRetry =
      isRetriableEnrichmentError(error) &&
      attempt < Math.min(job.maxAttempts, options.retryLimit);
    const status = shouldRetry
      ? ENRICHMENT_STATUSES.RETRY
      : ENRICHMENT_STATUSES.FAILED;
    await db
      .update(shortlistEnrichmentJobs)
      .set({
        error: message,
        lockedAt: null,
        lockedBy: null,
        runAfter: shouldRetry
          ? new Date(Date.now() + getRetryDelayMs(attempt))
          : new Date(),
        status,
        updatedAt: new Date(),
      })
      .where(eq(shortlistEnrichmentJobs.id, job.id));
    logger.error(
      { error: message, jobId: job.id, status },
      "Enrichment job failed",
    );
    return status;
  }
}

type SalaryRequest = z.infer<typeof salaryRequestSchema>;
type CompanyRequest = z.infer<typeof companyRequestSchema>;
type SalaryScope = "LOCAL" | SalaryRegionKey;

interface SalarySample {
  country: string;
  result: OpenWebNinjaSalaryResult;
  scope: SalaryScope;
}

async function processSalaryJob(
  db: dbClient,
  job: EnrichmentJobRow,
  request: SalaryRequest,
  connector: OpenWebNinjaConnector,
  fxConnector: FrankfurterConnector,
  options: {
    accountDailyRequestLimit: number;
    cacheReuseDays: number;
    regionConfig: SalaryRegionConfig[];
  },
): Promise<{ responseJson: unknown; summary: string }> {
  const accountId = getJobAccountId(job);
  const dayStart = getUtcDayStart();
  const samples: SalarySample[] = [];
  let limitReached = false;
  const targets: { country: string; scope: SalaryScope }[] = [
    { country: request.location, scope: "LOCAL" },
    ...options.regionConfig.flatMap((region) =>
      region.countries.map((country) => ({ country, scope: region.key })),
    ),
  ];

  for (const target of targets) {
    const outcome = await getSalarySample(db, job, connector, {
      cacheReuseDays: options.cacheReuseDays,
      accountDailyRequestLimit: options.accountDailyRequestLimit,
      accountId,
      country: target.country,
      jobTitle: request.jobTitle,
      scope: target.scope,
    });
    if (outcome.limitReached) {
      limitReached = true;
      break;
    }
    if (outcome.result) {
      samples.push({
        country: target.country,
        result: outcome.result,
        scope: target.scope,
      });
    }
  }

  if (limitReached) {
    await addExternalLimitNotice(db, job.cardId, accountId, dayStart);
  }

  if (samples.length === 0) {
    return {
      responseJson: { limitReached, sampleCount: 0 },
      summary: limitReached
        ? "The account's daily external data request limit has been reached."
        : `No salary benchmarks are currently available for ${request.jobTitle}.`,
    };
  }

  const localSample = samples.find((sample) => sample.scope === "LOCAL");
  const targetCurrency = (
    job.salaryCurrency ??
    localSample?.result.salary_currency ??
    samples[0]?.result.salary_currency
  )?.toUpperCase();
  if (!targetCurrency) throw new Error("Salary comparison currency is missing");

  const converted: SalarySample[] = [];
  for (const sample of samples) {
    converted.push({
      ...sample,
      result: await convertSalaryResult(
        db,
        fxConnector,
        sample.result,
        targetCurrency,
        job.salaryInterval,
      ),
    });
  }
  const ranges = buildSalaryRanges(
    converted,
    targetCurrency,
    job.salaryInterval,
  );
  const summary = `Updated salary comparison using ${samples.length} market benchmark${samples.length === 1 ? "" : "s"} across ${new Set(samples.map((sample) => sample.country)).size} location${new Set(samples.map((sample) => sample.country)).size === 1 ? "" : "s"}.`;

  await cardRepo.update(
    db,
    {
      shortlistSalaryData: {
        currency: targetCurrency,
        fetchedAt: new Date().toISOString(),
        period: job.salaryInterval,
        ranges,
        summary,
      },
    },
    { cardPublicId: job.cardPublicId },
  );
  await addRobotAudit(db, job.cardId, "Salary insights", summary);

  return {
    responseJson: { limitReached, ranges, sampleCount: samples.length },
    summary,
  };
}

async function getSalarySample(
  db: dbClient,
  job: EnrichmentJobRow,
  connector: OpenWebNinjaConnector,
  input: {
    accountDailyRequestLimit: number;
    accountId: string;
    cacheReuseDays: number;
    country: string;
    jobTitle: string;
    scope: SalaryScope;
  },
): Promise<{ limitReached: boolean; result: OpenWebNinjaSalaryResult | null }> {
  const jobTitleNormalized = normalizeJobTitle(input.jobTitle);
  const location = normalizeLocation(input.country);
  const requestJson = { jobTitle: input.jobTitle, location: input.country };
  const reusable = await findReusableSalaryRequest(db, {
    jobTitleNormalized,
    location,
    since: new Date(Date.now() - input.cacheReuseDays * 24 * 60 * 60 * 1_000),
  });
  if (reusable) {
    const response = salaryResponseSchema.safeParse(reusable.responseJson);
    const result = response.success ? (response.data.data[0] ?? null) : null;
    if (result) {
      await recordDuplicateProviderRequest(db, {
        accountId: input.accountId,
        cardId: job.cardId,
        duplicateOfId: reusable.id,
        endpoint: "JOB_SALARY",
        enrichmentJobId: job.id,
        jobTitleNormalized,
        location,
        provider: PROVIDERS.OPENWEBNINJA,
        regionKey: input.scope,
        requestJson,
        responseJson: reusable.responseJson,
      });
      return { limitReached: false, result };
    }
  }

  const requestCount = await countDailyAccountProviderRequests(
    db,
    input.accountId,
    PROVIDERS.OPENWEBNINJA,
    getUtcDayStart(),
  );
  if (requestCount >= input.accountDailyRequestLimit) {
    return { limitReached: true, result: null };
  }

  const historyId = await beginProviderRequest(db, {
    accountId: input.accountId,
    cardId: job.cardId,
    endpoint: "JOB_SALARY",
    enrichmentJobId: job.id,
    jobTitleNormalized,
    location,
    provider: PROVIDERS.OPENWEBNINJA,
    regionKey: input.scope,
    requestJson,
  });
  try {
    const response = await connector.getJobSalary({
      jobTitle: input.jobTitle,
      location: input.country,
    });
    await completeProviderRequest(db, historyId, response);
    return { limitReached: false, result: response.data[0] ?? null };
  } catch (error) {
    await failProviderRequest(db, historyId, formatError(error));
    throw error;
  }
}

async function processCompanyJob(
  db: dbClient,
  job: EnrichmentJobRow,
  request: CompanyRequest,
  connector: OpenWebNinjaConnector,
  options: { accountDailyRequestLimit: number },
): Promise<{ responseJson: unknown; summary: string }> {
  const accountId = getJobAccountId(job);
  const dayStart = getUtcDayStart();
  const requestCount = await countDailyAccountProviderRequests(
    db,
    accountId,
    PROVIDERS.OPENWEBNINJA,
    dayStart,
  );
  if (requestCount >= options.accountDailyRequestLimit) {
    await addExternalLimitNotice(db, job.cardId, accountId, dayStart);
    return {
      responseJson: null,
      summary:
        "The account's daily external data request limit has been reached.",
    };
  }

  const requestJson = { query: request.companyName };
  const historyId = await beginProviderRequest(db, {
    accountId,
    cardId: job.cardId,
    endpoint: "COMPANY_SEARCH",
    enrichmentJobId: job.id,
    location: normalizeLocation(request.companyLocation ?? ""),
    provider: PROVIDERS.OPENWEBNINJA,
    requestJson,
  });
  let response: Awaited<ReturnType<OpenWebNinjaConnector["searchCompanies"]>>;
  try {
    response = await connector.searchCompanies({ query: request.companyName });
    await completeProviderRequest(db, historyId, response);
  } catch (error) {
    await failProviderRequest(db, historyId, formatError(error));
    throw error;
  }

  const company = selectCompanyMatch(response.data, request);
  const summary = company
    ? summarizeCompany(company)
    : `No sufficiently confident employer match is currently available for ${request.companyName}.`;
  if (company) {
    await cardRepo.update(
      db,
      {
        shortlistCompanyRatingAggregated:
          company.rating === null ? null : String(company.rating),
        shortlistCompanySentimentBlob: buildCompanyCardData(company),
        shortlistCompanySentimentSummary: summary,
      },
      { cardPublicId: job.cardPublicId },
    );
    await addRobotAudit(db, job.cardId, "Company insights", summary);
  }
  return { responseJson: response, summary };
}

async function convertSalaryResult(
  db: dbClient,
  connector: FrankfurterConnector,
  result: OpenWebNinjaSalaryResult,
  targetCurrency: string,
  targetPeriod: string,
): Promise<OpenWebNinjaSalaryResult> {
  const rate = await getFxRate(
    db,
    connector,
    result.salary_currency,
    targetCurrency,
  );
  const periodFactor = getSalaryPeriodFactor(
    result.salary_period,
    targetPeriod,
  );
  return {
    ...result,
    max_salary: Math.round(result.max_salary * rate * periodFactor),
    median_salary: Math.round(result.median_salary * rate * periodFactor),
    min_salary: Math.round(result.min_salary * rate * periodFactor),
    salary_currency: targetCurrency,
    salary_period: targetPeriod,
  };
}

async function getFxRate(
  db: dbClient,
  connector: FrankfurterConnector,
  base: string,
  quote: string,
): Promise<number> {
  const normalizedBase = base.toUpperCase();
  const normalizedQuote = quote.toUpperCase();
  if (normalizedBase === normalizedQuote) return 1;

  const requestJson = { base: normalizedBase, quote: normalizedQuote };
  const requestKey = createProviderRequestKey(
    PROVIDERS.FRANKFURTER,
    "EXCHANGE_RATE",
    requestJson,
  );
  const cached = await findFreshRequestByKey(db, {
    requestKey,
    since: new Date(Date.now() - 24 * 60 * 60 * 1_000),
  });
  if (cached?.responseJson && isRecord(cached.responseJson)) {
    const rate = cached.responseJson.rate;
    if (typeof rate === "number" && rate > 0) return rate;
  }

  const historyId = await beginProviderRequest(db, {
    endpoint: "EXCHANGE_RATE",
    provider: PROVIDERS.FRANKFURTER,
    requestJson,
  });
  try {
    const response = await connector.getRate(normalizedBase, normalizedQuote);
    await completeProviderRequest(db, historyId, response);
    return response.rate;
  } catch (error) {
    await failProviderRequest(db, historyId, formatError(error));
    throw error;
  }
}

function buildSalaryRanges(
  samples: SalarySample[],
  currency: string,
  period: string,
) {
  const scopes: SalaryScope[] = ["LOCAL", "EU", "UK", "US", "APAC", "GLOBAL"];
  return scopes.flatMap((scope) => {
    const matching = samples.filter((sample) => sample.scope === scope);
    if (matching.length === 0) return [];
    return [
      {
        countries: matching.map((sample) => sample.country),
        currency,
        max: average(matching.map((sample) => sample.result.max_salary)),
        median: average(matching.map((sample) => sample.result.median_salary)),
        min: average(matching.map((sample) => sample.result.min_salary)),
        period,
        sampleCount: matching.length,
        scope,
      },
    ];
  });
}

function getSalaryPeriodFactor(source: string, target: string): number {
  const annualMultipliers: Record<string, number> = {
    DAY: 260,
    DAILY: 260,
    HOUR: 2_080,
    HOURLY: 2_080,
    MONTH: 12,
    MONTHLY: 12,
    PER_DAY: 260,
    PER_HOUR: 2_080,
    PER_MONTH: 12,
    PER_WEEK: 52,
    PER_YEAR: 1,
    WEEK: 52,
    WEEKLY: 52,
    YEAR: 1,
    YEARLY: 1,
  };
  const sourceMultiplier = annualMultipliers[source.toUpperCase()];
  const targetMultiplier = annualMultipliers[target.toUpperCase()];
  if (!sourceMultiplier || !targetMultiplier) {
    throw new Error(
      `Unsupported salary period conversion: ${source} to ${target}`,
    );
  }
  return sourceMultiplier / targetMultiplier;
}

function average(values: number[]): number {
  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isRetriableEnrichmentError(error: unknown): boolean {
  if (!(error instanceof OpenWebNinjaHttpError)) return true;
  return error.status === 408 || error.status === 429 || error.status >= 500;
}

async function completeJob(
  db: Pick<dbClient, "update">,
  jobId: string,
  input: { responseJson: unknown; summary: string },
) {
  await db
    .update(shortlistEnrichmentJobs)
    .set({
      error: null,
      fetchedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      responseJson: input.responseJson,
      status: ENRICHMENT_STATUSES.COMPLETED,
      summary: input.summary,
      updatedAt: new Date(),
    })
    .where(eq(shortlistEnrichmentJobs.id, jobId));
}

async function addRobotAudit(
  db: dbClient,
  cardId: number,
  fieldName: string,
  summary: string,
) {
  await cardActivityRepo.create(db, {
    cardId,
    createdBy: SHORTLIST_ROBOT_USER.id,
    fromTitle: fieldName,
    toDescription: summary,
    type: "card.updated.shortlistField",
  });
  const comment = await cardCommentRepo.create(db, {
    cardId,
    comment: `<p>${escapeHtml(`ShortlistOS updated ${fieldName.toLowerCase()}: ${summary}`)}</p>`,
    createdBy: SHORTLIST_ROBOT_USER.id,
    shortlistIsSystem: true,
  });
  if (comment?.id) {
    await cardActivityRepo.create(db, {
      cardId,
      commentId: comment.id,
      createdBy: SHORTLIST_ROBOT_USER.id,
      toComment: comment.comment,
      type: "card.updated.comment.added",
    });
  }
}

const EXTERNAL_LIMIT_COMMENT =
  '<p>Your account has reached its daily external data request limit. External requests will be available again tomorrow. If you need a higher limit, contact us at <a href="mailto:support@shortlistos.co">support@shortlistos.co</a>.</p>';

async function addExternalLimitNotice(
  db: dbClient,
  cardId: number,
  accountId: string,
  dayStart: Date,
) {
  const shouldCreate = await recordDailyProviderLimitNotice(db, {
    accountId,
    cardId,
    provider: PROVIDERS.OPENWEBNINJA,
    since: dayStart,
  });
  if (!shouldCreate) return;

  const comment = await cardCommentRepo.create(db, {
    cardId,
    comment: EXTERNAL_LIMIT_COMMENT,
    createdBy: SHORTLIST_ROBOT_USER.id,
    shortlistIsSystem: true,
  });
  if (comment?.id) {
    await cardActivityRepo.create(db, {
      cardId,
      commentId: comment.id,
      createdBy: SHORTLIST_ROBOT_USER.id,
      toComment: comment.comment,
      type: "card.updated.comment.added",
    });
  }
}

function getJobAccountId(job: EnrichmentJobRow): string {
  const accountId = job.requestedBy ?? job.cardCreatedBy;
  if (!accountId) {
    throw new Error("Unable to determine the account for enrichment quota");
  }
  return accountId;
}

function buildCompanyCardData(company: OpenWebNinjaCompanyResult) {
  return {
    businessOutlookRating: company.business_outlook_rating,
    careerOpportunitiesRating: company.career_opportunities_rating,
    companyLink: company.company_link,
    companySize: company.company_size,
    compensationAndBenefitsRating: company.compensation_and_benefits_rating,
    cultureAndValuesRating: company.culture_and_values_rating,
    headquartersLocation: company.headquarters_location,
    industry: company.industry,
    matchedCompanyId: company.company_id,
    matchedCompanyName: company.name,
    recommendToFriendRating: company.recommend_to_friend_rating,
    reviewCount: company.review_count,
    reviewsLink: company.reviews_link,
    source: "OpenWebNinja employer data",
    website: company.website,
    workLifeBalanceRating: company.work_life_balance_rating,
  };
}

function isTypeEnabled(job: EnrichmentJobRow): boolean {
  return job.enrichmentType === ENRICHMENT_TYPES.SALARY
    ? job.salaryEnabled
    : job.enrichmentType === ENRICHMENT_TYPES.COMPANY && job.companyEnabled;
}

function normalizeRequest(request: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(request)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ]),
  );
}

function nonEmptyOrNull(value: string | null) {
  const trimmed = value?.trim();
  return trimmed?.length ? trimmed : null;
}

export function createRequestKey(type: EnrichmentType, request: unknown) {
  return createHash("sha256")
    .update(`${type}:${JSON.stringify(request)}`)
    .digest("hex");
}

export function getRetryDelayMs(attempt: number) {
  return Math.min(60_000, 2 ** attempt * 1_000);
}

function inArrayValue<T>(value: T, values: readonly T[]) {
  return values.includes(value);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
