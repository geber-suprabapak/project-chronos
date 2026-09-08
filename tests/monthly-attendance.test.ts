import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateMonthlyAttendance,
  type MonthlyRecapInput,
} from "../src/server/attendance/monthly-recap.ts";

const weekdaySchedule = {
  academic_period_id: "period-1",
  start_time: "06:30:00",
  end_time: "07:30:00",
  is_active: true,
};

function fixture(
  overrides: Partial<MonthlyRecapInput> = {},
): MonthlyRecapInput {
  return {
    month: "2026-09",
    period: {
      id: "period-1",
      name: "2026/2027 Ganjil",
      start_date: "2026-07-01",
      end_date: "2026-12-31",
    },
    classes: [
      { id: "class-1", name: "X RPL 2", grade: 10 },
      { id: "class-2", name: "X RPL 10", grade: 10 },
      { id: "class-3", name: "XI TKJ 1", grade: 11 },
    ],
    students: [
      {
        student_id: "student-a",
        user_id: "user-a",
        full_name: "Ayu",
        nis: "1001",
      },
      {
        student_id: "student-b",
        user_id: "user-b",
        full_name: "Budi",
        nis: "1002",
      },
      {
        student_id: "student-c",
        user_id: "user-c",
        full_name: "Citra",
        nis: "1003",
      },
    ],
    enrollments: [
      {
        id: "enrollment-a",
        student_id: "student-a",
        user_id: "user-a",
        class_id: "class-1",
        academic_period_id: "period-1",
        absence_number: "2",
        status: "active",
      },
      {
        id: "enrollment-b-old",
        student_id: "student-b",
        user_id: "user-b",
        class_id: "class-1",
        academic_period_id: "period-1",
        absence_number: "1",
        status: "transferred",
        created_at: "2026-09-01T00:00:00+07:00",
      },
      {
        id: "enrollment-b-new",
        student_id: "student-b",
        user_id: "user-b",
        class_id: "class-3",
        academic_period_id: "period-1",
        absence_number: "1",
        status: "active",
        created_at: "2026-09-15T00:00:00+07:00",
      },
      {
        id: "enrollment-c",
        student_id: "student-c",
        user_id: "user-c",
        class_id: "class-2",
        academic_period_id: "period-1",
        absence_number: "bad",
        status: "active",
      },
    ],
    schedules: [
      { ...weekdaySchedule, day_of_week: "senin" },
      { ...weekdaySchedule, day_of_week: "selasa" },
      { ...weekdaySchedule, day_of_week: "rabu" },
      { ...weekdaySchedule, day_of_week: "kamis" },
      { ...weekdaySchedule, day_of_week: "jumat" },
    ],
    calendarExceptions: [
      { date: "2026-09-17", is_holiday: true, academic_period_id: "period-1" },
    ],
    attendances: [
      {
        id: "attendance-old",
        user_id: "user-b",
        date: "2026-09-10",
        status: "Hadir",
        action_type: "check_in",
      },
      {
        id: "attendance-new",
        user_id: "user-b",
        date: "2026-09-16",
        status: "Terlambat",
        action_type: "check_in",
      },
      {
        id: "checkout-only",
        user_id: "user-c",
        date: "2026-09-18",
        status: "Pulang",
        action_type: "check_out",
      },
    ],
    leaveRequests: [
      {
        id: "leave-sick",
        user_id: "user-c",
        category: "sakit",
        date: "2026-09-29",
        requested_start_date: "2026-09-29",
        original_end_date: "2026-10-01",
        effective_end_date: "2026-10-01",
        approval_status: "approved",
      },
      {
        id: "leave-pending",
        user_id: "user-a",
        category: "pergi",
        date: "2026-09-28",
        approval_status: "pending",
      },
    ],
    now: "2026-10-01T10:00:00+07:00",
    ...overrides,
  };
}

test("monthly recap uses scheduled WIB dates, leave precedence, transfer history, and totals", () => {
  const result = aggregateMonthlyAttendance(fixture());

  assert.equal(
    result.dates.some((date) => date.date === "2026-09-17"),
    false,
  );
  assert.deepEqual(
    result.classes.map((group) => group.className),
    ["X RPL 2", "X RPL 10", "XI TKJ 1"],
  );

  const oldClass = result.classes[0]!;
  const transferredOld = oldClass.rows.find((row) => row.fullName === "Budi")!;
  const newClass = result.classes[2]!;
  const transferredNew = newClass.rows.find((row) => row.fullName === "Budi")!;
  assert.equal(transferredOld.cells["2026-09-10"], "✓");
  assert.equal(transferredOld.cells["2026-09-16"], undefined);
  assert.equal(transferredNew.cells["2026-09-16"], "T");

  const sick = result.classes[1]!.rows.find((row) => row.fullName === "Citra")!;
  assert.equal(sick.cells["2026-09-29"], "S");
  assert.equal(sick.cells["2026-09-18"], "A");
  assert.equal(sick.totals.sakit, 2);
  assert.equal(sick.totals.alpha > 0, true);
  assert.equal(
    result.warnings.some((warning) => warning.includes("Citra")),
    true,
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes("Ahmad")),
    false,
  );
  assert.equal(result.totals.terlambat, 1);
});

test("current open school day and future dates stay blank", () => {
  const result = aggregateMonthlyAttendance(
    fixture({ now: "2026-09-10T07:00:00+07:00" }),
  );
  const ayu = result.classes[0]!.rows.find((row) => row.fullName === "Ayu")!;
  assert.equal(ayu.cells["2026-09-10"], "");
  assert.equal(ayu.cells["2026-09-11"], "");
  assert.equal(ayu.cells["2026-09-09"], "A");
  assert.equal(ayu.cells["2026-09-29"], "");
});

test("optional class and student filters constrain the shared dataset", () => {
  const classResult = aggregateMonthlyAttendance(
    fixture({ className: "XI TKJ 1" }),
  );
  assert.deepEqual(
    classResult.classes.map((group) => group.className),
    ["XI TKJ 1"],
  );

  const studentResult = aggregateMonthlyAttendance(
    fixture({ studentId: "student-a" }),
  );
  assert.deepEqual(
    studentResult.classes.flatMap((group) =>
      group.rows.map((row) => row.fullName),
    ),
    ["Ayu"],
  );
});

test("approved leave without a student identity cannot affect another row", () => {
  const result = aggregateMonthlyAttendance(
    fixture({
      leaveRequests: [
        {
          id: "orphan-leave",
          category: "sakit",
          date: "2026-09-09",
          approval_status: "approved",
        },
        {
          id: "identified-leave",
          user_id: "user-a",
          category: "sakit",
          date: "2026-09-09",
          approval_status: "approved",
        },
      ],
      now: "2026-10-01T10:00:00+07:00",
    }),
  );
  const ayu = result.classes[0]!.rows.find((row) => row.fullName === "Ayu")!;
  assert.equal(ayu.cells["2026-09-09"], "S");
  const budi = result.classes[0]!.rows.find((row) => row.fullName === "Budi")!;
  assert.equal(budi.cells["2026-09-09"], "A");
});
