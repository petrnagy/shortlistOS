import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import handler from "../../pages/api/upload/shortlist-file";

const {
  assertPermissionMock,
  assertWorkspaceMock,
  boardLookupMock,
  contextMock,
  enqueueMock,
  mockDb,
  storeObjectMock,
  sourceActivityMock,
} = vi.hoisted(() => {
  const db = {
    query: {
      users: { findFirst: vi.fn() },
      boards: { findFirst: vi.fn() },
      lists: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "source-id" }])),
      })),
    })),
  };
  return {
    assertPermissionMock: vi.fn(() => Promise.resolve()),
    assertWorkspaceMock: vi.fn(() => Promise.resolve()),
    boardLookupMock: vi.fn(() => Promise.resolve({ id: 42, workspaceId: 7 })),
    contextMock: vi.fn(() => Promise.resolve({ db, user: { id: "user-id" } })),
    enqueueMock: vi.fn(() => Promise.resolve("job-id")),
    sourceActivityMock: vi.fn(() => Promise.resolve()),
    mockDb: db,
    storeObjectMock: vi.fn(() =>
      Promise.resolve({ id: "object-id", s3Key: "sources/offer.pdf" }),
    ),
  };
});

vi.mock("@kan/api/trpc", () => ({ createNextApiContext: contextMock }));
vi.mock("@kan/api/utils/apiLogging", () => ({
  withApiLogging: (handler: unknown) => handler,
}));
vi.mock("@kan/api/utils/permissions", () => ({
  assertPermission: assertPermissionMock,
}));
vi.mock("@kan/api/utils/auth", () => ({
  assertUserInWorkspace: assertWorkspaceMock,
}));
vi.mock("@kan/api/utils/rateLimit", () => ({
  withRateLimit: (_options: unknown, handler: unknown) => handler,
}));
vi.mock("@kan/db/repository/board.repo", () => ({
  getWorkspaceAndBoardIdByBoardPublicId: boardLookupMock,
}));
vi.mock("@kan/db/repository/shortlistActivityLog.repo", () => ({
  ensureShortlistRobotUser: vi.fn(() => Promise.resolve()),
  createSourceActivity: sourceActivityMock,
}));
vi.mock("~/env", () => ({
  env: { SHORTLIST_SOURCE_BUCKET_NAME: "source-bucket" },
}));
vi.mock("~/utils/shortlistSourceIntake", () => ({
  enqueueShortlistSource: enqueueMock,
  sanitizeShortlistFilename: (filename: string) => filename,
  storeShortlistSourceObject: storeObjectMock,
}));

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

const createRequest = (filename: string) =>
  ({
    headers: {
      "content-length": "100",
      "content-type": "application/pdf",
      "x-original-filename": filename,
    },
    method: "POST",
    query: { boardPublicId: "boardABC1234" },
  }) as unknown as NextApiRequest;

const invalidUploadCases: [
  string,
  {
    headers?: NextApiRequest["headers"];
    query?: NextApiRequest["query"];
  },
  string,
][] = [
  [
    "an invalid board id",
    { query: { boardPublicId: "short" } },
    "Invalid boardPublicId",
  ],
  [
    "a missing content type",
    { headers: { "content-type": undefined } },
    "Missing content type",
  ],
  [
    "an invalid content length",
    { headers: { "content-length": "not-a-number" } },
    "Missing or invalid content length",
  ],
  [
    "an empty upload",
    { headers: { "content-length": "0" } },
    "Missing or invalid content length",
  ],
  [
    "an oversized upload",
    { headers: { "content-length": String(10 * 1024 * 1024 + 1) } },
    "File too large",
  ],
];

