import { sortAttendanceRows } from "./ordering.ts";
import { normalizeStudentRows } from "../../lib/class-names.ts";
import type {
  AstraAttendanceRecord,
  AstraStudentProfile,
  AttendanceExportFilter,
  OrderedAttendanceRow,
} from "./types.ts";

export interface AttendanceCollectionDependencies {
  fetchAttendance?: (
    query: AttendanceExportFilter,
  ) => Promise<AstraAttendanceRecord[]>;
  fetchStudents?: () => Promise<AstraStudentProfile[]>;
}

async function defaultFetchAttendance(
  filter: AttendanceExportFilter,
): Promise<AstraAttendanceRecord[]> {
  const { fetchAllAttendanceRecords } =
    await import("~/server/api/routers/attendance-source");
  return fetchAllAttendanceRecords<AstraAttendanceRecord>({
    startDate: filter.startDate || undefined,
    endDate: filter.endDate || undefined,
    userId: filter.userId || undefined,
  });
}

async function defaultFetchStudents(): Promise<AstraStudentProfile[]> {
  const { astraRequest } = await import("~/lib/astra/client");
  return astraRequest<AstraStudentProfile[]>("/v1/admin/students");
}

/**
 * Collects all attendance records and student profiles from Astra, applies
 * optional class/date filters, maps them to normalized display rows, and performs
 * deterministic stable ordering.
 */
export async function collectAuthoritativeAttendanceRows(
  filter: AttendanceExportFilter = {},
  deps?: AttendanceCollectionDependencies,
): Promise<OrderedAttendanceRow[]> {
  // 1. Fetch attendance records across all pages
  const attendancesPromise = deps?.fetchAttendance
    ? deps.fetchAttendance(filter)
    : defaultFetchAttendance(filter);

  // 2. Fetch all student profiles
  const studentsPromise = deps?.fetchStudents
    ? deps.fetchStudents()
    : defaultFetchStudents();

  const [rawAttendances, rawStudents] = await Promise.all([
    attendancesPromise,
    studentsPromise,
  ]);

  const normalizedStudents = normalizeStudentRows(rawStudents);
  const studentMap = new Map<string, (typeof normalizedStudents)[number]>();
  for (const s of normalizedStudents) {
    if (s.user_id === null) continue;
    studentMap.set(s.user_id, s);
  }

  // 3. Optional class filtering
  let filtered = rawAttendances;
  if (filter.className && filter.className !== "ALL") {
    const classQuery = filter.className.trim().toLowerCase();
    filtered = filtered.filter((a) => {
      const student = studentMap.get(a.user_id);
      return (student?.class_name ?? "").toLowerCase().includes(classQuery);
    });
  }

  // 4. Map to OrderedAttendanceRow
  const mappedRows: OrderedAttendanceRow[] = filtered.map((a) => {
    const student = studentMap.get(a.user_id);
    const date = a.date ?? "";
    const nis = student?.nis ?? "-";
    const className = student?.class_name ?? "-";
    const name = student?.full_name ?? student?.email ?? a.user_id;
    const rawStatus = a.status ?? "-";
    const normalizedStatus = rawStatus === "Datang" ? "Hadir" : rawStatus;
    const displayStatus = normalizedStatus;
    const actionType =
      a.action_type ?? (rawStatus === "Datang" ? "check_in" : null);
    const lokasi =
      a.latitude != null && a.longitude != null
        ? `${a.latitude}, ${a.longitude}`
        : "-";

    return {
      id: a.id,
      userId: a.user_id,
      date,
      nis,
      className,
      name,
      status: normalizedStatus,
      displayStatus,
      lokasi,
      actionType,
      createdAt: a.created_at ?? null,
    };
  });

  // 5. Deterministic stable ordering
  return sortAttendanceRows(mappedRows);
}
