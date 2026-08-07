import { describe, expect, it } from "vitest";

import { buildCardDescription } from "./build-card-description";

describe("buildCardDescription", () => {
  it("appends a formatted application deadline paragraph", () => {
    expect(
      buildCardDescription("<p>Build software products.</p>", "2026-08-31"),
    ).toBe(
      "<p>Build software products.</p><p><strong>Application deadline: 31 August 2026</strong></p>",
    );
  });

  it("creates only the deadline paragraph when no description is available", () => {
    expect(buildCardDescription(null, "2026-08-31")).toBe(
      "<p><strong>Application deadline: 31 August 2026</strong></p>",
    );
  });

  it("ignores malformed application deadlines", () => {
    expect(buildCardDescription("<p>Description</p>", "2026-02-31")).toBe(
      "<p>Description</p>",
    );
  });
});
