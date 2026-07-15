export const CARD_CONTACT_ROLE_OPTIONS = [
  "HR",
  "RECRUITER",
  "HIRING_MANAGER",
  "CTO",
  "CEO",
  "ADMIN",
  "OTHER",
] as const;

export const CARD_CONTACT_METHOD_TYPE_OPTIONS = [
  "PHONE",
  "EMAIL",
  "LINKEDIN",
  "WHATSAPP",
  "TELEGRAM",
  "WEBSITE",
  "OTHER",
] as const;

export type CardContactRole = (typeof CARD_CONTACT_ROLE_OPTIONS)[number];
export type CardContactMethodType =
  (typeof CARD_CONTACT_METHOD_TYPE_OPTIONS)[number];
