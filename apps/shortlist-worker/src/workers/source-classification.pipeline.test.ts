import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as LlmModule from "@kan/llm";

import {
  buildEnrichmentPatch,
  classifyEmailSourcesIndependently,
  mergeContacts,
  mergeDescription,
  selectClassifiableObjects,
} from "./source-queue-worker";

const { classifyFactsMock } = vi.hoisted(() => ({
  classifyFactsMock: vi.fn(),
}));

vi.mock("@kan/llm", async () => {
  const actual = await vi.importActual<typeof LlmModule>("@kan/llm");
  return {
    ...actual,
    classifyOpportunityFactsContent: classifyFactsMock,
  };
});

type ExistingCard = Parameters<typeof buildEnrichmentPatch>[0];
type IncomingCard = Parameters<typeof buildEnrichmentPatch>[1];
type IncomingContact = IncomingCard["contactsJson"][number];

const contact = (id: string, name: string, email: string): IncomingContact => ({
  id,
  methods: [{ id: `${id}-email`, type: "EMAIL", value: email }],
  name,
  role: "RECRUITER",
});

const existingCard = (overrides: Partial<ExistingCard> = {}): ExistingCard => ({
  contactsJson: [contact("existing", "Existing", "existing@example.test")],
  description: "Original description",
  dueDate: null,
  manualUpdatedOnly: false,
  shortlistCompanyLocation: null,
  shortlistCompanyName: "Acme",
  shortlistJobLocation: null,
  shortlistJobLocationType: null,
  shortlistJobPostingUrl: "https://acme.test/jobs/123",
  shortlistJobType: "FULL_TIME",
  shortlistSalaryCurrency: "EUR",
  shortlistSalaryInterval: "PER_YEAR",
  shortlistSalaryMax: null,
  shortlistSalaryMin: null,
  title: "Senior Developer",
  ...overrides,
});

