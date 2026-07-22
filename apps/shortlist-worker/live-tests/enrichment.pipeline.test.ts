import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { dbClient } from "@kan/db/client";
import * as cardRepo from "@kan/db/repository/card.repo";
import * as cardActivityRepo from "@kan/db/repository/cardActivity.repo";
import {
  boards,
  cards,
  comments,
  lists,
  shortlistEnrichmentJobs,
  shortlistProviderRequests,
  users,
  workspaceMembers,
  workspaces,
} from "@kan/db/schema";
import { SHORTLIST_ROBOT_USER } from "@kan/shared/constants";
import { generateUID } from "@kan/shared/utils";

import {
  ENRICHMENT_STATUSES,
  prepareEnrichmentQueue,
  processEnrichmentQueueBatch,
} from "../src/workers/enrichment-worker";
import { cleanupOpenWebNinjaCache } from "../src/workers/provider-cache-worker";

const shouldRun = Boolean(process.env.POSTGRES_URL);
const maybeDescribe = shouldRun ? describe : describe.skip;

interface Fixture {
  boardId: number;
  cardId: number;
  cardPublicId: string;
  listId: number;
  userId: string;
  workspaceId: number;
}

let db: dbClient;
let fixture: Fixture | null = null;

maybeDescribe("OpenWebNinja enrichment pipeline", () => {
  beforeAll(async () => {
    const dbModule = await import("@kan/db/client");
    db = dbModule.createDrizzleClient();
  });

  afterEach(async () => {
    if (!fixture) return;
    await db.delete(workspaces).where(eq(workspaces.id, fixture.workspaceId));
    await db.delete(users).where(eq(users.id, fixture.userId));
    fixture = null;
  });

  afterAll(async () => {
    await db.$client.end();
  });

  it("marks, queues, caches, fetches, summarizes, and audits salary and company data", async () => {
    fixture = await createFixture();
    const fetchMock = createProviderFetchMock();

    const [createdCard] = await db
      .select({ fetchNeeded: cards.shortlistDataFetchNeeded })
      .from(cards)
      .where(eq(cards.id, fixture.cardId));
    expect(createdCard?.fetchNeeded).toBe(true);

    expect(await prepareEnrichmentQueue(db)).toMatchObject({
      queued: 2,
      selected: 1,
    });
    expect(
      await processEnrichmentQueueBatch(db, {
        apiKey: "test-openwebninja-key",
        baseUrl: "https://openwebninja.pipeline.test",
        fetchImpl: fetchMock,
        regionConfig: [],
      }),
    ).toMatchObject({ completed: 2, selected: 2 });

    const [enrichedCard] = await db
      .select({
        companyBlob: cards.shortlistCompanySentimentBlob,
        companyRating: cards.shortlistCompanyRatingAggregated,
        companySummary: cards.shortlistCompanySentimentSummary,
        fetchNeeded: cards.shortlistDataFetchNeeded,
        salaryData: cards.shortlistSalaryData,
      })
      .from(cards)
      .where(eq(cards.id, fixture.cardId));
    expect(enrichedCard).toMatchObject({
      companyRating: "4.3",
      fetchNeeded: false,
    });
    expect(enrichedCard?.companySummary).toContain(
      "Available employer data indicates",
    );
    expect(enrichedCard?.companyBlob).toMatchObject({
      matchedCompanyId: 123,
      matchedCompanyName: "Acme GmbH",
    });
    expect(enrichedCard?.salaryData).toMatchObject({
      ranges: [
        {
          currency: "EUR",
          max: 10_000,
          min: 6_667,
          scope: "LOCAL",
        },
      ],
    });

    const jobs = await db
      .select({
        responseJson: shortlistEnrichmentJobs.responseJson,
        status: shortlistEnrichmentJobs.status,
        summary: shortlistEnrichmentJobs.summary,
      })
      .from(shortlistEnrichmentJobs)
      .where(eq(shortlistEnrichmentJobs.cardId, fixture.cardId));
    expect(jobs).toHaveLength(2);
    expect(
      jobs.every(
        (job) =>
          job.status === ENRICHMENT_STATUSES.COMPLETED &&
          job.responseJson !== null &&
          Boolean(job.summary),
      ),
    ).toBe(true);
    const robotComments = await db
      .select({ comment: comments.comment })
      .from(comments)
      .where(
        and(
          eq(comments.cardId, fixture.cardId),
          eq(comments.createdBy, SHORTLIST_ROBOT_USER.id),
        ),
      );
    expect(robotComments).toHaveLength(2);

    await cardActivityRepo.create(db, {
      cardId: fixture.cardId,
      createdBy: SHORTLIST_ROBOT_USER.id,
      fromTitle: "System maintenance",
      type: "card.updated.shortlistField",
    });
    expect(await getFetchNeeded(fixture.cardId)).toBe(false);

    await cardActivityRepo.create(db, {
      cardId: fixture.cardId,
      createdBy: fixture.userId,
      fromTitle: "User note",
      type: "card.updated.shortlistField",
    });
    expect(await getFetchNeeded(fixture.cardId)).toBe(true);
    expect(await prepareEnrichmentQueue(db)).toMatchObject({
      cached: 2,
      queued: 0,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches empty successful responses and retries provider failures only three times", async () => {
    fixture = await createFixture({ companyEnabled: false });
    await prepareEnrichmentQueue(db);
    const emptyFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [], status: "OK" }), {
        status: 200,
      }),
    );
    expect(
      await processEnrichmentQueueBatch(db, {
        apiKey: "key",
        fetchImpl: emptyFetch,
        regionConfig: [],
      }),
    ).toMatchObject({ completed: 1 });
    const [cardAfterEmptyResponse] = await db
      .select({ salaryData: cards.shortlistSalaryData })
      .from(cards)
      .where(eq(cards.id, fixture.cardId));
    expect(cardAfterEmptyResponse?.salaryData).toBeNull();
    expect(
      await db
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.cardId, fixture.cardId)),
    ).toHaveLength(0);

    await cardActivityRepo.create(db, {
      cardId: fixture.cardId,
      createdBy: fixture.userId,
      fromTitle: "Unrelated user update",
      type: "card.updated.shortlistField",
    });
    expect(await prepareEnrichmentQueue(db)).toMatchObject({
      cached: 1,
      queued: 0,
    });
    expect(emptyFetch).toHaveBeenCalledOnce();

    await db
      .update(cards)
      .set({
        shortlistDataFetchNeeded: true,
        shortlistJobLocation: "Berlin, Germany",
      })
      .where(eq(cards.id, fixture.cardId));
    expect(await prepareEnrichmentQueue(db)).toMatchObject({ queued: 1 });
    const failingFetch = vi
      .fn()
      .mockResolvedValue(new Response("provider unavailable", { status: 503 }));

    expect(
      await processEnrichmentQueueBatch(db, {
        apiKey: "key",
        fetchImpl: failingFetch,
        regionConfig: [],
      }),
    ).toMatchObject({ retried: 1 });
    await makeJobsRunnable(fixture.cardId);
    expect(
      await processEnrichmentQueueBatch(db, {
        apiKey: "key",
        fetchImpl: failingFetch,
        regionConfig: [],
      }),
    ).toMatchObject({ retried: 1 });
    await makeJobsRunnable(fixture.cardId);
    expect(
      await processEnrichmentQueueBatch(db, {
        apiKey: "key",
        fetchImpl: failingFetch,
        regionConfig: [],
      }),
    ).toMatchObject({ failed: 1 });
    expect(failingFetch).toHaveBeenCalledTimes(3);
  });

  it("respects Powerpack and manual-update eligibility and refreshes stale cache entries", async () => {
    fixture = await createFixture({ companyEnabled: false });
    await prepareEnrichmentQueue(db);
    const fetchMock = createProviderFetchMock();
    await processEnrichmentQueueBatch(db, {
      apiKey: "key",
      fetchImpl: fetchMock,
      regionConfig: [],
    });

    await db
      .update(shortlistEnrichmentJobs)
      .set({ fetchedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000) })
      .where(eq(shortlistEnrichmentJobs.cardId, fixture.cardId));
    await cardActivityRepo.create(db, {
      cardId: fixture.cardId,
      createdBy: fixture.userId,
      fromTitle: "Refresh stale insights",
      type: "card.updated.shortlistField",
    });
    expect(await prepareEnrichmentQueue(db)).toMatchObject({ queued: 1 });

    await db
      .update(cards)
      .set({ manualUpdatedOnly: true, shortlistDataFetchNeeded: false })
      .where(eq(cards.id, fixture.cardId));
    await cardActivityRepo.create(db, {
      cardId: fixture.cardId,
      createdBy: fixture.userId,
      fromTitle: "Manual-only update",
      type: "card.updated.shortlistField",
    });
    expect(await getFetchNeeded(fixture.cardId)).toBe(false);

    await db
      .update(cards)
      .set({ manualUpdatedOnly: false })
      .where(eq(cards.id, fixture.cardId));
    await db
      .update(users)
      .set({ shortlistPowerpackExpiresAt: new Date(Date.now() - 60_000) })
      .where(eq(users.id, fixture.userId));
    await cardActivityRepo.create(db, {
      cardId: fixture.cardId,
      createdBy: fixture.userId,
      fromTitle: "Expired Powerpack update",
      type: "card.updated.shortlistField",
    });
    expect(await getFetchNeeded(fixture.cardId)).toBe(false);
  });

  it("samples configured regions, converts currencies, and reuses similar-title cache rows", async () => {
    fixture = await createFixture({ companyEnabled: false });
    await db
      .update(cards)
      .set({
        shortlistSalaryCurrency: "CZK",
        shortlistSalaryInterval: "PER_MONTH",
        title: "Senior PHP Developer",
      })
      .where(eq(cards.id, fixture.cardId));
    await prepareEnrichmentQueue(db);
    const fetchMock = createRegionalFetchMock();
    const regionConfig = [
      { countries: ["Germany", "France"], key: "EU" as const },
      { countries: ["United Kingdom"], key: "UK" as const },
      {
        countries: ["Germany", "United Kingdom"],
        key: "GLOBAL" as const,
      },
    ];

    await processEnrichmentQueueBatch(db, {
      apiKey: "key",
      fetchImpl: fetchMock,
      fxFetchImpl: fetchMock,
      regionConfig,
    });

    const [firstCard] = await db
      .select({ salaryData: cards.shortlistSalaryData })
      .from(cards)
      .where(eq(cards.id, fixture.cardId));
    expect(firstCard?.salaryData).toMatchObject({
      currency: "CZK",
      period: "PER_MONTH",
      ranges: [
        { scope: "LOCAL" },
        { max: 62_500, min: 37_500, sampleCount: 2, scope: "EU" },
        { max: 60_000, min: 30_000, sampleCount: 1, scope: "UK" },
        { max: 55_000, min: 27_500, sampleCount: 2, scope: "GLOBAL" },
      ],
    });
    const callsAfterFirstCard = fetchMock.mock.calls.length;
    expect(callsAfterFirstCard).toBeGreaterThanOrEqual(4);

    const secondCard = await cardRepo.create(db, {
      createdBy: fixture.userId,
      description: "Similar title cache test",
      listId: fixture.listId,
      position: "end",
      shortlistJobLocation: "Prague, Czechia",
      shortlistSalaryCurrency: "CZK",
      shortlistSalaryInterval: "PER_MONTH",
      title: "PHP Developer",
      workspaceId: fixture.workspaceId,
    });
    await prepareEnrichmentQueue(db);
    await processEnrichmentQueueBatch(db, {
      apiKey: "key",
      fetchImpl: fetchMock,
      fxFetchImpl: fetchMock,
      regionConfig,
    });

    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirstCard);
    const duplicateRows = await db
      .select({ status: shortlistProviderRequests.status })
      .from(shortlistProviderRequests)
      .where(eq(shortlistProviderRequests.cardId, secondCard.id));
    expect(duplicateRows).toHaveLength(6);
    expect(duplicateRows.every((row) => row.status === "DUPLICATE")).toBe(true);
  });

  it("stops external requests at the daily account limit and comments only once", async () => {
    fixture = await createFixture({ companyEnabled: false });
    const fixtureUserId = fixture.userId;
    await prepareEnrichmentQueue(db);
    const fetchMock = createRegionalFetchMock();
    const options = {
      apiKey: "key",
      accountDailyRequestLimit: 2,
      fetchImpl: fetchMock,
      fxFetchImpl: fetchMock,
      regionConfig: [{ countries: ["Germany", "France"], key: "EU" as const }],
    };

    await processEnrichmentQueueBatch(db, options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      await db
        .select({ accountId: shortlistProviderRequests.accountId })
        .from(shortlistProviderRequests)
        .where(eq(shortlistProviderRequests.cardId, fixture.cardId))
        .then((rows) =>
          rows
            .filter((row) => row.accountId !== null)
            .every((row) => row.accountId === fixtureUserId),
        ),
    ).toBe(true);
    expect(
      await db
        .select({ comment: comments.comment })
        .from(comments)
        .where(eq(comments.cardId, fixture.cardId))
        .then((rows) =>
          rows.filter((row) =>
            row.comment.includes("daily external data request limit"),
          ),
        ),
    ).toHaveLength(1);

    const secondCard = await cardRepo.create(db, {
      createdBy: fixture.userId,
      description: "Account quota test",
      listId: fixture.listId,
      position: "end",
      shortlistJobLocation: "Brno, Czechia",
      shortlistSalaryCurrency: "CZK",
      shortlistSalaryInterval: "PER_MONTH",
      title: "Distinct Account-Limited Role",
      workspaceId: fixture.workspaceId,
    });
    await db
      .update(cards)
      .set({
        shortlistDataFetchNeeded: true,
        shortlistDataFetchRequestedBy: fixture.userId,
      })
      .where(eq(cards.id, secondCard.id));
    await prepareEnrichmentQueue(db);
    await processEnrichmentQueueBatch(db, options);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      await db
        .select({ comment: comments.comment })
        .from(comments)
        .where(eq(comments.cardId, secondCard.id)),
    ).toHaveLength(0);

    await db
      .update(shortlistEnrichmentJobs)
      .set({ fetchedAt: new Date(0) })
      .where(eq(shortlistEnrichmentJobs.cardId, fixture.cardId));
    await cardActivityRepo.create(db, {
      cardId: fixture.cardId,
      createdBy: fixture.userId,
      fromTitle: "Try enrichment after limit",
      type: "card.updated.shortlistField",
    });
    await prepareEnrichmentQueue(db);
    await processEnrichmentQueueBatch(db, options);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      await db
        .select({ comment: comments.comment })
        .from(comments)
        .where(eq(comments.cardId, fixture.cardId))
        .then((rows) =>
          rows.filter((row) =>
            row.comment.includes("daily external data request limit"),
          ),
        ),
    ).toHaveLength(1);
  });

  it("deletes only expired OpenWebNinja cache rows", async () => {
    fixture = await createFixture({ companyEnabled: false });
    const now = new Date("2026-07-23T12:00:00.000Z");
    await db.insert(shortlistProviderRequests).values([
      {
        accountId: fixture.userId,
        endpoint: "OLD_SALARY",
        provider: "OPENWEBNINJA",
        requestedAt: new Date("2026-06-22T11:59:59.000Z"),
        requestJson: {},
        requestKey: randomUUID(),
        status: "COMPLETED",
      },
      {
        accountId: fixture.userId,
        endpoint: "FRESH_SALARY",
        provider: "OPENWEBNINJA",
        requestedAt: new Date("2026-06-24T12:00:00.000Z"),
        requestJson: {},
        requestKey: randomUUID(),
        status: "COMPLETED",
      },
      {
        accountId: fixture.userId,
        endpoint: "OLD_CLASSIFICATION",
        provider: "LLM",
        requestedAt: new Date("2025-01-01T00:00:00.000Z"),
        requestJson: {},
        requestKey: randomUUID(),
        status: "COMPLETED",
      },
    ]);

    await expect(
      cleanupOpenWebNinjaCache(db, { now, retentionDays: 30 }),
    ).resolves.toMatchObject({ deleted: 1, retentionDays: 30 });

    const remaining = await db
      .select({ endpoint: shortlistProviderRequests.endpoint })
      .from(shortlistProviderRequests)
      .where(eq(shortlistProviderRequests.accountId, fixture.userId));
    expect(remaining.map((row) => row.endpoint).sort()).toEqual([
      "FRESH_SALARY",
      "OLD_CLASSIFICATION",
    ]);
  });
});

