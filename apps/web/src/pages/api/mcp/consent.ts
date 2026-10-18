import type { NextApiRequest, NextApiResponse } from "next";
import { t } from "@lingui/core/macro";

import { initAuth } from "@kan/auth/server";
import { createDrizzleClient } from "@kan/db/client";
import * as mcpRepo from "@kan/db/repository/mcp.repo";
import { createLogger } from "@kan/logger";

import { validateAuthorization } from "~/server/mcp/authorization";
import { mcpUrls } from "~/server/mcp/config";
import {
  consentCookie,
  consentCookieName,
  matchesConsentSecret,
} from "~/server/mcp/consent";
import { consentError, setConsentPageHeaders } from "~/server/mcp/consent-page";

const db = createDrizzleClient();
const logger = createLogger("mcp-consent");
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setConsentPageHeaders(res, "no-referrer");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  if (req.headers.origin !== mcpUrls().origin) {
    logger.warn(
      { reason: "invalid_origin", origin: req.headers.origin ?? null },
      "MCP consent rejected",
    );
    return consentError(
      res,
      403,
      "invalid_origin",
      t`This request did not come from shortlistOS. Start again from your AI client.`,
    );
  }
  try {
    const { input } = await validateAuthorization(db, req.body);
    setConsentPageHeaders(res, "no-referrer", input.redirect_uri);
    const session = await initAuth(db).api.getSession({
      headers: new Headers({ cookie: req.headers.cookie ?? "" }),
    });
    if (!session)
      return consentError(
        res,
        401,
        "authentication_required",
        t`Your sign-in has expired. Sign in and start again from your AI client.`,
      );
    const cookieName = consentCookieName(input, session.user.id);
    const csrf: unknown = (req.body as Record<string, unknown> | undefined)
      ?.csrf;
    if (!matchesConsentSecret(req.cookies[cookieName], csrf)) {
      logger.warn(
        {
          reason: "invalid_csrf_token",
          hasCookie: !!req.cookies[cookieName],
          hasToken: typeof csrf === "string",
        },
        "MCP consent rejected",
      );
      return consentError(
        res,
        403,
        "invalid_csrf_token",
        t`This authorization page has expired. Start again from your AI client.`,
      );
    }
    const decision: unknown = (req.body as Record<string, unknown> | undefined)
      ?.decision;
    if (decision !== "allow" && decision !== "deny")
      return consentError(
        res,
        400,
        "invalid_request",
        t`This authorization request is invalid. Start again from your AI client.`,
      );
    const target = new URL(input.redirect_uri);
    target.searchParams.set("iss", mcpUrls().origin);
    if (input.state !== undefined)
      target.searchParams.set("state", input.state);
    if (decision === "deny") target.searchParams.set("error", "access_denied");
    else {
      try {
        await mcpRepo.requirePowerpack(db, session.user.id);
      } catch {
        return consentError(
          res,
          403,
          "powerpack_required",
          t`An active Powerpack is required to connect.`,
        );
      }
      const code = await mcpRepo.issueCode(db, {
        userId: session.user.id,
        clientId: input.client_id,
        redirectUri: input.redirect_uri,
        challenge: input.code_challenge,
        resource: input.resource,
      });
      target.searchParams.set("code", code);
    }
    res.setHeader("Set-Cookie", consentCookie(cookieName, "", true));
    return res.redirect(303, target.toString());
  } catch {
    logger.warn({ reason: "invalid_request" }, "MCP consent rejected");
    return consentError(
      res,
      400,
      "invalid_request",
      t`This authorization request is invalid. Start again from your AI client.`,
    );
  }
}
export const config = { api: { bodyParser: { sizeLimit: "16kb" } } };
