import { differenceInDays } from "date-fns";

export type CardAgingLevel =
  | "none"
  | "aged-lvl-1"
  | "aged-lvl-2"
  | "aged-lvl-3";

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
    return "aged-lvl-3";
  }

  if (daysAgo >= 14) {
    return "aged-lvl-2";
  }

  if (daysAgo >= 7) {
    return "aged-lvl-1";
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
    case "aged-lvl-1":
      return "card-aging-tint-light opacity-90";

    case "aged-lvl-2":
      return "card-aging-tint-medium opacity-80";

    case "aged-lvl-3":
      return "card-aging-tint-heavy opacity-75";

    case "none":
    default:
      return baseClasses;
  }
}
