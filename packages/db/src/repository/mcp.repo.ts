import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import {
  boards,
  lists,
  mcpAuthorizationCodes,
  mcpClients,
  mcpConnections,
  mcpConsumedRefreshTokens,
  users,
  workspaces,
} from "@kan/db/schema";
import { generateUID } from "@kan/shared/utils";

export const hashMcpSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const newMcpSecret = () => randomBytes(32).toString("base64url");
export const pkceChallenge = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
export const getClient = (db: dbClient, clientId: string) =>
  db.query.mcpClients.findFirst({ where: eq(mcpClients.publicId, clientId) });

export const getLiveWorkspace = (db: dbClient, publicId: string) =>
  db.query.workspaces.findFirst({
    columns: { id: true },
    where: and(eq(workspaces.publicId, publicId), isNull(workspaces.deletedAt)),
  });
export async function getLiveBoard(db: dbClient, publicId: string) {
  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .innerJoin(workspaces, eq(boards.workspaceId, workspaces.id))
    .where(
      and(
        eq(boards.publicId, publicId),
        isNull(boards.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    );
  return board;
}
export async function getLiveList(db: dbClient, publicId: string) {
  const [list] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(lists)
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .innerJoin(workspaces, eq(boards.workspaceId, workspaces.id))
    .where(
      and(
        eq(lists.publicId, publicId),
        isNull(lists.deletedAt),
        isNull(boards.deletedAt),
        isNull(workspaces.deletedAt),
      ),
    );
  return list;
}

export async function registerClient(
  db: dbClient,
  name: string,
  redirectUris: string[],
) {
  const publicId = newMcpSecret();
  await db.insert(mcpClients).values({ publicId, name, redirectUris });
  return publicId;
}

export async function requireAccount(db: dbClient, userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("Account not found");
  return user;
}

export async function issueCode(
  db: dbClient,
  input: Omit<
    typeof mcpAuthorizationCodes.$inferInsert,
    "codeHash" | "expiresAt"
  >,
) {
  const code = newMcpSecret();
  await db.insert(mcpAuthorizationCodes).values({
    ...input,
    codeHash: hashMcpSecret(code),
    expiresAt: new Date(Date.now() + 300_000),
  });
  return code;
}

function tokenPair() {
  const accessToken = newMcpSecret();
  const refreshToken = newMcpSecret();
  return {
    accessToken,
    refreshToken,
    values: {
      accessTokenHash: hashMcpSecret(accessToken),
      refreshTokenHash: hashMcpSecret(refreshToken),
      accessExpiresAt: new Date(Date.now() + 3_600_000),
      refreshExpiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  };
}

export async function exchangeCode(
  db: dbClient,
  input: {
    code: string;
    clientId: string;
    redirectUri: string;
    verifier: string;
    resource: string;
  },
) {
  return db.transaction(async (tx) => {
    // Atomic consume prevents concurrent exchanges and replay.
    const [code] = await tx
      .update(mcpAuthorizationCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(mcpAuthorizationCodes.codeHash, hashMcpSecret(input.code)),
          eq(mcpAuthorizationCodes.clientId, input.clientId),
          eq(mcpAuthorizationCodes.redirectUri, input.redirectUri),
          eq(mcpAuthorizationCodes.challenge, pkceChallenge(input.verifier)),
          eq(mcpAuthorizationCodes.resource, input.resource),
          isNull(mcpAuthorizationCodes.consumedAt),
          gt(mcpAuthorizationCodes.expiresAt, new Date()),
        ),
      )
      .returning();
    if (!code) throw new Error("Invalid authorization code");
    await requireAccount(tx as unknown as dbClient, code.userId);
    const client = await getClient(tx as unknown as dbClient, code.clientId);
    if (!client) throw new Error("Unknown client");
    const pair = tokenPair();
    await tx.insert(mcpConnections).values({
      publicId: generateUID(),
      userId: code.userId,
      clientId: code.clientId,
      clientName: client.name,
      ...pair.values,
    });
    return pair;
  });
}

export async function refreshTokens(
  db: dbClient,
  clientId: string,
  refreshToken: string,
) {
  const result = await db.transaction(async (tx) => {
    const pair = tokenPair();
    const [connection] = await tx
      .update(mcpConnections)
      .set(pair.values)
      .where(
        and(
          eq(mcpConnections.refreshTokenHash, hashMcpSecret(refreshToken)),
          eq(mcpConnections.clientId, clientId),
          isNull(mcpConnections.revokedAt),
          gt(mcpConnections.refreshExpiresAt, new Date()),
        ),
      )
      .returning();
    if (!connection) {
      // Commit family revocation before reporting reuse; throwing here would roll it back.
      const reused = await tx.query.mcpConsumedRefreshTokens.findFirst({
        where: eq(
          mcpConsumedRefreshTokens.tokenHash,
          hashMcpSecret(refreshToken),
        ),
      });
      if (reused)
        await tx
          .update(mcpConnections)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(mcpConnections.publicId, reused.connectionPublicId),
              eq(mcpConnections.clientId, clientId),
            ),
          );
      return null;
    }
    await requireAccount(tx as unknown as dbClient, connection.userId);
    await tx.insert(mcpConsumedRefreshTokens).values({
      tokenHash: hashMcpSecret(refreshToken),
      connectionPublicId: connection.publicId,
      expiresAt: connection.refreshExpiresAt,
    });
    return pair;
  });
  if (!result) throw new Error("Invalid refresh token");
  return result;
}

export const getConnection = (db: dbClient, token: string) =>
  db.query.mcpConnections.findFirst({
    where: and(
      eq(mcpConnections.accessTokenHash, hashMcpSecret(token)),
      isNull(mcpConnections.revokedAt),
      gt(mcpConnections.accessExpiresAt, new Date()),
    ),
  });

export const listConnections = (db: dbClient, userId: string) =>
  db
    .select({
      publicId: mcpConnections.publicId,
      clientName: mcpConnections.clientName,
      createdAt: mcpConnections.createdAt,
      expiresAt: mcpConnections.refreshExpiresAt,
    })
    .from(mcpConnections)
    .where(
      and(
        eq(mcpConnections.userId, userId),
        isNull(mcpConnections.revokedAt),
        gt(mcpConnections.refreshExpiresAt, new Date()),
      ),
    );

export const revokeConnection = (
  db: dbClient,
  userId: string,
  publicId: string,
) =>
  db
    .update(mcpConnections)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(mcpConnections.userId, userId),
        eq(mcpConnections.publicId, publicId),
      ),
    );
