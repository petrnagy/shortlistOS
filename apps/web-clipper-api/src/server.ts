/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { createServer } from "node:http";
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { z } from "zod";

import type { dbClient } from "@kan/db/client";
import { initAuth } from "@kan/auth/server";
import { createDrizzleClient } from "@kan/db/client";
import { createLogger } from "@kan/logger";

import { config, WEB_CLIPPER_CLIENT_ID } from "./config";
import { webClipperStrings } from "./dictionary";
import {
  authorizationCodeTokenSchema,
  createClipSchema,
  createPairingSchema,
  pairingIdSchema,
  refreshTokenSchema,
  revokeSchema,
} from "./schemas";
import {
  hashSecret,
  issueAccessToken,
  randomToken,
  verifyAccessToken,
  verifySecretHash,
} from "./security";
import {
  createClip,
  createPairing,
  decidePairing,
  exchangeAuthorizationCode,
  getAvailableBoard,
  getBootstrap,
  getClipStatus,
  getPairingForApproval,
  getUserById,
  pollPairing,
  revokeRefreshTokenFamily,
  rotateRefreshToken,
} from "./store";

const logger = createLogger("web-clipper-api");
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const MAX_JSON_BODY_BYTES = 5 * 1024 * 1024;
const PAIRING_CSRF_COOKIE = "shortlistos_web_clipper_pairing_csrf";
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

interface ApiError {
  error: string;
  errorDescription?: string;
}

const nodeHeadersToWebHeaders = (headers: IncomingHttpHeaders) => {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) result.append(name, item);
    } else if (value !== undefined) {
      result.set(name, value);
    }
  }
  return result;
};

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    "Content-Type": JSON_CONTENT_TYPE,
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const sendError = (
  response: ServerResponse,
  status: number,
  error: string,
  errorDescription?: string,
) => {
  const body: ApiError = { error };
  if (errorDescription) body.errorDescription = errorDescription;
  sendJson(response, status, body);
};

const readBody = async (request: IncomingMessage, limit: number) => {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > limit) {
      tooLarge = true;
    } else if (!tooLarge) {
      chunks.push(buffer);
    }
  }
  if (tooLarge) {
    throw new z.ZodError([
      {
        code: "custom",
        path: [],
        message: "PAYLOAD_TOO_LARGE",
      },
    ]);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const readJson = async (request: IncomingMessage, limit = 64 * 1024) =>
  JSON.parse(await readBody(request, limit)) as unknown;

const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPE_MAP[character] ?? character,
  );

const translateScope = (scope: string) =>
  (webClipperStrings.scopes as Readonly<Record<string, string>>)[scope] ??
  scope;

const renderPaperGrainBackground =
  () => `<div class="paper-grain" aria-hidden="true">
  <div class="paper-grain-gradient"></div>
  <svg preserveAspectRatio="none">
    <filter id="paper-grain-noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="5" stitchTiles="stitch"></feTurbulence>
      <feColorMatrix type="saturate" values="0"></feColorMatrix>
      <feComponentTransfer><feFuncR type="linear" slope="2" intercept="-0.45"></feFuncR><feFuncG type="linear" slope="2" intercept="-0.45"></feFuncG><feFuncB type="linear" slope="2" intercept="-0.45"></feFuncB></feComponentTransfer>
    </filter>
    <rect class="paper-grain-multiply" width="100%" height="100%" fill="#6f6248" filter="url(#paper-grain-noise)"></rect>
    <rect class="paper-grain-overlay" width="100%" height="100%" fill="#fffaf0" filter="url(#paper-grain-noise)"></rect>
    <rect class="paper-grain-dark" width="100%" height="100%" fill="#ffffff" filter="url(#paper-grain-noise)"></rect>
  </svg>
</div>`;

