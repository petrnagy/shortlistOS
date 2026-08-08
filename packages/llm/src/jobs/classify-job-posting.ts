/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-23
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import TurndownService from "turndown";
import { z } from "zod";

import {
  CARD_CONTACT_METHOD_TYPE_OPTIONS,
  CARD_CONTACT_ROLE_OPTIONS,
} from "@kan/shared/constants";

import { completeLlmMessage } from "../llm-connector";

const DEFAULT_MAX_CONTENT_CHARS = 30_000;
const JOB_POSTING_CLASSIFICATION_TEMPLATE = readFileSync(
  fileURLToPath(
    new URL("./prompts/job-posting-classification.md", import.meta.url),
  ),
  "utf8",
).trim();
const OPPORTUNITY_FACTS_CLASSIFICATION_TEMPLATE = readFileSync(
  fileURLToPath(
    new URL("./prompts/opportunity-facts-classification.md", import.meta.url),
  ),
  "utf8",
).trim();
const JOB_DESCRIPTION_MARKDOWN_TEMPLATE = readFileSync(
  fileURLToPath(
    new URL("./prompts/job-description-markdown.md", import.meta.url),
  ),
  "utf8",
).trim();

export const jobPostingRejectionSchema = z.object({
  isJobOpportunity: z.literal(false),
  pageType: z
    .enum([
      "JOB_SEARCH_RESULTS",
      "CAREERS_PAGE",
      "TALENT_POOL",
      "ARTICLE",
      "OTHER",
    ])
    .catch("OTHER"),
  rejectionReason: z
    .string()
    .catch("The source is not a specific job opportunity."),
});

const nullableStringSchema = z.string().nullable().catch(null);
const nullableIsoDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .catch(null);
const nullableIntegerSchema = z.number().int().nullable().catch(null);
const stringArraySchema = z.array(z.string()).catch([]);

const jobPostingContactRoleOptions = new Set<string>(CARD_CONTACT_ROLE_OPTIONS);

const jobPostingContactRoleSchema = z.preprocess(
  (value) =>
    typeof value === "string" &&
    value.length > 0 &&
    !jobPostingContactRoleOptions.has(value)
      ? "OTHER"
      : value,
  z.enum(CARD_CONTACT_ROLE_OPTIONS),
);

const jobPostingContactMethodTypeSchema = z.enum(
  CARD_CONTACT_METHOD_TYPE_OPTIONS,
);

const jobPostingContactsJsonSchema = z.array(
  z.object({
    id: z.string().min(1),
    role: jobPostingContactRoleSchema,
    name: z.string().min(1).max(255),
    methods: z.array(
      z.object({
        id: z.string().min(1),
        type: jobPostingContactMethodTypeSchema,
        value: z.string().min(1).max(1000),
      }),
    ),
  }),
);

