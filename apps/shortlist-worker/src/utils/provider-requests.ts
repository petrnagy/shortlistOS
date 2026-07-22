import { createHash } from "node:crypto";
import { and, count, desc, eq, gte, isNotNull, ne, or, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { shortlistProviderRequests } from "@kan/db/schema";

export const PROVIDERS = {
  FRANKFURTER: "FRANKFURTER",
  LLM: "LLM",
  OPENWEBNINJA: "OPENWEBNINJA",
} as const;

export const PROVIDER_REQUEST_STATUSES = {
  COMPLETED: "COMPLETED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  PENDING: "PENDING",
} as const;

type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

interface RequestIdentity {
  accountId?: string | null;
  cardId?: number | null;
  endpoint: string;
  enrichmentJobId?: string | null;
  jobTitleNormalized?: string | null;
  location?: string | null;
  provider: Provider;
  regionKey?: string | null;
  requestJson: unknown;
  sourceJobId?: string | null;
}

export function createProviderRequestKey(
  provider: Provider,
  endpoint: string,
  request: unknown,
): string {
  return createHash("sha256")
    .update(`${provider}:${endpoint}:${JSON.stringify(request)}`)
    .digest("hex");
}

export async function beginProviderRequest(
  db: dbClient,
  input: RequestIdentity,
): Promise<string> {
  const [row] = await db
    .insert(shortlistProviderRequests)
    .values({
      accountId: input.accountId,
      cardId: input.cardId,
      endpoint: input.endpoint,
      enrichmentJobId: input.enrichmentJobId,
      jobTitleNormalized: input.jobTitleNormalized,
      location: input.location,
      provider: input.provider,
      regionKey: input.regionKey,
      requestJson: input.requestJson,
      requestKey: createProviderRequestKey(
        input.provider,
        input.endpoint,
        input.requestJson,
      ),
      sourceJobId: input.sourceJobId,
      status: PROVIDER_REQUEST_STATUSES.PENDING,
    })
    .returning({ id: shortlistProviderRequests.id });

  if (!row) throw new Error("Unable to create provider request history");
  return row.id;
}

export async function completeProviderRequest(
  db: dbClient,
  id: string,
  responseJson: unknown,
): Promise<void> {
  await db
    .update(shortlistProviderRequests)
    .set({
      error: null,
      fetchedAt: new Date(),
      responseJson,
      status: PROVIDER_REQUEST_STATUSES.COMPLETED,
      updatedAt: new Date(),
    })
    .where(eq(shortlistProviderRequests.id, id));
}

export async function failProviderRequest(
  db: dbClient,
  id: string,
  error: string,
): Promise<void> {
  await db
    .update(shortlistProviderRequests)
    .set({
      error,
      status: PROVIDER_REQUEST_STATUSES.FAILED,
      updatedAt: new Date(),
    })
    .where(eq(shortlistProviderRequests.id, id));
}

export async function recordDuplicateProviderRequest(
  db: dbClient,
  input: RequestIdentity & {
    duplicateOfId: string;
    responseJson: unknown;
  },
): Promise<void> {
  await db.insert(shortlistProviderRequests).values({
    accountId: input.accountId,
    cardId: input.cardId,
    duplicateOfId: input.duplicateOfId,
    endpoint: input.endpoint,
    enrichmentJobId: input.enrichmentJobId,
    fetchedAt: new Date(),
    jobTitleNormalized: input.jobTitleNormalized,
    location: input.location,
    provider: input.provider,
    regionKey: input.regionKey,
    requestJson: input.requestJson,
    requestKey: createProviderRequestKey(
      input.provider,
      input.endpoint,
      input.requestJson,
    ),
    responseJson: input.responseJson,
    sourceJobId: input.sourceJobId,
    status: PROVIDER_REQUEST_STATUSES.DUPLICATE,
  });
}

export async function countDailyAccountProviderRequests(
  db: dbClient,
  accountId: string,
  provider: Provider,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(shortlistProviderRequests)
    .where(
      and(
        eq(shortlistProviderRequests.accountId, accountId),
        eq(shortlistProviderRequests.provider, provider),
        gte(shortlistProviderRequests.requestedAt, since),
        ne(
          shortlistProviderRequests.status,
          PROVIDER_REQUEST_STATUSES.DUPLICATE,
        ),
      ),
    );
  return row?.value ?? 0;
}

export async function recordDailyProviderLimitNotice(
  db: dbClient,
  input: {
    accountId: string;
    cardId: number;
    provider: Provider;
    since: Date;
  },
): Promise<boolean> {
  const endpoint = "DAILY_LIMIT_NOTICE";
  const [existing] = await db
    .select({ id: shortlistProviderRequests.id })
    .from(shortlistProviderRequests)
    .where(
      and(
        eq(shortlistProviderRequests.accountId, input.accountId),
        eq(shortlistProviderRequests.provider, input.provider),
        eq(shortlistProviderRequests.endpoint, endpoint),
        gte(shortlistProviderRequests.requestedAt, input.since),
      ),
    )
    .limit(1);
  if (existing) return false;

  const requestJson = { day: input.since.toISOString().slice(0, 10) };
  await db.insert(shortlistProviderRequests).values({
    accountId: input.accountId,
    cardId: input.cardId,
    endpoint,
    provider: input.provider,
    requestJson,
    requestKey: createProviderRequestKey(input.provider, endpoint, requestJson),
    status: PROVIDER_REQUEST_STATUSES.DUPLICATE,
  });
  return true;
}

export function getUtcDayStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function linkSourceProviderRequestsToCard(
  db: dbClient,
  sourceJobId: string,
  cardId: number,
): Promise<void> {
  await db
    .update(shortlistProviderRequests)
    .set({ cardId, updatedAt: new Date() })
    .where(eq(shortlistProviderRequests.sourceJobId, sourceJobId));
}

export async function findReusableSalaryRequest(
  db: dbClient,
  input: {
    jobTitleNormalized: string;
    location: string;
    since: Date;
  },
) {
  const titlePattern = `%${escapeLike(input.jobTitleNormalized)}%`;
  const rows = await db
    .select({
      fetchedAt: shortlistProviderRequests.fetchedAt,
      id: shortlistProviderRequests.id,
      jobTitleNormalized: shortlistProviderRequests.jobTitleNormalized,
      responseJson: shortlistProviderRequests.responseJson,
    })
    .from(shortlistProviderRequests)
    .where(
      and(
        eq(shortlistProviderRequests.provider, PROVIDERS.OPENWEBNINJA),
        eq(shortlistProviderRequests.endpoint, "JOB_SALARY"),
        eq(
          shortlistProviderRequests.status,
          PROVIDER_REQUEST_STATUSES.COMPLETED,
        ),
        eq(
          shortlistProviderRequests.location,
          normalizeLocation(input.location),
        ),
        gte(shortlistProviderRequests.fetchedAt, input.since),
        isNotNull(shortlistProviderRequests.responseJson),
        or(
          sql`${shortlistProviderRequests.jobTitleNormalized} ILIKE ${titlePattern} ESCAPE '\\'`,
          sql`${input.jobTitleNormalized} ILIKE ('%' || ${shortlistProviderRequests.jobTitleNormalized} || '%')`,
        ),
      ),
    )
    .orderBy(desc(shortlistProviderRequests.fetchedAt))
    .limit(10);

  return rows.find(
    (row) => row.jobTitleNormalized && row.responseJson !== null,
  );
}

export async function findFreshRequestByKey(
  db: dbClient,
  input: { requestKey: string; since: Date },
) {
  const [row] = await db
    .select({
      id: shortlistProviderRequests.id,
      responseJson: shortlistProviderRequests.responseJson,
    })
    .from(shortlistProviderRequests)
    .where(
      and(
        eq(shortlistProviderRequests.requestKey, input.requestKey),
        eq(
          shortlistProviderRequests.status,
          PROVIDER_REQUEST_STATUSES.COMPLETED,
        ),
        gte(shortlistProviderRequests.fetchedAt, input.since),
        isNotNull(shortlistProviderRequests.responseJson),
      ),
    )
    .orderBy(desc(shortlistProviderRequests.fetchedAt))
    .limit(1);
  return row;
}

export function normalizeJobTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLocation(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
