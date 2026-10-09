import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-runtime-env", () => ({
  env: (name: string) => process.env[name],
}));

import packageJson from "../../../../package.json";

import { healthRouter } from "./health";

describe("health router", () => {
  const mockDb = {
    execute: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.stubEnv("APP_IMAGE_TAG", "sha-69d8d18763cf6b9685d131fd4f11fc4358e55245");
    vi.stubEnv("NEXT_PUBLIC_AVATAR_BUCKET_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME", "");
    vi.stubEnv("SHORTLIST_SOURCE_BUCKET_NAME", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns the application version and immutable image reference", async () => {
    const result = await healthRouter
      .createCaller({ db: mockDb } as never)
      .health();

    expect(result).toEqual({
      status: "ok",
      database: "ok",
      storage: "not_configured",
      version: packageJson.version,
      image: {
        repository: "ghcr.io/petrnagy/shortlistos",
        tag: "sha-69d8d18763cf6b9685d131fd4f11fc4358e55245",
      },
    });
  });

  it("returns null image metadata when the image tag is unavailable", async () => {
    delete process.env.APP_IMAGE_TAG;

    const result = await healthRouter
      .createCaller({ db: mockDb } as never)
      .health();

    expect(result.version).toBe(packageJson.version);
    expect(result.image).toBeNull();
    expect(result.status).toBe("ok");
  });
});
