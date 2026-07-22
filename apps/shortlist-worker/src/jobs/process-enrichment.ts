import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

import { processEnrichmentQueueBatch } from "../workers/enrichment-worker";

const logger = createLogger("shortlist-worker:process-enrichment");
const db = createDrizzleClient();

try {
  const result = await processEnrichmentQueueBatch(db, {
    apiKey: getRequiredEnv("OPENWEBNINJA_API_KEY"),
    cacheReuseDays: getNumberEnv("OPENWEBNINJA_SALARY_CACHE_REUSE_DAYS", 30),
    accountDailyRequestLimit: getNumberEnv(
      "OPENWEBNINJA_ACCOUNT_DAILY_REQUEST_LIMIT",
      250,
    ),
    frankfurterBaseUrl: process.env.FRANKFURTER_BASE_URL,
    retryLimit: getNumberEnv("OPENWEBNINJA_RETRY_LIMIT", 3),
  });
  logger.info(result, "Enrichment queue processing finished");
} catch (error) {
  logger.error({ error }, "Enrichment queue processing failed");
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
