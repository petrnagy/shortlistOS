/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const WEB_CLIPPER_CLIENT_ID = "shortlistos-web-clipper";
export const WEB_CLIPPER_SCOPES = [
  "profile:read",
  "boards:read",
  "clips:create",
  "clips:read",
] as const;

const environmentSchema = z.object({
  WEB_CLIPPER_ACCESS_TOKEN_SECRET: z.string().min(32),
  WEB_CLIPPER_ENCRYPTION_KEY: z.string().min(32),
  WEB_CLIPPER_ALLOWED_ORIGINS: z.string().default(""),
  SHORTLIST_SOURCE_BUCKET_NAME: z.string().min(1),
  WEB_CLIPPER_API_PORT: z.coerce.number().int().min(1).max(65535).default(3010),
  NEXT_PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsedEnvironment = environmentSchema.parse(process.env);

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  ...parsedEnvironment,
  allowedOrigins: new Set(
    splitList(parsedEnvironment.WEB_CLIPPER_ALLOWED_ORIGINS),
  ),
  accessTokenSecret: new TextEncoder().encode(
    parsedEnvironment.WEB_CLIPPER_ACCESS_TOKEN_SECRET,
  ),
  encryptionKey: createHash("sha256")
    .update(parsedEnvironment.WEB_CLIPPER_ENCRYPTION_KEY)
    .digest(),
} as const;
