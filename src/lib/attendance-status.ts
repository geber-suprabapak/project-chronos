/**
 * Canonical per-class Attendance status presentation.
 *
 * `getClassAttendanceSummary` already returns disjoint canonical buckets
 * (Hadir, Terlambat, Sakit, Izin, plus unaccounted students as TidakHadir).
 * Per-class rows and counts must keep those values distinct: a late check-in
 * stays "Terlambat" (never "Hadir") and an approved medical stay stays
 * "Sakit" (never "Izin").
 */

export type PerClassAttendanceStatus =
  "Hadir" | "Terlambat" | "Sakit" | "Izin" | "Belum Presensi";

export interface PerClassStudent {
  studentId?: string | null;
  userId: string | null;
  nis: string | null;
  fullName: string | null;
  absenceNumber: string | null;
}

export function perClassStudentKey(student: PerClassStudent): string {
  if (student.studentId) return `student:${student.studentId}`;
  if (student.userId) return `user:${student.userId}`;
  throw new Error("Student summary row has no canonical identity.");
}

export interface PerClassSummaryBuckets {
  hadir: readonly PerClassStudent[];
  terlambat: readonly PerClassStudent[];
  sakit: readonly PerClassStudent[];
  izin: readonly PerClassStudent[];
  tidakHadir: readonly PerClassStudent[];
}

/** Filter dropdown options in presentation order. */
export const PER_CLASS_STATUS_OPTIONS: readonly PerClassAttendanceStatus[] = [
  "Hadir",
  "Terlambat",
  "Sakit",
  "Izin",
  "Belum Presensi",
];

// Buckets applied lowest precedence first so a higher-precedence status
// overwrites an earlier one when defensive deduplication is needed. The
// server contract keeps these disjoint; the order only guards against a
// future source that does not.
const BUCKET_PRECEDENCE: readonly (readonly [
  keyof PerClassSummaryBuckets,
  PerClassAttendanceStatus,
])[] = [
  ["tidakHadir", "Belum Presensi"],
  ["hadir", "Hadir"],
  ["terlambat", "Terlambat"],
  ["izin", "Izin"],
  ["sakit", "Sakit"],
];

export type PerClassStatusRow = PerClassStudent & {
  status: PerClassAttendanceStatus;
};

/**
 * Map summary buckets to one row per student with its canonical status label.
 * Each student keeps exactly one status; overlapping buckets resolve through
 * the precedence order above instead of collapsing into a broader label.
 */
export function resolvePerClassStatusRows(
  buckets: PerClassSummaryBuckets,
): PerClassStatusRow[] {
  const byIdentity = new Map<string, PerClassStatusRow>();

  for (const [bucket, status] of BUCKET_PRECEDENCE) {
    for (const student of buckets[bucket]) {
      byIdentity.set(perClassStudentKey(student), { ...student, status });
    }
  }

  return Array.from(byIdentity.values()).sort(comparePerClassRows);
}

export function filterPerClassStatusRows<Row extends PerClassStatusRow>(
  rows: readonly Row[],
  status: string,
  query: string,
): Row[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!status || row.status === status) &&
      (!q ||
        [row.fullName, row.nis, row.absenceNumber].some((value) =>
          value?.toLowerCase().includes(q),
        )),
  );
}

/** Order rows by absence number, then by full name. */
export function comparePerClassRows(
  a: PerClassStudent,
  b: PerClassStudent,
): number {
  const noA = Number(a.absenceNumber ?? Number.MAX_SAFE_INTEGER);
  const noB = Number(b.absenceNumber ?? Number.MAX_SAFE_INTEGER);
  if (noA !== noB) return noA - noB;
  return (a.fullName ?? "").localeCompare(b.fullName ?? "");
}
