export function buildCardDescription(
  description: string | null,
  applicationDeadline: string | null,
): string {
  const formattedDeadline = formatApplicationDeadline(applicationDeadline);
  const baseDescription = description?.trim() ?? "";

  if (!formattedDeadline) {
    return baseDescription;
  }

  const deadlineParagraph = `<p><strong>Application deadline: ${formattedDeadline}</strong></p>`;

  return `${baseDescription}${deadlineParagraph}`;
}

function formatApplicationDeadline(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
