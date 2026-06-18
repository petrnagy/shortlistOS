import { differenceInDays } from "date-fns";

export type CardAgingLevel =
  | "none"
  | "aged-1-week"
  | "aged-2-weeks"
  | "aged-1-month";

/**
 * Determine the aging level of a card based on lastActivity date
 * 3 levels:
 * - Older than 1 week: slight fading with a warm tint
 * - Older than 2 weeks: moderate fading with a warm tint
 * - Older than 1 month: stronger fading with a warm tint
 */
export function getCardAgingLevel(
  lastActivity: Date | null | undefined,
): CardAgingLevel {
  if (!lastActivity) return "none";

  const daysAgo = differenceInDays(new Date(), new Date(lastActivity));

  if (daysAgo >= 30) {
    return "aged-1-month";
  }

  if (daysAgo >= 14) {
    return "aged-2-weeks";
  }

  if (daysAgo >= 7) {
    return "aged-1-week";
  }

  return "none";
}

/**
 * Get Tailwind CSS classes for card aging effect.
 * Progressive aging: slight yellowing plus increasing fade.
 */
export function getCardAgingClasses(agingLevel: CardAgingLevel): string {
  const baseClasses = "";

  switch (agingLevel) {
    case "aged-1-week":
      return "card-aging-tint-light opacity-90";

    case "aged-2-weeks":
      return "card-aging-tint-medium opacity-80";

    case "aged-1-month":
      return "card-aging-tint-heavy opacity-75";

    case "none":
    default:
      return baseClasses;
  }
}
