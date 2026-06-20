import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockLogger } = vi.hoisted(() => {
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

        return Promise.resolve([{ id: "link-row-id" }]);
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
  };
});

vi.mock("~/env", () => ({
  env: {
    BREVO_MAGIC_INBOX_WEBHOOK_SECRET: "test-inbox-secret",
    SHORTLIST_MAGIC_CLIP_WEBHOOK_SECRET: "test-clip-secret",
    SHORTLIST_MAGIC_LINK_WEBHOOK_SECRET: "test-link-secret",
    STRIPE_SECRET_KEY: "test-stripe-secret",
    STRIPE_SHORTLIST_WEBHOOK_SECRET: "test-stripe-webhook-secret",
  },
}));

vi.mock("@kan/db/client", () => ({
  createDrizzleClient: vi.fn(() => mockDb),
}));

vi.mock("@kan/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
}));

import { createDrizzleClient } from "@kan/db/client";

import handler from "../../pages/api/shortlist_magic_link";

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
      authorization: "Bearer test-link-secret",
    },
    method: options.method ?? "POST",
  }) as NextApiRequest;

describe("shortlist magic link endpoint", () => {
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
  });

  it("inserts a link for a Powerpack user that owns the board", async () => {
    const response = createResponse();

    await handler(
      createRequest({
        body: {
          boardId: "boardABC",
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
        url: "https://example.com/job",
      },
    ]);
  });

  it("discards a link when board ownership or Powerpack access is missing", async () => {
    mockDb._state.accessRows = [];
    const response = createResponse();

    await handler(
      createRequest({
        body: {
          boardId: "boardABC",
          url: "https://example.com/job",
          userId: "user-id",
        },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ inserted: 0, skipped: 1 });
    expect(mockDb._state.insertedValues).toEqual([]);
  });
});
