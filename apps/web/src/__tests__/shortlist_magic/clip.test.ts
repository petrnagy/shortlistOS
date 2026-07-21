import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDrizzleClient } from "@kan/db/client";

import handler from "../../pages/api/shortlist_magic_clip";

const { mockDb, mockEnqueue, mockLogger, mockStoreObject } = vi.hoisted(() => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const state = {
    accessRows: [
      {
        boardId: 123,
        userId: "user-id",
        shortlistPowerpackActivatedAt: now,
        shortlistPowerpackExpiresAt: tomorrow,
      },
    ],
    insertedValues: [] as unknown[],
  };

  const db = {
    _state: state,
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve(state.accessRows)),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: unknown) => {
        state.insertedValues.push(value);

        return {
          returning: vi.fn(() => Promise.resolve([{ id: "clip-row-id" }])),
        };
      }),
    })),
  };

  return {
    mockDb: db,
    mockLogger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
    mockEnqueue: vi.fn(() => Promise.resolve("job-id")),
    mockStoreObject: vi.fn(() =>
      Promise.resolve({ id: "object-id", s3Key: "sources/webpage.html" }),
    ),
  };
});

vi.mock("~/env", () => ({
  env: {
    BREVO_MAGIC_INBOX_WEBHOOK_SECRET: "test-inbox-secret",
    SHORTLIST_MAGIC_CLIP_WEBHOOK_SECRET: "test-clip-secret",
    SHORTLIST_SOURCE_BUCKET_NAME: "source-bucket",
    STRIPE_SECRET_KEY: "test-stripe-secret",
    STRIPE_SHORTLIST_WEBHOOK_SECRET: "test-stripe-webhook-secret",
  },
}));

vi.mock("~/utils/shortlistSourceIntake", () => ({
  enqueueShortlistSource: mockEnqueue,
  storeShortlistSourceObject: mockStoreObject,
}));

vi.mock("@kan/db/client", () => ({
  createDrizzleClient: vi.fn(() => mockDb),
}));

vi.mock("@kan/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

const mockCreateDrizzleClient = createDrizzleClient as ReturnType<typeof vi.fn>;

const createResponse = () => {
  const response = {
    status: vi.fn<(code: number) => NextApiResponse>(),
    json: vi.fn<(body: unknown) => NextApiResponse>(),
  };

  response.status.mockReturnValue(response as unknown as NextApiResponse);
  response.json.mockReturnValue(response as unknown as NextApiResponse);

  return response as unknown as NextApiResponse & {
    json: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
  };
};

const createRequest = (options: {
  body: unknown;
  headers?: NextApiRequest["headers"];
  method?: string;
}) =>
  ({
    body: options.body,
    headers: options.headers ?? {
      authorization: "Bearer test-clip-secret",
    },
    method: options.method ?? "POST",
  }) as NextApiRequest;

describe("shortlist magic clip endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    mockDb._state.accessRows = [
      {
        boardId: 123,
        userId: "user-id",
        shortlistPowerpackActivatedAt: now,
        shortlistPowerpackExpiresAt: tomorrow,
      },
    ];
    mockDb._state.insertedValues = [];
    mockEnqueue.mockClear();
    mockStoreObject.mockClear();
  });

  it("inserts a clip for a Powerpack user that owns the board", async () => {
    const response = createResponse();

    await handler(
      createRequest({
        body: {
          boardId: "boardABC",
          rawHtml: "<html><body>Job</body></html>",
          url: " https://example.com/job ",
          userId: "user-id",
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ inserted: 1, skipped: 0 });
    expect(mockCreateDrizzleClient).toHaveBeenCalledTimes(1);
    expect(mockDb._state.insertedValues).toEqual([
      {
        boardId: 123,
        createdBy: "user-id",
        metadataJson: { boardPublicId: "boardABC" },
        url: "https://example.com/job",
      },
    ]);
    expect(mockStoreObject).toHaveBeenCalledOnce();
    expect(mockStoreObject).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 123,
        objectType: "WEBPAGE_HTML",
        sourceId: "clip-row-id",
      }),
    );
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 123,
        sourceId: "clip-row-id",
        sourceType: "WEBPAGE",
      }),
    );
  });

  it("rejects unauthorized clip requests before creating a database client", async () => {
    const response = createResponse();

    await handler(
      createRequest({
        body: {
          boardId: "boardABC",
          rawHtml: "<html><body>Job</body></html>",
          url: "https://example.com/job",
          userId: "user-id",
        },
        headers: { authorization: "Bearer wrong-secret" },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    expect(mockCreateDrizzleClient).not.toHaveBeenCalled();
    expect(mockDb._state.insertedValues).toEqual([]);
  });

  it("rejects malformed clip payloads before creating a database client", async () => {
    const response = createResponse();

    await handler(
      createRequest({
        body: {
          boardId: "boardABC",
          rawHtml: "   ",
          url: "https://example.com/job",
          userId: "user-id",
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Invalid magic clip payload",
    });
    expect(mockCreateDrizzleClient).not.toHaveBeenCalled();
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("skips a clip when board ownership or Powerpack access is invalid", async () => {
    mockDb._state.accessRows = [];
    const response = createResponse();

    await handler(
      createRequest({
        body: {
          boardId: "boardABC",
          rawHtml: "<html><body>Job</body></html>",
          url: "https://example.com/job",
          userId: "user-id",
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ inserted: 0, skipped: 1 });
    expect(mockDb._state.insertedValues).toEqual([]);
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("rejects non-POST clip requests without side effects", async () => {
    const response = createResponse();

    await handler(
      createRequest({ body: {}, method: "GET" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(405);
    expect(mockCreateDrizzleClient).not.toHaveBeenCalled();
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
