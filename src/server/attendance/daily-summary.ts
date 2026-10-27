import { TRPCError } from "@trpc/server";
import { fetchCompleteList } from "~/lib/astra/complete-list";
import { normalizeDateOnly } from "~/lib/date-utils";
import { fetchAllAttendanceRecords } from "~/server/api/routers/attendance-source";
import { normalizeStudentRows } from "~/lib/class-names";
import {
  perClassStudentKey,
  type PerClassStudent,
  type PerClassSummaryBuckets,
} from "~/lib/attendance-status";

interface Period {
  id: string;
  school_id: string;
  is_active: boolean;
}

interface Student {
  student_id?: string | null;
  user_id?: string | null;
  lifecycle_status?: string | null;
  full_name?: string | null;
  email?: string | null;
  nis?: string | null;
  absence_number?: string | null;
}

interface Enrollment extends Student {
  academic_period_id?: string | null;
  class_id?: string | null;
  status: string;
  absence_number?: string | null;
}

interface Attendance extends Student {
  date: string;
  status: string;
  action_type?: string | null;
}

interface Leave extends Student {
  date: string;
  requested_start_date?: string | null;
  effective_end_date?: string | null;
  original_end_date?: string | null;
  approval_status?: string;
  status?: boolean;
  category: string;
}

type ClassSummaryDetails = {
  [Bucket in keyof PerClassSummaryBuckets]: PerClassStudent[];
};

async function getDailyAttendanceState(date: string, className?: string) {
  // Astra is tenant scoped. A unique active period identifies this school's
  // roster; an absent or ambiguous period must not masquerade as an empty one.
  const periods = await fetchCompleteList<Period>(
    "/v1/admin/academic-periods?is_active=true",
  );
  const active = periods.filter((period) => period.is_active);
  if (active.length !== 1) {
    throw new TRPCError({
      code: active.length === 0 ? "NOT_FOUND" : "CONFLICT",
      message:
        active.length === 0
          ? "Periode akademik aktif belum tersedia."
          : "Terdapat lebih dari satu periode akademik aktif.",
    });
  }
  const period = active[0]!;
  const range = new URLSearchParams({ start_date: date, end_date: date });
  const enrollmentQuery = new URLSearchParams({
    academic_period_id: period.id,
    status: "active",
  });
  const [rawStudents, enrollments, attendances, leaves, classes] =
    await Promise.all([
      fetchCompleteList<Student>("/v1/admin/students"),
      fetchCompleteList<Enrollment>(`/v1/admin/enrollments?${enrollmentQuery}`),
      fetchAllAttendanceRecords<Attendance>({ date }),
      fetchCompleteList<Leave>(`/v1/admin/leave-requests?${range}`),
      className
        ? fetchCompleteList<{ id: string; name: string }>(
            `/v1/admin/classes?academic_period_id=${encodeURIComponent(period.id)}`,
          )
        : Promise.resolve([]),
    ]);

  const students = normalizeStudentRows(rawStudents);
  const classIds = new Set(
    classes
      .filter((c) => c.name.toLowerCase() === className?.trim().toLowerCase())
      .map((c) => c.id),
  );

  const byStudent = new Map<string, Student>();
  const byUser = new Map<string, Student>();
  for (const student of students) {
    if (student.student_id) byStudent.set(student.student_id, student);
    if (student.user_id) byUser.set(student.user_id, student);
  }
  const roster = new Map<string, PerClassStudent>();
  const studentKeys = new Map<string, string>();
  const userKeys = new Map<string, string>();
  for (const enrollment of enrollments) {
    if (
      enrollment.status !== "active" ||
      enrollment.academic_period_id !== period.id ||
      !enrollment.class_id ||
      (className && !classIds.has(enrollment.class_id))
    )
      continue;
    const student = enrollment.student_id
      ? byStudent.get(enrollment.student_id)
      : enrollment.user_id
        ? byUser.get(enrollment.user_id)
        : undefined;
    if (!student) {
      throw new Error("Astra enrollment references a missing student.");
    }
    // A canonical roster-only student needs no Logto account. For a linked
    // profile, the existing approval lifecycle still controls eligibility.
    if (student.user_id && student.lifecycle_status !== "approved") continue;
    const studentId = student.student_id ?? enrollment.student_id;
    const userId = student.user_id ?? enrollment.user_id;
    const detail: PerClassStudent = {
      studentId: studentId ?? null,
      userId: userId ?? null,
      fullName: student.full_name ?? student.email ?? null,
      nis: student.nis ?? null,
      absenceNumber:
        enrollment.absence_number ?? student.absence_number ?? null,
    };
    const key = perClassStudentKey(detail);
    roster.set(key, detail);
    if (studentId) studentKeys.set(studentId, key);
    if (userId) userKeys.set(userId, key);
  }
  const identityKey = (row: Student) =>
    (row.student_id ? studentKeys.get(row.student_id) : undefined) ??
    (row.user_id ? userKeys.get(row.user_id) : undefined);

  const sick = new Set<string>();
  const permitted = new Set<string>();
  for (const leave of leaves) {
    const key = identityKey(leave);
    const start = normalizeDateOnly(leave.requested_start_date ?? leave.date);
    const end = normalizeDateOnly(
      leave.effective_end_date ?? leave.original_end_date ?? start,
    );
    if (
      !key ||
      !start ||
      !end ||
      date < start ||
      date > end ||
      (leave.approval_status !== "approved" &&
        !(leave.approval_status === undefined && leave.status === true))
    )
      continue;
    if (leave.category === "sakit") {
      sick.add(key);
      permitted.delete(key);
    } else if (!sick.has(key)) {
      permitted.add(key);
    }
  }
  const arrived = new Set<string>();
  const late = new Set<string>();
  const departed = new Set<string>();
  for (const attendance of attendances) {
    const key = identityKey(attendance);
    if (!key || normalizeDateOnly(attendance.date) !== date) continue;
    if (
      attendance.status === "Pulang" ||
      attendance.action_type === "check_out"
    )
      departed.add(key);
    if (sick.has(key) || permitted.has(key)) continue;
    if (
      attendance.action_type !== "check_out" &&
      ["Hadir", "Datang", "Terlambat"].includes(attendance.status)
    ) {
      arrived.add(key);
      if (attendance.status === "Terlambat") late.add(key);
    }
  }
  return { roster, arrived, late, departed, sick, permitted };
}

