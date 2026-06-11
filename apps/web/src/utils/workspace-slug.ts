import { randomHex } from "./random-hex";

const MAX_WORKSPACE_SLUG_LENGTH = 64;
const WORKSPACE_SLUG_SUFFIX_LENGTH = 10;
const WORKSPACE_SLUG_BASE_LENGTH =
  MAX_WORKSPACE_SLUG_LENGTH - WORKSPACE_SLUG_SUFFIX_LENGTH;

export function slugifyWorkspaceName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, WORKSPACE_SLUG_BASE_LENGTH);
}

export function createWorkspaceSlug(value: string) {
  const slug = slugifyWorkspaceName(value) || "workspace";

  return `${slug}-${randomHex(4)}-${randomHex(4)}`;
}
