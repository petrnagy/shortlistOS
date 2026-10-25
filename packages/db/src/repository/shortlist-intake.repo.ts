import { and, eq, isNull } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { boards, lists, users } from "@kan/db/schema";

export async function getImportContext(
  db: dbClient,
  input: { boardId: number; userId: string; listPublicId?: string },
) {
  const [user, activeBoard, destination] = await Promise.all([
    db.query.users.findFirst({
      columns: {
        shortlistPowerpackActivatedAt: true,
        shortlistPowerpackExpiresAt: true,
      },
      where: eq(users.id, input.userId),
    }),
    db.query.boards.findFirst({
      columns: { publicId: true },
      where: and(
        eq(boards.id, input.boardId),
        isNull(boards.deletedAt),
        eq(boards.isArchived, false),
      ),
    }),
    db.query.lists.findFirst({
      columns: { publicId: true },
      where: and(
        eq(lists.boardId, input.boardId),
        isNull(lists.deletedAt),
        input.listPublicId
          ? eq(lists.publicId, input.listPublicId)
          : eq(lists.name, "Saved"),
      ),
    }),
  ]);
  return { user, activeBoard, destination };
}
