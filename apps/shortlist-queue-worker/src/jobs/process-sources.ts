/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-15
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

import { DEFAULT_LLM_ACCOUNT_DAILY_REQUEST_LIMIT } from "../utils/provider-requests";
import { processShortlistJobQueueBatch } from "../workers/source-queue-worker";

const logger = createLogger("shortlist-queue-worker:process-sources");

const db = createDrizzleClient();

try {
  const result = await processShortlistJobQueueBatch(db, {
    apiKey: getRequiredEnv("LLM_CONNECTOR_API_KEY"),
    accountDailyRequestLimit: getNumberEnv(
      "SHORTLIST_LLM_ACCOUNT_DAILY_REQUEST_LIMIT",
      DEFAULT_LLM_ACCOUNT_DAILY_REQUEST_LIMIT,
    ),
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
