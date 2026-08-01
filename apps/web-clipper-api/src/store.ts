/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-07-27
 * License: No license. All rights reserved.
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * Proprietary: shortlistOS Powerpack feature. Not part of the open-source distribution.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  boards,
  cards,
  users,
  webClipperClips,
  webClipperPairings,
  webClipperRefreshTokens,
  workspaceMembers,
} from "@kan/db/schema";

import { WEB_CLIPPER_CLIENT_ID } from "./config";
import {
  derivePairingAuthorizationCode,
  encryptSnapshot,
  hashSecret,
  randomToken,
  verifyPkce,
  verifySecretHash,
} from "./security";

const PAIRING_LIFETIME_MS = 5 * 60 * 1000;
const REFRESH_TOKEN_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

export const getUserById = (db: dbClient, userId: string) =>
  db.query.users.findFirst({
    columns: {
      id: true,
      email: true,
      shortlistPowerpackExpiresAt: true,
    },
    where: eq(users.id, userId),
  });

export const createPairing = async (
  db: dbClient,
  input: {
    codeChallenge: string;
    scopes: string[];
    extensionVersion: string;
    browser: string;
  },
) => {
  const pollToken = randomToken();
  const expiresAt = new Date(Date.now() + PAIRING_LIFETIME_MS);
  const [pairing] = await db
    .insert(webClipperPairings)
    .values({
      pollTokenHash: hashSecret(pollToken),
      clientId: WEB_CLIPPER_CLIENT_ID,
      codeChallenge: input.codeChallenge,
      scopes: input.scopes,
      extensionVersion: input.extensionVersion,
      browser: input.browser,
      expiresAt,
    })
    .returning({ id: webClipperPairings.id });
  if (!pairing) throw new Error("Unable to persist pairing");
  return { pairingId: pairing.id, pollToken, expiresAt };
};

export const getPairingForApproval = async (
  db: dbClient,
  pairingId: string,
) => {
  const now = new Date();
  return db.query.webClipperPairings.findFirst({
    where: and(
      eq(webClipperPairings.id, pairingId),
      eq(webClipperPairings.clientId, WEB_CLIPPER_CLIENT_ID),
      eq(webClipperPairings.status, "PENDING"),
      gt(webClipperPairings.expiresAt, now),
    ),
  });
};

export const decidePairing = (
  db: dbClient,
  input: { pairingId: string; userId: string; approved: boolean },
) =>
  db.transaction(async (tx) => {
    const now = new Date();
    const code = derivePairingAuthorizationCode(input.pairingId);
    const [pairing] = await tx
      .update(webClipperPairings)
      .set(
        input.approved
          ? {
              status: "APPROVED",
              userId: input.userId,
              approvedAt: now,
              updatedAt: now,
              authorizationCodeHash: hashSecret(code),
            }
          : {
              status: "DENIED",
              userId: input.userId,
              deniedAt: now,
              updatedAt: now,
            },
      )
      .where(
        and(
          eq(webClipperPairings.id, input.pairingId),
          eq(webClipperPairings.status, "PENDING"),
          gt(webClipperPairings.expiresAt, now),
        ),
      )
      .returning({ id: webClipperPairings.id });
    if (pairing) return true;
    const existing = await tx.query.webClipperPairings.findFirst({
      columns: { status: true, userId: true },
      where: eq(webClipperPairings.id, input.pairingId),
    });
    return (
      existing?.userId === input.userId &&
      existing.status === (input.approved ? "APPROVED" : "DENIED")
    );
  });

export const pollPairing = async (
  db: dbClient,
  pairingId: string,
  pollToken: string,
) => {
  const pairing = await db.query.webClipperPairings.findFirst({
    where: eq(webClipperPairings.id, pairingId),
  });
  if (!pairing || !verifySecretHash(pollToken, pairing.pollTokenHash))
    return null;
  if (pairing.expiresAt <= new Date() && pairing.status === "PENDING") {
    await db
      .update(webClipperPairings)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(
        and(
          eq(webClipperPairings.id, pairing.id),
          eq(webClipperPairings.status, "PENDING"),
        ),
      );
    return { status: "EXPIRED" as const };
  }
  if (pairing.status === "APPROVED")
    return {
      status: "APPROVED" as const,
      authorizationCode: derivePairingAuthorizationCode(pairing.id),
    };
  return { status: pairing.status };
};

