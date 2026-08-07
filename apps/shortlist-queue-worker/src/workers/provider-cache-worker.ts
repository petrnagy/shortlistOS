import { and, eq, lt } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { shortlistProviderRequests } from "@kan/db/schema";

import { PROVIDERS } from "../utils/provider-requests";

const DAY_MS = 24 * 60 * 60 * 1_000;

interface CleanupOpenWebNinjaCacheOptions {
  now?: Date;
  retentionDays: number;
}

export async function cleanupOpenWebNinjaCache(
  db: dbClient,
  options: CleanupOpenWebNinjaCacheOptions,
) {
  if (!Number.isInteger(options.retentionDays) || options.retentionDays < 1) {
    throw new Error("OpenWebNinja cache retention must be a positive integer");
  }

  const now = options.now ?? new Date();
  const deleteBefore = new Date(now.getTime() - options.retentionDays * DAY_MS);
  const deleted = await db
    .delete(shortlistProviderRequests)
    .where(
      and(
        eq(shortlistProviderRequests.provider, PROVIDERS.OPENWEBNINJA),
        lt(shortlistProviderRequests.requestedAt, deleteBefore),
      ),
    )
    .returning({ id: shortlistProviderRequests.id });

  return {
    deleteBefore,
    deleted: deleted.length,
    retentionDays: options.retentionDays,
  };
}
