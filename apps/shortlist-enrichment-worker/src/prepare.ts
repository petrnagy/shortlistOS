import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";
import { prepareEnrichmentQueue } from "@kan/shortlist-queue-worker/enrichment";

const logger = createLogger("shortlist-enrichment-worker:prepare");
const db = createDrizzleClient();

try {
  const result = await prepareEnrichmentQueue(db);
  logger.info(result, "Enrichment queue preparation finished");
} catch (error) {
  logger.error({ error }, "Enrichment queue preparation failed");
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
