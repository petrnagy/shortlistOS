import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { withRateLimit } from "@kan/api/utils/rateLimit";
import { createDrizzleClient } from "@kan/db/client";
import * as mcpRepo from "@kan/db/repository/mcp.repo";
import { createLogger } from "@kan/logger";

import { MCP_SCOPE, mcpUrls, validRedirectUri } from "~/server/mcp/config";

const logger = createLogger("mcp-oauth");
const db = createDrizzleClient();
const registrationSchema = z.object({
  client_name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(
      (name) =>
        !/[<>]/.test(name) &&
        [...name].every((character) => character.charCodeAt(0) >= 32),
    ),
  redirect_uris: z
    .array(z.string().max(2048).refine(validRedirectUri))
    .min(1)
    .max(10),
  token_endpoint_auth_method: z.literal("none").optional(),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .optional(),
  response_types: z.array(z.literal("code")).optional(),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "invalid_request" });
  try {
    if (req.query.action === "register") {
      const input = registrationSchema.parse(req.body);
      const clientId = await mcpRepo.registerClient(
        db,
        input.client_name,
        input.redirect_uris,
      );
      return res.status(201).json({
        ...input,
        client_id: clientId,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      });
    }
    if (req.query.action !== "token") return res.status(404).end();
    const input = z
      .object({
        grant_type: z.enum(["authorization_code", "refresh_token"]),
        client_id: z.string().min(1).max(64),
        resource: z.literal(mcpUrls().resource),
        code: z.string().max(100).optional(),
        redirect_uri: z.string().max(2048).optional(),
        code_verifier: z
          .string()
          .min(43)
          .max(128)
          .regex(/^[A-Za-z0-9._~-]+$/)
          .optional(),
        refresh_token: z.string().max(100).optional(),
      })
      .parse(req.body);
    const pair =
      input.grant_type === "authorization_code"
        ? await mcpRepo.exchangeCode(db, {
            code: z.string().parse(input.code),
            clientId: input.client_id,
            redirectUri: z.string().parse(input.redirect_uri),
            verifier: z.string().parse(input.code_verifier),
            resource: input.resource,
          })
        : await mcpRepo.refreshTokens(
            db,
            input.client_id,
            z.string().parse(input.refresh_token),
          );
    return res.status(200).json({
      access_token: pair.accessToken,
      refresh_token: pair.refreshToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: MCP_SCOPE,
    });
  } catch (error) {
    if (!(error instanceof z.ZodError))
      logger.warn("MCP OAuth request rejected");
    return res.status(400).json({
      error: error instanceof z.ZodError ? "invalid_request" : "invalid_grant",
    });
  }
}

export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
export default withRateLimit(
  { keyPrefix: "mcp-oauth", points: 30, duration: 60 },
  handler,
);