const paperGrainStyles = `
    .paper-grain { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; background: linear-gradient(180deg, rgba(255, 255, 255, .45) 0%, rgba(246, 244, 239, .25) 100%), #faf9f6; }
    .paper-grain-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255, 255, 255, .45) 0%, rgba(246, 244, 239, .25) 100%); }
    .paper-grain svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .paper-grain-multiply { opacity: .28; mix-blend-mode: multiply; }
    .paper-grain-overlay { opacity: .2; mix-blend-mode: overlay; }
    .paper-grain-dark { display: none; opacity: .16; mix-blend-mode: overlay; }
    @media (prefers-color-scheme: dark) { .paper-grain { background: #171717; } .paper-grain::after { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, .85); } .paper-grain-dark { display: block; } }
`;

const getCookie = (request: IncomingMessage, name: string) => {
  const cookies = request.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return cookie.slice(separator + 1).trim();
    }
  }
  return null;
};

const pairingCsrfCookie = (value: string, clear = false) =>
  [
    `${PAIRING_CSRF_COOKIE}=${clear ? "" : value}`,
    "Path=/web-clipper/connect",
    "HttpOnly",
    "SameSite=Lax",
    config.NODE_ENV === "production" ? "Secure" : null,
    clear ? "Max-Age=0" : "Max-Age=600",
  ]
    .filter(Boolean)
    .join("; ");

const isAllowedExtensionOrigin = (origin: string) => {
  if (config.allowedOrigins.has(origin)) return true;
  if (config.NODE_ENV !== "development") return false;
  try {
    const protocol = new URL(origin).protocol;
    return protocol === "chrome-extension:" || protocol === "moz-extension:";
  } catch {
    return false;
  }
};

