import type { NextApiRequest, NextApiResponse } from "next";
import { t } from "@lingui/core/macro";

import { initAuth } from "@kan/auth/server";
import { createDrizzleClient } from "@kan/db/client";
import { newMcpSecret } from "@kan/db/repository/mcp.repo";
import { renderConnectionConsent } from "@kan/shared/connection-consent";

import { validateAuthorization } from "~/server/mcp/authorization";
import {
  consentCookie,
  consentCookieName,
  isConsentSecret,
} from "~/server/mcp/consent";
import { consentError, setConsentPageHeaders } from "~/server/mcp/consent-page";

const db = createDrizzleClient();
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  setConsentPageHeaders(res, "same-origin");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  try {
    const { client, input } = await validateAuthorization(db, req.query);
    setConsentPageHeaders(res, "same-origin", input.redirect_uri);
    const session = await initAuth(db).api.getSession({
      headers: new Headers({ cookie: req.headers.cookie ?? "" }),
    });
    if (!session) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(input))
        if (typeof value === "string") params.set(key, value);
      return res.redirect(
        302,
        `/login?next=${encodeURIComponent(`/mcp/authorize?${params}`)}`,
      );
    }
    const cookieName = consentCookieName(input, session.user.id);
    const existing: unknown = req.cookies[cookieName];
    const csrf = isConsentSecret(existing) ? existing : newMcpSecret();
    res.setHeader("Set-Cookie", consentCookie(cookieName, csrf));
    const fields: Record<string, string> = { ...input, csrf };
    const clientName = client.name;
    const username = session.user.name || session.user.email;
    return res.status(200).send(
      renderConnectionConsent({
        title: t`Connect to shortlistOS`,
        heading: t`Connect ${clientName}`,
        description: t`Let this AI client work with your opportunities and shortlists.`,
        permissions: [
          t`View, create and rename shortlists.`,
          t`View, create, update, move and delete opportunities, comments and checklists.`,
          t`Columns stay fixed. Magic email and job attachment ingestion are unavailable.`,
        ],
        account: { label: t`Signed in as`, email: session.user.email },
        form: {
          action: "/api/mcp/consent",
          fields,
          cancel: t`Cancel`,
          allow: t`Allow access`,
          allowValue: "allow",
        },
        note: t`Actions are recorded as ${username} via ${clientName}. The client name is supplied by the app.`,
        privacy: t`You can revoke access at any time.`,
        link: { href: "/settings/mcp", label: t`MCP settings` },
      }),
    );
  } catch {
    return consentError(
      res,
      400,
      "invalid_request",
      t`This authorization request is invalid. Start again from your AI client.`,
    );
  }
}
