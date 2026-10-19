import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import authorize from "~/pages/api/mcp/authorize";
import consent from "~/pages/api/mcp/consent";
import metadata from "~/pages/api/mcp/metadata";
import oauth from "~/pages/api/mcp/oauth/[action]";
import { authorizationSchema } from "./authorization";
import { mcpUrls } from "./config";
import { consentCookieName } from "./consent";

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  issueCode: vi.fn(),
  registerClient: vi.fn(),
  exchangeCode: vi.fn(),
  refreshTokens: vi.fn(),
  getSession: vi.fn(),
  newMcpSecret: vi.fn(),
}));
vi.mock("@kan/db/client", () => ({ createDrizzleClient: () => ({}) }));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce(
      (text, part, index) =>
        text + part + (index < values.length ? String(values[index]) : ""),
      "",
    ),
}));
vi.mock("@kan/db/repository/mcp.repo", async () => {
  const { createHash } = await import("node:crypto");
  return {
    ...mocks,
    hashMcpSecret: (value: string) =>
      createHash("sha256").update(value).digest("hex"),
  };
});
vi.mock("@kan/auth/server", () => ({
  initAuth: () => ({ api: { getSession: mocks.getSession } }),
}));
vi.mock("@kan/api/utils/rateLimit", () => ({
  withRateLimit: (_options: unknown, handler: unknown) => handler,
}));

