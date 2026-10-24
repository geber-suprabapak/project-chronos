import { TRPCError } from "@trpc/server";
import { fetchCompleteList } from "~/lib/astra/complete-list";
import { normalizeDateOnly } from "~/lib/date-utils";
import { fetchAllAttendanceRecords } from "~/server/api/routers/attendance-source";

interface Period {
  id: string;
  school_id: string;
  is_active: boolean;
}

interface Student {
  student_id?: string | null;
  user_id?: string | null;
  lifecycle_status?: string | null;
}

interface Enrollment extends Student {
  academic_period_id?: string | null;
  class_id?: string | null;
  status: string;
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

export async function getDailyAttendanceSummary(date: string) {
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
  const [students, enrollments, attendances, leaves] = await Promise.all([
    fetchCompleteList<Student>("/v1/admin/students"),
    fetchCompleteList<Enrollment>(`/v1/admin/enrollments?${enrollmentQuery}`),
    fetchAllAttendanceRecords<Attendance>({ date }),
    fetchCompleteList<Leave>(`/v1/admin/leave-requests?${range}`),
  ]);

  const byStudent = new Map<string, Student>();
  const byUser = new Map<string, Student>();
  for (const student of students) {
    if (student.student_id) byStudent.set(student.student_id, student);
    if (student.user_id) byUser.set(student.user_id, student);
  }
  const roster = new Set<string>();
  const studentKeys = new Map<string, string>();
  const userKeys = new Map<string, string>();
  for (const enrollment of enrollments) {
    if (
      enrollment.status !== "active" ||
      enrollment.academic_period_id !== period.id ||
      !enrollment.class_id
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
    const key = studentId ? `student:${studentId}` : `user:${userId}`;
    roster.add(key);
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
    )
      arrived.add(key);
  }
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
