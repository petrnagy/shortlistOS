import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";
import { cleanupOpenWebNinjaCache } from "@kan/shortlist-queue-worker/enrichment";

const logger = createLogger("shortlist-enrichment-worker:cleanup-cache");
const db = createDrizzleClient();

try {
  const result = await cleanupOpenWebNinjaCache(db, {
    retentionDays: getNumberEnv("OPENWEBNINJA_SALARY_CACHE_REUSE_DAYS", 30),
  });
  logger.info(result, "OpenWebNinja cache cleanup finished");
} catch (error) {
  logger.error({ error }, "OpenWebNinja cache cleanup failed");
  process.exitCode = 1;
} finally {
  await db.$client.end();
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
