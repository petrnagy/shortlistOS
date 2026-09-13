import { afterEach, describe, expect, it, vi } from "vitest";

describe("configuredProviders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("disables Microsoft profile photo fetching", async () => {
    vi.stubEnv("MICROSOFT_CLIENT_ID", "microsoft-client-id");
    vi.stubEnv("MICROSOFT_CLIENT_SECRET", "microsoft-client-secret");

    const { configuredProviders } = await import("./providers");

    expect(configuredProviders.microsoft).toMatchObject({
      clientId: "microsoft-client-id",
      clientSecret: "microsoft-client-secret",
      tenantId: "common",
      requireSelectAccount: true,
      disableProfilePhoto: true,
    });
  });
});
