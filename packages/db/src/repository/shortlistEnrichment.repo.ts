import { and, eq, exists, gte, inArray, isNull, lte, or } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { boards, cards, lists, users } from "@kan/db/schema";
import { SHORTLIST_ROBOT_USER } from "@kan/shared/constants";

type EnrichmentDb = Pick<dbClient, "select" | "update">;

export async function markCardsForEnrichment(
  db: EnrichmentDb,
  input: { cardIds: number[]; createdBy: string },
): Promise<void> {
  const cardIds = [...new Set(input.cardIds)];
  if (cardIds.length === 0 || input.createdBy === SHORTLIST_ROBOT_USER.id) {
    return;
  }

  const now = new Date();
  const activePowerpackUser = db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, input.createdBy),
        lte(users.shortlistPowerpackActivatedAt, now),
        gte(users.shortlistPowerpackExpiresAt, now),
      ),
    );
  const enabledBoard = db
    .select({ id: boards.id })
    .from(lists)
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        eq(lists.id, cards.listId),
        isNull(boards.deletedAt),
        or(
          eq(boards.shortlistIsSalaryDataEnabled, true),
          eq(boards.shortlistIsCompanySentimentEnabled, true),
        ),
      ),
    );

  await db
    .update(cards)
    .set({
      shortlistDataFetchNeeded: true,
      shortlistDataFetchRequestedBy: input.createdBy,
    })
    .where(
      and(
        inArray(cards.id, cardIds),
        isNull(cards.deletedAt),
        eq(cards.manualUpdatedOnly, false),
        exists(activePowerpackUser),
        exists(enabledBoard),
      ),
    );
}
