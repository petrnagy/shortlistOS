/**
 * Author: Petr Nagy / shortlistOS
 * URL: https://petrnagy.cz
 * Since: 2026-06-20
 * License: GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later).
 * Copyright: Copyright (c) 2026 Petr Nagy.
 * This file is part of shortlistOS.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { NextApiRequest } from "next";

import type { createDrizzleClient } from "@kan/db/client";
import { boards, users } from "@kan/db/schema";

import { hasActivePowerpack } from "./powerpack";

type DbClient = ReturnType<typeof createDrizzleClient>;

export interface ShortlistMagicBoardAccess {
  boardId: number;
  userId: string;
}

const getHeaderValue = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export const getBearerToken = (req: NextApiRequest): string | null => {
  const authorization = getHeaderValue(req.headers.authorization);

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return getHeaderValue(req.headers.bearer)?.trim() ?? null;
};

export const isAuthorizedBearerRequest = (
  req: NextApiRequest,
  secret: string | undefined,
): boolean => !!secret && getBearerToken(req) === secret;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const resolveOwnedBoardWithActivePowerpack = async (
  db: DbClient,
  input: { boardPublicId: string; userId: string },
): Promise<ShortlistMagicBoardAccess | null> => {
  const rows = await db
    .select({
      boardId: boards.id,
      userId: users.id,
      shortlistPowerpackActivatedAt: users.shortlistPowerpackActivatedAt,
      shortlistPowerpackExpiresAt: users.shortlistPowerpackExpiresAt,
    })
    .from(boards)
    .innerJoin(users, eq(boards.createdBy, users.id))
    .where(
      and(
        eq(boards.publicId, input.boardPublicId),
        eq(boards.createdBy, input.userId),
        eq(users.id, input.userId),
        isNull(boards.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row || !hasActivePowerpack(row)) {
    return null;
  }

  return {
    boardId: row.boardId,
    userId: row.userId,
  };
};

export const resolveMagicInboxRecipientAccess = async (
  db: DbClient,
  input: { boardPublicId: string; userPublicSecret: string },
): Promise<ShortlistMagicBoardAccess | null> => {
  const rows = await db
    .select({
      boardId: boards.id,
      userId: users.id,
      shortlistPowerpackActivatedAt: users.shortlistPowerpackActivatedAt,
      shortlistPowerpackExpiresAt: users.shortlistPowerpackExpiresAt,
    })
    .from(boards)
    .innerJoin(users, eq(boards.createdBy, users.id))
    .where(
      and(
        eq(boards.publicId, input.boardPublicId),
        eq(users.shortlistUserPublicSecret, input.userPublicSecret),
        isNull(boards.deletedAt),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row || !hasActivePowerpack(row)) {
    return null;
  }

  return {
    boardId: row.boardId,
    userId: row.userId,
  };
};
