import type { NextApiRequest, NextApiResponse } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";

import handler from "../../pages/api/upload/shortlist-file";

const {
  assertPermissionMock,
  boardLookupMock,
  contextMock,
  enqueueMock,
  mockDb,
  storeObjectMock,
} = vi.hoisted(() => {
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "source-id" }])),
      })),
    })),
  };
  return {
    assertPermissionMock: vi.fn(() => Promise.resolve()),
    boardLookupMock: vi.fn(() => Promise.resolve({ id: 42, workspaceId: 7 })),
    contextMock: vi.fn(() => Promise.resolve({ db, user: { id: "user-id" } })),
    enqueueMock: vi.fn(() => Promise.resolve("job-id")),
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
vi.mock("@kan/api/utils/rateLimit", () => ({
  withRateLimit: (_options: unknown, handler: unknown) => handler,
}));
vi.mock("@kan/db/repository/board.repo", () => ({
  getWorkspaceAndBoardIdByBoardPublicId: boardLookupMock,
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
    query: { boardPublicId: "boardABC12345" },
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
      jobId: "job-id",
      sourceId: "source-id",
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

  it.each(invalidUploadCases)("rejects %s before storing or queueing", async (_label, overrides, error) => {
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
  });

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
