import { beforeEach, describe, expect, it, vi } from "vitest";

import type { dbClient } from "@kan/db/client";
import { shortlistEmailSources } from "@kan/db/schema";

import {
  getSourceFailureReason,
  recordSourceProcessingActivity,
} from "./source-queue-worker";

const { createActivity } = vi.hoisted(() => ({
  createActivity: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("@kan/db/repository/shortlistActivityLog.repo", () => ({
  createSourceActivity: createActivity,
}));

const job = (
  sourceType: string,
  payloadJson: unknown,
): Parameters<typeof recordSourceProcessingActivity>[1] => ({
  id: "job-id",
  sourceId: "source-id",
  boardId: 42,
  sourceType,
  payloadJson,
  attempts: 1,
  maxAttempts: 3,
  createdAt: new Date(),
  createdBy: "user",
  processingLog: null,
  timeZone: "UTC",
});

function mockDatabase() {
  let table: unknown;
  const query = {
    from: (selected: unknown) => {
      table = selected;
      return query;
    },
    leftJoin: () => query,
    where: () => query,
    limit: () =>
      Promise.resolve(
        table === shortlistEmailSources
          ? [{ subject: "Engineer at Acme", fromEmail: "jobs@example.com" }]
          : [
              {
                cardId: null,
                error: "PDF extraction failed",
                processingLog: "Attempt failed",
                attempts: 2,
              },
            ],
      ),
  };
  return {
    select: () => query,
    query: {
      shortlistAttachmentSources: {
        findFirst: () => Promise.resolve({ originalFilename: "role.pdf" }),
      },
    },
  } as unknown as dbClient;
}

beforeEach(() => vi.clearAllMocks());

describe("source processing failure activity", () => {
  it.each([
    ["EMAIL", {}, "email"],
    ["WEBPAGE", { sourceUrl: "https://example.com/job" }, "web"],
    ["ATTACHMENT", {}, "upload"],
    [
      "ATTACHMENT",
      { intakeMethod: "link", sourceUrl: "https://example.com/job" },
      "link",
    ],
    ["ATTACHMENT", { intakeMethod: "text" }, "text"],
  ] as const)(
    "records %s %j failures even when no opportunity was created",
    async (sourceType, payload, kind) => {
      const db = mockDatabase();
      await recordSourceProcessingActivity(
        db,
        job(sourceType, payload),
        "FAILED",
      );
      expect(createActivity).toHaveBeenCalledWith(
        db,
        expect.objectContaining({
          activityType: `source.${kind}.failed`,
          activityResult: "FAILED",
          cardId: null,
          payload: expect.objectContaining({
            sourceKind: kind,
            attempt: 2,
            reason:
              "The source could not be read. Try pasting the opportunity as text.",
          }) as unknown,
        }),
      );
    },
  );

  it("distinguishes a failed attempt that will retry", async () => {
    await recordSourceProcessingActivity(
      mockDatabase(),
      job("ATTACHMENT", { intakeMethod: "text" }),
      "RETRY",
    );
    expect(createActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        activityType: "source.text.retrying",
        activityResult: "FAILED",
      }),
    );
  });

  it("does not mark a pending job as failed", async () => {
    await recordSourceProcessingActivity(
      mockDatabase(),
      job("ATTACHMENT", null),
      "PENDING",
    );
    expect(createActivity).not.toHaveBeenCalled();
  });

  it("keeps internal errors out of the user-facing reason", () => {
    expect(
      getSourceFailureReason("SQL failed with password=secret boardId=42"),
    ).toBe("Processing could not be completed. Please try again.");
    expect(
      getSourceFailureReason(
        "not a job",
        "Classification rejected this source",
      ),
    ).toBe("not a job");
  });
});