const applyCors = (request: IncomingMessage, response: ServerResponse) => {
  const origin = request.headers.origin;
  if (!origin || !isAllowedExtensionOrigin(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Cache-Control",
  );
  response.setHeader("Access-Control-Max-Age", "600");
  return true;
};

const isRateLimited = (
  request: IncomingMessage,
  route: string,
  limit: number,
) => {
  const forwarded = request.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0] ??
    request.socket.remoteAddress ??
    "unknown";
  const key = `${route}:${ip}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
};

const getBearerClaims = async (
  request: IncomingMessage,
  requiredScopes: string[],
) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const claims = await verifyAccessToken(authorization.slice(7));
    const grantedScopes = new Set<string>(claims.scopes);
    if (!requiredScopes.every((scope) => grantedScopes.has(scope))) {
      return { claims, forbidden: true as const };
    }
    return { claims, forbidden: false as const };
  } catch {
    return null;
  }
};

const requireAccess = async (
  request: IncomingMessage,
  response: ServerResponse,
  requiredScopes: string[],
) => {
  const authentication = await getBearerClaims(request, requiredScopes);
  if (!authentication) {
    sendError(response, 401, "invalid_token");
    return null;
  }
  if (authentication.forbidden) {
    sendError(response, 403, "insufficient_scope");
    return null;
  }
  return authentication.claims;
};

const tokenResponse = async (
  result: {
    user: { id: string; email: string };
    scopes: string[];
    refreshToken: string;
  },
  response: ServerResponse,
) => {
  const access = await issueAccessToken(result.user.id, result.scopes);
  sendJson(response, 200, {
    accessToken: access.token,
    refreshToken: result.refreshToken,
    accessTokenExpiresAt: access.expiresAt.toISOString(),
    userId: result.user.id,
    email: result.user.email,
  });
};

const renderConsent = (
  response: ServerResponse,
  userEmail: string,
  pairingId: string,
  csrfToken: string,
  scopes: string[],
) => {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(webClipperStrings.consent.pageTitle)}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f7f5;
      color: #171717;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      position: relative;
      background: #faf9f6;
    }
    ${paperGrainStyles}
    main {
      position: relative;
      z-index: 1;
      width: min(29rem, 100%);
      padding: 2rem;
      border: 1px solid #deded9;
      border-radius: .75rem;
      background: rgba(255, 255, 255, .96);
      box-shadow: 0 18px 45px rgba(23, 23, 23, .08);
    }
    .brand {
      margin: 0 0 1.75rem;
      font-size: 1rem;
      font-weight: 750;
      letter-spacing: -.025em;
    }
    h1 {
      margin: 0;
      font-size: 1.625rem;
      line-height: 1.2;
      letter-spacing: -.035em;
    }
    .description {
      margin: .75rem 0 1.5rem;
      color: #66665f;
      font-size: .9375rem;
      line-height: 1.6;
    }
    .account {
      display: flex;
      align-items: center;
      gap: .65rem;
      margin: 0;
      padding: .8rem .9rem;
      border: 1px solid #e5e5e0;
      border-radius: .5rem;
      background: #f7f7f5;
      color: #3f3f3b;
      font-size: .875rem;
    }
    .account::before {
      content: "";
      width: .5rem;
      height: .5rem;
      flex: 0 0 auto;
      border-radius: 999px;
      background: #22a06b;
      box-shadow: 0 0 0 3px rgba(34, 160, 107, .12);
    }
    .actions { display: flex; gap: .625rem; margin-top: 1.5rem; }
    button {
      min-height: 2.75rem;
      flex: 1;
      border: 1px solid transparent;
      border-radius: .5rem;
      padding: .7rem 1rem;
      font: inherit;
      font-size: .875rem;
      font-weight: 700;
      cursor: pointer;
      transition: background-color .15s ease, border-color .15s ease, transform .15s ease;
    }
    button:active { transform: translateY(1px); }
    button:focus-visible { outline: 2px solid #171717; outline-offset: 2px; }
    .approve { background: #171717; color: #fff; }
    .approve:hover { background: #30302d; }
    .deny { border-color: #deded9; background: #fff; color: #3f3f3b; }
    .deny:hover { background: #f2f2ef; }
    .privacy {
      margin: 1.25rem 0 0;
      color: #85857e;
      font-size: .75rem;
      line-height: 1.5;
      text-align: center;
    }
    @media (max-width: 32rem) {
      main { padding: 1.5rem; }
      .actions { flex-direction: column-reverse; }
    }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; background: #171717; color: #f5f5f3; }
      body {
        background-color: #171717;
      }
      main { border-color: #3b3b38; background: rgba(32, 32, 30, .97); box-shadow: 0 18px 50px rgba(0, 0, 0, .3); }
      .description { color: #b7b7b0; }
      .account { border-color: #41413d; background: #292927; color: #deded8; }
      .approve { background: #f4f4f1; color: #171717; }
      .approve:hover { background: #dfdfda; }
      .deny { border-color: #41413d; background: #292927; color: #deded8; }
      .deny:hover { background: #353532; }
      button:focus-visible { outline-color: #f4f4f1; }
    }
  </style>
</head>
<body>
  ${renderPaperGrainBackground()}
  <main>
    <p class="brand">${escapeHtml(webClipperStrings.brand)}</p>
    <h1>${escapeHtml(webClipperStrings.consent.heading)}</h1>
    <p class="description">${escapeHtml(webClipperStrings.consent.description)} ${escapeHtml(scopes.map(translateScope).join(", "))}.</p>
    <p class="account">${escapeHtml(webClipperStrings.consent.signedInAs)} ${escapeHtml(userEmail)}</p>
    <form method="post" action="/web-clipper/connect">
      <input type="hidden" name="pairing_id" value="${escapeHtml(pairingId)}">
      <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
      <div class="actions">
        <button class="deny" name="decision" value="deny">${escapeHtml(webClipperStrings.consent.cancel)}</button>
        <button class="approve" name="decision" value="approve">${escapeHtml(webClipperStrings.consent.allow)}</button>
      </div>
    </form>
    <p class="privacy">${escapeHtml(webClipperStrings.consent.privacy)}</p>
  </main>
</body>
</html>`);
};

