export const SHORTLIST_SUPPORTED_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "txt",
  "odt",
  "doc",
  "docx",
] as const;

export type ShortlistSupportedAttachmentExtension =
  (typeof SHORTLIST_SUPPORTED_ATTACHMENT_EXTENSIONS)[number];

export const SHORTLIST_SOURCE_TYPES = {
  ATTACHMENT: "ATTACHMENT",
  EMAIL: "EMAIL",
  WEBPAGE: "WEBPAGE",
} as const;

export type ShortlistSourceType =
  (typeof SHORTLIST_SOURCE_TYPES)[keyof typeof SHORTLIST_SOURCE_TYPES];

export const SHORTLIST_SOURCE_OBJECT_TYPES = {
  ATTACHMENT_FILE: "ATTACHMENT_FILE",
  EMAIL_EML: "EMAIL_EML",
  EMAIL_HTML: "EMAIL_HTML",
  EMAIL_TEXT: "EMAIL_TEXT",
  WEBPAGE_HTML: "WEBPAGE_HTML",
} as const;

export type ShortlistSourceObjectType =
  (typeof SHORTLIST_SOURCE_OBJECT_TYPES)[keyof typeof SHORTLIST_SOURCE_OBJECT_TYPES];

export const SHORTLIST_JOB_TYPES = {
  CLASSIFY_SOURCE: "CLASSIFY_SOURCE",
} as const;

export type ShortlistJobType =
  (typeof SHORTLIST_JOB_TYPES)[keyof typeof SHORTLIST_JOB_TYPES];

export const SHORTLIST_JOB_STATUSES = {
  COMPLETED: "COMPLETED",
  DUPLICATE: "DUPLICATE",
  FAILED: "FAILED",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  RETRY: "RETRY",
} as const;

export type ShortlistJobStatus =
  (typeof SHORTLIST_JOB_STATUSES)[keyof typeof SHORTLIST_JOB_STATUSES];

export function getShortlistFileExtension(filename: string): string | null {
  const sanitizedFilename = filename.trim();
  const lastDotIndex = sanitizedFilename.lastIndexOf(".");

  if (lastDotIndex === -1 || lastDotIndex === sanitizedFilename.length - 1) {
    return null;
  }

  return sanitizedFilename.slice(lastDotIndex + 1).toLowerCase();
}

export function isSupportedShortlistAttachment(filename: string): boolean {
  const extension = getShortlistFileExtension(filename);

  return extension
    ? SHORTLIST_SUPPORTED_ATTACHMENT_EXTENSIONS.includes(
        extension as ShortlistSupportedAttachmentExtension,
      )
    : false;
}
