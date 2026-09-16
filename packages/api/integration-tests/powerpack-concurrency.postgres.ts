import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { dbClient } from "@kan/db/client";
import * as boardRepo from "@kan/db/repository/board.repo";
import { POWERPACK_ENABLED_DEFAULTS } from "@kan/db/repository/powerpack-defaults";
import { grantShortlistPowerpackForCheckout } from "@kan/db/repository/user.repo";
import * as schema from "@kan/db/schema";

import { seedTestData } from "./test-db";

// Run with vitest.postgres.config.ts and POSTGRES_URL. This creates and removes
// a uniquely named test database; it never changes application data.
describe("Powerpack PostgreSQL concurrency", () => {
  const databaseName = `powerpack_test_${randomUUID().replaceAll("-", "")}`;
  let admin: Pool | undefined;
  let pool: Pool | undefined;
  let db: dbClient;

  beforeAll(async () => {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("POSTGRES_URL is required");
    admin = new Pool({ connectionString });
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    const url = new URL(connectionString);
    url.pathname = `/${databaseName}`;
    pool = new Pool({ connectionString: url.toString(), max: 6 });
    db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: "../../packages/db/migrations" });
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin?.end();
  });

  it("serializes competing purchases and creation behind the owner lock", async () => {
    const { user, workspace } = await seedTestData(db);
    const board = await boardRepo.create(db, {
      name: "Existing",
      slug: "existing",
      createdBy: user.id,
      workspaceId: workspace.id,
    });
    if (!board) throw new Error("Missing test board");
    const input = {
      amountTotal: 2900,
      currency: "usd",
      membershipDurationDays: 90,
      productId: "prod_test",
      stripeCheckoutSessionId: "cs_first",
      stripeEventId: "evt_first",
      userId: user.id,
    };
    let release: () => void = () => undefined;
    let ready: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const initialized = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const first = db.transaction(async (tx) => {
      await grantShortlistPowerpackForCheckout(
        tx as unknown as dbClient,
        input,
      );
      // A deliberate preference saved after initialization must survive the
      // waiting purchase, even though it arrived before this transaction committed.
      await tx
        .update(schema.boards)
        .set({ shortlistIsSalaryDataEnabled: false })
        .where(eq(schema.boards.id, board.id));
      ready();
      await held;
    });
    await Promise.race([initialized, first]);
    const second = grantShortlistPowerpackForCheckout(db, {
      ...input,
      stripeCheckoutSessionId: "cs_second",
      stripeEventId: "evt_second",
    });
    const creation = boardRepo.create(db, {
      name: "Concurrent",
      slug: "concurrent",
      createdBy: user.id,
      workspaceId: workspace.id,
    });
    try {
      await expect
        .poll(
          async () => {
            const result = await pool?.query<{ count: string }>(
              "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
            );
            return Number(result?.rows[0]?.count ?? 0);
          },
          { timeout: 10_000 },
        )
        .toBe(2);
    } finally {
      release();
      await Promise.all([first, second, creation]);
    }
    const created = await creation;
    if (!created) throw new Error("Missing concurrent board");
    expect(
      await db.query.boards.findFirst({
        where: eq(schema.boards.id, created.id),
      }),
    ).toMatchObject(POWERPACK_ENABLED_DEFAULTS);
    expect(
      await db.query.boards.findFirst({
        where: eq(schema.boards.id, board.id),
      }),
    ).toMatchObject({
      ...POWERPACK_ENABLED_DEFAULTS,
      shortlistIsSalaryDataEnabled: false,
    });
    const member = await db.query.users.findFirst({
      where: eq(schema.users.id, user.id),
    });
    if (
      !member?.shortlistPowerpackActivatedAt ||
      !member.shortlistPowerpackExpiresAt
    )
      throw new Error("Missing membership");
    expect(
      member.shortlistPowerpackExpiresAt.getTime() -
        member.shortlistPowerpackActivatedAt.getTime(),
    ).toBe(180 * 86_400_000);
    expect(
      await db.select().from(schema.shortlistPowerpackPurchases),
    ).toHaveLength(2);
  }, 20_000);
});
