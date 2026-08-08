import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";
import {
  DEFAULT_OPENWEBNINJA_ACCOUNT_DAILY_REQUEST_LIMIT,
  prepareEnrichmentQueue,
  processEnrichmentQueueBatch,
} from "@kan/shortlist-queue-worker/enrichment";

const logger = createLogger("shortlist-enrichment-worker");
const db = createDrizzleClient();
const apiKey = getRequiredEnv("OPENWEBNINJA_API_KEY");
const pollIntervalMs = getNumberEnv(
  "OPENWEBNINJA_WORKER_POLL_INTERVAL_MS",
  60_000,
);
const retryLimit = getNumberEnv("OPENWEBNINJA_RETRY_LIMIT", 3);
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    logger.info({ signal }, "Stopping enrichment worker");
  });
}

try {
  while (!stopping) {
    const prepared = await prepareEnrichmentQueue(db);
    const processed = await processEnrichmentQueueBatch(db, {
      apiKey,
      cacheReuseDays: getNumberEnv("OPENWEBNINJA_SALARY_CACHE_REUSE_DAYS", 30),
      accountDailyRequestLimit: getNumberEnv(
        "OPENWEBNINJA_ACCOUNT_DAILY_REQUEST_LIMIT",
        DEFAULT_OPENWEBNINJA_ACCOUNT_DAILY_REQUEST_LIMIT,
      ),
      frankfurterBaseUrl: process.env.FRANKFURTER_BASE_URL,
      retryLimit,
    });
    if (prepared.selected > 0 || processed.selected > 0) {
      logger.info({ prepared, processed }, "Enrichment worker cycle finished");
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
} catch (error) {
  logger.error({ error }, "Enrichment worker stopped after an error");
  process.exitCode = 1;
} finally {
  await db.$client.end();
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
