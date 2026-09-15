import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as boardRepo from "@kan/db/repository/board.repo";
import { POWERPACK_ENABLED_DEFAULTS } from "@kan/db/repository/powerpack-defaults";
import { grantShortlistPowerpackForCheckout } from "@kan/db/repository/user.repo";
import { boards, shortlistPowerpackPurchases, users } from "@kan/db/schema";

import { createTestDb, seedTestData } from "./test-db";

const DISABLED = Object.fromEntries(
  Object.keys(POWERPACK_ENABLED_DEFAULTS).map((key) => [key, false]),
);

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Expected test fixture to exist");
  return value;
}

async function setup() {
  const db = await createTestDb();
  const { user, workspace } = await seedTestData(db);
  const purchase = (suffix = "first") =>
    grantShortlistPowerpackForCheckout(db, {
      amountTotal: 2900,
      currency: "usd",
      membershipDurationDays: 90,
      productId: "prod_powerpack",
      stripeCheckoutSessionId: `cs_${suffix}`,
      stripeEventId: `evt_${suffix}`,
      userId: user.id,
    });
  const create = (slug: string, type: "regular" | "template" = "regular") =>
    boardRepo
      .create(db, {
        name: slug,
        slug,
        type,
        createdBy: user.id,
        workspaceId: workspace.id,
      })
      .then(required);
  const read = (publicId: string) =>
    db.query.boards
      .findFirst({ where: eq(boards.publicId, publicId) })
      .then(required);
  const update = (
    publicId: string,
    settings: Partial<Parameters<typeof boardRepo.update>[1]>,
  ) =>
    boardRepo.update(db, {
      name: undefined,
      slug: undefined,
      visibility: undefined,
      boardPublicId: publicId,
      updatedBy: user.id,
      ...settings,
    });
  return { db, user, workspace, purchase, create, read, update };
}

