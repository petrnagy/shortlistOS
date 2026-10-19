import type { NextApiRequest, NextApiResponse } from "next";
import { describe, expect, it, vi } from "vitest";

import { withRateLimit } from "./rateLimit";

vi.mock("@kan/db/redis", () => ({ getRedisClient: () => null }));

describe("rate limit wrapper", () => {
  it("never retries a failed write handler", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("Write failed"));
    const wrapped = withRateLimit({ identifier: () => "mcp-test" }, handler);
    await expect(
      wrapped({} as NextApiRequest, {} as NextApiResponse),
    ).rejects.toThrow("Write failed");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
