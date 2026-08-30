export type DateLike = string | Date | null | undefined;

const DATE_ONLY_PATTERN = /^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/;

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Extract a calendar date without converting it through the browser timezone.
 * Malformed upstream values become null instead of silently becoming the Unix
 * epoch (01/01/1970).
 */
export function normalizeDateOnly(value: DateLike): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const dateOnly = [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
    return isValidDateOnly(dateOnly) ? dateOnly : null;
  }

  if (value === null || value === undefined) return null;

  const candidate = value.trim();
  const match = DATE_ONLY_PATTERN.exec(candidate);
  const dateOnly = match?.[1];
  return dateOnly && isValidDateOnly(dateOnly) ? dateOnly : null;
}

/** Identify exact date-only payloads before choosing date-only presentation. */
export function isDateOnlyValue(value: DateLike): boolean {
  if (value instanceof Date || value === null || value === undefined)
    return false;
  const candidate = value.trim();
  return isValidDateOnly(candidate);
}

export function dateOnlySortValue(value: DateLike): number {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return Number.NEGATIVE_INFINITY;
  const [year, month, day] = dateOnly.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function formatDateOnly(
  value: DateLike,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
  fallback = "-",
): string {
  const dateOnly = normalizeDateOnly(value);
  if (!dateOnly) return fallback;

  const [year, month, day] = dateOnly.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  return new Intl.DateTimeFormat("id-ID", options).format(date);
}
