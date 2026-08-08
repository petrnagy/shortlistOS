import { and, asc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";

import type { dbClient } from "@kan/db/client";
import { boards, cards, lists, users } from "@kan/db/schema";

export interface ShortlistCalendarEvent {
  cardPublicId: string;
  title: string;
  company: string | null;
  startsAt: Date;
  updatedAt: Date;
}

export async function getShortlistCalendar(
  db: dbClient,
  input: {
    boardPublicId: string;
    userPublicSecret: string;
    feedSecret: string;
  },
): Promise<{ boardName: string; events: ShortlistCalendarEvent[] } | null> {
  if (!input.userPublicSecret || !input.feedSecret) return null;

  const rows = await db
    .select({
      boardName: boards.name,
      cardPublicId: cards.publicId,
      title: cards.title,
      company: cards.shortlistCompanyName,
      startsAt: cards.dueDate,
      updatedAt: cards.updatedAt,
      createdAt: cards.createdAt,
    })
    .from(boards)
    .innerJoin(
      users,
      and(
        eq(boards.createdBy, users.id),
        eq(users.shortlistUserPublicSecret, input.userPublicSecret),
        eq(users.shortlistFeedSecret, input.feedSecret),
      ),
    )
    .innerJoin(
      lists,
      and(eq(lists.boardId, boards.id), isNull(lists.deletedAt)),
    )
    .innerJoin(
      cards,
      and(
        eq(cards.listId, lists.id),
        isNull(cards.deletedAt),
        isNotNull(cards.dueDate),
        eq(cards.manualUpdatedOnly, false),
      ),
    )
    .where(
      and(
        eq(boards.publicId, input.boardPublicId),
        eq(boards.type, "regular"),
        eq(boards.isArchived, false),
        eq(boards.shortlistIsCalendarFeedEnabled, true),
        isNull(boards.deletedAt),
        lte(users.shortlistPowerpackActivatedAt, new Date()),
        sql`${users.shortlistPowerpackExpiresAt} >= now()`,
      ),
    )
    .orderBy(asc(cards.dueDate));

  if (rows.length > 0) {
    return {
      boardName: rows[0]?.boardName ?? "shortlistOS",
      events: rows.map((row) => ({
        cardPublicId: row.cardPublicId,
        title: row.title,
        company: row.company,
        startsAt: row.startsAt ?? row.createdAt,
        updatedAt: row.updatedAt ?? row.createdAt,
      })),
    };
  }

  const [emptyBoard] = await db
    .select({ boardName: boards.name })
    .from(boards)
    .innerJoin(
      users,
      and(
        eq(boards.createdBy, users.id),
        eq(users.shortlistUserPublicSecret, input.userPublicSecret),
        eq(users.shortlistFeedSecret, input.feedSecret),
      ),
    )
    .where(
      and(
        eq(boards.publicId, input.boardPublicId),
        eq(boards.type, "regular"),
        eq(boards.isArchived, false),
        eq(boards.shortlistIsCalendarFeedEnabled, true),
        isNull(boards.deletedAt),
        lte(users.shortlistPowerpackActivatedAt, new Date()),
        sql`${users.shortlistPowerpackExpiresAt} >= now()`,
      ),
    )
    .limit(1);

  return emptyBoard ? { boardName: emptyBoard.boardName, events: [] } : null;
}

export function renderShortlistCalendar(input: {
  boardName: string;
  events: ShortlistCalendarEvent[];
  boardUrl: string;
}): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//shortlistOS//Shortlist Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(input.boardName)}`,
  ];

  for (const event of input.events) {
    const endsAt = new Date(event.startsAt.getTime() + 60 * 60 * 1000);
    const title = event.company
      ? `Interview: ${event.title} at ${event.company}`
      : `Interview: ${event.title}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.cardPublicId}@shortlistos`,
      `DTSTAMP:${formatIcalDate(event.updatedAt)}`,
      `DTSTART:${formatIcalDate(event.startsAt)}`,
      `DTEND:${formatIcalDate(endsAt)}`,
      `SUMMARY:${escapeIcalText(title)}`,
      `DESCRIPTION:${escapeIcalText(`Interview tracked in ${input.boardName}`)}`,
      `URL:${input.boardUrl}?card=${encodeURIComponent(event.cardPublicId)}`,
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export const formatIcalDate = (value: Date): string =>
  value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

export const escapeIcalText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
