/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { config, WEB_CLIPPER_CLIENT_ID, WEB_CLIPPER_SCOPES } from "./config";

const accessTokenClaimsSchema = z.object({
  sub: z.string().uuid(),
  clientId: z.literal(WEB_CLIPPER_CLIENT_ID),
  scopes: z.array(z.enum(WEB_CLIPPER_SCOPES)),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export const randomToken = () => randomBytes(32).toString("base64url");

export const hashSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const derivePairingAuthorizationCode = (pairingId: string) =>
  createHmac("sha256", config.accessTokenSecret)
    .update(`web-clipper-pairing:${pairingId}`)
    .digest("base64url");

export const verifySecretHash = (value: string, expectedHash: string) => {
  const actual = Buffer.from(hashSecret(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const verifyPkce = (verifier: string, challenge: string) => {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  const computedBuffer = Buffer.from(computed);
  const challengeBuffer = Buffer.from(challenge);
  return (
    computedBuffer.length === challengeBuffer.length &&
    timingSafeEqual(computedBuffer, challengeBuffer)
  );
};

export const encryptSnapshot = (plaintext: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
};

export const issueAccessToken = async (
  userId: string,
  scopes: string[],
): Promise<{ token: string; expiresAt: Date }> => {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const token = await new SignJWT({
    clientId: WEB_CLIPPER_CLIENT_ID,
    scopes,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(config.NEXT_PUBLIC_BASE_URL)
    .setAudience(WEB_CLIPPER_CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .setJti(randomToken())
    .sign(config.accessTokenSecret);
  return { token, expiresAt };
};

export const verifyAccessToken = async (
  token: string,
): Promise<AccessTokenClaims> => {
  const verified = await jwtVerify(token, config.accessTokenSecret, {
    issuer: config.NEXT_PUBLIC_BASE_URL,
    audience: WEB_CLIPPER_CLIENT_ID,
    algorithms: ["HS256"],
  });
  return accessTokenClaimsSchema.parse(verified.payload);
};
