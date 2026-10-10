import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  shortlistActivityLogs,
  shortlistEmailSources,
  shortlistInboundEmailJobs,
  shortlistJobQueue,
  shortlistSourceObjects,
} from "@kan/db/schema";

import {
  getInboundRetryDelayMs,
  processInboundEmailBatch,
} from "./inbound-email-worker";

const { mockPutObject, mockEnsureRobot, mockLogger, state } = vi.hoisted(
  () => ({
    mockPutObject: vi.fn(() => Promise.resolve()),
    mockEnsureRobot: vi.fn(() => Promise.resolve()),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    state: {
      attempts: 0,
      lastError: null as string | null,
      job: null as Record<string, unknown> | null,
      status: "PENDING",
      sourceCreated: false,
      objectRows: [] as Record<string, unknown>[],
      objectSelectCalls: 0,
      duplicateObjectLookup: null as Record<string, unknown> | null,
      queueCreated: false,
      activityCount: 0,
    },
  }),
);

vi.mock("@kan/shared/utils", () => ({ putObject: mockPutObject }));
vi.mock("@kan/db/repository/shortlistActivityLog.repo", () => ({
  ensureShortlistRobotUser: mockEnsureRobot,
}));
vi.mock("@kan/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

function createMockDb() {
  const db: Record<string, (...args: never[]) => unknown> = {};
  db.transaction = async (callback: (tx: typeof db) => Promise<unknown>) =>
    callback(db);
  db.select = () => {
    let table: unknown;
    const query = {
      from: (selected: unknown) => {
        table = selected;
        return query;
      },
      where: () => query,
      orderBy: () => query,
      limit: () => query,
      for: () =>
        table === shortlistInboundEmailJobs &&
        state.job &&
        ["PENDING", "RETRY", "PROCESSING"].includes(state.status)
          ? [
              {
                ...state.job,
                attempts: state.attempts,
                maxAttempts: 5,
                sourceId: state.job.sourceId,
              },
            ]
          : [],
      then: (resolve: (value: unknown[]) => unknown) => {
        if (table !== shortlistSourceObjects) return resolve([]);
        if (state.duplicateObjectLookup) {
          const duplicate = state.duplicateObjectLookup;
          state.duplicateObjectLookup = null;
          return resolve([duplicate]);
        }
        state.objectSelectCalls += 1;
        const rows =
          state.objectSelectCalls === 2
            ? state.objectRows.filter(
                (row) => row.objectType === "EMAIL_CURRENT",
              )
            : [];
        return resolve(rows);
      },
    };
    return query;
  };
  db.insert = (table: unknown) => ({
    values: (values: Record<string, unknown>) => {
      if (table === shortlistActivityLogs) {
        state.activityCount += 1;
        return Promise.resolve();
      }
      const query = {
        onConflictDoNothing: () => query,
        returning: () => {
          if (table === shortlistEmailSources) {
            if (state.sourceCreated) return [];
            state.sourceCreated = true;
            return [{ id: "source-1" }];
          }
          if (table === shortlistSourceObjects) {
            const existing = state.objectRows.find(
              (row) => row.s3Key === values.s3Key,
            );
            if (existing) {
              state.duplicateObjectLookup = existing;
              return [];
            }
            const row = {
              ...values,
              id: `object-${state.objectRows.length + 1}`,
            };
            state.objectRows.push(row);
            return [{ id: row.id }];
          }
          if (table === shortlistJobQueue) {
            if (state.queueCreated) return [];
            state.queueCreated = true;
            return [{ id: "source-job-1" }];
          }
          return [];
        },
      };
      return query;
    },
  });
  db.update = (table: unknown) => ({
    set: (values: Record<string, unknown>) => ({
      where: () => {
        if (table === shortlistInboundEmailJobs) {
          if (typeof values.sourceId === "string" && state.job) {
            state.job.sourceId = values.sourceId;
          }
          if (values.status === "PROCESSING") {
            state.status = "PROCESSING";
            state.attempts += 1;
          }
          if (values.status === "RETRY" || values.status === "FAILED") {
            state.status = values.status;
            state.lastError =
              typeof values.lastError === "string" ? values.lastError : "";
          }
          if (values.status === "COMPLETED") state.status = "COMPLETED";
        }
        const result = Promise.resolve();
        return Object.assign(result, {
          returning: () =>
            values.status === "COMPLETED" ? [{ id: "inbound-job-1" }] : [],
        });
      },
    }),
  });
  return db;
}

describe("inbound email worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.attempts = 0;
    state.lastError = null;
    state.status = "PENDING";
    state.sourceCreated = false;
    state.objectRows = [];
    state.objectSelectCalls = 0;
    state.duplicateObjectLookup = null;
    state.queueCreated = false;
    state.activityCount = 0;
    state.job = {
      id: "inbound-job-1",
      idempotencyKey: "stable-job-key",
      externId: "message-1@example.test",
      createdBy: "user-1",
      boardId: 10,
      boardPublicId: "board-public-1",
      sourceId: null,
      payloadJson: {
        MessageId: "message-1@example.test",
        From: { Address: "sender@example.test" },
        Subject: "Role",
        RawTextBody: "A new role",
        Attachments: [
          {
            Name: "role.pdf",
            ContentType: "application/pdf",
            DownloadToken: "never-log-token",
          },
        ],
      },
    };
  });

  it("retries a transient download and stores the attachment before enqueueing", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { "content-type": "application/pdf" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const db = createMockDb();

    const first = await processInboundEmailBatch(db as never, {
      apiKey: "worker-api-key",
      bucket: "source-bucket",
      workerId: "test-worker",
    });
    expect(first).toMatchObject({ selected: 1, retried: 1, completed: 0 });
    expect(state.status).toBe("RETRY");
    expect(state.queueCreated).toBe(false);

    const second = await processInboundEmailBatch(db as never, {
      apiKey: "worker-api-key",
      bucket: "source-bucket",
      workerId: "test-worker",
    });
    expect(second).toMatchObject({ selected: 1, completed: 1, retried: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mockPutObject).toHaveBeenCalled();
    expect(state.objectRows).toHaveLength(3);
    expect(
      state.objectRows.some((row) => row.objectType === "ATTACHMENT_FILE"),
    ).toBe(true);
    expect(state.queueCreated).toBe(true);
    expect(state.status).toBe("COMPLETED");
    expect(state.activityCount).toBe(1);
    const logged = JSON.stringify(mockLogger.warn.mock.calls);
    expect(logged).not.toContain("never-log-token");
    expect(logged).not.toContain("worker-api-key");

    const duplicate = await processInboundEmailBatch(db as never, {
      apiKey: "worker-api-key",
      bucket: "source-bucket",
      workerId: "test-worker",
    });
    expect(duplicate).toMatchObject({ selected: 0, completed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(state.activityCount).toBe(1);
  });

  it("retains repeated transient failures as terminal without enqueueing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("", { status: 503 })),
    );
    const db = createMockDb();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await processInboundEmailBatch(db as never, {
        apiKey: "worker-api-key",
        bucket: "source-bucket",
        workerId: "test-worker",
      });
    }

    expect(state.attempts).toBe(5);
    expect(state.status).toBe("FAILED");
    expect(state.lastError).toContain("HTTP 503");
    expect(state.queueCreated).toBe(false);
    expect(state.activityCount).toBe(0);
  });

  it("does not retry authentication failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("", { status: 401 })),
    );
    const result = await processInboundEmailBatch(createMockDb() as never, {
      apiKey: "worker-api-key",
      bucket: "source-bucket",
      workerId: "test-worker",
    });

    expect(result).toMatchObject({ selected: 1, failed: 1, retried: 0 });
    expect(state.attempts).toBe(1);
    expect(state.status).toBe("FAILED");
    expect(state.lastError).toContain("HTTP 401");
    expect(state.lastError).not.toContain("never-log-token");
    expect(state.lastError).not.toContain("worker-api-key");
  });

  it("uses exponential backoff with jitter and honors Retry-After", () => {
    expect(getInboundRetryDelayMs(1, undefined, 0)).toBe(750);
    expect(getInboundRetryDelayMs(2, undefined, 1)).toBe(2_500);
    expect(getInboundRetryDelayMs(1, 12_000, 0)).toBe(12_000);
  });
});