const renderCompletion = (response: ServerResponse, approved: boolean) => {
  const nonce = randomToken();
  const pageTitle = approved
    ? webClipperStrings.completion.approvedPageTitle
    : webClipperStrings.completion.deniedPageTitle;
  const heading = approved
    ? webClipperStrings.completion.approvedHeading
    : webClipperStrings.completion.deniedHeading;
  const description = approved
    ? webClipperStrings.completion.approvedDescription
    : webClipperStrings.completion.deniedDescription;
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'`,
  });
  response.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7f7f5; color: #171717; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; position: relative; background: #faf9f6; }
    ${paperGrainStyles}
    main { position: relative; z-index: 1; width: min(29rem, 100%); padding: 2rem; border: 1px solid #deded9; border-radius: .75rem; background: rgba(255, 255, 255, .96); box-shadow: 0 18px 45px rgba(23, 23, 23, .08); text-align: center; }
    .brand { margin: 0 0 1.75rem; font-size: 1rem; font-weight: 750; letter-spacing: -.025em; text-align: left; }
    .status { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; margin: 0 auto 1rem; border-radius: 999px; background: ${approved ? "#e7f7f0" : "#f2f2ef"}; color: ${approved ? "#16794f" : "#66665f"}; font-size: 1.25rem; font-weight: 800; }
    h1 { margin: 0; font-size: 1.625rem; line-height: 1.2; letter-spacing: -.035em; }
    .description { margin: .75rem 0 1.5rem; color: #66665f; font-size: .9375rem; line-height: 1.6; }
    .close { display: inline-flex; min-height: 2.75rem; align-items: center; justify-content: center; border-radius: .5rem; padding: .7rem 1.25rem; background: #171717; color: #fff; font-size: .875rem; font-weight: 700; text-decoration: none; transition: background-color .15s ease, transform .15s ease; }
    .close:hover { background: #30302d; }
    .close:active { transform: translateY(1px); }
    .close:focus-visible { outline: 2px solid #171717; outline-offset: 2px; }
    .fallback { margin: 1.25rem 0 0; color: #85857e; font-size: .75rem; line-height: 1.5; }
    @media (max-width: 32rem) { main { padding: 1.5rem; } }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; background: #171717; color: #f5f5f3; }
      body { background-color: #171717; }
      main { border-color: #3b3b38; background: rgba(32, 32, 30, .97); box-shadow: 0 18px 50px rgba(0, 0, 0, .3); }
      .description { color: #b7b7b0; }
      .status { background: ${approved ? "#173d2f" : "#292927"}; color: ${approved ? "#7de0b5" : "#b7b7b0"}; }
      .close { background: #f4f4f1; color: #171717; }
      .close:hover { background: #dfdfda; }
      .close:focus-visible { outline-color: #f4f4f1; }
    }
</style>
</head>
<body>
  ${renderPaperGrainBackground()}
  <main>
    <p class="brand">${escapeHtml(webClipperStrings.brand)}</p>
    <div class="status" aria-hidden="true">${approved ? "✓" : "—"}</div>
    <h1>${escapeHtml(heading)}</h1>
    <p class="description">${escapeHtml(description)}</p>
    <a class="close" id="close-tab" href="#">${escapeHtml(webClipperStrings.completion.closeTab)}</a>
    <p class="fallback">${escapeHtml(webClipperStrings.completion.closeFallback)}</p>
  </main>
  <script nonce="${nonce}">document.getElementById("close-tab").addEventListener("click",function(event){event.preventDefault();window.close();});</script>
</body>
</html>`);
};

export const createWebClipperServer = (database?: dbClient) => {
  const db = database ?? createDrizzleClient();
  const auth = initAuth(db);

  // Node's request listener intentionally owns the lifetime of this async handler.
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return createServer(async (request, response) => {
    const startedAt = Date.now();
    const requestUrl = new URL(request.url ?? "/", config.NEXT_PUBLIC_BASE_URL);

    try {
      if (
        config.NODE_ENV === "production" &&
        request.headers["x-forwarded-proto"] !== "https"
      ) {
        return sendError(response, 400, "https_required");
      }

      if (requestUrl.pathname.startsWith("/api/web-clipper/")) {
        const origin = request.headers.origin;
        const originAllowed = applyCors(request, response);
        if (origin && !originAllowed) {
          return sendError(response, 403, "origin_not_allowed");
        }
        if (request.method === "OPTIONS") {
          if (
            !request.headers.origin ||
            !isAllowedExtensionOrigin(request.headers.origin)
          ) {
            return sendError(response, 403, "origin_not_allowed");
          }
          response.writeHead(204);
          return response.end();
        }
      }

      if (requestUrl.pathname === "/api/web-clipper/pairings") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return sendError(response, 405, "method_not_allowed");
        }
        if (isRateLimited(request, "create-pairing", 10)) {
          response.setHeader("Retry-After", "60");
          return sendError(response, 429, "rate_limited");
        }
        const parsed = createPairingSchema.safeParse(await readJson(request));
        if (!parsed.success) return sendError(response, 400, "invalid_request");
        const pairing = await createPairing(db, {
          codeChallenge: parsed.data.codeChallenge,
          scopes: parsed.data.scopes,
          extensionVersion: parsed.data.client.extensionVersion,
          browser: parsed.data.client.browser,
        });
        return sendJson(response, 201, {
          pairingId: pairing.pairingId,
          pollToken: pairing.pollToken,
          authorizationUrl: new URL(
            `/web-clipper/connect?pairing_id=${encodeURIComponent(pairing.pairingId)}`,
            config.NEXT_PUBLIC_BASE_URL,
          ).toString(),
          expiresAt: pairing.expiresAt.toISOString(),
          pollIntervalMs: 2000,
        });
      }

      const pairingPollMatch = /^\/api\/web-clipper\/pairings\/([^/]+)$/.exec(
        requestUrl.pathname,
      );
      if (pairingPollMatch) {
        if (request.method !== "GET") {
          response.setHeader("Allow", "GET");
          return sendError(response, 405, "method_not_allowed");
        }
        if (isRateLimited(request, "poll-pairing", 60)) {
          response.setHeader("Retry-After", "2");
          return sendError(response, 429, "rate_limited");
        }
        const pairingId = pairingIdSchema.safeParse(pairingPollMatch[1]);
        const authorization = request.headers.authorization;
        if (!pairingId.success || !authorization?.startsWith("Bearer ")) {
          return sendError(response, 404, "not_found");
        }
        const result = await pollPairing(
          db,
          pairingId.data,
          authorization.slice(7),
        );
        if (!result) return sendError(response, 404, "not_found");
        return sendJson(response, 200, result);
      }

      if (requestUrl.pathname === "/web-clipper/connect") {
        if (!["GET", "POST"].includes(request.method ?? "")) {
          response.setHeader("Allow", "GET, POST");
          return sendError(response, 405, "method_not_allowed");
        }
        if (isRateLimited(request, "pairing-approval", 30)) {
          response.setHeader("Retry-After", "60");
          return sendError(response, 429, "rate_limited");
        }

        const session = await auth.api.getSession({
          headers: nodeHeadersToWebHeaders(request.headers),
        });
        if (!session?.user.id) {
          if (request.method !== "GET") {
            return sendError(response, 401, "authentication_required");
          }
          const next = `${requestUrl.pathname}${requestUrl.search}`;
          response.writeHead(302, {
            Location: `/login?next=${encodeURIComponent(next)}`,
            "Cache-Control": "no-store",
          });
          return response.end();
        }

        if (request.method === "GET") {
          const pairingId = pairingIdSchema.safeParse(
            requestUrl.searchParams.get("pairing_id"),
          );
          if (!pairingId.success) return sendError(response, 404, "not_found");
          const pairing = await getPairingForApproval(db, pairingId.data);
          if (!pairing) return sendError(response, 404, "not_found");
          const csrfToken = randomToken();
          response.setHeader("Set-Cookie", pairingCsrfCookie(csrfToken));
          return renderConsent(
            response,
            session.user.email,
            pairing.id,
            csrfToken,
            pairing.scopes,
          );
        }

        const form = new URLSearchParams(await readBody(request, 4096));
        const pairingId = pairingIdSchema.safeParse(form.get("pairing_id"));
        const csrfToken = form.get("csrf_token");
        const csrfCookie = getCookie(request, PAIRING_CSRF_COOKIE);
        if (
          !pairingId.success ||
          !csrfToken ||
          !csrfCookie ||
          !verifySecretHash(csrfToken, hashSecret(csrfCookie))
        ) {
          return sendError(response, 403, "invalid_csrf_token");
        }
        const approved = form.get("decision") === "approve";
        if (
          !(await decidePairing(db, {
            pairingId: pairingId.data,
            userId: session.user.id,
            approved,
          }))
        ) {
          return sendError(response, 400, "invalid_request");
        }
        response.setHeader("Set-Cookie", pairingCsrfCookie("", true));
        return renderCompletion(response, approved);
      }

      if (requestUrl.pathname === "/api/web-clipper/oauth/token") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return sendError(response, 405, "method_not_allowed");
        }
        if (isRateLimited(request, "token", 30)) {
          response.setHeader("Retry-After", "60");
          return sendError(response, 429, "rate_limited");
        }
        const body = await readJson(request);
        if (
          typeof body !== "object" ||
          body === null ||
          !("grant_type" in body)
        ) {
          return sendError(response, 400, "invalid_request");
        }
        if (
          !("client_id" in body) ||
          body.client_id !== WEB_CLIPPER_CLIENT_ID
        ) {
          return sendError(response, 401, "invalid_client");
        }
        if (body.grant_type === "authorization_code") {
          const parsed = authorizationCodeTokenSchema.safeParse(body);
          if (!parsed.success)
            return sendError(response, 400, "invalid_request");
          const result = await exchangeAuthorizationCode(db, {
            code: parsed.data.code,
            codeVerifier: parsed.data.code_verifier,
          });
          if (!result) return sendError(response, 401, "invalid_grant");
          return tokenResponse(result, response);
        }
        if (body.grant_type === "refresh_token") {
          const parsed = refreshTokenSchema.safeParse(body);
          if (!parsed.success)
            return sendError(response, 400, "invalid_request");
          const result = await rotateRefreshToken(
            db,
            parsed.data.refresh_token,
          );
          if (!result) return sendError(response, 401, "invalid_grant");
          return tokenResponse(result, response);
        }
        return sendError(response, 400, "unsupported_grant_type");
      }

      if (requestUrl.pathname === "/api/web-clipper/oauth/revoke") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return sendError(response, 405, "method_not_allowed");
        }
        const body = await readJson(request);
        if (
          typeof body !== "object" ||
          body === null ||
          !("client_id" in body) ||
          body.client_id !== WEB_CLIPPER_CLIENT_ID
        ) {
          return sendError(response, 401, "invalid_client");
        }
        const parsed = revokeSchema.safeParse(body);
        if (!parsed.success) return sendError(response, 400, "invalid_request");
        await revokeRefreshTokenFamily(db, parsed.data.token);
        response.writeHead(204, { "Cache-Control": "no-store" });
        return response.end();
      }

      if (requestUrl.pathname === "/api/web-clipper/bootstrap") {
        if (request.method !== "GET") {
          response.setHeader("Allow", "GET");
          return sendError(response, 405, "method_not_allowed");
        }
        const claims = await requireAccess(request, response, [
          "profile:read",
          "boards:read",
        ]);
        if (!claims) return;
        const bootstrap = await getBootstrap(db, claims.sub);
        if (!bootstrap) return sendError(response, 401, "invalid_token");
        return sendJson(response, 200, bootstrap);
      }

      if (requestUrl.pathname === "/api/web-clipper/clips") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return sendError(response, 405, "method_not_allowed");
        }
        if (isRateLimited(request, "create-clip", 20)) {
          response.setHeader("Retry-After", "60");
          return sendError(response, 429, "RATE_LIMITED");
        }
        const claims = await requireAccess(request, response, ["clips:create"]);
        if (!claims) return;
        let parsedBody: z.SafeParseReturnType<
          unknown,
          z.infer<typeof createClipSchema>
        >;
        try {
          parsedBody = createClipSchema.safeParse(
            await readJson(request, MAX_JSON_BODY_BYTES),
          );
        } catch (error) {
          if (
            error instanceof z.ZodError &&
            error.issues[0]?.message === "PAYLOAD_TOO_LARGE"
          ) {
            return sendError(response, 413, "PAGE_TOO_LARGE");
          }
          throw error;
        }
        if (!parsedBody.success)
          return sendError(response, 400, "invalid_request");

        const user = await getUserById(db, claims.sub);
        if (
          !user?.shortlistPowerpackExpiresAt ||
          user.shortlistPowerpackExpiresAt <= new Date()
        ) {
          return sendError(response, 403, "POWERPACK_REQUIRED");
        }
        const board = await getAvailableBoard(
          db,
          claims.sub,
          parsedBody.data.boardId,
        );
        if (!board) return sendError(response, 404, "BOARD_NOT_FOUND");
        const clip = await createClip(db, {
          userId: claims.sub,
          boardId: board.id,
          boardPublicId: board.publicId,
          page: parsedBody.data.page,
          client: parsedBody.data.client,
        });
        if (clip.deduplicated) {
          logger.info(
            { clipId: clip.id },
            "Reused recent Web Clipper submission",
          );
        }
        return sendJson(response, 202, {
          clipId: clip.id,
          status: clip.status,
        });
      }

      const clipMatch = /^\/api\/web-clipper\/clips\/([^/]+)$/.exec(
        requestUrl.pathname,
      );
      if (clipMatch) {
        if (request.method !== "GET") {
          response.setHeader("Allow", "GET");
          return sendError(response, 405, "method_not_allowed");
        }
        const claims = await requireAccess(request, response, ["clips:read"]);
        if (!claims) return;
        const clipId = z.string().uuid().safeParse(clipMatch[1]);
        if (!clipId.success) return sendError(response, 404, "NOT_FOUND");
        const status = await getClipStatus(db, claims.sub, clipId.data);
        if (!status) return sendError(response, 404, "NOT_FOUND");
        if (["QUEUED", "PROCESSING", "NOT_A_JOB"].includes(status.status)) {
          return sendJson(response, 200, { status: status.status });
        }
        if (status.status === "FAILED") {
          return sendJson(response, 200, {
            status: "FAILED",
            errorCode: status.errorCode ?? "SERVER_ERROR",
          });
        }
        if (!status.cardPublicId || !status.boardName) {
          return sendJson(response, 200, {
            status: "FAILED",
            errorCode: "SERVER_ERROR",
          });
        }
        return sendJson(response, 200, {
          status: status.status,
          cardId: status.cardPublicId,
          cardUrl: new URL(
            `/cards/${status.cardPublicId}`,
            config.NEXT_PUBLIC_BASE_URL,
          ).toString(),
          jobTitle: status.jobTitle,
          companyName: status.companyName,
          boardName: status.boardName,
        });
      }

      return sendError(response, 404, "not_found");
    } catch (error) {
      if (error instanceof SyntaxError && !response.headersSent) {
        return sendError(response, 400, "invalid_request");
      }
      if (
        error instanceof z.ZodError &&
        error.issues[0]?.message === "PAYLOAD_TOO_LARGE" &&
        !response.headersSent
      ) {
        return sendError(response, 413, "PAGE_TOO_LARGE");
      }
      logger.error(
        {
          method: request.method,
          path: requestUrl.pathname,
          durationMs: Date.now() - startedAt,
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : "Unknown error",
        },
        "Web Clipper request failed",
      );
      if (!response.headersSent) sendError(response, 500, "SERVER_ERROR");
      else response.end();
    }
  });
};