describe("direct shortlist file upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertPermissionMock.mockResolvedValue(undefined);
    assertWorkspaceMock.mockResolvedValue(undefined);
    mockDb.query.users.findFirst.mockResolvedValue({
      shortlistPowerpackActivatedAt: new Date(Date.now() - 86_400_000),
      shortlistPowerpackExpiresAt: new Date(Date.now() + 86_400_000),
    });
    mockDb.query.boards.findFirst.mockResolvedValue({
      publicId: "boardABC1234",
    });
    mockDb.query.lists.findFirst.mockResolvedValue({
      publicId: "listABC12345",
    });
    boardLookupMock.mockResolvedValue({ id: 42, workspaceId: 7 });
    enqueueMock.mockResolvedValue("job-id");
    storeObjectMock.mockResolvedValue({
      id: "object-id",
      s3Key: "sources/offer.pdf",
    });
  });

  it("stores and queues an authenticated supported upload", async () => {
    const response = createResponse();
    await handler(createRequest("offer.pdf"), response);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      accepted: true,
    });
    expect(assertPermissionMock).toHaveBeenCalledWith(
      mockDb,
      "user-id",
      7,
      "card:create",
    );
    expect(storeObjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        boardId: 42,
        filename: "offer.pdf",
        objectType: "ATTACHMENT_FILE",
      }),
    );
    expect(enqueueMock).toHaveBeenCalledOnce();
    expect(sourceActivityMock).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        activityType: "source.upload.received",
        activityResult: "SUCCESS",
      }),
    );
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadJson: expect.objectContaining({
          listPublicId: "listABC12345",
          intakeMethod: "upload",
        }) as unknown,
      }),
    );
  });

  it.each(["link", "text"] as const)(
    "queues %s through the attachment pipeline with destination and provenance",
    async (intakeMethod) => {
      const request = createRequest(
        intakeMethod === "link"
          ? "job-opportunity.html"
          : "job-opportunity.txt",
      );
      request.headers["content-type"] =
        intakeMethod === "link"
          ? "text/html;charset=utf-8"
          : "text/plain;charset=utf-8";
      request.query = {
        boardPublicId: "boardABC1234",
        listPublicId: "listABC12345",
        intakeMethod,
        ...(intakeMethod === "link"
          ? { sourceUrl: "https://example.com/jobs/123" }
          : {}),
      };
      const response = createResponse();
      await handler(request, response);
      expect(response.status).toHaveBeenCalledWith(200);
      expect(enqueueMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: "ATTACHMENT",
          payloadJson: expect.objectContaining({
            intakeMethod,
            listPublicId: "listABC12345",
            sourceUrl:
              intakeMethod === "link"
                ? "https://example.com/jobs/123"
                : undefined,
          }) as unknown,
        }),
      );
    },
  );

  it.each(["expired", "missing"])(
    "rejects %s Powerpack before storing content",
    async (status) => {
      mockDb.query.users.findFirst.mockResolvedValueOnce(
        status === "missing"
          ? undefined
          : {
              shortlistPowerpackActivatedAt: new Date(
                Date.now() - 2 * 86_400_000,
              ),
              shortlistPowerpackExpiresAt: new Date(Date.now() - 86_400_000),
            },
      );
      const response = createResponse();
      await handler(createRequest("offer.pdf"), response);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(storeObjectMock).not.toHaveBeenCalled();
      expect(enqueueMock).not.toHaveBeenCalled();
    },
  );

  it("rejects users outside the workspace", async () => {
    assertWorkspaceMock.mockRejectedValueOnce(new Error("Forbidden"));
    const response = createResponse();
    await handler(createRequest("offer.pdf"), response);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it.each(["boards", "lists"] as const)(
    "rejects unavailable %s before creating a source",
    async (table) => {
      mockDb.query[table].findFirst.mockResolvedValueOnce(undefined);
      const response = createResponse();
      await handler(createRequest("offer.pdf"), response);
      expect(response.status).toHaveBeenCalledWith(404);
      expect(mockDb.insert).not.toHaveBeenCalled();
    },
  );

  it.each([
    { intakeMethod: "link" },
    { intakeMethod: "link", sourceUrl: "file:///etc/passwd" },
    {
      intakeMethod: "link",
      sourceUrl: "https://user:password@example.com/job",
    },
    { intakeMethod: "unknown" },
    { listPublicId: "invalid" },
  ])("rejects invalid import options %j", async (options) => {
    const request = createRequest("offer.pdf");
    request.query = { ...request.query, ...options };
    const response = createResponse();
    await handler(request, response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("rejects legacy doc files before storing anything", async () => {
    const response = createResponse();
    await handler(createRequest("offer.doc"), response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "Unsupported file type",
    });
    expect(storeObjectMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it.each(invalidUploadCases)(
    "rejects %s before storing or queueing",
    async (_label, overrides, error) => {
      const request = createRequest("offer.pdf") as NextApiRequest &
        Record<string, unknown>;
      if (overrides.headers) {
        request.headers = { ...request.headers, ...overrides.headers };
      }
      if (overrides.query) request.query = overrides.query;
      const response = createResponse();

      await handler(request, response);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith({ error });
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(storeObjectMock).not.toHaveBeenCalled();
      expect(enqueueMock).not.toHaveBeenCalled();
    },
  );

  it("rejects an upload for an unknown board before creating a source", async () => {
    boardLookupMock.mockResolvedValueOnce(null as never);
    const response = createResponse();

    await handler(createRequest("offer.pdf"), response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ error: "Board not found" });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(storeObjectMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("rejects an upload without card creation permission", async () => {
    assertPermissionMock.mockRejectedValueOnce(new Error("Forbidden"));
    const response = createResponse();

    await handler(createRequest("offer.pdf"), response);

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({ error: "Permission denied" });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(storeObjectMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("rejects non-POST uploads before authentication or storage", async () => {
    const request = createRequest("offer.pdf");
    request.method = "GET";
    const response = createResponse();

    await handler(request, response);

    expect(response.status).toHaveBeenCalledWith(405);
    expect(contextMock).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(storeObjectMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
