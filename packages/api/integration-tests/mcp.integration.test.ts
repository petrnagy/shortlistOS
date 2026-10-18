import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as mcp from "@kan/db/repository/mcp.repo";
import { mcpAuthorizationCodes, mcpConnections, users } from "@kan/db/schema";

import { createTestDb, seedTestData } from "./test-db";

describe("MCP authorization storage", () => {
  it("binds codes to client, redirect, PKCE and resource; rotates tokens and revokes access", async () => {
    const db = await createTestDb();
    try {
      const { user } = await seedTestData(db);
      await db
        .update(users)
        .set({
          shortlistPowerpackActivatedAt: new Date(Date.now() - 1000),
          shortlistPowerpackExpiresAt: new Date(Date.now() + 86_400_000),
        })
        .where(eq(users.id, user.id));
      const clientId = await mcp.registerClient(db, "Claude", [
        "https://client.example/callback",
      ]);
      const verifier = mcp.newMcpSecret();
      const code = await mcp.issueCode(db, {
        userId: user.id,
        clientId,
        redirectUri: "https://client.example/callback",
        challenge: mcp.pkceChallenge(verifier),
        resource: "https://shortlist.example/api/mcp",
      });
      const input = {
        clientId,
        code,
        verifier,
        redirectUri: "https://client.example/callback",
        resource: "https://shortlist.example/api/mcp",
      };
      for (const bad of [
        { verifier: mcp.newMcpSecret() },
        { clientId: "other" },
        { redirectUri: "https://evil.example" },
        { resource: "https://other.example" },
      ]) {
        await expect(
          mcp.exchangeCode(db, { ...input, ...bad }),
        ).rejects.toThrow("Invalid authorization code");
      }
      const tokens = await mcp.exchangeCode(db, input);
      await expect(mcp.exchangeCode(db, input)).rejects.toThrow(
        "Invalid authorization code",
      );
      const stored = await db.select().from(mcpConnections);
      expect(stored[0]?.accessTokenHash).not.toBe(tokens.accessToken);
      expect(stored[0]?.refreshTokenHash).not.toBe(tokens.refreshToken);
      expect(await mcp.getConnection(db, tokens.accessToken)).toMatchObject({
        userId: user.id,
        clientName: "Claude",
      });
      await expect(
        mcp.refreshTokens(db, "wrong-client", tokens.refreshToken),
      ).rejects.toThrow();
      const rotated = await mcp.refreshTokens(
        db,
        clientId,
        tokens.refreshToken,
      );
      expect(await mcp.getConnection(db, tokens.accessToken)).toBeUndefined();
      const connection = (await mcp.listConnections(db, user.id))[0];
      if (!connection) throw new Error("Expected MCP connection");
      await mcp.revokeConnection(db, crypto.randomUUID(), connection.publicId);
      expect(await mcp.getConnection(db, rotated.accessToken)).toBeDefined();
      await mcp.revokeConnection(db, user.id, connection.publicId);
      expect(await mcp.getConnection(db, rotated.accessToken)).toBeUndefined();
      await expect(
        mcp.refreshTokens(db, clientId, rotated.refreshToken),
      ).rejects.toThrow();
      const secondCode = await mcp.issueCode(db, {
        userId: user.id,
        clientId,
        redirectUri: input.redirectUri,
        challenge: mcp.pkceChallenge(verifier),
        resource: input.resource,
      });
      const second = await mcp.exchangeCode(db, { ...input, code: secondCode });
      const latest = await mcp.refreshTokens(db, clientId, second.refreshToken);
      await expect(
        mcp.refreshTokens(db, clientId, second.refreshToken),
      ).rejects.toThrow();
      expect(await mcp.getConnection(db, latest.accessToken)).toBeUndefined();
      await expect(
        mcp.refreshTokens(db, clientId, latest.refreshToken),
      ).rejects.toThrow();
    } finally {
      await (db.$client as unknown as { close(): Promise<void> }).close();
    }
  }, 30_000);

  it("rejects expired codes and Powerpack; keeps connection management available", async () => {
    const db = await createTestDb();
    try {
      const { user } = await seedTestData(db);
      await expect(mcp.requirePowerpack(db, user.id)).rejects.toThrow(
        "Active Powerpack required",
      );
      expect(await mcp.listConnections(db, user.id)).toEqual([]);
      const clientId = await mcp.registerClient(db, "Cursor", [
        "http://127.0.0.1:1234/callback",
      ]);
      const verifier = mcp.newMcpSecret();
      const code = await mcp.issueCode(db, {
        userId: user.id,
        clientId,
        redirectUri: "http://127.0.0.1:1234/callback",
        challenge: mcp.pkceChallenge(verifier),
        resource: "https://shortlist.example/api/mcp",
      });
      await db
        .update(mcpAuthorizationCodes)
        .set({ expiresAt: new Date(0) })
        .where(eq(mcpAuthorizationCodes.codeHash, mcp.hashMcpSecret(code)));
      await expect(
        mcp.exchangeCode(db, {
          code,
          clientId,
          verifier,
          redirectUri: "http://127.0.0.1:1234/callback",
          resource: "https://shortlist.example/api/mcp",
        }),
      ).rejects.toThrow();
    } finally {
      await (db.$client as unknown as { close(): Promise<void> }).close();
    }
  }, 30_000);
});
