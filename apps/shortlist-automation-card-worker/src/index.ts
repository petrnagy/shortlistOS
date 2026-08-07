import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

import {
  enqueueDueCardAutomations,
  processCardAutomationBatch,
} from "./worker";

const logger = createLogger("shortlist-automation-card-worker");
const db = createDrizzleClient();
const intervalMs = 60 * 60 * 1000;
let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
    logger.info({ signal }, "Stopping card automation worker");
  });
}

try {
  while (!stopping) {
    const generated = await enqueueDueCardAutomations(db);
    let processed = 0;
    while (!stopping) {
      const result = await processCardAutomationBatch(db);
      processed += result.selected;
      if (result.selected === 0) break;
    }
    logger.info({ generated, processed }, "Card automation cycle finished");
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
} catch (error) {
  logger.error({ error }, "Card automation worker stopped after an error");
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