export const jobPostingSuccessSchema = z.object({
  isJobOpportunity: z.literal(true),
  pageType: z.literal("JOB_POSTING"),
  jobTitle: z.string().trim().min(1),
  jobTitleNormalized: nullableStringSchema,
  jobTitleDisplay: nullableStringSchema,
  jobTitleBroader: nullableStringSchema,
  jobTitleAtoms: z
    .object({
      seniority: z
        .enum([
          "INTERN",
          "JUNIOR",
          "MID",
          "SENIOR",
          "LEAD",
          "STAFF",
          "PRINCIPAL",
        ])
        .nullable()
        .catch(null),
      occupation: nullableStringSchema,
      titleSpecializations: stringArraySchema,
      managementLevel: z
        .enum([
          "INDIVIDUAL_CONTRIBUTOR",
          "SUPERVISOR",
          "TEAM_LEAD",
          "DEPUTY_MANAGER",
          "MANAGER",
          "HEAD_OF_DEPARTMENT",
          "DIRECTOR",
          "EXECUTIVE",
        ])
        .nullable()
        .catch(null),
    })
    .catch({
      seniority: null,
      occupation: null,
      titleSpecializations: [],
      managementLevel: null,
    }),
  salaryLookupTitles: stringArraySchema,
  companyName: nullableStringSchema,
  companyWebsiteUrl: nullableStringSchema,
  companyHQ: nullableStringSchema,
  sourceJobId: nullableStringSchema,
  requisitionId: nullableStringSchema,
  postingStatus: z.enum(["ACTIVE", "EXPIRED", "UNKNOWN"]).catch("UNKNOWN"),
  description: nullableStringSchema,
  salaryMin: nullableIntegerSchema,
  salaryMax: nullableIntegerSchema,
  salarySingle: nullableIntegerSchema,
  salaryCurrency: nullableStringSchema,
  salaryPeriod: z
    .enum(["ANNUAL", "MONTHLY", "WEEKLY", "DAILY", "HOURLY"])
    .nullable()
    .catch(null),
  salarySource: z
    .enum(["EMPLOYER_PROVIDED", "PLATFORM_ESTIMATE", "UNKNOWN"])
    .nullable()
    .catch(null),
  salaryOriginalText: nullableStringSchema,
  workSchedule: z.enum(["FULL_TIME", "PART_TIME"]).nullable().catch(null),
  engagementType: z
    .enum([
      "EMPLOYEE",
      "CONTRACTOR",
      "FREELANCE",
      "INTERNSHIP",
      "TEMPORARY",
      "SEASONAL",
    ])
    .nullable()
    .catch(null),
  engagementTypeSource: z
    .enum(["EXPLICIT", "INFERRED", "UNKNOWN"])
    .catch("UNKNOWN"),
  locationType: z.enum(["REMOTE", "HYBRID", "ON_SITE"]).nullable().catch(null),
  jobLocations: stringArraySchema,
  remoteLocationRestriction: nullableStringSchema,
  applicationDeadline: nullableStringSchema,
  interviewDateTime: nullableIsoDateTimeSchema,
  contactsJson: jobPostingContactsJsonSchema.catch([]),
  equityMentioned: z.boolean().catch(false),
  fieldEvidence: z
    .array(
      z.object({
        field: z.string().min(1),
        source: z.string().min(1),
        quote: z.string().max(500).nullable().catch(null),
      }),
    )
    .catch([]),
  explicitCorrections: stringArraySchema,
});

export const opportunityFactsSchema = jobPostingSuccessSchema
  .omit({ isJobOpportunity: true, pageType: true })
  .partial()
  .extend({
    isRelevant: z.boolean().catch(false),
    rejectionReason: nullableStringSchema.optional(),
    explicitCorrections: stringArraySchema,
    fieldEvidence: z
      .array(
        z.object({
          field: z.string().min(1),
          quote: z.string().max(500).nullable().catch(null),
        }),
      )
      .catch([]),
  });

export const jobPostingClassificationSchema = z.union([
  jobPostingRejectionSchema,
  jobPostingSuccessSchema,
]);

export type JobPostingClassification = z.infer<
  typeof jobPostingClassificationSchema
>;
export type OpportunityFacts = z.infer<typeof opportunityFactsSchema>;

export interface ClassifyJobPostingContentInput {
  apiKey: string;
  model: string;
  htmlContent: string;
  timeZone?: string;
  sourceUrl?: string | null;
  clippedAt?: Date | string | null;
  contentKind?: "webpage" | "email";
  maxContentChars?: number;
}

export interface ClassifyJobPostingContentResult {
  classification: JobPostingClassification;
  warnings: string[];
  model: string;
  rawResponse: unknown;
}

export interface ClassifyOpportunityFactsInput
  extends ClassifyJobPostingContentInput {
  sourceRole: "ATTACHMENT" | "CURRENT_EMAIL" | "QUOTED_HISTORY";
}

export interface ClassifyOpportunityFactsResult {
  facts: OpportunityFacts;
  model: string;
  rawResponse: unknown;
  warnings: string[];
}

export interface ExtractJobDescriptionMarkdownInput {
  apiKey: string;
  model: string;
  htmlContent: string;
  sourceUrl?: string | null;
  maxContentChars?: number;
}

export interface ExtractJobDescriptionMarkdownResult {
  markdown: string;
  model: string;
  rawResponse: unknown;
  warnings: string[];
}

