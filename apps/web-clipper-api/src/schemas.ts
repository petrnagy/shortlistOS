/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { z } from "zod";

import { WEB_CLIPPER_CLIENT_ID, WEB_CLIPPER_SCOPES } from "./config";

export const createPairingSchema = z
  .object({
    clientId: z.literal(WEB_CLIPPER_CLIENT_ID),
    scopes: z
      .array(z.enum(WEB_CLIPPER_SCOPES))
      .length(WEB_CLIPPER_SCOPES.length),
    codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    codeChallengeMethod: z.literal("S256"),
    client: z.object({
      extensionVersion: z.string().regex(/^[A-Za-z0-9.+_-]{1,64}$/),
      browser: z.enum(["CHROMIUM", "FIREFOX"]),
    }),
  })
  .refine((value) =>
    WEB_CLIPPER_SCOPES.every((scope) => value.scopes.includes(scope)),
  );

export const pairingIdSchema = z.string().uuid();

export const authorizationCodeTokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  code: z.string().min(1).max(1024),
  code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
  client_id: z.literal(WEB_CLIPPER_CLIENT_ID),
});

export const refreshTokenSchema = z.object({
  grant_type: z.literal("refresh_token"),
  refresh_token: z.string().min(1).max(1024),
  client_id: z.literal(WEB_CLIPPER_CLIENT_ID),
});

export const revokeSchema = z.object({
  token: z.string().min(1).max(1024),
  token_type_hint: z.literal("refresh_token").optional(),
  client_id: z.literal(WEB_CLIPPER_CLIENT_ID),
});

const httpUrlSchema = z
  .string()
  .max(8192)
  .url()
  .refine((value) => ["http:", "https:"].includes(new URL(value).protocol));

export const createClipSchema = z.object({
  boardId: z.string().min(1).max(128),
  source: z.literal("WEB_CLIPPER"),
  page: z.object({
    url: httpUrlSchema,
    canonicalUrl: httpUrlSchema.nullable(),
    title: z.string().min(1).max(2048),
    language: z.string().max(64).nullable(),
    capturedAt: z.string().datetime({ offset: true }),
    html: z
      .string()
      .min(1)
      .max(4 * 1024 * 1024),
    jsonLd: z.array(z.string().max(256 * 1024)).max(100),
  }),
  client: z.object({
    extensionVersion: z.string().regex(/^[A-Za-z0-9.+_-]{1,64}$/),
    browser: z.enum(["CHROMIUM", "FIREFOX"]),
  }),
});
