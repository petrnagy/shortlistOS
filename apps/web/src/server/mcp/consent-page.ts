import "~/utils/i18n";

import type { NextApiResponse } from "next";
import { t } from "@lingui/core/macro";

import { renderConnectionConsent } from "@kan/shared/connection-consent";

export function setConsentPageHeaders(
  res: NextApiResponse,
  policy: "same-origin" | "no-referrer",
  redirectUri?: string,
) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", policy);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Content-Security-Policy",
    // Some browsers check form-action again after the OAuth redirect. Callers
    // supply only the exact redirect URI validated against the registered client.
    `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'${redirectUri ? ` ${new URL(redirectUri).origin}` : ""}; frame-ancestors 'none'; base-uri 'none'`,
  );
}

export function consentError(
  res: NextApiResponse,
  status: number,
  code: string,
  message: string,
) {
  res.setHeader("X-MCP-Consent-Error", code);
  return res.status(status).send(
    renderConnectionConsent({
      title: t`Connect to shortlistOS`,
      heading: t`Unable to authorize`,
      description: message,
      privacy: t`Start again from your AI client to open a fresh authorization page.`,
      link: { href: "/settings/mcp", label: t`MCP settings` },
    }),
  );
}