function response() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
    redirect: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.send.mockReturnValue(res);
  return { res, typed: res as unknown as NextApiResponse };
}
const request = (value: object) => value as NextApiRequest;
const secret = "a".repeat(43);
const authorization = () => ({
  client_id: "client",
  redirect_uri: "https://client.example/callback",
  response_type: "code",
  code_challenge_method: "S256",
  code_challenge: "a".repeat(43),
  resource: mcpUrls().resource,
  state: "opaque-state",
  decision: "allow",
  csrf: secret,
});
function cookiesFor(input = authorization(), userId = "user") {
  return {
    [consentCookieName(authorizationSchema.parse(input), userId)]: secret,
  };
}
function post(body = authorization(), cookies = cookiesFor(body)) {
  return request({
    method: "POST",
    headers: { origin: mcpUrls().origin, cookie: "session=cookie" },
    cookies,
    body,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClient.mockResolvedValue({
    name: "Claude",
    redirectUris: ["https://client.example/callback"],
  });
  mocks.getSession.mockResolvedValue({
    user: {
      id: "user",
      name: "Test User",
      email: "test@example.com",
      shortlistPowerpackActivatedAt: null,
      shortlistPowerpackExpiresAt: null,
    },
  });
  mocks.newMcpSecret.mockReturnValue(secret);
  mocks.issueCode.mockResolvedValue("one-time-code");
});

describe("MCP browser authorization", () => {
  it.each([
    "https://client.example/callback",
    "http://127.0.0.1:62414/callback",
  ])(
    "serves the extension-style form and authorizes its first submission (%s)",
    async (redirectUri) => {
      mocks.getClient.mockResolvedValue({
        name: "Claude",
        redirectUris: [redirectUri],
      });
      const input = { ...authorization(), redirect_uri: redirectUri };
      const { res, typed } = response();
      await authorize(
        request({
          method: "GET",
          headers: { cookie: "session=cookie" },
          cookies: {},
          query: input,
        }),
        typed,
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Referrer-Policy",
        "same-origin",
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Security-Policy",
        expect.stringContaining("default-src 'none'"),
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Security-Policy",
        expect.stringContaining(
          `form-action 'self' ${new URL(redirectUri).origin};`,
        ),
      );
      const html = res.send.mock.calls[0]?.[0] as string;
      expect(html).toContain('<p class="brand">shortlistOS</p>');
      expect(html).toContain(
        '<p class="account">Signed in as test@example.com</p>',
      );
      expect(html).toContain('<form method="post" action="/api/mcp/consent">');
      expect(html).toContain('name="csrf" value="' + secret + '"');
      expect(html).toContain('type="submit" class="approve"');
      expect(html).not.toContain("<script");
      expect(html).not.toContain("__NEXT_DATA__");
      const submitted = response();
      await consent(post(input), submitted.typed);
      expect(submitted.res.redirect).toHaveBeenCalledWith(
        303,
        expect.stringContaining("code=one-time-code"),
      );
      expect(submitted.res.setHeader).toHaveBeenCalledWith(
        "Referrer-Policy",
        "no-referrer",
      );
      expect(submitted.res.setHeader).toHaveBeenCalledWith(
        "Set-Cookie",
        expect.stringContaining("Max-Age=0"),
      );
      expect(mocks.issueCode).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves the displayed token on reload and isolates concurrent authorization tabs", async () => {
    const original = authorization();
    const other = {
      ...original,
      state: "another-tab",
      code_challenge: "b".repeat(43),
    };
    const firstName = Object.keys(cookiesFor(original))[0];
    const secondName = Object.keys(cookiesFor(other))[0];
    expect(firstName).not.toBe(secondName);
    const jar = { ...cookiesFor(original), ...cookiesFor(other) };
    const reloaded = response();
    await authorize(
      request({ method: "GET", headers: {}, cookies: jar, query: original }),
      reloaded.typed,
    );
    expect(mocks.newMcpSecret).not.toHaveBeenCalled();
    expect(reloaded.res.send).toHaveBeenCalledWith(
      expect.stringContaining('name="csrf" value="' + secret + '"'),
    );
    const first = response();
    const second = response();
    await consent(post(original, jar), first.typed);
    await consent(post(other, jar), second.typed);
    expect(first.res.redirect).toHaveBeenCalledWith(
      303,
      expect.stringContaining("state=opaque-state"),
    );
    expect(second.res.redirect).toHaveBeenCalledWith(
      303,
      expect.stringContaining("state=another-tab"),
    );
  });
  it("binds the consent token to the signed-in account and exact authorization request", async () => {
    const original = authorization();
    for (const body of [
      { ...original, state: "changed-state" },
      { ...original, code_challenge: "b".repeat(43) },
    ]) {
      const { res, typed } = response();
      await consent(post(body, cookiesFor(original)), typed);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.setHeader).toHaveBeenCalledWith(
        "X-MCP-Consent-Error",
        "invalid_csrf_token",
      );
    }
    mocks.getSession.mockResolvedValueOnce({
      user: { id: "other-user", name: "Other", email: "other@example.com" },
    });
    const switched = response();
    await consent(post(), switched.typed);
    expect(switched.res.status).toHaveBeenCalledWith(403);
    expect(mocks.issueCode).not.toHaveBeenCalled();
  });
  it.each([undefined, "null", "https://evil.example"])(
    "rejects an untrusted origin (%s) even with a matching CSRF token",
    async (origin) => {
      const { res, typed } = response();
      await consent(request({ ...post(), headers: { origin } }), typed);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.setHeader).toHaveBeenCalledWith(
        "X-MCP-Consent-Error",
        "invalid_origin",
      );
      expect(mocks.issueCode).not.toHaveBeenCalled();
    },
  );
  it("rejects missing or mismatched cookies with an actionable consent screen", async () => {
    for (const cookies of [
      {},
      { [Object.keys(cookiesFor())[0] ?? ""]: "b".repeat(43) },
    ]) {
      const { res, typed } = response();
      await consent(post(authorization(), cookies), typed);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining("This authorization page has expired."),
      );
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('href="/settings/mcp"'),
      );
      expect(mocks.issueCode).not.toHaveBeenCalled();
    }
  });
  it("preserves the OAuth issuer and state in the registered redirect", async () => {
    const { res, typed } = response();
    await consent(post(), typed);
    expect(mocks.issueCode).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: "user",
        clientId: "client",
        resource: mcpUrls().resource,
      }),
    );
    const redirect = new URL(res.redirect.mock.calls[0]?.[1] as string);
    expect(redirect.origin).toBe("https://client.example");
    expect(redirect.searchParams.get("state")).toBe("opaque-state");
    expect(redirect.searchParams.get("iss")).toBe(mcpUrls().origin);
  });
  it("authorizes accounts with an expired Powerpack", async () => {
    mocks.getSession.mockResolvedValue({
      user: {
        id: "user",
        name: "Test User",
        email: "test@example.com",
        shortlistPowerpackActivatedAt: new Date(0),
        shortlistPowerpackExpiresAt: new Date(1),
      },
    });
    const page = response();
    await authorize(
      request({
        method: "GET",
        headers: {},
        cookies: {},
        query: authorization(),
      }),
      page.typed,
    );
    expect(page.res.status).toHaveBeenCalledWith(200);
    const submitted = response();
    await consent(post(), submitted.typed);
    expect(submitted.res.redirect).toHaveBeenCalledWith(
      303,
      expect.stringContaining("code=one-time-code"),
    );
  });
  it("rejects invalid and unauthenticated requests without issuing a code", async () => {
    for (const body of [
      { ...authorization(), redirect_uri: "https://evil.example/callback" },
      { ...authorization(), code_challenge_method: "plain" },
      { ...authorization(), resource: "https://other.example/mcp" },
    ]) {
      const { res, typed } = response();
      await consent(post(body, cookiesFor()), typed);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.redirect).not.toHaveBeenCalled();
    }
    mocks.getSession.mockResolvedValueOnce(null);
    const unauthenticated = response();
    await consent(post(), unauthenticated.typed);
    expect(unauthenticated.res.status).toHaveBeenCalledWith(401);
    expect(mocks.issueCode).not.toHaveBeenCalled();
  });
  it("returns access_denied on cancellation without issuing a code", async () => {
    const { res, typed } = response();
    await consent(post({ ...authorization(), decision: "deny" }), typed);
    expect(
      new URL(res.redirect.mock.calls[0]?.[1] as string).searchParams.get(
        "error",
      ),
    ).toBe("access_denied");
    expect(mocks.issueCode).not.toHaveBeenCalled();
  });
  it("escapes client names in the native HTML", async () => {
    mocks.getClient.mockResolvedValueOnce({
      name: '<img src=x onerror="alert(1)">',
      redirectUris: ["https://client.example/callback"],
    });
    const { res, typed } = response();
    await authorize(
      request({
        method: "GET",
        headers: {},
        cookies: {},
        query: authorization(),
      }),
      typed,
    );
    const html = res.send.mock.calls[0]?.[0] as string;
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });
  it("redirects to sign-in with the complete authorization request", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const { res, typed } = response();
    await authorize(
      request({
        method: "GET",
        headers: {},
        cookies: {},
        query: authorization(),
      }),
      typed,
    );
    const login = new URL(
      res.redirect.mock.calls[0]?.[1] as string,
      mcpUrls().origin,
    );
    const next = new URL(
      login.searchParams.get("next") ?? "",
      mcpUrls().origin,
    );
    expect(next.pathname).toBe("/mcp/authorize");
    expect(next.searchParams.get("state")).toBe("opaque-state");
    expect(next.searchParams.get("resource")).toBe(mcpUrls().resource);
  });
  it("rejects unsafe registration callbacks and confidential-client settings", async () => {
    for (const body of [
      { client_name: "Unsafe", redirect_uris: ["javascript:alert(1)"] },
      {
        client_name: "Unsafe",
        redirect_uris: ["https://client.example/callback"],
        token_endpoint_auth_method: "client_secret_basic",
      },
    ]) {
      const { res, typed } = response();
      await oauth(
        request({
          method: "POST",
          headers: {},
          query: { action: "register" },
          body,
        }),
        typed,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocks.registerClient).not.toHaveBeenCalled();
    }
  });
  it("advertises OAuth discovery, PKCE and the exact protected resource", () => {
    const { res, typed } = response();
    metadata(request({ query: { kind: "resource" } }), typed);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: mcpUrls().resource,
        authorization_servers: [mcpUrls().origin],
      }),
    );
    metadata(request({ query: {} }), typed);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      }),
    );
  });
});
