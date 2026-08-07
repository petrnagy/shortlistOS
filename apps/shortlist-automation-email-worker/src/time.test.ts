import { describe, expect, it } from "vitest";

import { getLocalTime, isAutomationSendHour } from "./time";

describe("email automation local scheduling", () => {
  it("uses the user's timezone for 07:00 delivery", () => {
    const local = getLocalTime(
      new Date("2026-08-03T05:00:00.000Z"),
      "Europe/Budapest",
    );
    expect(local).toEqual({ date: "2026-08-03", hour: 7, weekday: "Mon" });
    expect(isAutomationSendHour(local)).toBe(true);
  });

  it("falls back to UTC for invalid timezones", () => {
    expect(
      getLocalTime(new Date("2026-08-03T07:00:00.000Z"), "invalid").hour,
    ).toBe(7);
  });
});
