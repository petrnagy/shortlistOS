import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDrizzleClient } from "@kan/db/client";

import handler, {
  getCurrentEmailMessage,
  parseMagicInboxRecipientsFromBrevoEmail,
} from "../../pages/api/shortlist_magic_inbox/incoming_webhook";

const { mockDb, mockEnqueue, mockLogger, mockStoreObject } = vi.hoisted(() => {
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
    insertError: false,
    conflictOptions: null as unknown,
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
        if (
          typeof value === "object" &&
          value !== null &&
          "externId" in value
        ) {
          state.insertedValues.push(value);
        }

        return {
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve(state.insertedRows)),
          })),
          onConflictDoUpdate: vi.fn((options: unknown) => {
            state.conflictOptions = options;
            return {
              returning: vi.fn(() =>
                state.insertError
                  ? Promise.reject(new Error("queue persistence unavailable"))
                  : Promise.resolve(state.insertedRows),
              ),
            };
          }),
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
      Promise.resolve({ id: "object-id", s3Key: "sources/object" }),
    ),
  };
});

vi.mock("~/env", () => ({
  env: {
    BREVO_MAGIC_INBOX_WEBHOOK_SECRET: "test-webhook-secret",
    NEXT_PUBLIC_MAGIC_INBOX_DOMAIN: "magic-inbox.shortlistos.co",
    SHORTLIST_SOURCE_BUCKET_NAME: "source-bucket",
    BREVO_API_KEY: "must-not-be-used-by-webhook",
    SHORTLIST_MAGIC_CLIP_WEBHOOK_SECRET: "test-clip-secret",
    STRIPE_SECRET_KEY: "test-stripe-secret",
    STRIPE_SHORTLIST_WEBHOOK_SECRET: "test-stripe-webhook-secret",
  },
}));

vi.mock("~/utils/shortlistSourceIntake", () => ({
  enqueueShortlistSource: mockEnqueue,
  sanitizeShortlistFilename: (filename: string) => filename,
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
          Base64Content: Buffer.from("PDF fixture").toString("base64"),
        },
      ],
      Headers: {
        "Message-ID":
          "<CAN0zNmMsj_xOx8hCREv3rbovcYE3m5rZh8eRe+QSKC0yff_W6A@mail.gmail.com>",
        Subject: "Re: Summer brochure 2021",
        "In-Reply-To": "<previous-message@example.com>",
        References: "<root-message@example.com> <previous-message@example.com>",
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
    mockDb._state.insertError = false;
    mockDb._state.conflictOptions = null;
    mockEnqueue.mockClear();
    mockStoreObject.mockClear();
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

  it("separates the newest plain-text reply from quoted email history", () => {
    expect(
      getCurrentEmailMessage({
        RawTextBody:
          "The salary increased to EUR 90,000.\nOn Monday Jane wrote:\nOld salary EUR 70,000",
      }),
    ).toMatchObject({
      content: "The salary increased to EUR 90,000.",
      contentType: "text/plain",
    });
  });

  it("durably queues a Brevo inbound email without downloading or storing objects", async () => {
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
      expect.objectContaining({
        boardId: 123,
        createdBy: "owner-user-id",
        externId:
          "<CAN0zNmMsj_xOx8hCREv3rbovcYE3m5rZh8eRe+QSKC0yff_W6A@mail.gmail.com>",
        status: "PENDING",
      }),
    ]);
    const persistedJob = mockDb._state.insertedValues[0] as {
      payloadJson: {
        RawTextBody: string;
        Attachments: { DownloadToken?: string }[];
      };
    };
    expect(persistedJob.payloadJson.RawTextBody).toBe("Hi Terry");
    expect(persistedJob.payloadJson.Attachments[0]?.DownloadToken).toBe("def");
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("treats an existing completed MessageId as a duplicate", async () => {
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

  it("reuses the idempotency key and refreshes a pending job on duplicate delivery", async () => {
    const body = createBrevoPayload();
    const firstResponse = createResponse();
    const secondResponse = createResponse();

    await handler(createRequest({ body }), firstResponse);
    await handler(createRequest({ body }), secondResponse);

    const [firstJob, secondJob] = mockDb._state.insertedValues as {
      idempotencyKey: string;
    }[];
    expect(firstJob?.idempotencyKey).toBe(secondJob?.idempotencyKey);
    const conflictOptions = mockDb._state.conflictOptions as {
      set: { payloadJson: unknown; runAfter: unknown };
      setWhere: unknown;
    };
    expect(conflictOptions.set.payloadJson).toBeDefined();
    expect(conflictOptions.set.runAfter).toBeDefined();
    expect(conflictOptions.setWhere).toBeDefined();
    expect(secondResponse.status).toHaveBeenCalledWith(200);
  });

  it("returns an error when durable queue persistence fails", async () => {
    mockDb._state.insertError = true;
    const response = createResponse();

    await handler(createRequest({ body: createBrevoPayload() }), response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      message: "Webhook handler failed",
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

  it("rejects malformed Brevo payloads before creating a database client", async () => {
    const response = createResponse();

    await handler(createRequest({ body: { items: "not-an-array" } }), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      message: "Invalid Brevo payload",
    });
    expect(mockCreateDrizzleClient).not.toHaveBeenCalled();
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("skips emails without a stable Brevo MessageId", async () => {
    const payload = createBrevoPayload();
    delete (payload.items[0] as { MessageId?: string } | undefined)?.MessageId;
    const response = createResponse();

    await handler(createRequest({ body: payload }), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      duplicates: 0,
      inserted: 0,
      received: 1,
      skipped: 1,
    });
    expect(mockDb._state.insertedValues).toEqual([]);
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it("queues unsupported attachments for body-only processing", async () => {
    const payload = createBrevoPayload();
    const item = payload.items[0];
    expect(item).toBeDefined();
    if (!item) return;
    item.Attachments = [
      {
        Base64Content: Buffer.from("legacy document").toString("base64"),
        ContentID: "legacy-content-id",
        ContentLength: 15,
        ContentType: "application/msword",
        DownloadToken: "legacy-download-token",
        Name: "legacy-offer.doc",
      },
    ];
    const response = createResponse();

    await handler(createRequest({ body: payload }), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockDb._state.insertedValues).toEqual([
      expect.objectContaining({ status: "PENDING" }),
    ]);
  });

  it("rejects non-POST webhook requests without side effects", async () => {
    const response = createResponse();

    await handler(
      createRequest({ body: createBrevoPayload(), method: "GET" }),
      response,
    );

    expect(response.status).toHaveBeenCalledWith(405);
    expect(mockCreateDrizzleClient).not.toHaveBeenCalled();
    expect(mockStoreObject).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
  });
});
