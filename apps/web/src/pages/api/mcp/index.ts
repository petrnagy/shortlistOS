import type { NextApiRequest, NextApiResponse } from "next";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { withRateLimit } from "@kan/api/utils/rateLimit";
import { createDrizzleClient } from "@kan/db/client";
import * as mcpRepo from "@kan/db/repository/mcp.repo";
import { createLogger } from "@kan/logger";

import { MCP_SCOPE, mcpUrls } from "~/server/mcp/config";
import { createMcpServer } from "~/server/mcp/server";

const db = createDrizzleClient();
const logger = createLogger("mcp-http");
async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id",
  );
  res.setHeader(
    "Access-Control-Expose-Headers",
    "WWW-Authenticate, MCP-Protocol-Version",
  );
  if (req.method === "OPTIONS") return res.status(204).end();
  const token = req.headers.authorization?.match(
    /^Bearer ([A-Za-z0-9_-]{43})$/,
  )?.[1];
  const connection = token ? await mcpRepo.getConnection(db, token) : undefined;
  if (!connection) {
    res.setHeader(
      "WWW-Authenticate",
      `Bearer resource_metadata="${mcpUrls().metadata}", scope="${MCP_SCOPE}"`,
    );
    return res.status(401).json({ error: "invalid_token" });
  }
  if (req.headers.origin) {
    const client = await mcpRepo.getClient(db, connection.clientId);
    const origins =
      client?.redirectUris.map((uri) => new URL(uri).origin) ?? [];
    if (
      req.headers.origin !== mcpUrls().origin &&
      !origins.includes(req.headers.origin)
    )
      return res.status(403).json({ error: "invalid_origin" });
  }
  try {
    await mcpRepo.requirePowerpack(db, connection.userId);
  } catch {
    return res.status(403).json({ error: "powerpack_required" });
  }
  // Stateless transport: requests remain portable across replicas and restarts.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  const server = createMcpServer(db, connection);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    logger.error("MCP transport request failed");
    if (!res.headersSent) res.status(500).json({ error: "server_error" });
  } finally {
    await server.close();
  }
}
export default withRateLimit(
  { keyPrefix: "mcp", points: 100, duration: 60 },
  handler,
);
export const config = {
  api: { bodyParser: { sizeLimit: "128kb" }, responseLimit: "8mb" },
};