interface PreparedContent {
  content: string;
  contentFormat: "MARKDOWN" | "RAW_HTML";
  warnings: string[];
}

export async function classifyJobPostingContent({
  apiKey,
  model,
  htmlContent,
  sourceUrl = null,
  clippedAt = null,
  contentKind = "webpage",
  maxContentChars = DEFAULT_MAX_CONTENT_CHARS,
  timeZone = "UTC",
}: ClassifyJobPostingContentInput): Promise<ClassifyJobPostingContentResult> {
  const preparedContent = prepareClassificationContent(
    htmlContent,
    maxContentChars,
  );
  const prompt = buildJobPostingClassificationPrompt({
    sourceUrl,
    clippedAt,
    contentKind,
    content: preparedContent.content,
    contentFormat: preparedContent.contentFormat,
    timeZone,
    warnings: preparedContent.warnings,
  });

  const response = await completeLlmMessage({
    apiKey,
    model,
    message: prompt,
    responseFormat: "json_object",
  });

  return {
    classification: parseJobPostingClassification(response.content),
    warnings: preparedContent.warnings,
    model: response.model,
    rawResponse: response.raw,
  };
}

export async function classifyOpportunityFactsContent({
  apiKey,
  model,
  htmlContent,
  sourceUrl = null,
  clippedAt = null,
  maxContentChars = DEFAULT_MAX_CONTENT_CHARS,
  sourceRole,
  timeZone = "UTC",
}: ClassifyOpportunityFactsInput): Promise<ClassifyOpportunityFactsResult> {
  const preparedContent = prepareClassificationContent(
    htmlContent,
    maxContentChars,
  );
  const response = await completeLlmMessage({
    apiKey,
    model,
    message: buildOpportunityFactsPrompt({
      clippedAt,
      content: preparedContent.content,
      contentFormat: preparedContent.contentFormat,
      sourceRole,
      sourceUrl,
      timeZone,
    }),
    responseFormat: "json_object",
  });

  return {
    facts: opportunityFactsSchema.parse(
      JSON.parse(extractJsonObject(response.content)) as unknown,
    ),
    model: response.model,
    rawResponse: response.raw,
    warnings: preparedContent.warnings,
  };
}

export async function extractJobDescriptionMarkdown({
  apiKey,
  model,
  htmlContent,
  sourceUrl = null,
  maxContentChars = DEFAULT_MAX_CONTENT_CHARS,
}: ExtractJobDescriptionMarkdownInput): Promise<ExtractJobDescriptionMarkdownResult> {
  const preparedContent = prepareClassificationContent(
    htmlContent,
    maxContentChars,
  );
  const response = await completeLlmMessage({
    apiKey,
    model,
    message: buildJobDescriptionMarkdownPrompt({
      content: preparedContent.content,
      contentFormat: preparedContent.contentFormat,
      sourceUrl,
      warnings: preparedContent.warnings,
    }),
  });

  return {
    markdown: sanitizeJobDescriptionMarkdown(response.content),
    model: response.model,
    rawResponse: response.raw,
    warnings: preparedContent.warnings,
  };
}

export function buildJobDescriptionMarkdownPrompt({
  content,
  contentFormat,
  sourceUrl,
  warnings,
}: {
  content: string;
  contentFormat: "MARKDOWN" | "RAW_HTML";
  sourceUrl: string | null;
  warnings: string[];
}): string {
  return renderPromptTemplate(JOB_DESCRIPTION_MARKDOWN_TEMPLATE, {
    CONTENT: content,
    CONTENT_FORMAT: contentFormat,
    CONVERSION_WARNINGS: JSON.stringify(warnings),
    SOURCE_URL: sourceUrl ?? "null",
  });
}

