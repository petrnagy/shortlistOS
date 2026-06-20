import type { dbClient } from "@kan/db/client";
import { shortlistLinks } from "@kan/db/schema";

export const createShortlistLink = async (
  db: dbClient,
  input: {
    boardId: number;
    createdBy: string;
    url: string;
  },
) => {
  const [result] = await db
    .insert(shortlistLinks)
    .values({
      boardId: input.boardId,
      createdBy: input.createdBy,
      url: input.url,
    })
    .returning({
      id: shortlistLinks.id,
      url: shortlistLinks.url,
      boardId: shortlistLinks.boardId,
      createdBy: shortlistLinks.createdBy,
    });

  return result;
};