describe("Powerpack board initialization", () => {
  it("rolls back purchase, membership and board initialization together", async () => {
    const { db, user, create, read } = await setup();
    const board = await create("rollback");
    const original = await read(board.publicId);
    await expect(
      db.transaction(async (tx) => {
        await grantShortlistPowerpackForCheckout(tx as unknown as typeof db, {
          amountTotal: 2900,
          currency: "usd",
          membershipDurationDays: 90,
          productId: "prod_test",
          stripeCheckoutSessionId: "cs_rollback",
          stripeEventId: "evt_rollback",
          userId: user.id,
        });
        throw new Error("Roll back test transaction");
      }),
    ).rejects.toThrow("Roll back test transaction");
    expect(await read(board.publicId)).toEqual(original);
    expect(await db.select().from(shortlistPowerpackPurchases)).toHaveLength(0);
    expect(
      await db.query.users.findFirst({ where: eq(users.id, user.id) }),
    ).toMatchObject({
      shortlistPowerpackActivatedAt: null,
      shortlistPowerpackExpiresAt: null,
    });
  }, 20_000);

  it("initializes only owned active regular boards and preserves all numeric settings", async () => {
    const { db, user, workspace, purchase, create, read } = await setup();
    const active = await create("active");
    const archived = await create("archived");
    const deleted = await create("deleted");
    const template = await create("template", "template");
    const [other] = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: "other@example.com",
        emailVerified: true,
      })
      .returning();
    const shared = await boardRepo
      .create(db, {
        name: "shared",
        slug: "shared",
        workspaceId: workspace.id,
        createdBy: required(other).id,
      })
      .then(required);
    const timing = {
      shortlistSavedReminderAfterDays: 11,
      shortlistSavedAutoArchiveAfterDays: 22,
      shortlistAppliedFollowUpReminderAfterDays: 12,
      shortlistAppliedGhostedAfterDays: 23,
      shortlistInterviewingNudgeAfterDays: 4,
      shortlistNegotiatingNudgeAfterDays: 5,
    };
    await db.update(boards).set(timing).where(eq(boards.id, active.id));
    await db
      .update(boards)
      .set({ isArchived: true })
      .where(eq(boards.id, archived.id));
    await db
      .update(boards)
      .set({ deletedAt: new Date() })
      .where(eq(boards.id, deleted.id));
    const excluded = await Promise.all(
      [archived, deleted, template, shared].map((b) => read(b.publicId)),
    );
    // Activation timestamps alone must not imply that a purchase was processed.
    await db
      .update(users)
      .set({
        shortlistPowerpackActivatedAt: new Date(0),
        shortlistPowerpackExpiresAt: new Date(1),
      })
      .where(eq(users.id, user.id));
    await purchase();
    expect(await read(active.publicId)).toMatchObject({
      ...POWERPACK_ENABLED_DEFAULTS,
      ...timing,
      shortlistPowerpackSettingsInitializedAt: expect.any(Date) as Date,
    });
    expect(
      await Promise.all(
        [archived, deleted, template, shared].map((b) => read(b.publicId)),
      ),
    ).toEqual(excluded);
  }, 20_000);

  it("preserves deliberately disabled preferences on renewal, retries and reactivation", async () => {
    const { db, user, purchase, create, read, update } = await setup();
    const board = await create("preferences");
    await purchase();
    await update(board.publicId, DISABLED);
    const configured = await read(board.publicId);
    expect(configured).toMatchObject(DISABLED);
    expect(await purchase()).toEqual({ processed: false });
    await grantShortlistPowerpackForCheckout(db, {
      amountTotal: 2900,
      currency: "usd",
      membershipDurationDays: 90,
      productId: "prod_powerpack",
      stripeCheckoutSessionId: "cs_first",
      stripeEventId: "evt_retry",
      userId: user.id,
    });
    expect(await read(board.publicId)).toEqual(configured);
    await purchase("second");
    expect(await read(board.publicId)).toEqual(configured);
    await db
      .update(users)
      .set({ shortlistPowerpackExpiresAt: new Date(0) })
      .where(eq(users.id, user.id));
    await purchase("reactivation");
    expect(await read(board.publicId)).toEqual(configured);
  }, 20_000);

  it("applies owner membership defaults to direct creation and snapshots, excluding templates", async () => {
    const { db, user, workspace, create, purchase, read } = await setup();
    expect(await read((await create("free")).publicId)).toMatchObject({
      ...DISABLED,
      shortlistPowerpackSettingsInitializedAt: null,
    });
    await purchase();
    expect(await read((await create("paid")).publicId)).toMatchObject(
      POWERPACK_ENABLED_DEFAULTS,
    );
    expect(
      await read((await create("template", "template")).publicId),
    ).toMatchObject({
      ...DISABLED,
      shortlistPowerpackSettingsInitializedAt: null,
    });
    for (const type of ["regular", "template"] as const) {
      const board = await boardRepo.createFromSnapshot(db, {
        source: { name: "snapshot", labels: [], lists: [] },
        workspaceId: workspace.id,
        createdBy: user.id,
        slug: `snapshot-${type}`,
        type,
      });
      expect(await read(board.publicId)).toMatchObject(
        type === "regular" ? POWERPACK_ENABLED_DEFAULTS : DISABLED,
      );
    }
    await db
      .update(users)
      .set({ shortlistPowerpackExpiresAt: new Date(0) })
      .where(eq(users.id, user.id));
    expect(await read((await create("expired")).publicId)).toMatchObject(
      DISABLED,
    );
  }, 20_000);

  it("preserves configuration through archive and initializes a never-configured unarchive only once", async () => {
    const { create, purchase, read, update } = await setup();
    const board = await create("archived");
    await update(board.publicId, { isArchived: true });
    await purchase();
    expect(await read(board.publicId)).toMatchObject({
      ...DISABLED,
      shortlistPowerpackSettingsInitializedAt: null,
    });
    await update(board.publicId, { isArchived: false });
    expect(await read(board.publicId)).toMatchObject({
      ...POWERPACK_ENABLED_DEFAULTS,
      shortlistPowerpackSettingsInitializedAt: expect.any(Date) as Date,
    });
    await update(board.publicId, DISABLED);
    const configured = await read(board.publicId);
    await update(board.publicId, { isArchived: true });
    expect(await read(board.publicId)).toMatchObject({
      ...DISABLED,
      shortlistPowerpackSettingsInitializedAt:
        configured.shortlistPowerpackSettingsInitializedAt,
    });
    await update(board.publicId, { isArchived: false });
    expect(await read(board.publicId)).toMatchObject({
      ...DISABLED,
      shortlistPowerpackSettingsInitializedAt:
        configured.shortlistPowerpackSettingsInitializedAt,
    });
  }, 20_000);

  it("does not initialize templates or boards unarchived without active Powerpack", async () => {
    const { create, purchase, read, update } = await setup();
    const free = await create("free-unarchive");
    await update(free.publicId, { isArchived: true });
    await update(free.publicId, { isArchived: false });
    expect(await read(free.publicId)).toMatchObject({
      ...DISABLED,
      shortlistPowerpackSettingsInitializedAt: null,
    });
    const template = await create("template-unarchive", "template");
    await update(template.publicId, { isArchived: true });
    await purchase();
    await update(template.publicId, { isArchived: false });
    expect(await read(template.publicId)).toMatchObject({
      ...DISABLED,
      shortlistPowerpackSettingsInitializedAt: null,
    });
  }, 20_000);

  it("marks explicit all-disabled settings and numeric edits as configured before unarchiving", async () => {
    const { create, purchase, read, update } = await setup();
    const pending = [];
    for (const [slug, settings] of [
      ["disabled", DISABLED],
      ["numeric", { shortlistSavedReminderAfterDays: 9 }],
    ] as const) {
      const board = await create(slug);
      await update(board.publicId, { isArchived: true, ...settings });
      pending.push({ board, settings });
    }
    await purchase();
    for (const { board, settings } of pending) {
      await update(board.publicId, { isArchived: false });
      expect(await read(board.publicId)).toMatchObject({
        ...DISABLED,
        ...settings,
        shortlistPowerpackSettingsInitializedAt: expect.any(Date) as Date,
      });
    }
  }, 20_000);

  it("keeps concurrent purchases additive and includes concurrently created boards", async () => {
    const { db, user, create, purchase, read } = await setup();
    const [first, second, board] = await Promise.all([
      purchase(),
      purchase("second"),
      create("concurrent"),
    ]);
    expect(first.processed).toBe(true);
    expect(second.processed).toBe(true);
    expect(await read(required(board).publicId)).toMatchObject(
      POWERPACK_ENABLED_DEFAULTS,
    );
    const member = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(
      required(member?.shortlistPowerpackExpiresAt).getTime() -
        required(member?.shortlistPowerpackActivatedAt).getTime(),
    ).toBe(180 * 86_400_000);
    expect(await db.select().from(shortlistPowerpackPurchases)).toHaveLength(2);
  }, 20_000);
});
