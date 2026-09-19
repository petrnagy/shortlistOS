import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  decidePairing: vi.fn(),
  getBootstrap: vi.fn(),
}));

vi.mock("@kan/auth/server", () => ({
  initAuth: () => ({ api: { getSession: mocks.getSession } }),
}));
vi.mock("@kan/db/client", () => ({ createDrizzleClient: () => ({}) }));
vi.mock("./store", () => ({
  ...mocks,
  createClip: vi.fn(),
  createPairing: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  getAvailableBoard: vi.fn(),
  getClipStatus: vi.fn(),
  getPairingForApproval: vi.fn(),
  getUserById: vi.fn(),
  pollPairing: vi.fn(),
  revokeRefreshTokenFamily: vi.fn(),
  rotateRefreshToken: vi.fn(),
}));

const firefox = "moz-extension://e382bfd1-973b-4a43-adea-426714963b42";
const chrome = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const userId = "a382bfd1-973b-4a43-adea-426714963b42";
let server: Server | undefined;
let baseUrl: string;

const start = async (origins = "moz-extension://*", mode = "production") => {
  vi.stubEnv("WEB_CLIPPER_ALLOWED_ORIGINS", origins);
  vi.stubEnv("NODE_ENV", mode);
  const { createWebClipperServer } = await import("./server");
  const instance = createWebClipperServer();
  server = instance;
  await new Promise<void>((resolve) =>
    instance.listen(0, "127.0.0.1", resolve),
  );
  baseUrl = `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
};

const request = (path: string, init: RequestInit = {}) =>
  fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "x-forwarded-proto": "https", ...init.headers },
  });

const preflight = (origin: string) =>
  request("/api/web-clipper/bootstrap", {
    method: "OPTIONS",
    headers: { Origin: origin },
  });

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.stubEnv("WEB_CLIPPER_ACCESS_TOKEN_SECRET", "a".repeat(32));
  vi.stubEnv("WEB_CLIPPER_ENCRYPTION_KEY", "b".repeat(32));
  vi.stubEnv("SHORTLIST_SOURCE_BUCKET_NAME", "test");
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
});

afterEach(async () => {
  if (server) {
    const instance = server;
    instance.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      instance.close((error) => (error ? reject(error) : resolve())),
    );
    server = undefined;
  }
  vi.unstubAllEnvs();
});

describe("extension CORS", () => {
  it.each([
    [chrome, chrome, 204],
    [chrome, "chrome-extension://other", 403],
    [firefox, firefox, 204],
    [firefox, "moz-extension://another-profile", 403],
    ["moz-extension://*", firefox, 204],
    ["moz-extension://*", `${firefox}/`, 204],
    ["", firefox, 403],
    ["", chrome, 403],
    ["chrome-extension://*", chrome, 403],
    ["https://*", "https://example.com", 403],
    ["http://*", "http://example.com", 403],
    ["*", firefox, 403],
  ])("configuration %s handles %s with %i", async (origins, origin, status) => {
    await start(origins);
    const response = await preflight(origin);
    expect(response.status).toBe(status);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      status === 204 ? origin : null,
    );
    if (status === 204) expect(response.headers.get("Vary")).toBe("Origin");
  });

  it.each([
    "https://moz-extension.example",
    "http://example.com",
    "moz-extension.example",
    "moz-extension://",
    "moz-extension://uuid.example/path",
    "moz-extension://uuid.example?query",
    "moz-extension://uuid.example?",
    "moz-extension://uuid.example#fragment",
    "moz-extension://uuid.example#",
    "moz-extension://user:password@uuid.example",
    "moz-extension://uuid.example:123",
    "moz-extension://uuid.example/../",
    "moz-extension://uuid.example/.",
    "moz-extension://*",
    "moz-extension://[invalid",
    "https://example.com/moz-extension://uuid",
    "chrome-extension://unconfigured",
  ])("rejects malformed or unrelated origin %s", async (origin) => {
    await start();
    expect((await preflight(origin)).status).toBe(403);
  });

  it.each([chrome, firefox])(
    "preserves development acceptance of %s",
    async (origin) => {
      await start("", "development");
      expect((await preflight(origin)).status).toBe(204);
      expect((await preflight("https://example.com")).status).toBe(403);
    },
  );
});

describe("authorization with Firefox wildcard", () => {
  it.each([
    ["GET", "/api/web-clipper/bootstrap"],
    ["POST", "/api/web-clipper/clips"],
    ["GET", `/api/web-clipper/clips/${userId}`],
  ])("requires a valid bearer token for %s %s", async (method, path) => {
    await start();
    for (const authorization of ["", "Bearer invalid"]) {
      const response = await request(path, {
        method,
        headers: { Origin: firefox, Authorization: authorization },
      });
      expect(response.status).toBe(401);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(firefox);
      expect(response.headers.get("Vary")).toBe("Origin");
    }
  });

  it("checks scopes and accepts a correctly signed bearer token", async () => {
    await start();
    const { issueAccessToken } = await import("./security");
    for (const scopes of [[], ["profile:read", "boards:read"]]) {
      const { token } = await issueAccessToken(userId, scopes);
      mocks.getBootstrap.mockResolvedValue({ boards: [] });
      const response = await request("/api/web-clipper/bootstrap", {
        headers: { Origin: firefox, Authorization: `Bearer ${token}` },
      });
      expect(response.status).toBe(scopes.length ? 200 : 403);
    }
    expect(mocks.getBootstrap).toHaveBeenCalledTimes(1);
  });

  it.each([
    [false, "csrf", "csrf", "approve", 401, null],
    [true, "", "csrf", "approve", 403, null],
    [true, "csrf", "", "approve", 403, null],
    [true, "wrong", "csrf", "approve", 403, null],
    [true, "csrf", "csrf", "", 200, false],
    [true, "csrf", "csrf", "deny", 200, false],
    [true, "csrf", "csrf", "approve", 200, true],
  ])(
    "enforces session, CSRF and explicit approval (%s, %s, %s, %s)",
    async (authenticated, csrf, cookie, decision, status, approved) => {
      await start();
      mocks.getSession.mockResolvedValue(
        authenticated
          ? { user: { id: userId, email: "test@example.com" } }
          : null,
      );
      mocks.decidePairing.mockResolvedValue(true);
      const response = await request("/web-clipper/connect", {
        method: "POST",
        headers: { Cookie: `shortlistos_web_clipper_pairing_csrf=${cookie}` },
        body: new URLSearchParams({
          pairing_id: userId,
          csrf_token: csrf,
          decision,
        }),
      });
      expect(response.status).toBe(status);
      if (approved === null) expect(mocks.decidePairing).not.toHaveBeenCalled();
      else
        expect(mocks.decidePairing).toHaveBeenCalledWith(expect.anything(), {
          pairingId: userId,
          userId,
          approved,
        });
    },
  );
});
