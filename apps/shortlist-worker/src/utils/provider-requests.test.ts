import { describe, expect, it } from "vitest";

import { getUtcDayStart } from "./provider-requests";

describe("provider request quotas", () => {
  it("resets daily account usage at midnight UTC", () => {
    expect(getUtcDayStart(new Date("2026-07-22T23:59:59.999Z"))).toEqual(
      new Date("2026-07-22T00:00:00.000Z"),
    );
    expect(getUtcDayStart(new Date("2026-07-23T00:00:00.000Z"))).toEqual(
      new Date("2026-07-23T00:00:00.000Z"),
    );
  });
});
