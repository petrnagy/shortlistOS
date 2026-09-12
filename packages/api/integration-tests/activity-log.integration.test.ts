import { describe, expect, it } from "vitest";

import * as boardRepo from "@kan/db/repository/board.repo";

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

    expect(result).toMatchObject({
      hasMore: false,
      nextCursor: null,
      activities: [
        {
          entityType: "board",
          publicId: "board1234567",
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
});
