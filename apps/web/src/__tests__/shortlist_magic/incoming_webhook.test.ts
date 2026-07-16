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
        userId: "owner-user-id",
        shortlistPowerpackActivatedAt: now,
        shortlistPowerpackExpiresAt: tomorrow,
      },
    ],
    insertedRows: [{ id: "inbox-row-id" }],
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
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve(state.insertedRows)),
          })),
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
  };
});

vi.mock("~/env", () => ({
  env: {
    BREVO_MAGIC_INBOX_WEBHOOK_SECRET: "test-webhook-secret",
    NEXT_PUBLIC_MAGIC_INBOX_DOMAIN: "magic-inbox.shortlistos.co",
    SHORTLIST_MAGIC_CLIP_WEBHOOK_SECRET: "test-clip-secret",
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

import handler, {
  parseMagicInboxRecipientsFromBrevoEmail,
} from "../../pages/api/shortlist_magic_inbox/incoming_webhook";

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
      authorization: "Bearer test-webhook-secret",
    },
    method: options.method ?? "POST",
  }) as NextApiRequest;

const createBrevoPayload = () => ({
  items: [
    {
      Uuid: ["1a825d56-029b-4a41-b8e4-61670463431b"],
      MessageId:
        "<CAN0zNmMsj_xOx8hCREv3rbovcYE3m5rZh8eRe+QSKC0yff_W6A@mail.gmail.com>",
      InReplyTo: "<e6df8cf2-cfb2-2cb6-320f-d9cba05a3001@clubble.me>",
      From: {
        Name: "Antoine Lefeuvre",
        Address: "antoine@mailclark.ai",
      },
      To: [
        {
          Name: "Shortlist Magic Inbox",
          Address: "boardABC.userHash123@magic-inbox.shortlistos.co",
        },
      ],
      Recipients: ["boardABC.userHash123@magic-inbox.shortlistos.co"],
      Cc: [],
      ReplyTo: null,
      SentAtDate: "Tue, 1 Sep 2020 09:53:21 +0200",
      Subject: "Re: Summer brochure 2021",
      RawHtmlBody: "<div>Hi Terry</div>",
      RawTextBody: "Hi Terry",
      ExtractedMarkdownMessage: "Hi Terry",
      ExtractedMarkdownSignature: "**Antoine Lefeuvre**",
      SpamScore: 3.3,
      Attachments: [
        {
          Name: "summer2021.pdf",
          ContentType: "application/pdf",
          ContentLength: 168910,
          ContentID: "f_kejnjyug1",
          DownloadToken: "def",
        },
      ],
      Headers: {
        "Message-ID":
          "<CAN0zNmMsj_xOx8hCREv3rbovcYE3m5rZh8eRe+QSKC0yff_W6A@mail.gmail.com>",
        Subject: "Re: Summer brochure 2021",
        To: "Shortlist Magic Inbox <boardABC.userHash123@magic-inbox.shortlistos.co>",
      },
    },
  ],
});

describe("shortlist magic inbox webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    mockDb._state.accessRows = [
      {
        boardId: 123,
        userId: "owner-user-id",
        shortlistPowerpackActivatedAt: now,
        shortlistPowerpackExpiresAt: tomorrow,
      },
    ];
    mockDb._state.insertedRows = [{ id: "inbox-row-id" }];
    mockDb._state.insertedValues = [];
  });

  it("parses board id and user public secret from the final magic inbox address", () => {
    const item = createBrevoPayload().items.at(0);

    expect(item).toBeDefined();
    if (!item) return;

    const [recipient] = parseMagicInboxRecipientsFromBrevoEmail(item);

    expect(recipient).toEqual({
      boardPublicId: "boardABC",
      userPublicSecret: "userHash123",
    });
  });

  it("inserts a Brevo inbound email source without using a real database", async () => {
    const response = createResponse();

    await handler(createRequest({ body: createBrevoPayload() }), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      duplicates: 0,
      inserted: 1,
      received: 1,
      skipped: 0,
    });
    expect(mockCreateDrizzleClient).toHaveBeenCalledTimes(1);
    expect(mockDb._state.insertedValues).toEqual([
      {
        boardId: 123,
        contentType: "application/json",
        createdBy: "owner-user-id",
        externId:
          "<CAN0zNmMsj_xOx8hCREv3rbovcYE3m5rZh8eRe+QSKC0yff_W6A@mail.gmail.com>",
        processedAt: null,
        processingLog: "Received from Brevo and awaiting processing.",
        processingResult: "RETRY",
        processingTries: 0,
        rawContent: JSON.stringify(createBrevoPayload().items[0]),
        source: "BREVO",
        userId: "owner-user-id",
      },
    ]);
  });

  it("treats an existing MessageId as a duplicate through on-conflict no-op", async () => {
    mockDb._state.insertedRows = [];
    const response = createResponse();

    await handler(createRequest({ body: createBrevoPayload() }), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      duplicates: 1,
      inserted: 0,
      received: 1,
      skipped: 0,
    });
  });

  it("skips an email when board ownership or Powerpack access cannot be resolved", async () => {
    mockDb._state.accessRows = [];
    const response = createResponse();

    await handler(createRequest({ body: createBrevoPayload() }), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      duplicates: 0,
      inserted: 0,
      received: 1,
      skipped: 1,
    });
    expect(mockDb._state.insertedValues).toEqual([]);
  });

  it("rejects unauthorized webhook calls before creating a database client", async () => {
    const response = createResponse();

    await handler(
      createRequest({
        body: createBrevoPayload(),
        headers: { authorization: "Bearer wrong-secret" },
      }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ message: "Unauthorized" });
    expect(mockCreateDrizzleClient).not.toHaveBeenCalled();
    expect(mockDb._state.insertedValues).toEqual([]);
  });
});