async function createFixture(
  options: { companyEnabled?: boolean } = {},
): Promise<Fixture> {
  const suffix = generateUID();
  const userId = randomUUID();
  const email = `enrichment-${suffix}@example.test`;
  await db
    .insert(users)
    .values({
      email: SHORTLIST_ROBOT_USER.email,
      emailVerified: true,
      id: SHORTLIST_ROBOT_USER.id,
      image: SHORTLIST_ROBOT_USER.image,
      name: SHORTLIST_ROBOT_USER.name,
    })
    .onConflictDoNothing();
  await db.insert(users).values({
    email,
    emailVerified: true,
    id: userId,
    name: "Enrichment Test User",
    shortlistPowerpackActivatedAt: new Date(Date.now() - 60_000),
    shortlistPowerpackExpiresAt: new Date(Date.now() + 86_400_000),
  });
  const [workspace] = await db
    .insert(workspaces)
    .values({
      createdBy: userId,
      name: "Enrichment Test Workspace",
      publicId: generateUID(),
      slug: `enrichment-${suffix}`,
    })
    .returning({ id: workspaces.id });
  if (!workspace) throw new Error("Workspace fixture was not created");
  await db.insert(workspaceMembers).values({
    createdBy: userId,
    email,
    publicId: generateUID(),
    role: "admin",
    status: "active",
    userId,
    workspaceId: workspace.id,
  });
  const [board] = await db
    .insert(boards)
    .values({
      createdBy: userId,
      name: "Enrichment Test Board",
      publicId: generateUID(),
      shortlistIsCompanySentimentEnabled: options.companyEnabled ?? true,
      shortlistIsSalaryDataEnabled: true,
      slug: `enrichment-board-${suffix}`,
      workspaceId: workspace.id,
    })
    .returning({ id: boards.id });
  if (!board) throw new Error("Board fixture was not created");
  const [list] = await db
    .insert(lists)
    .values({
      boardId: board.id,
      createdBy: userId,
      index: 0,
      name: "Saved",
      publicId: generateUID(),
    })
    .returning({ id: lists.id });
  if (!list) throw new Error("List fixture was not created");
  const card = await cardRepo.create(db, {
    createdBy: userId,
    description: "Opportunity for enrichment",
    listId: list.id,
    position: "end",
    shortlistCompanyLocation: "Prague, Czechia",
    shortlistCompanyName: "Acme s.r.o.",
    shortlistJobLocation: "Prague, Czechia",
    title: "Platform Engineer",
    workspaceId: workspace.id,
  });

  return {
    boardId: board.id,
    cardId: card.id,
    cardPublicId: card.publicId,
    listId: list.id,
    userId,
    workspaceId: workspace.id,
  };
}

