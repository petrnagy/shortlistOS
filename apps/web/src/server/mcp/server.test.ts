import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  boardActivities,
  boards,
  cardActivities,
  cards,
  users,
  workspaceMembers,
} from "@kan/db/schema";

import {
  createTestDb,
  seedTestData,
} from "../../../../../packages/api/integration-tests/test-db";
import { validRedirectUri } from "./config";
import { createMcpServer, publicResult } from "./server";

vi.mock("@kan/auth/server", () => ({ initAuth: () => ({ api: {} }) }));

describe("MCP tools", () => {
  it("preserves GUI automation and attribution, limits tools, and enforces membership", async () => {
    const db = await createTestDb();
    const { user, workspace } = await seedTestData(db);
    await db
      .update(users)
      .set({
        shortlistPowerpackActivatedAt: new Date(Date.now() - 1000),
        shortlistPowerpackExpiresAt: new Date(Date.now() + 86_400_000),
      })
      .where(eq(users.id, user.id));
    const server = createMcpServer(db, {
      userId: user.id,
      clientName: "Claude",
    });
    const client = new Client({ name: "Spoofed client", version: "1.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const call = async (name: string, args: Record<string, unknown> = {}) =>
      client.callTool({ name, arguments: args });
    const json = (result: Awaited<ReturnType<typeof call>>) =>
      JSON.parse(
        (result.content as { text: string }[])[0]?.text ?? "null",
      ) as Record<string, unknown>;
    try {
      const tools = (await client.listTools()).tools.map((tool) => tool.name);
      expect(tools).not.toContain("delete_shortlist");
      expect(
        tools.some((name) => /column|magic|attachment|inbox/.test(name)),
      ).toBe(false);
      const created = json(
        await call("create_shortlist", {
          workspacePublicId: workspace.publicId,
          name: "MCP shortlist",
        }),
      );
      expect(created.publicId).toBeTypeOf("string");
      const boardPublicId = created.publicId as string;
      const board = json(await call("get_shortlist", { boardPublicId }));
      const columns = board.lists as { publicId: string }[];
      expect(columns).toHaveLength(8);
      const [saved, applied] = columns;
      if (!saved || !applied) throw new Error("Expected standard columns");
      expect(await db.select().from(boardActivities)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            actorClientName: "Claude",
            type: "board.created",
          }),
        ]),
      );
      const opportunity = json(
        await call("create_opportunity", {
          listPublicId: saved.publicId,
          title: "Engineer",
          shortlistCompanyName: "Acme",
          shortlistSalaryMin: 100_000,
          shortlistSalaryCurrency: "USD",
        }),
      );
      const cardPublicId = opportunity.publicId as string;
      expect(await db.select().from(cards)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            publicId: cardPublicId,
            shortlistSalaryMin: 100_000,
          }),
        ]),
      );
      expect(await db.select().from(cards)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            publicId: cardPublicId,
            shortlistDataFetchNeeded: true,
            shortlistDataFetchRequestedBy: user.id,
          }),
        ]),
      );
      const activities = await db.select().from(cardActivities);
      expect(
        activities.find((item) => item.type === "card.created")
          ?.actorClientName,
      ).toBe("Claude");
      expect(
        (
          await call("update_opportunity", {
            cardPublicId,
            listPublicId: applied.publicId,
          })
        ).isError,
      ).not.toBe(true);
      expect(
        (await call("rename_shortlist", { boardPublicId, name: "Renamed" }))
          .isError,
      ).not.toBe(true);
      expect(await db.select().from(boardActivities)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "board.renamed",
            actorClientName: "Claude",
          }),
        ]),
      );
      // Hidden parameters cannot widen the allowlisted board operation.
      expect(
        (
          await call("rename_shortlist", {
            boardPublicId,
            name: "Unsafe",
            visibility: "public",
          })
        ).isError,
      ).toBe(true);
      await db
        .update(workspaceMembers)
        .set({ status: "paused" })
        .where(eq(workspaceMembers.userId, user.id));
      expect(
        (await call("update_opportunity", { cardPublicId, title: "Denied" }))
          .isError,
      ).toBe(true);
      expect((await call("get_opportunity", { cardPublicId })).isError).toBe(
        true,
      );
      await db
        .update(workspaceMembers)
        .set({ status: "active" })
        .where(eq(workspaceMembers.userId, user.id));
      await db
        .update(boards)
        .set({ deletedAt: new Date() })
        .where(eq(boards.publicId, boardPublicId));
      expect((await call("get_shortlist", { boardPublicId })).isError).toBe(
        true,
      );
      expect(
        (
          await call("create_opportunity", {
            title: "Deleted shortlist",
            listPublicId: saved.publicId,
          })
        ).isError,
      ).toBe(true);
      expect((await call("get_opportunity", { cardPublicId })).isError).toBe(
        true,
      );
      await db
        .update(users)
        .set({ shortlistPowerpackExpiresAt: new Date(0) })
        .where(eq(users.id, user.id));
      expect((await call("list_workspaces")).isError).not.toBe(true);
    } finally {
      await client.close();
      await server.close();
      await (db.$client as unknown as { close(): Promise<void> }).close();
    }
  }, 30_000);

  it.each(["free", "expired Powerpack"])(
    "supports reads and writes for an account with %s access without enabling paid enrichment",
    async (plan) => {
      const db = await createTestDb();
      const { user, workspace } = await seedTestData(db);
      if (plan === "expired Powerpack")
        await db
          .update(users)
          .set({
            shortlistPowerpackActivatedAt: new Date(0),
            shortlistPowerpackExpiresAt: new Date(1),
          })
          .where(eq(users.id, user.id));
      const server = createMcpServer(db, {
        userId: user.id,
        clientName: "ChatGPT",
      });
      const client = new Client({ name: "Test client", version: "1.0.0" });
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const call = async (name: string, args: Record<string, unknown> = {}) => {
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError).not.toBe(true);
        return JSON.parse(
          (result.content as { text: string }[])[0]?.text ?? "null",
        ) as Record<string, unknown>;
      };
      try {
        await call("list_workspaces");
        const shortlist = await call("create_shortlist", {
          workspacePublicId: workspace.publicId,
          name: "My shortlist",
        });
        const boardPublicId = shortlist.publicId as string;
        const board = await call("get_shortlist", { boardPublicId });
        const columns = board.lists as { publicId: string }[];
        expect(columns).toHaveLength(8);
        const [saved, applied] = columns;
        if (!saved || !applied) throw new Error("Expected standard columns");
        // Retained shortlist settings must not bypass Powerpack eligibility.
        await db
          .update(boards)
          .set({
            shortlistIsSalaryDataEnabled: true,
            shortlistIsCompanySentimentEnabled: true,
          })
          .where(eq(boards.publicId, boardPublicId));
        const opportunity = await call("create_opportunity", {
          listPublicId: saved.publicId,
          title: "Engineer",
          shortlistCompanyName: "Acme",
          shortlistSalaryMin: 100_000,
        });
        const cardPublicId = opportunity.publicId as string;
        await call("update_opportunity", {
          cardPublicId,
          title: "Senior Engineer",
          listPublicId: applied.publicId,
        });
        expect(await call("get_opportunity", { cardPublicId })).toMatchObject({
          title: "Senior Engineer",
          shortlistSalaryMin: 100_000,
        });
        await call("rename_shortlist", { boardPublicId, name: "Renamed" });
        expect(await db.select().from(cards)).toEqual([
          expect.objectContaining({
            publicId: cardPublicId,
            shortlistDataFetchNeeded: false,
            shortlistDataFetchRequestedBy: null,
          }),
        ]);
        expect(await db.select().from(cardActivities)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "card.created",
              actorClientName: "ChatGPT",
              createdBy: user.id,
            }),
          ]),
        );
        await call("delete_opportunity", { cardPublicId });
        const [deleted] = await db
          .select({ deletedAt: cards.deletedAt })
          .from(cards);
        expect(deleted?.deletedAt).toBeInstanceOf(Date);
      } finally {
        await client.close();
        await server.close();
        await (db.$client as unknown as { close(): Promise<void> }).close();
      }
    },
    30_000,
  );

  it("removes internal identifiers recursively and validates callback schemes", () => {
    expect(
      publicResult({
        id: 1,
        publicId: "abcdefgh1234",
        userId: "private",
        items: [{ listId: 2, publicId: "abcd12345678" }],
      }),
    ).toEqual({
      publicId: "abcdefgh1234",
      items: [{ publicId: "abcd12345678" }],
    });
    expect(validRedirectUri("https://client.example/callback")).toBe(true);
    expect(validRedirectUri("http://127.0.0.1:8080/callback")).toBe(true);
    for (const uri of [
      "javascript:alert(1)",
      "http://external.example/callback",
      "https://client.example/#fragment",
      "https://user:pass@client.example/",
    ])
      expect(validRedirectUri(uri)).toBe(false);
  });
});
