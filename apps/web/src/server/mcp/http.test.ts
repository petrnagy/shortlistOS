import { createServer } from "node:http";
import type { NextApiRequest, NextApiResponse } from "next";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import handler from "~/pages/api/mcp";

const mocks = vi.hoisted(() => ({ revoked: false }));
vi.mock("@kan/db/client", () => ({ createDrizzleClient: () => ({}) }));
vi.mock("@kan/db/repository/mcp.repo", () => ({
  getConnection: (_db: unknown, token: string) =>
    token === "a".repeat(43) && !mocks.revoked
      ? { userId: "user", clientName: "Claude", clientId: "client" }
      : undefined,
  getClient: () => ({ redirectUris: ["https://client.example/callback"] }),
}));
vi.mock("@kan/api/utils/rateLimit", () => ({
  withRateLimit: (_options: unknown, callback: unknown) => callback,
}));
vi.mock("~/server/mcp/server", async () => {
  const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  return {
    createMcpServer: () => {
      const server = new McpServer({
        name: "shortlistOS-test",
        version: "1.0.0",
      });
      server.registerTool("ping", { inputSchema: {} }, () => ({
        content: [{ type: "text", text: "pong" }],
      }));
      return server;
    },
  };
});
afterEach(() => {
  mocks.revoked = false;
});

describe("MCP Streamable HTTP", () => {
  it("supports an SDK client across stateless requests and challenges unauthenticated clients", async () => {
    const http = createServer((req, res) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of req)
          chunks.push(Buffer.from(chunk as Uint8Array));
        const request = req as NextApiRequest;
        const body = Buffer.concat(chunks).toString();
        request.body = body ? (JSON.parse(body) as unknown) : undefined;
        const response = res as NextApiResponse;
        response.status = (status: number) => {
          res.statusCode = status;
          return response;
        };
        response.json = (value: unknown) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(value));
          return response;
        };
        await handler(request, response);
      })().catch(() => {
        res.statusCode = 500;
        res.end();
      });
    });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test server address");
    const url = new URL(`http://127.0.0.1:${address.port}/api/mcp`);
    const headers = { Authorization: `Bearer ${"a".repeat(43)}` };
    const client = new Client({
      name: "SDK integration test",
      version: "1.0.0",
    });
    try {
      const unauthorized = await fetch(url);
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get("WWW-Authenticate")).toContain(
        "oauth-protected-resource/api/mcp",
      );
      expect(
        (
          await fetch(url, {
            headers: { ...headers, Origin: "https://evil.example" },
          })
        ).status,
      ).toBe(403);
      await client.connect(
        new StreamableHTTPClientTransport(url, { requestInit: { headers } }),
      );
      expect((await client.listTools()).tools.map((tool) => tool.name)).toEqual(
        ["ping"],
      );
      expect(
        (await client.callTool({ name: "ping", arguments: {} })).content,
      ).toEqual([{ type: "text", text: "pong" }]);
      mocks.revoked = true;
      expect((await fetch(url, { headers })).status).toBe(401);
    } finally {
      await client.close();
      http.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }, 15_000);
});
