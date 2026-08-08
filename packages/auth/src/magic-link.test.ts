import { describe, expect, it } from "vitest";

import { isMagicLinkSignUpUrl } from "./magic-link";

describe("isMagicLinkSignUpUrl", () => {
  it("identifies links explicitly created by the signup form", () => {
    expect(
      isMagicLinkSignUpUrl(
        "https://example.com/api/auth/magic-link/verify?token=abc&callbackURL=%2Fboards&newUserCallbackURL=%2Fboards",
      ),
    ).toBe(true);
  });

  it("does not treat ordinary login links as signup links", () => {
    expect(
      isMagicLinkSignUpUrl(
        "https://example.com/api/auth/magic-link/verify?token=abc&callbackURL=%2Fboards",
      ),
    ).toBe(false);
  });
});