function createRegionalFetchMock() {
  return vi.fn((input: Parameters<typeof fetch>[0]) => {
    const url = new URL(
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : input,
    );
    if (url.pathname.includes("/v2/rate/")) {
      const [, , , base, quote] = url.pathname.split("/");
      const rate = base === "EUR" ? 25 : base === "GBP" ? 30 : 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({ base, date: "2026-07-22", quote, rate }),
          { status: 200 },
        ),
      );
    }

    const location = url.searchParams.get("location") ?? "Prague, Czechia";
    const values: Record<
      string,
      { currency: string; max: number; median: number; min: number }
    > = {
      France: { currency: "EUR", max: 3_000, median: 2_500, min: 2_000 },
      Germany: { currency: "EUR", max: 2_000, median: 1_500, min: 1_000 },
      "Prague, Czechia": {
        currency: "CZK",
        max: 200,
        median: 150,
        min: 100,
      },
      "United Kingdom": {
        currency: "GBP",
        max: 2_000,
        median: 1_500,
        min: 1_000,
      },
    };
    const salary = values[location] ?? {
      currency: "CZK",
      max: 200,
      median: 150,
      min: 100,
    };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          data: [
            {
              confidence: "CONFIDENT",
              job_title: "Senior PHP Developer",
              location,
              max_salary: salary.max,
              median_salary: salary.median,
              min_salary: salary.min,
              publisher_link: "https://example.test/salary",
              publisher_name: "Employer data",
              salary_currency: salary.currency,
              salary_period: "MONTH",
            },
          ],
          status: "OK",
        }),
        { status: 200 },
      ),
    );
  });
}

