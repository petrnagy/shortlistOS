/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-23
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { classifyJobPostingContent } from "../src/jobs/classify-job-posting";

const shouldRunLiveTest =
  !!process.env.LLM_CONNECTOR_API_KEY &&
  !!process.env.LLM_CONNECTOR_MODEL;

describe.runIf(shouldRunLiveTest)("job posting classification live LLM", () => {
  it(
    "classifies the fixture through the configured LLM API",
    async () => {
      const html = readFileSync(
        resolve(
          __dirname,
          "../src/jobs/fixtures/job-posting-classification.test.html",
        ),
        "utf8",
      );

      const result = await classifyJobPostingContent({
        apiKey: process.env.LLM_CONNECTOR_API_KEY ?? "",
        model: process.env.LLM_CONNECTOR_MODEL ?? "",
        htmlContent: html,
        sourceUrl: "fixture://job-posting-classification.test.html",
        clippedAt: new Date("2026-06-23T00:00:00.000Z"),
        contentKind: "webpage",
      });

      expect(result.classification).toHaveProperty("isJobOpportunity");
      expect(result.model).toBeTruthy();

      console.info("RAW_LLM_API_RESPONSE");
      console.info(JSON.stringify(result.rawResponse, null, 2));
      console.info("MAPPED_CLASSIFICATION_JSON");
      console.info(JSON.stringify(result.classification, null, 2));
      if (result.warnings.length > 0) {
        console.info("CLASSIFICATION_WARNINGS");
        console.warn(result.warnings.join("\n"));
      }
    },
    120_000,
  );
});

describe.skipIf(shouldRunLiveTest)("job posting classification live LLM", () => {
  it("is skipped until LLM env vars are set", () => {
    expect(shouldRunLiveTest).toBe(false);
  });
});
