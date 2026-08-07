import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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

  it.each([
    ["maximal-job-offer.pdf", "application/pdf"],
    [
      "maximal-job-offer.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    ["maximal-job-offer.odt", "application/vnd.oasis.opendocument.text"],
  ])("extracts the real %s fixture", async (filename, contentType) => {
    const buffer = await readFile(
      fileURLToPath(new URL(`../../test-fixtures/${filename}`, import.meta.url)),
    );

    const text = await extractSourceText({ buffer, contentType, filename });

    expect(text).toContain("Principal Director of Moodle");
    expect(text).toContain("Northstar Learning Systems GmbH");
    expect(text.length).toBeGreaterThan(8_000);
  });
});
