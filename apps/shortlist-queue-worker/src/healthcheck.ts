import { sql } from "drizzle-orm";

import { createDrizzleClient } from "@kan/db/client";

const db = createDrizzleClient();

try {
  await db.execute(sql`SELECT 1`);
} catch {
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
