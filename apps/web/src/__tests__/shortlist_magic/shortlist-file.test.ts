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

describe("direct shortlist file upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
