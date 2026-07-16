/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-15
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

import { processShortlistJobQueueBatch } from "../workers/source-queue-worker";

const logger = createLogger("shortlist-worker:process-sources");

const db = createDrizzleClient();

try {
  const result = await processShortlistJobQueueBatch(db, {
    apiKey: getRequiredEnv("LLM_CONNECTOR_API_KEY"),
    model: getRequiredEnv("LLM_CONNECTOR_MODEL"),
    retryLimit: getNumberEnv("INBOX_CLIP_RETRY_LIMIT", 3),
  });

  logger.info(result, "Shortlist source queue processing finished");
} catch (error) {
  logger.error({ error }, "Shortlist source queue processing failed");
  process.exitCode = 1;
} finally {
  await db.$client.end();
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

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
