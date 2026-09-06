import type { MonthBounds } from "./types.ts";

const YEAR_MONTH_REGEX = /^([1-9]\d{3})-(0[1-9]|1[0-2])$/;

/**
 * Validates whether a given string is a valid YYYY-MM format.
 */
export function isValidYearMonth(
  val: string | null | undefined,
): val is string {
  if (!val) return false;
  return YEAR_MONTH_REGEX.test(val.trim());
}

/**
 * Parses and computes the exact date bounds for a YYYY-MM string in Asia/Jakarta timezone.
 * Throws an Error if the month format is invalid.
 */
export function getAsiaJakartaMonthBounds(monthStr: string): MonthBounds {
  const match = YEAR_MONTH_REGEX.exec(monthStr.trim());
  if (!match) {
    throw new Error(
      `Format bulan tidak valid: "${monthStr}". Harus berformat YYYY-MM (misal 2026-09).`,
    );
  }

  // SAFETY: Group 1 is verified by the YEAR_MONTH_REGEX 4-digit year match.
  const year = parseInt(match[1] as string, 10);
  // SAFETY: Group 2 is verified by the YEAR_MONTH_REGEX 2-digit month match.
  const monthNumber = parseInt(match[2] as string, 10);

  // Day 0 of the following month returns the last day of the target month in UTC/absolute calendar days
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  const formattedMonth = String(monthNumber).padStart(2, "0");
  const startDate = `${year}-${formattedMonth}-01`;
  const endDate = `${year}-${formattedMonth}-${String(daysInMonth).padStart(2, "0")}`;

  return {
    month: `${year}-${formattedMonth}`,
    startDate,
    endDate,
    timezone: "Asia/Jakarta",
    year,
    monthNumber,
    daysInMonth,
  };
}

export interface AsiaJakartaCurrentInfo {
  year: number;
  month: string;
  day: number;
  yearMonth: string;
  isoDate: string;
}

/**
 * Extracts current date and time components in the Asia/Jakarta (WIB, UTC+7) timezone.
 */
export function getAsiaJakartaCurrentInfo(
  referenceDate = new Date(),
): AsiaJakartaCurrentInfo {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(referenceDate);
  const yearStr = parts.find((p) => p.type === "year")?.value ?? "2026";
  const monthStr = parts.find((p) => p.type === "month")?.value ?? "09";
  const dayStr = parts.find((p) => p.type === "day")?.value ?? "01";

  const year = parseInt(yearStr, 10);
  const day = parseInt(dayStr, 10);

  return {
    year,
    month: monthStr,
    day,
    yearMonth: `${yearStr}-${monthStr}`,
    isoDate: `${yearStr}-${monthStr}-${dayStr.padStart(2, "0")}`,
  };
}

/**
 * Sanitizes an arbitrary segment (such as class name) for safe inclusion in
 * Content-Disposition filenames, preventing directory traversal or header injection.
 */
export function sanitizeFilenameSegment(value: string): string {
  return value
    .replace(/\.\.+/g, "")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
}

/**
 * Checks the ordering of optional, already-validated ISO date-only bounds.
 */
export function hasOrderedDateBounds(
  startDate: string | null,
  endDate: string | null,
): boolean {
  return !startDate || !endDate || startDate <= endDate;
}