function createProviderFetchMock() {
  return vi.fn((input: Parameters<typeof fetch>[0]) => {
    const url =
      input instanceof URL
        ? input
        : input instanceof Request
          ? new URL(input.url)
          : new URL(input);
    if (url.pathname.includes("job-salary")) {
      return Promise.resolve(
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
            status: "OK",
          }),
          { status: 200 },
        ),
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify({ data: [companyResponse()], status: "OK" }),
        { status: 200 },
      ),
    );
  });
}

function companyResponse() {
  return {
    business_outlook_rating: 0.72,
    career_opportunities_rating: 4.1,
    ceo: "Jane Doe",
    ceo_rating: 0.8,
    company_description: "A software company",
    company_id: 123,
    company_link: "https://example.test/company",
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
    reviews_link: "https://example.test/reviews",
    salary_count: 80,
    senior_management_rating: 3.9,
    stock: null,
    website: "https://acme.test",
    work_life_balance_rating: 4.5,
    year_founded: 2010,
  };
}

async function getFetchNeeded(cardId: number) {
  const [card] = await db
    .select({ value: cards.shortlistDataFetchNeeded })
    .from(cards)
    .where(eq(cards.id, cardId));
  return card?.value;
}

async function makeJobsRunnable(cardId: number) {
  await db
    .update(shortlistEnrichmentJobs)
    .set({ runAfter: new Date(0) })
    .where(eq(shortlistEnrichmentJobs.cardId, cardId));
}
