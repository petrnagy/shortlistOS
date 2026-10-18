import { z } from "zod";

import type { dbClient } from "@kan/db/client";
import * as mcpRepo from "@kan/db/repository/mcp.repo";

import { mcpUrls, validScope } from "./config";

export const authorizationSchema = z.object({
  client_id: z.string().min(1).max(64),
  redirect_uri: z.string().max(2048),
  response_type: z.literal("code"),
  code_challenge_method: z.literal("S256"),
  code_challenge: z
    .string()
    .length(43)
    .regex(/^[A-Za-z0-9_-]+$/),
  resource: z.string().url(),
  state: z.string().max(2048).optional(),
  scope: z.string().max(200).optional(),
});

export async function validateAuthorization(db: dbClient, value: unknown) {
  const input = authorizationSchema.parse(value);
  if (input.resource !== mcpUrls().resource || !validScope(input.scope))
    throw new Error("Invalid resource or scope");
  const client = await mcpRepo.getClient(db, input.client_id);
  if (!client?.redirectUris.includes(input.redirect_uri))
    throw new Error("Invalid client or redirect URI");
  return { input, client };
}
