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

import type { OpenWebNinjaCompanyResult } from "../connectors/openwebninja";
import {
  OpenWebNinjaConnector,
  selectCompanyMatch,
  summarizeCompany,
  summarizeSalary,
} from "../connectors/openwebninja";

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
  cardId: number;
  cardPublicId: string;
  companyEnabled: boolean;
  enrichmentType: string;
  id: string;
  manualUpdatedOnly: boolean;
  maxAttempts: number;
  requestJson: unknown;
  salaryEnabled: boolean;
}

export async function prepareEnrichmentQueue(
  db: dbClient,
  options: { limit?: number; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const rows = await db
    .select({
      cardId: cards.id,
      companyEnabled: boards.shortlistIsCompanySentimentEnabled,
      companyLocation: cards.shortlistCompanyLocation,
      companyName: cards.shortlistCompanyName,
      jobLocation: cards.shortlistJobLocation,
      jobTitle: cards.title,
      manualUpdatedOnly: cards.manualUpdatedOnly,
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
      .set({ shortlistDataFetchNeeded: false })
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
  options: {
    apiKey: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    limit?: number;
    retryLimit?: number;
  },
) {
  const jobs = await claimJobs(db, options.limit ?? DEFAULT_BATCH_LIMIT);
  const connector = new OpenWebNinjaConnector({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl,
  });
  const result = { completed: 0, failed: 0, retried: 0, selected: jobs.length };

  for (const job of jobs) {
    const status = await processJob(
      db,
      job,
      connector,
      options.retryLimit ?? 3,
    );
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
        cardId: shortlistEnrichmentJobs.cardId,
        cardPublicId: cards.publicId,
        companyEnabled: boards.shortlistIsCompanySentimentEnabled,
        enrichmentType: shortlistEnrichmentJobs.enrichmentType,
        id: shortlistEnrichmentJobs.id,
        manualUpdatedOnly: cards.manualUpdatedOnly,
        maxAttempts: shortlistEnrichmentJobs.maxAttempts,
        requestJson: shortlistEnrichmentJobs.requestJson,
        salaryEnabled: boards.shortlistIsSalaryDataEnabled,
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
  retryLimit: number,
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
      const response = await connector.getJobSalary(request);
      const salary = response.data[0] ?? null;
      const summary = salary
        ? summarizeSalary(salary)
        : `No salary benchmark is currently available for ${request.jobTitle} in ${request.location}.`;
      if (salary) {
        await cardRepo.update(
          db,
          {
            shortlistSalaryData: {
              fetchedAt: new Date().toISOString(),
              ranges: [
                {
                  confidence: salary.confidence,
                  currency: salary.salary_currency,
                  label: salary.location,
                  max: salary.max_salary,
                  median: salary.median_salary,
                  min: salary.min_salary,
                  period: salary.salary_period,
                  publisherLink: salary.publisher_link,
                },
              ],
              summary,
            },
          },
          { cardPublicId: job.cardPublicId },
        );
        await addRobotAudit(db, job.cardId, "Salary insights", summary);
      }
      await completeJob(db, job.id, { responseJson: response, summary });
    } else if (job.enrichmentType === ENRICHMENT_TYPES.COMPANY) {
      const request = companyRequestSchema.parse(job.requestJson);
      const response = await connector.searchCompanies({
        query: request.companyName,
      });
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
      await completeJob(db, job.id, { responseJson: response, summary });
    } else {
      throw new Error(`Unsupported enrichment type ${job.enrichmentType}`);
    }

    return ENRICHMENT_STATUSES.COMPLETED;
  } catch (error) {
    const message = formatError(error);
    const shouldRetry = attempt < Math.min(job.maxAttempts, retryLimit);
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
