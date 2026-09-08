import { normalizeDateOnly } from "~/lib/date-utils";

export const DAILY_ATTENDANCE_STATES = ["✓", "S", "I", "A", "T"] as const;
export type DailyAttendanceState = (typeof DAILY_ATTENDANCE_STATES)[number];

export interface MonthlyRecapPeriod {
  id: string;
  name?: string | null;
  start_date: string;
  end_date: string;
}

export interface MonthlyRecapClass {
  id: string;
  name: string;
  grade?: number | null;
}

export interface MonthlyRecapStudent {
  student_id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  nis?: string | null;
  class_name?: string | null;
  absence_number?: string | number | null;
}

export interface MonthlyRecapEnrollment {
  id: string;
  student_id?: string | null;
  user_id?: string | null;
  class_id?: string | null;
  class_name?: string | null;
  academic_period_id?: string | null;
  nis?: string | null;
  student_name?: string | null;
  absence_number?: string | number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
}

export interface MonthlyRecapSchedule {
  class_id?: string | null;
  academic_period_id?: string | null;
  day_of_week?: string | number | null;
  hari?: string | number | null;
  start_time?: string | null;
  end_time?: string | null;
  mulai_masuk?: string | null;
  selesai_masuk?: string | null;
  is_active?: boolean | null;
}

export interface MonthlyRecapCalendarException {
  academic_period_id?: string | null;
  date: string;
  is_holiday?: boolean | null;
  reason?: string | null;
}

export interface MonthlyRecapAttendance {
  id: string;
  user_id?: string | null;
  student_id?: string | null;
  date: string;
  status?: string | null;
  action_type?: string | null;
  created_at?: string | null;
}

export interface MonthlyRecapLeaveRequest {
  id: string;
  user_id?: string | null;
  student_id?: string | null;
  category?: string | null;
  date: string;
  requested_start_date?: string | null;
  original_end_date?: string | null;
  effective_end_date?: string | null;
  approval_status?: string | null;
  status?: boolean | null;
}

export interface MonthlyRecapInput {
  month: string;
  period: MonthlyRecapPeriod;
  classes: readonly MonthlyRecapClass[];
  students: readonly MonthlyRecapStudent[];
  enrollments: readonly MonthlyRecapEnrollment[];
  schedules: readonly MonthlyRecapSchedule[];
  calendarExceptions: readonly MonthlyRecapCalendarException[];
  attendances: readonly MonthlyRecapAttendance[];
  leaveRequests: readonly MonthlyRecapLeaveRequest[];
  className?: string;
  studentId?: string;
  userId?: string;
  nis?: string;
  now?: Date | string;
}

export interface MonthlyRecapDate {
  date: string;
  dayOfWeek: string;
}

export interface MonthlyRecapCell {
  date: string;
  state: DailyAttendanceState | "";
  attendanceIds: string[];
  leaveRequestId: string | null;
}

export interface MonthlyRecapTotals {
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  terlambat: number;
  expectedDays: number;
}

export interface MonthlyRecapStudentRow {
  studentId: string | null;
  userId: string | null;
  nis: string | null;
  fullName: string;
  classId: string;
  className: string;
  absenceNumber: string | null;
  warning: string | null;
  cells: Record<string, DailyAttendanceState | "">;
  days: MonthlyRecapCell[];
  totals: MonthlyRecapTotals;
}

export interface MonthlyRecapClassGroup {
  classId: string;
  className: string;
  grade: number | null;
  warning: string | null;
  rows: MonthlyRecapStudentRow[];
  totals: MonthlyRecapTotals;
}

export interface MonthlyRecapResult {
  month: string;
  period: {
    id: string;
    name: string | null;
    startDate: string;
    endDate: string;
  };
  dates: MonthlyRecapDate[];
  classes: MonthlyRecapClassGroup[];
  totals: MonthlyRecapTotals;
  warnings: string[];
}

interface DateRange {
  start: string;
  end: string;
}

interface WibClock {
  date: string;
  time: string;
}

const WEEKDAYS = [
  "minggu",
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
] as const;

const ROMAN_GRADES = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
} satisfies Record<string, number>;

