import { timingSafeEqual } from "node:crypto";
import type { z } from "zod";

import { hashMcpSecret } from "@kan/db/repository/mcp.repo";

import type { authorizationSchema } from "./authorization";
import { mcpUrls } from "./config";

export function consentCookieName(
  input: z.infer<typeof authorizationSchema>,
  userId: string,
) {
  const request = [
    userId,
    input.client_id,
    input.redirect_uri,
    input.code_challenge,
    input.resource,
    input.state ?? "",
    input.scope ?? "",
  ];
  return `shortlistos_mcp_consent_${hashMcpSecret(JSON.stringify(request)).slice(0, 24)}`;
}

export function consentCookie(name: string, value: string, clear = false) {
  return `${name}=${clear ? "" : value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : 600}${mcpUrls().origin.startsWith("https:") ? "; Secure" : ""}`;
}

export const isConsentSecret = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export function matchesConsentSecret(cookie: unknown, csrf: unknown) {
  return (
    isConsentSecret(cookie) &&
    isConsentSecret(csrf) &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(csrf))
  );
}
