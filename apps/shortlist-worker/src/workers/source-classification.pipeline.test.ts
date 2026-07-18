import { beforeEach, describe, expect, it, vi } from "vitest";

import { classifyEmailSourcesIndependently } from "./source-queue-worker";

const { classifyFactsMock } = vi.hoisted(() => ({
  classifyFactsMock: vi.fn(),
}));

vi.mock("@kan/llm", async () => {
  const actual = await vi.importActual<typeof import("@kan/llm")>("@kan/llm");
  return {
    ...actual,
    classifyOpportunityFactsContent: classifyFactsMock,
  };
});

const extractedSource = (
  role: "ATTACHMENT" | "CURRENT_EMAIL" | "QUOTED_HISTORY",
  filename: string,
  content: string,
) => ({
  buffer: Buffer.from(content),
  content,
  role,
  sourceObject: {
    bucket: "source-bucket",
    contentType: "text/plain",
    fileSize: content.length,
    metadataJson: null,
    objectType: role === "ATTACHMENT" ? "ATTACHMENT_FILE" : "EMAIL_CURRENT",
    originalFilename: filename,
    s3Key: filename,
  },
  warning: null,
});

describe("mocked multi-source email classification pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies body and every attachment separately before TypeScript merges them", async () => {
    classifyFactsMock.mockImplementation(
      (input: { htmlContent: string; sourceRole: string }) => {
        if (input.htmlContent.includes("increased")) {
          return Promise.resolve({
            facts: {
              explicitCorrections: ["salaryMax"],
              fieldEvidence: [],
              isRelevant: true,
              salaryMax: 90_000,
            },
            model: "mock-model",
            rawResponse: {},
            warnings: [],
          });
        }
        if (input.htmlContent.includes("primary")) {
          return Promise.resolve({
            facts: {
              companyName: "Acme",
              explicitCorrections: [],
              fieldEvidence: [],
              isRelevant: true,
              jobTitle: "Senior Developer",
              salaryMax: 70_000,
            },
            model: "mock-model",
            rawResponse: {},
            warnings: [],
          });
        }
        return Promise.resolve({
          facts: {
            explicitCorrections: [],
            fieldEvidence: [],
            isRelevant: true,
            jobLocations: ["Prague"],
          },
          model: "mock-model",
          rawResponse: {},
          warnings: [],
        });
      },
    );

    const result = await classifyEmailSourcesIndependently({
      apiKey: "mock-key",
      existingTitle: null,
      model: "mock-model",
      sourceContent: {
        clippedAt: new Date("2026-07-19T10:00:00.000Z"),
        content: "unused combined content",
        contentHash: "hash",
        contentKind: "email",
        currentEmailContent: "Salary increased",
        provenance: {},
        sourceObjects: [
          extractedSource(
            "CURRENT_EMAIL",
            "current.txt",
            "Salary increased to EUR 90,000",
          ),
          extractedSource("ATTACHMENT", "offer.pdf", "primary offer"),
          extractedSource("ATTACHMENT", "location.docx", "location details"),
        ],
        sourceUrl: null,
      },
    });

    expect(classifyFactsMock).toHaveBeenCalledTimes(3);
    expect(result.classification).toMatchObject({
      isJobOpportunity: true,
      companyName: "Acme",
      jobLocations: ["Prague"],
      jobTitle: "Senior Developer",
      salaryMax: 90_000,
    });
  });

  it("continues when one optional attachment classification fails", async () => {
    classifyFactsMock.mockImplementation((input: { htmlContent: string }) =>
      input.htmlContent.includes("broken")
        ? Promise.reject(new Error("invalid document"))
        : Promise.resolve({
            facts: {
              explicitCorrections: [],
              fieldEvidence: [],
              isRelevant: true,
              jobTitle: "Senior Developer",
            },
            model: "mock-model",
            rawResponse: {},
            warnings: [],
          }),
    );

    const result = await classifyEmailSourcesIndependently({
      apiKey: "mock-key",
      existingTitle: null,
      model: "mock-model",
      sourceContent: {
        clippedAt: new Date(),
        content: "unused",
        contentHash: "hash",
        contentKind: "email",
        currentEmailContent: "Senior Developer",
        provenance: {},
        sourceObjects: [
          extractedSource("CURRENT_EMAIL", "current.txt", "Senior Developer"),
          extractedSource("ATTACHMENT", "broken.pdf", "broken attachment"),
        ],
        sourceUrl: null,
      },
    });

    expect(result.classification).toMatchObject({
      isJobOpportunity: true,
      jobTitle: "Senior Developer",
    });
    expect(result.warnings[0]).toContain("broken.pdf: invalid document");
  });
});
