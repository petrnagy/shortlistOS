import { describe, expect, it } from "vitest";

import {
  createProviderQuotaLockKey,
  DEFAULT_LLM_ACCOUNT_DAILY_REQUEST_LIMIT,
  DEFAULT_OPENWEBNINJA_ACCOUNT_DAILY_REQUEST_LIMIT,
  getUtcDayStart,
  PROVIDERS,
} from "./provider-requests";

describe("provider request quotas", () => {
  it("resets daily account usage at midnight UTC", () => {
    expect(getUtcDayStart(new Date("2026-07-22T23:59:59.999Z"))).toEqual(
      new Date("2026-07-22T00:00:00.000Z"),
    );
    expect(getUtcDayStart(new Date("2026-07-23T00:00:00.000Z"))).toEqual(
      new Date("2026-07-23T00:00:00.000Z"),
    );
  });

  it("uses the configured account-level daily defaults", () => {
    expect(DEFAULT_LLM_ACCOUNT_DAILY_REQUEST_LIMIT).toBe(250);
    expect(DEFAULT_OPENWEBNINJA_ACCOUNT_DAILY_REQUEST_LIMIT).toBe(250);
  });

  it("serializes reservations by account, provider, and UTC day", () => {
    expect(
      createProviderQuotaLockKey(
        "account-1",
        PROVIDERS.LLM,
        new Date("2026-08-08T23:59:59.999Z"),
      ),
    ).toBe("account-1:LLM:2026-08-08");
    expect(
      createProviderQuotaLockKey(
        "account-1",
        PROVIDERS.OPENWEBNINJA,
        new Date("2026-08-09T00:00:00.000Z"),
      ),
    ).toBe("account-1:OPENWEBNINJA:2026-08-09");
  });
});
