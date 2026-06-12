import type { Locale as DateFnsLocale } from "date-fns";
import { formatDistanceToNow } from "date-fns";

export function formatLastActivity(
  lastActivity: Date | null | undefined,
  dateLocale: DateFnsLocale,
): string | null {
  if (!lastActivity) return null;

  return formatDistanceToNow(new Date(lastActivity), {
    addSuffix: true,
    locale: dateLocale,
  });
}