const createRefreshTokenRecord = async (
  db: Pick<dbClient, "insert">,
  input: {
    userId: string;
    scopes: string[];
    familyId?: string;
    parentTokenId?: string;
  },
) => {
  const token = randomToken();
  const [record] = await db
    .insert(webClipperRefreshTokens)
    .values({
      tokenHash: hashSecret(token),
      tokenFamilyId: input.familyId ?? randomUUID(),
      parentTokenId: input.parentTokenId,
      clientId: WEB_CLIPPER_CLIENT_ID,
      userId: input.userId,
      scopes: input.scopes,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS),
    })
    .returning({ id: webClipperRefreshTokens.id });
  if (!record) throw new Error("Unable to persist refresh token");
  return { token, record };
};

export const exchangeAuthorizationCode = (
  db: dbClient,
  input: {
    code: string;
    codeVerifier: string;
  },
) =>
  db.transaction(async (tx) => {
    const now = new Date();
    const codeRecord = await tx.query.webClipperPairings.findFirst({
      where: and(
        eq(webClipperPairings.authorizationCodeHash, hashSecret(input.code)),
        eq(webClipperPairings.clientId, WEB_CLIPPER_CLIENT_ID),
        eq(webClipperPairings.status, "APPROVED"),
        gt(webClipperPairings.expiresAt, now),
        isNull(webClipperPairings.consumedAt),
      ),
    });

    if (
      !codeRecord ||
      !codeRecord.userId ||
      !verifyPkce(input.codeVerifier, codeRecord.codeChallenge)
    ) {
      return null;
    }

    const [consumed] = await tx
      .update(webClipperPairings)
      .set({ consumedAt: now, status: "CONSUMED", updatedAt: now })
      .where(
        and(
          eq(webClipperPairings.id, codeRecord.id),
          eq(webClipperPairings.status, "APPROVED"),
        ),
      )
      .returning({ id: webClipperPairings.id });
    if (!consumed) return null;

    const user = await tx.query.users.findFirst({
      columns: { id: true, email: true },
      where: eq(users.id, codeRecord.userId),
    });
    if (!user) return null;

    const refresh = await createRefreshTokenRecord(tx, {
      userId: user.id,
      scopes: codeRecord.scopes,
    });
    return { user, scopes: codeRecord.scopes, refreshToken: refresh.token };
  });

export const rotateRefreshToken = (db: dbClient, token: string) =>
  db.transaction(async (tx) => {
    const now = new Date();
    const tokenRecord = await tx.query.webClipperRefreshTokens.findFirst({
      where: and(
        eq(webClipperRefreshTokens.tokenHash, hashSecret(token)),
        eq(webClipperRefreshTokens.clientId, WEB_CLIPPER_CLIENT_ID),
      ),
    });
    if (!tokenRecord) return null;

    if (tokenRecord.rotatedAt || tokenRecord.revokedAt) {
      await tx
        .update(webClipperRefreshTokens)
        .set({ revokedAt: now })
        .where(
          and(
            eq(
              webClipperRefreshTokens.tokenFamilyId,
              tokenRecord.tokenFamilyId,
            ),
            isNull(webClipperRefreshTokens.revokedAt),
          ),
        );
      return null;
    }

    if (tokenRecord.expiresAt <= now) return null;

    const [rotated] = await tx
      .update(webClipperRefreshTokens)
      .set({ rotatedAt: now, lastUsedAt: now, revokedAt: now })
      .where(
        and(
          eq(webClipperRefreshTokens.id, tokenRecord.id),
          isNull(webClipperRefreshTokens.rotatedAt),
          isNull(webClipperRefreshTokens.revokedAt),
        ),
      )
      .returning({ id: webClipperRefreshTokens.id });
    if (!rotated) return null;

    const user = await tx.query.users.findFirst({
      columns: { id: true, email: true },
      where: eq(users.id, tokenRecord.userId),
    });
    if (!user) return null;

    const refresh = await createRefreshTokenRecord(tx, {
      userId: user.id,
      scopes: tokenRecord.scopes,
      familyId: tokenRecord.tokenFamilyId,
      parentTokenId: tokenRecord.id,
    });
    return { user, scopes: tokenRecord.scopes, refreshToken: refresh.token };
  });