export async function getDailyAttendanceSummary(date: string) {
  const { roster, arrived, departed, sick, permitted } =
    await getDailyAttendanceState(date);
  const checkedOut = [...arrived].filter((key) => departed.has(key)).length;
  return {
    date,
    totalUsers: roster.size,
    sudahAbsenMasuk: arrived.size,
    belumAbsenMasuk: roster.size - arrived.size - sick.size - permitted.size,
    sudahAbsenPulang: checkedOut,
    belumAbsenPulang: arrived.size - checkedOut,
    izin: permitted.size,
    sakit: sick.size,
  };
}

export async function getClassAttendanceSummary(input: {
  date: string;
  className: string;
}) {
  const { roster, arrived, late, sick, permitted } =
    await getDailyAttendanceState(input.date, input.className);
  const details: ClassSummaryDetails = {
    hadir: [],
    terlambat: [],
    sakit: [],
    izin: [],
    tidakHadir: [],
  };
  for (const [key, student] of roster) {
    const bucket = sick.has(key)
      ? "sakit"
      : permitted.has(key)
        ? "izin"
        : late.has(key)
          ? "terlambat"
          : arrived.has(key)
            ? "hadir"
            : "tidakHadir";
    details[bucket].push(student);
  }
  return {
    ...input,
    totalStudents: roster.size,
    summary: {
      hadir: details.hadir.length,
      terlambat: details.terlambat.length,
      sakit: details.sakit.length,
      izin: details.izin.length,
      tidakHadir: details.tidakHadir.length,
    },
    details,
  };
}
