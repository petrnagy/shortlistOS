/**
 * Continuously drains the shortlist source queue for container/worker deployments.
 */
import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

import { DEFAULT_LLM_ACCOUNT_DAILY_REQUEST_LIMIT } from "../utils/provider-requests";
import { processInboundEmailBatch } from "../workers/inbound-email-worker";
import { processShortlistJobQueueBatch } from "../workers/source-queue-worker";

const logger = createLogger("shortlist-queue-worker:watch-sources");
const db = createDrizzleClient();
const pollIntervalMs = getNumberEnv("SHORTLIST_WORKER_POLL_INTERVAL_MS", 5_000);
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    logger.info({ signal }, "Stopping shortlist source worker");
  });
}

try {
  while (!stopping) {
    const inboundResult = await processInboundEmailBatch(db, {
      apiKey: getOptionalEnv("BREVO_API_KEY"),
      bucket: getRequiredEnv("SHORTLIST_SOURCE_BUCKET_NAME"),
    });
    const result = await processShortlistJobQueueBatch(db, {
      apiKey: getRequiredEnv("LLM_CONNECTOR_API_KEY"),
      accountDailyRequestLimit: getNumberEnv(
        "SHORTLIST_LLM_ACCOUNT_DAILY_REQUEST_LIMIT",
        DEFAULT_LLM_ACCOUNT_DAILY_REQUEST_LIMIT,
      ),
      model: getRequiredEnv("LLM_CONNECTOR_MODEL"),
      retryLimit: getNumberEnv("INBOX_CLIP_RETRY_LIMIT", 3),
    });

    if (result.selected > 0 || inboundResult.selected > 0) {
      logger.info(
        { inbound: inboundResult, sources: result },
        "Shortlist worker batches finished",
      );
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
} catch (error) {
  logger.error({ error }, "Shortlist source worker stopped after an error");
  process.exitCode = 1;
} finally {
  await db.$client.end();
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() ?? undefined;
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