export function sanitizeJobDescriptionMarkdown(markdown: string): string {
  const withoutFences = markdown
    .trim()
    .replace(/^```(?:markdown|md)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
  const withoutControlCharacters = Array.from(withoutFences)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (
        codePoint === 9 ||
        codePoint === 10 ||
        (codePoint >= 32 && codePoint !== 127)
      );
    })
    .join("");

  return withoutControlCharacters
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(
      /\[([^\]]+)\]\(\s*(?:javascript|data|vbscript|file):[^)]*\)/gi,
      "$1",
    )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function buildOpportunityFactsPrompt({
  clippedAt,
  content,
  contentFormat,
  sourceRole,
  sourceUrl,
  timeZone,
}: {
  clippedAt: Date | string | null;
  content: string;
  contentFormat: "MARKDOWN" | "RAW_HTML";
  sourceRole: ClassifyOpportunityFactsInput["sourceRole"];
  sourceUrl: string | null;
  timeZone: string;
}): string {
  return renderPromptTemplate(OPPORTUNITY_FACTS_CLASSIFICATION_TEMPLATE, {
    CLIPPED_AT: formatClippedAt(clippedAt),
    CONTENT: content,
    CONTENT_FORMAT: contentFormat,
    SOURCE_ROLE: sourceRole,
    SOURCE_URL: sourceUrl ?? "null",
    USER_TIME_ZONE: timeZone,
  });
}

function renderPromptTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Missing prompt template value: ${key}`);
    }
    return value;
  });
}

export function convertHtmlToJobPostingMarkdown(html: string): string {
  const turndown = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    headingStyle: "atx",
  });

  turndown.remove(["script", "style", "noscript", "svg", "canvas"]);

  return normalizeContent(turndown.turndown(html));
}

export function buildJobPostingClassificationPrompt({
  sourceUrl,
  clippedAt,
  contentKind,
  content,
  contentFormat,
  timeZone,
  warnings,
}: {
  sourceUrl: string | null;
  clippedAt: Date | string | null;
  contentKind: "webpage" | "email";
  content: string;
  contentFormat: "MARKDOWN" | "RAW_HTML";
  timeZone: string;
  warnings: string[];
}): string {
  return renderPromptTemplate(JOB_POSTING_CLASSIFICATION_TEMPLATE, {
    CLIPPED_AT: formatClippedAt(clippedAt),
    CONTENT: content,
    CONTENT_FORMAT: contentFormat,
    CONTENT_KIND: contentKind,
    CONVERSION_WARNINGS: JSON.stringify(warnings),
    SOURCE_URL: sourceUrl ?? "null",
    USER_TIME_ZONE: timeZone,
  });
}

function prepareClassificationContent(
  htmlContent: string,
  maxContentChars: number,
): PreparedContent {
  const warnings: string[] = [];
  const trimmedHtml = htmlContent.trim();

  if (!trimmedHtml) {
    throw new Error("Job posting classification requires HTML content.");
  }

  try {
    const markdown = convertHtmlToJobPostingMarkdown(trimmedHtml);

    if (!markdown) {
      throw new Error("HTML converted to empty markdown.");
    }

    return {
      content: truncateContent(markdown, maxContentChars, warnings),
      contentFormat: "MARKDOWN",
      warnings,
    };
  } catch (error) {
    warnings.push(
      `HTML to markdown conversion failed; using raw HTML instead. ${getErrorMessage(error)}`,
    );

    return {
      content: truncateContent(trimmedHtml, maxContentChars, warnings),
      contentFormat: "RAW_HTML",
      warnings,
    };
  }
}

function parseJobPostingClassification(
  content: string,
): JobPostingClassification {
  const parsed = JSON.parse(extractJsonObject(content)) as unknown;

  return jobPostingClassificationSchema.parse(parsed);
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("LLM response did not contain a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function truncateContent(
  content: string,
  maxContentChars: number,
  warnings: string[],
): string {
  const normalized = normalizeContent(content);

  if (normalized.length <= maxContentChars) {
    return normalized;
  }

  warnings.push(
    `Content was truncated from ${normalized.length} to ${maxContentChars} characters before classification.`,
  );

  return `${normalized.slice(0, maxContentChars)}

[Content truncated before classification. The beginning of the document was preserved.]`;
}

function normalizeContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatClippedAt(clippedAt: Date | string | null): string {
  if (!clippedAt) {
    return "null";
  }

  if (clippedAt instanceof Date) {
    return clippedAt.toISOString();
  }

  return clippedAt;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error.";
}
