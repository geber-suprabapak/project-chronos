import type { OrderedAttendanceRow } from "./types.ts";

/**
 * Deterministically sorts attendance records:
 * 1. Tanggal (date ASC)
 * 2. Kelas (className ASC)
 * 3. NIS (nis ASC)
 * 4. Record ID (id ASC tie-breaker)
 */
export function sortAttendanceRows(
  rows: readonly OrderedAttendanceRow[],
): OrderedAttendanceRow[] {
  return [...rows].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;

    const classCompare = a.className.localeCompare(b.className);
    if (classCompare !== 0) return classCompare;

    const nisCompare = a.nis.localeCompare(b.nis);
    if (nisCompare !== 0) return nisCompare;

    return a.id.localeCompare(b.id);
  });
}