const incomingCard = (overrides: Partial<IncomingCard> = {}): IncomingCard => ({
  contactsJson: [],
  description: "",
  dueDate: null,
  shortlistCardSource: "EMAIL_INBOX",
  shortlistCompanyLocation: null,
  shortlistCompanyName: "Acme",
  shortlistJobLocation: null,
  shortlistJobLocationType: null,
  shortlistJobPostingUrl: null,
  shortlistJobType: "FULL_TIME",
  shortlistSalaryCurrency: null,
  shortlistSalaryInterval: "PER_MONTH",
  shortlistSalaryMax: null,
  shortlistSalaryMin: null,
  title: "Senior Developer",
  ...overrides,
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
      timeZone: "Europe/Budapest",
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
    expect(classifyFactsMock).toHaveBeenCalledWith(
      expect.objectContaining({ timeZone: "Europe/Budapest" }),
    );
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
      timeZone: "America/New_York",
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

  it("keeps source priority stable regardless of LLM completion order", async () => {
    const scenarios = {
      current: {
        delay: 5,
        facts: {
          companyName: "Current Company",
          description: "Current email description",
          explicitCorrections: [],
          fieldEvidence: [],
          isRelevant: true,
          jobLocations: ["Budapest"],
          jobTitle: "Current Email Engineer",
          salaryMax: 90_000,
        },
      },
      history: {
        delay: 1,
        facts: {
          companyHQ: "History HQ",
          description: "Quoted history description",
          explicitCorrections: [],
          fieldEvidence: [],
          isRelevant: true,
          jobTitle: "History Engineer",
          salaryMin: 60_000,
        },
      },
      primary: {
        delay: 30,
        facts: {
          companyName: "Primary Attachment Company",
          description: "Primary attachment description",
          explicitCorrections: [],
          fieldEvidence: [],
          isRelevant: true,
          jobLocations: ["Berlin"],
          jobTitle: "Primary Attachment Engineer",
          salaryMax: 100_000,
        },
      },
      secondary: {
        delay: 0,
        facts: {
          companyName: "Secondary Attachment Company",
          description: "Secondary attachment description",
          explicitCorrections: [],
          fieldEvidence: [],
          isRelevant: true,
          jobLocations: ["Prague"],
          jobTitle: "Secondary Attachment Engineer",
          salaryMin: 80_000,
          workSchedule: "PART_TIME",
        },
      },
    } as const;
    classifyFactsMock.mockImplementation(
      async (input: { htmlContent: string }) => {
        const scenario = scenarios[input.htmlContent as keyof typeof scenarios];
        await new Promise((resolve) => setTimeout(resolve, scenario.delay));
        return {
          facts: scenario.facts,
          model: "mock-model",
          rawResponse: {},
          warnings: [],
        };
      },
    );

    const result = await classifyEmailSourcesIndependently({
      apiKey: "mock-key",
      existingTitle: null,
      model: "mock-model",
      timeZone: "Europe/Budapest",
      sourceContent: {
        clippedAt: new Date("2026-07-19T10:00:00.000Z"),
        content: "unused",
        contentHash: "hash",
        contentKind: "email",
        currentEmailContent: "current",
        provenance: {},
        sourceObjects: [
          extractedSource("CURRENT_EMAIL", "current.md", "current"),
          extractedSource("ATTACHMENT", "primary.pdf", "primary"),
          extractedSource("ATTACHMENT", "secondary.docx", "secondary"),
          extractedSource("QUOTED_HISTORY", "history.eml", "history"),
        ],
        sourceUrl: null,
      },
    });

    expect(result.classification).toMatchObject({
      companyHQ: "History HQ",
      companyName: "Primary Attachment Company",
      description: [
        "Primary attachment description",
        "Secondary attachment description",
        "Current email description",
        "Quoted history description",
      ].join("\n\n"),
      isJobOpportunity: true,
      jobLocations: ["Budapest", "Berlin", "Prague"],
      jobTitle: "Primary Attachment Engineer",
      salaryMax: 100_000,
      salaryMin: 80_000,
      workSchedule: "PART_TIME",
    });
  });

  it("lets explicit current-email corrections override attachments", async () => {
    classifyFactsMock.mockImplementation((input: { htmlContent: string }) =>
      Promise.resolve({
        facts:
          input.htmlContent === "current correction"
            ? {
                description: "Corrected current description",
                explicitCorrections: ["description", "salaryMax"],
                fieldEvidence: [],
                isRelevant: true,
                jobTitle: "Corrected Engineer",
                salaryMax: 130_000,
              }
            : {
                description: "Outdated attachment description",
                explicitCorrections: [],
                fieldEvidence: [],
                isRelevant: true,
                jobTitle: "Attachment Engineer",
                salaryMax: 100_000,
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
      timeZone: "UTC",
      sourceContent: {
        clippedAt: new Date(),
        content: "unused",
        contentHash: "hash",
        contentKind: "email",
        currentEmailContent: "current correction",
        provenance: {},
        sourceObjects: [
          extractedSource("CURRENT_EMAIL", "current.md", "current correction"),
          extractedSource("ATTACHMENT", "offer.pdf", "attachment"),
        ],
        sourceUrl: null,
      },
    });

    expect(result.classification).toMatchObject({
      description: "Corrected current description",
      explicitCorrections: ["description", "salaryMax"],
      jobTitle: "Attachment Engineer",
      salaryMax: 130_000,
    });
  });

  it("orders attachments by their persisted source index", () => {
    const current = extractedSource(
      "CURRENT_EMAIL",
      "current.md",
      "current",
    ).sourceObject;
    const primary = {
      ...extractedSource("ATTACHMENT", "primary.pdf", "primary").sourceObject,
      metadataJson: { "source-order": "0" },
    };
    const secondary = {
      ...extractedSource("ATTACHMENT", "secondary.pdf", "secondary")
        .sourceObject,
      metadataJson: { "source-order": "1" },
    };

    const selected = selectClassifiableObjects("EMAIL", [
      secondary,
      current,
      primary,
    ]);

    expect(
      selected
        .filter(({ role }) => role === "ATTACHMENT")
        .map(({ sourceObject }) => sourceObject.originalFilename),
    ).toEqual(["primary.pdf", "secondary.pdf"]);
  });
});

describe("deterministic duplicate enrichment", () => {
  it("fills empty fields and merges descriptions and unique contacts", () => {
    const result = buildEnrichmentPatch(
      existingCard(),
      incomingCard({
        contactsJson: [
          contact("existing", "Existing", "existing@example.test"),
          contact("recruiter", "Recruiter", "recruiter@example.test"),
        ],
        description: "New interview process details",
        shortlistCompanyName: "Wrong Company",
        shortlistSalaryMax: 120_000,
        title: "Wrong title",
      }),
      new Set(),
    );

    expect(result.changedFields).toEqual([
      "Maximum salary",
      "Description",
      "Contacts",
    ]);
    expect(result.patch).toMatchObject({
      contactsJson: [
        contact("existing", "Existing", "existing@example.test"),
        contact("recruiter", "Recruiter", "recruiter@example.test"),
      ],
      shortlistSalaryMax: 120_000,
    });
    expect(result.patch.title).toBeUndefined();
    expect(result.patch.shortlistCompanyName).toBeUndefined();
    expect(result.patch.description).toContain("Original description");
    expect(result.patch.description).toContain("New interview process details");
  });

  it("overwrites populated fields only when explicitly corrected", () => {
    const result = buildEnrichmentPatch(
      existingCard({ shortlistSalaryMax: 100_000 }),
      incomingCard({
        shortlistCompanyName: "Acme GmbH",
        shortlistSalaryMax: 125_000,
        title: "Staff Developer",
      }),
      new Set(["companyName", "jobTitle", "salaryMax"]),
    );

    expect(result.patch).toMatchObject({
      shortlistCompanyName: "Acme GmbH",
      shortlistSalaryMax: 125_000,
      title: "Staff Developer",
    });
  });

  it("changes only fields backed by new evidence", () => {
    const result = buildEnrichmentPatch(
      existingCard(),
      incomingCard({
        contactsJson: [contact("new", "New", "new@example.test")],
        description: "Unverified description",
        shortlistSalaryMax: 95_000,
      }),
      new Set(),
      new Set(["salaryMax"]),
    );

    expect(result.changedFields).toEqual(["Maximum salary"]);
    expect(result.patch).toEqual({ shortlistSalaryMax: 95_000 });
  });

  it("does not auto-enrich a manually locked card", () => {
    const result = buildEnrichmentPatch(
      existingCard({ manualUpdatedOnly: true }),
      incomingCard({
        description: "New details",
        shortlistSalaryMax: 95_000,
      }),
      new Set(["salaryMax"]),
    );

    expect(result).toEqual({ changedFields: [], patch: {} });
  });

  it("deduplicates descriptions and contacts", () => {
    expect(
      mergeDescription("Original description", "Original description"),
    ).toBe("Original description");
    expect(
      mergeContacts(
        [{ email: "recruiter@example.test", name: "Recruiter" }],
        [
          { email: "recruiter@example.test", name: "Recruiter" },
          { email: "hiring@example.test", name: "Hiring manager" },
        ],
      ),
    ).toHaveLength(2);
  });
});
