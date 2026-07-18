import { describe, expect, it } from "vitest";

import { extractSourceText } from "./extract-source-text";

describe("extractSourceText", () => {
  it("decodes text sources", async () => {
    await expect(
      extractSourceText({
        buffer: Buffer.from("Senior Developer at Acme"),
        contentType: "text/plain",
        filename: "offer.txt",
      }),
    ).resolves.toBe("Senior Developer at Acme");
  });

  it("rejects legacy doc files that intake no longer accepts", async () => {
    await expect(
      extractSourceText({
        buffer: Buffer.from("not-a-doc"),
        contentType: "application/msword",
        filename: "offer.doc",
      }),
    ).rejects.toThrow("Unsupported source document type");
  });
});
