import { differenceInDays } from "date-fns";

export type CardAgingLevel = "none" | "aged-1-week" | "aged-2-weeks" | "aged-1-month";

/**
 * Determine the aging level of a card based on lastActivity date
 * 3 levels:
 * - Older than 1 week: light yellowing
 * - Older than 2 weeks: moderate yellowing with texture
 * - Older than 1 month: heavy parchment effect
 */
export function getCardAgingLevel(lastActivity: Date | null | undefined): CardAgingLevel {
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
 * Get Tailwind CSS classes for card aging effect
 * Progressive aging: yellowing → texture overlay → parchment
 */
export function getCardAgingClasses(agingLevel: CardAgingLevel): string {
  const baseClasses = "";

  switch (agingLevel) {
    case "aged-1-week":
      // Light yellowing with slight opacity reduction
      return "bg-yellow-50 opacity-95 dark:bg-yellow-950/20";

    case "aged-2-weeks":
      // Moderate yellowing with more opacity reduction
      return "bg-yellow-100 opacity-90 dark:bg-yellow-900/30";

    case "aged-1-month":
      // Heavy parchment effect - warm sepia tone with reduced opacity
      return "bg-yellow-200 opacity-85 dark:bg-yellow-800/40";

    case "none":
    default:
      return baseClasses;
  }
}