function dateValue(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function addDays(date: string, days: number): string {
  const value = new Date(dateValue(date));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function monthBounds(month: string): DateRange {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(year!, monthNumber!, 0))
    .toISOString()
    .slice(0, 10);
  return { start, end };
}

function dateFromWib(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return normalizeDateOnly(value);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function currentWib(now: Date | string | undefined): WibClock {
  if (now && !(now instanceof Date) && /^\d{4}-\d{2}-\d{2}$/.test(now)) {
    return { date: now, time: "23:59" };
  }
  const parsed = now instanceof Date ? now : new Date(now ?? Date.now());
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(parsed);
  const part = (type: string) =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function normalizeWeekday(
  value: string | number | null | undefined,
): string | null {
  const candidate =
    value === null || value === undefined
      ? ""
      : String(value).trim().toLowerCase();
  if (/^\d+$/.test(candidate)) {
    const numeric = Number(candidate);
    return WEEKDAYS[numeric === 7 ? 0 : numeric] ?? null;
  }
  if (!candidate) return null;
  if (candidate === "monday") return "senin";
  if (candidate === "tuesday") return "selasa";
  if (candidate === "wednesday") return "rabu";
  if (candidate === "thursday") return "kamis";
  if (candidate === "friday") return "jumat";
  if (candidate === "saturday") return "sabtu";
  if (candidate === "sunday") return "minggu";
  return WEEKDAYS.find((day) => day === candidate) ?? null;
}

function scheduleFor(
  schedules: readonly MonthlyRecapSchedule[],
  classId: string,
  periodId: string,
  date: string,
): MonthlyRecapSchedule | null {
  const weekday = WEEKDAYS[new Date(dateValue(date)).getUTCDay()];
  const matches = schedules.filter((schedule) => {
    if (schedule.is_active === false) return false;
    if (schedule.class_id && schedule.class_id !== classId) return false;
    if (schedule.academic_period_id && schedule.academic_period_id !== periodId)
      return false;
    return normalizeWeekday(schedule.day_of_week ?? schedule.hari) === weekday;
  });
  return (
    matches.sort(
      (a, b) =>
        Number(Boolean(b.class_id)) * 2 +
        Number(Boolean(b.academic_period_id)) -
        (Number(Boolean(a.class_id)) * 2 +
          Number(Boolean(a.academic_period_id))),
    )[0] ?? null
  );
}

function isHoliday(
  exceptions: readonly MonthlyRecapCalendarException[],
  periodId: string,
  date: string,
): boolean {
  return exceptions.some(
    (exception) =>
      normalizeDateOnly(exception.date) === date &&
      exception.is_holiday === true &&
      (!exception.academic_period_id ||
        exception.academic_period_id === periodId),
  );
}

function cutoffFor(schedule: MonthlyRecapSchedule): string | null {
  const raw = schedule.end_time ?? schedule.selesai_masuk;
  if (!raw) return null;
  const match = /^(\d{2}:\d{2})/.exec(raw);
  return match?.[1] ?? null;
}

function isOpenSchoolDay(
  date: string,
  schedule: MonthlyRecapSchedule,
  now: { date: string; time: string },
): boolean {
  // A recap never evaluates a scheduled day that has not happened yet.  The
  // current day stays open until its arrival window closes; all earlier days
  // are closed and can be projected to Alpha when there is no evidence.
  if (!now.date || date > now.date) return true;
  if (date < now.date) return false;
  const cutoff = cutoffFor(schedule);
  return cutoff === null || now.time < cutoff;
}

function validAbsenceNumber(
  value: string | number | null | undefined,
): number | null {
  const candidate =
    value === null || value === undefined ? "" : String(value).trim();
  // Persisted roster values may retain display padding (for example, `01`).
  // Treat those as the same positive integer as `1`; only zero, signs,
  // decimals, and non-digit legacy values are invalid.
  if (!/^\d+$/.test(candidate)) return null;
  const parsed = Number(candidate);
  return parsed > 0 && Number.isSafeInteger(parsed) ? parsed : null;
}

function naturalClassGrade(
  name: string,
  grade: number | null | undefined,
): number {
  if (grade !== null && grade !== undefined) return grade;
  const token = name.trim().split(/\s+/)[0]?.toUpperCase();
  return (
    Object.entries(ROMAN_GRADES).find(([key]) => key === token)?.[1] ??
    Number.MAX_SAFE_INTEGER
  );
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "id", { numeric: true, sensitivity: "base" });
}

function emptyTotals(expectedDays: number): MonthlyRecapTotals {
  return { hadir: 0, sakit: 0, izin: 0, alpha: 0, terlambat: 0, expectedDays };
}

function addTotals(
  target: MonthlyRecapTotals,
  source: MonthlyRecapTotals,
): void {
  target.hadir += source.hadir;
  target.sakit += source.sakit;
  target.izin += source.izin;
  target.alpha += source.alpha;
  target.terlambat += source.terlambat;
}

function studentKey(
  enrollment: MonthlyRecapEnrollment,
  student: MonthlyRecapStudent | undefined,
): string {
  return (
    enrollment.student_id ??
    student?.student_id ??
    enrollment.user_id ??
    student?.user_id ??
    enrollment.nis ??
    student?.nis ??
    enrollment.id
  );
}

function enrollmentStart(
  enrollment: MonthlyRecapEnrollment,
  periodStart: string,
): string {
  return (
    dateFromWib(enrollment.effective_start_date) ??
    dateFromWib(enrollment.created_at) ??
    periodStart
  );
}

function applicableEnrollment(
  enrollments: readonly MonthlyRecapEnrollment[],
  date: string,
  periodStart: string,
  periodEnd: string,
): MonthlyRecapEnrollment[] {
  const grouped = new Map<string, MonthlyRecapEnrollment[]>();
  for (const enrollment of enrollments) {
    const key =
      enrollment.student_id ??
      enrollment.user_id ??
      enrollment.nis ??
      enrollment.id;
    const list = grouped.get(key) ?? [];
    list.push(enrollment);
    grouped.set(key, list);
  }

  const result: MonthlyRecapEnrollment[] = [];
  for (const list of grouped.values()) {
    const ordered = [...list].sort((a, b) =>
      enrollmentStart(a, periodStart).localeCompare(
        enrollmentStart(b, periodStart),
      ),
    );
    const effective = ordered.flatMap((current, index) => {
      const start = enrollmentStart(current, periodStart);
      const explicitEnd = dateFromWib(current.effective_end_date);
      const nextStart = ordered[index + 1]
        ? enrollmentStart(ordered[index + 1]!, periodStart)
        : null;
      const end =
        explicitEnd ?? (nextStart ? addDays(nextStart, -1) : periodEnd);
      return start <= date && date <= end ? [current] : [];
    });
    // A healthy period has one effective enrollment per student. If legacy
    // rows overlap, prefer the latest effective start rather than duplicating
    // the student into multiple classes for the same day.
    if (effective.length > 0) {
      effective.sort((a, b) =>
        enrollmentStart(b, periodStart).localeCompare(
          enrollmentStart(a, periodStart),
        ),
      );
      result.push(effective[0]!);
    }
  }
  return result;
}

function approvedLeaveFor(
  leaves: readonly MonthlyRecapLeaveRequest[],
  userId: string | null,
  studentId: string | null,
  date: string,
): MonthlyRecapLeaveRequest | null {
  const matches = leaves.filter((leave) => {
    if (
      leave.approval_status !== "approved" &&
      !(leave.approval_status === undefined && leave.status === true)
    )
      return false;
    const identityMatches =
      (leave.user_id !== null &&
        leave.user_id !== undefined &&
        leave.user_id === userId) ||
      (leave.student_id !== null &&
        leave.student_id !== undefined &&
        leave.student_id === studentId);
    if (!identityMatches) return false;
    const start = dateFromWib(leave.requested_start_date ?? leave.date);
    const end = dateFromWib(
      leave.effective_end_date ?? leave.original_end_date ?? start,
    );
    return Boolean(start && end && start <= date && date <= end);
  });
  return (
    matches
      .sort(
        (a, b) =>
          Number((a.category ?? "").toLowerCase() === "sakit") -
          Number((b.category ?? "").toLowerCase() === "sakit"),
      )
      .at(-1) ?? null
  );
}

function attendanceFor(
  attendances: readonly MonthlyRecapAttendance[],
  userId: string | null,
  studentId: string | null,
  date: string,
): MonthlyRecapAttendance[] {
  return attendances.filter(
    (attendance) =>
      dateFromWib(attendance.date) === date &&
      ((userId && attendance.user_id === userId) ||
        (studentId && attendance.student_id === studentId)),
  );
}

function arrivalState(
  records: readonly MonthlyRecapAttendance[],
): DailyAttendanceState | null {
  const arrivals = records.filter(
    (record) =>
      record.action_type === "check_in" ||
      (record.action_type !== "check_out" &&
        ["Hadir", "Terlambat", "Datang"].includes(record.status ?? "")),
  );
  if (arrivals.some((record) => record.status === "Terlambat")) return "T";
  if (
    arrivals.some(
      (record) => record.status === "Hadir" || record.status === "Datang",
    )
  )
    return "✓";
  return null;
}

export function aggregateMonthlyAttendance(
  input: MonthlyRecapInput,
): MonthlyRecapResult {
  const { start: monthStart, end: monthEnd } = monthBounds(input.month);
  const periodStart = normalizeDateOnly(input.period.start_date) ?? monthStart;
  const periodEnd = normalizeDateOnly(input.period.end_date) ?? monthEnd;
  const rangeStart = monthStart > periodStart ? monthStart : periodStart;
  const rangeEnd = monthEnd < periodEnd ? monthEnd : periodEnd;
  const now = currentWib(input.now);
  const dates: MonthlyRecapDate[] = [];

  for (let date = rangeStart; date <= rangeEnd; date = addDays(date, 1)) {
    const daySchedule = input.schedules.some((schedule) => {
      if (schedule.is_active === false) return false;
      if (
        schedule.academic_period_id &&
        schedule.academic_period_id !== input.period.id
      )
        return false;
      return (
        normalizeWeekday(schedule.day_of_week ?? schedule.hari) ===
        WEEKDAYS[new Date(dateValue(date)).getUTCDay()]
      );
    });
    if (
      daySchedule &&
      !isHoliday(input.calendarExceptions, input.period.id, date)
    ) {
      dates.push({
        date,
        dayOfWeek: WEEKDAYS[new Date(dateValue(date)).getUTCDay()]!,
      });
    }
  }

  const classById = new Map(input.classes.map((item) => [item.id, item]));
  const studentByKey = new Map<string, MonthlyRecapStudent>();
  for (const student of input.students) {
    for (const key of [student.student_id, student.user_id, student.nis]) {
      if (key) studentByKey.set(key, student);
    }
  }

  const enrollments = input.enrollments.filter(
    (enrollment) =>
      !enrollment.academic_period_id ||
      enrollment.academic_period_id === input.period.id,
  );
  const filteredEnrollments = enrollments.filter((enrollment) => {
    const student = studentByKey.get(
      enrollment.student_id ??
        enrollment.user_id ??
        enrollment.nis ??
        enrollment.id,
    );
    const classInfo = enrollment.class_id
      ? classById.get(enrollment.class_id)
      : undefined;
    const enrollmentClass = classInfo?.name ?? enrollment.class_name ?? "";
    if (input.className && enrollmentClass !== input.className) return false;
    if (
      input.studentId &&
      input.studentId !== (student?.student_id ?? enrollment.student_id)
    )
      return false;
    if (
      input.userId &&
      input.userId !== (student?.user_id ?? enrollment.user_id)
    )
      return false;
    if (input.nis && input.nis !== (student?.nis ?? enrollment.nis))
      return false;
    return true;
  });
  const classRows = new Map<string, MonthlyRecapStudentRow[]>();
  const warnings: string[] = [];

  for (const dateInfo of dates) {
    const applicable = applicableEnrollment(
      filteredEnrollments,
      dateInfo.date,
      periodStart,
      periodEnd,
    );
    for (const enrollment of applicable) {
      const student =
        studentByKey.get(studentKey(enrollment, undefined)) ??
        studentByKey.get(
          enrollment.student_id ?? enrollment.user_id ?? enrollment.nis ?? "",
        );
      const classInfo = enrollment.class_id
        ? classById.get(enrollment.class_id)
        : undefined;
      const classId =
        enrollment.class_id ?? `class:${enrollment.class_name ?? "unknown"}`;
      const className =
        classInfo?.name ?? enrollment.class_name ?? "Kelas tanpa nama";
      const rows = classRows.get(classId) ?? [];
      const rowStudentId = student?.student_id ?? enrollment.student_id ?? null;
      const rowUserId = student?.user_id ?? enrollment.user_id ?? null;
      const rowNis = student?.nis ?? enrollment.nis ?? null;
      let row = rows.find(
        (candidate) =>
          (rowStudentId !== null && candidate.studentId === rowStudentId) ||
          (rowUserId !== null && candidate.userId === rowUserId) ||
          (rowNis !== null && candidate.nis === rowNis),
      );
      if (!row) {
        const absenceValue =
          enrollment.absence_number ?? student?.absence_number ?? null;
        row = {
          studentId: rowStudentId,
          userId: rowUserId,
          nis: rowNis,
          fullName:
            student?.full_name ?? enrollment.student_name ?? "Siswa tanpa nama",
          classId,
          className,
          absenceNumber:
            absenceValue === null || absenceValue === undefined
              ? null
              : String(absenceValue),
          warning: null,
          cells: {},
          days: [],
          totals: emptyTotals(dates.length),
        };
        rows.push(row);
        classRows.set(classId, rows);
      }

      const schedule = scheduleFor(
        input.schedules,
        classId,
        input.period.id,
        dateInfo.date,
      );
      if (!schedule) continue;
      const open = isOpenSchoolDay(dateInfo.date, schedule, now);
      const leave = approvedLeaveFor(
        input.leaveRequests,
        row.userId,
        row.studentId,
        dateInfo.date,
      );
      const attendance = attendanceFor(
        input.attendances,
        row.userId,
        row.studentId,
        dateInfo.date,
      );
      const state = open
        ? ""
        : leave
          ? (leave.category ?? "").toLowerCase() === "sakit"
            ? "S"
            : "I"
          : (arrivalState(attendance) ?? "A");
      row.cells[dateInfo.date] = state;
      row.days.push({
        date: dateInfo.date,
        state,
        attendanceIds: attendance.map((item) => item.id),
        leaveRequestId: leave?.id ?? null,
      });
      if (state === "✓") row.totals.hadir += 1;
      if (state === "S") row.totals.sakit += 1;
      if (state === "I") row.totals.izin += 1;
      if (state === "A") row.totals.alpha += 1;
      if (state === "T") row.totals.terlambat += 1;
    }
  }

  const groups: MonthlyRecapClassGroup[] = [];
  for (const [classId, rows] of classRows) {
    const classInfo = classById.get(classId);
    const className = classInfo?.name ?? rows[0]?.className ?? classId;
    const duplicateNumbers = new Set<number>();
    const numberCounts = new Map<number, number>();
    for (const row of rows) {
      const number = validAbsenceNumber(row.absenceNumber);
      if (number !== null)
        numberCounts.set(number, (numberCounts.get(number) ?? 0) + 1);
    }
    for (const [number, count] of numberCounts)
      if (count > 1) duplicateNumbers.add(number);
    for (const row of rows) {
      const number = validAbsenceNumber(row.absenceNumber);
      if (number === null || duplicateNumbers.has(number)) {
        row.warning =
          number === null
            ? "Absence Number legacy tidak valid atau kosong."
            : `Absence Number ${number} duplikat dalam kelas.`;
        warnings.push(`${className}: ${row.fullName} — ${row.warning}`);
      }
    }
    rows.sort((a, b) => {
      const numberA = validAbsenceNumber(a.absenceNumber);
      const numberB = validAbsenceNumber(b.absenceNumber);
      if (
        numberA !== null &&
        numberB !== null &&
        !duplicateNumbers.has(numberA) &&
        !duplicateNumbers.has(numberB)
      )
        return numberA - numberB;
      if (numberA !== null && !duplicateNumbers.has(numberA)) return -1;
      if (numberB !== null && !duplicateNumbers.has(numberB)) return 1;
      return naturalCompare(a.fullName, b.fullName);
    });
    const totals = emptyTotals(dates.length);
    const expectedDays = dates.filter((date) =>
      scheduleFor(input.schedules, classId, input.period.id, date.date),
    ).length;
    for (const row of rows) row.totals.expectedDays = row.days.length;
    totals.expectedDays = expectedDays;
    for (const row of rows) addTotals(totals, row.totals);
    groups.push({
      classId,
      className,
      grade: classInfo?.grade ?? naturalClassGrade(className, null),
      warning: rows.some((row) => row.warning)
        ? "Ada Absence Number legacy yang perlu diperiksa."
        : null,
      rows,
      totals,
    });
  }

  groups.sort(
    (a, b) => a.grade! - b.grade! || naturalCompare(a.className, b.className),
  );
  const totals = emptyTotals(dates.length);
  for (const group of groups) addTotals(totals, group.totals);
  return {
    month: input.month,
    period: {
      id: input.period.id,
      name: input.period.name ?? null,
      startDate: periodStart,
      endDate: periodEnd,
    },
    dates,
    classes: groups,
    totals,
    warnings: [...new Set(warnings)],
  };
}
