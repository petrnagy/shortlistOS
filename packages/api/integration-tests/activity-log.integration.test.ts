import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as boardActivityRepo from "@kan/db/repository/board-activity.repo";
import * as boardRepo from "@kan/db/repository/board.repo";
import { boardActivities, boards, workspaceMembers } from "@kan/db/schema";

import { activityLogRouter } from "../src/routers/activity-log";
import { createTestDb, seedTestData } from "./test-db";

describe("global activity log", () => {
  it("includes a board creation for an active workspace member", async () => {
    const db = await createTestDb();
    const { user, workspace } = await seedTestData(db);
    const board = await boardRepo.create(db, {
      publicId: "board1234567",
      name: "Frontend roles",
      slug: "frontend-roles",
      createdBy: user.id,
      workspaceId: workspace.id,
    });

    expect(board).toBeDefined();

    const caller = activityLogRouter.createCaller({
      user: {
        id: user.id,
        name: user.name ?? "Test User",
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        image: user.image,
      },
      db,
      auth: null as never,
      headers: new Headers(),
      transport: "trpc",
      requestId: crypto.randomUUID(),
    });

    const result = await caller.list({ limit: 20 });
    expect(result.activities[0]?.publicId).toMatch(/^[A-Za-z0-9]{12}$/);

    expect(result).toMatchObject({
      hasMore: false,
      nextCursor: null,
      activities: [
        {
          entityType: "board",
          type: "board.created",
          board: {
            publicId: "board1234567",
            name: "Frontend roles",
            type: "regular",
          },
          user: {
            id: user.id,
            name: "Test User",
            email: "test@example.com",
          },
        },
      ],
    });
  }, 15_000);

  it("records transitions once and preserves history without links after deletion", async () => {
    const db = await createTestDb();
    const { user, workspace } = await seedTestData(db);
    const board = await boardRepo.create(db, {
      name: "Archived roles",
      slug: "archived-roles",
      createdBy: user.id,
      workspaceId: workspace.id,
    });
    expect(board).toBeDefined();
    if (!board) throw new Error("Board was not created");
    const update = {
      boardPublicId: board.publicId,
      updatedBy: user.id,
      name: undefined,
      slug: undefined,
      visibility: undefined,
    };
    await boardRepo.update(db, { ...update, isArchived: true });
    await boardRepo.update(db, { ...update, isArchived: true });
    await boardRepo.update(db, { ...update, isArchived: false });
    const before = await boardActivityRepo.getPaginatedUserActivities(
      db,
      user.id,
    );
    expect(before.activities.map((event) => event.type).sort()).toEqual([
      "board.archived",
      "board.created",
      "board.unarchived",
    ]);
    expect(
      before.activities.every(
        (event) => event.board.publicId === board.publicId,
      ),
    ).toBe(true);
    await boardRepo.softDelete(db, {
      boardId: board.id,
      deletedAt: new Date(),
      deletedBy: user.id,
    });
    await boardRepo.softDelete(db, {
      boardId: board.id,
      deletedAt: new Date(),
      deletedBy: user.id,
    });
    const after = await boardActivityRepo.getPaginatedUserActivities(
      db,
      user.id,
    );
    expect(after.activities).toHaveLength(4);
    expect(
      after.activities.every(
        (event) =>
          event.board.publicId === null &&
          event.board.name === "Archived roles",
      ),
    ).toBe(true);
    await db.delete(boards).where(eq(boards.id, board.id));
    expect(await db.select().from(boardActivities)).toHaveLength(4);
    const removed = await boardActivityRepo.getPaginatedUserActivities(
      db,
      user.id,
    );
    expect(removed.activities).toEqual(after.activities);
    expect(
      (
        await boardActivityRepo.getPaginatedUserActivities(
          db,
          crypto.randomUUID(),
        )
      ).activities,
    ).toEqual([]);
    await db
      .update(workspaceMembers)
      .set({ deletedAt: new Date() })
      .where(eq(workspaceMembers.userId, user.id));
    expect(
      (await boardActivityRepo.getPaginatedUserActivities(db, user.id))
        .activities,
    ).toEqual([]);
  }, 15_000);
});