export const revokeRefreshTokenFamily = async (db: dbClient, token: string) => {
  const record = await db.query.webClipperRefreshTokens.findFirst({
    columns: { tokenFamilyId: true },
    where: eq(webClipperRefreshTokens.tokenHash, hashSecret(token)),
  });
  if (!record) return;
  await db
    .update(webClipperRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(webClipperRefreshTokens.tokenFamilyId, record.tokenFamilyId),
        isNull(webClipperRefreshTokens.revokedAt),
      ),
    );
};

export const getBootstrap = async (db: dbClient, userId: string) => {
  const user = await getUserById(db, userId);
  if (!user) return null;
  const availableBoards = await db
    .select({ id: boards.publicId, name: boards.name })
    .from(boards)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, boards.workspaceId),
    )
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaceMembers.deletedAt),
        isNull(boards.deletedAt),
        eq(boards.isArchived, false),
        eq(boards.type, "regular"),
      ),
    )
    .orderBy(asc(boards.name), asc(boards.publicId));
  const expiresAt = user.shortlistPowerpackExpiresAt;
  return {
    user: { id: user.id, email: user.email },
    powerpack: {
      active: expiresAt !== null && expiresAt > new Date(),
      expiresAt: expiresAt?.toISOString() ?? null,
    },
    boards: availableBoards,
  };
};

export const getAvailableBoard = (db: dbClient, userId: string, id: string) =>
  db
    .select({
      id: boards.id,
      publicId: boards.publicId,
      name: boards.name,
    })
    .from(boards)
    .innerJoin(
      workspaceMembers,
      eq(workspaceMembers.workspaceId, boards.workspaceId),
    )
    .where(
      and(
        eq(boards.publicId, id),
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.status, "active"),
        isNull(workspaceMembers.deletedAt),
        isNull(boards.deletedAt),
        eq(boards.isArchived, false),
        eq(boards.type, "regular"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

export const createClip = async (
  db: dbClient,
  input: {
    userId: string;
    boardId: number;
    page: {
      url: string;
      canonicalUrl: string | null;
      title: string;
      language: string | null;
      capturedAt: string;
      html: string;
      jsonLd: string[];
    };
    client: { extensionVersion: string; browser: string };
  },
) => {
  const [clip] = await db
    .insert(webClipperClips)
    .values({
      userId: input.userId,
      boardId: input.boardId,
      sourceUrl: input.page.url,
      canonicalUrl: input.page.canonicalUrl,
      pageTitle: input.page.title,
      pageLanguage: input.page.language,
      pageCapturedAt: new Date(input.page.capturedAt),
      encryptedHtml: encryptSnapshot(input.page.html),
      encryptedJsonLd: encryptSnapshot(JSON.stringify(input.page.jsonLd)),
      extensionVersion: input.client.extensionVersion,
      browser: input.client.browser,
    })
    .returning({ id: webClipperClips.id, status: webClipperClips.status });
  if (!clip) throw new Error("Unable to persist clip");
  return clip;
};

export const getClipStatus = async (
  db: dbClient,
  userId: string,
  clipId: string,
) => {
  const [result] = await db
    .select({
      status: webClipperClips.status,
      errorCode: webClipperClips.errorCode,
      jobTitle: webClipperClips.resultJobTitle,
      companyName: webClipperClips.resultCompanyName,
      boardName: webClipperClips.resultBoardName,
      cardPublicId: cards.publicId,
    })
    .from(webClipperClips)
    .leftJoin(
      cards,
      or(
        eq(cards.id, webClipperClips.cardId),
        eq(cards.id, webClipperClips.duplicateCardId),
      ),
    )
    .where(
      and(eq(webClipperClips.id, clipId), eq(webClipperClips.userId, userId)),
    )
    .limit(1);
  return result ?? null;
};
