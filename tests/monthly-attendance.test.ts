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

test("snapshot terminal unknown-end rows produce no Alpha and preserve evidence", () => {
  const active = Array.from({ length: 956 }, (_, index) => ({
    id: `active-${index}`,
    student_id: `active-student-${index}`,
    academic_period_id: "period-1",
    class_id: "class-1",
    absence_number: String(index + 1),
    status: "active",
  }));
  const graduated = Array.from({ length: 345 }, (_, index) => ({
    id: `graduated-${index}`,
    student_id: `graduate-${index}`,
    user_id: `graduate-user-${index}`,
    academic_period_id: "period-1",
    status: "graduated",
    created_at: "2026-07-01T00:00:00+07:00",
    updated_at: "2026-09-03T00:00:00+07:00",
  }));
  const result = aggregateMonthlyAttendance(
    fixture({
      month: "2026-10",
      enrollments: [...active, ...graduated],
      students: [],
      attendances: [
        {
          id: "graduated-arrival",
          student_id: "graduate-0",
          date: "2026-10-01",
          status: "Hadir",
          action_type: "check_in",
        },
        {
          id: "graduated-weekend",
          student_id: "graduate-1",
          date: "2026-10-03",
          status: "Terlambat",
          action_type: "check_in",
        },
      ],
      leaveRequests: [
        {
          id: "graduated-leave",
          student_id: "graduate-2",
          date: "2026-10-02",
          effective_end_date: "2026-10-05",
          category: "sakit",
          approval_status: "approved",
        },
      ],
      now: "2026-10-06T06:00:00+07:00",
    }),
  );
  const unknown = result.classes.find(
    (group) => group.classId === "class:unknown",
  )!;
  assert.equal(unknown.rows.length, 345);
  assert.equal(unknown.totals.alpha, 0);
  assert.ok(
    unknown.rows.every(
      (row) =>
        row.totals.alpha === 0 &&
        row.totals.expectedDays === 0 &&
        row.warning?.includes("Rentang enrollment"),
    ),
  );
  const arrived = unknown.rows.find((row) => row.studentId === "graduate-0")!;
  assert.equal(arrived.cells["2026-10-01"], "✓");
  assert.equal(arrived.cells["2026-10-02"], "");
  assert.deepEqual(
    arrived.days.find((day) => day.date === "2026-10-01")!.attendanceIds,
    ["graduated-arrival"],
  );
  assert.equal(
    unknown.rows.find((row) => row.studentId === "graduate-1")!.cells[
      "2026-10-03"
    ],
    "T",
  );
  assert.equal(
    unknown.rows.find((row) => row.studentId === "graduate-2")!.cells[
      "2026-10-04"
    ],
    "S",
  );
  const current = result.classes.find((group) => group.classId === "class-1")!;
  assert.equal(current.rows.length, 956);
  assert.equal(current.totals.alpha, 956 * 3);
  assert.equal(current.rows[0]!.totals.expectedDays, 22);
  assert.equal(result.totals.expectedDays, 22);
});

test("explicit end stays inclusive; recorded evidence after end stays visible with a warning", () => {
  const result = aggregateMonthlyAttendance(
    fixture({
      enrollments: [
        {
          id: "known-end",
          student_id: "student-a",
          class_id: "class-1",
          academic_period_id: "period-1",
          status: "graduated",
          effective_start_date: "2026-09-01",
          effective_end_date: "2026-09-03",
          updated_at: "2026-10-01",
        },
      ],
      attendances: [
        {
          id: "after-end",
          student_id: "student-a",
          date: "2026-09-07",
          status: "Hadir",
          action_type: "check_in",
        },
      ],
      leaveRequests: [],
      now: "2026-10-01",
    }),
  );
  const row = result.classes[0]!.rows[0]!;
  assert.equal(row.cells["2026-09-03"], "A");
  assert.equal(row.cells["2026-09-04"], undefined);
  assert.equal(row.cells["2026-09-07"], "✓");
  assert.equal(row.totals.alpha, 3);
  assert.equal(row.totals.expectedDays, 3);
  assert.ok(row.warning?.includes("Rentang enrollment"));
});

test("class filters preserve the successor boundary in transfer history", () => {
  const unfiltered = aggregateMonthlyAttendance(fixture());
  const filtered = aggregateMonthlyAttendance(
    fixture({ className: "X RPL 2" }),
  );
  const original = unfiltered.classes
    .find((group) => group.className === "X RPL 2")!
    .rows.find((row) => row.fullName === "Budi")!;
  const selected = filtered.classes[0]!.rows.find(
    (row) => row.fullName === "Budi",
  )!;
  assert.deepEqual(selected.cells, original.cells);
  assert.deepEqual(selected.totals, original.totals);
});

test("a terminal unknown-end successor does not erase a known earlier class interval", () => {
  const result = aggregateMonthlyAttendance(
    fixture({
      enrollments: [
        {
          id: "old",
          student_id: "student-a",
          class_id: "class-1",
          academic_period_id: "period-1",
          status: "transferred",
          effective_start_date: "2026-09-01",
        },
        {
          id: "new",
          user_id: "user-a",
          class_id: "class-3",
          academic_period_id: "period-1",
          status: "graduated",
          created_at: "2026-09-15T00:00:00+07:00",
        },
      ],
      attendances: [],
      leaveRequests: [],
      now: "2026-10-01",
    }),
  );
  const earlier = result.classes.find((group) => group.classId === "class-1")!
    .rows[0]!;
  const terminal = result.classes.find((group) => group.classId === "class-3")!
    .rows[0]!;
  assert.equal(earlier.cells["2026-09-14"], "A");
  assert.equal(earlier.cells["2026-09-15"], undefined);
  assert.equal(terminal.cells["2026-09-15"], "");
  assert.equal(terminal.totals.alpha, 0);
});

test("unknown-end evidence respects the current arrival cutoff and future-day policy", () => {
  const result = aggregateMonthlyAttendance(
    fixture({
      enrollments: [
        {
          id: "unknown",
          student_id: "student-a",
          class_id: "class-1",
          academic_period_id: "period-1",
          status: "archived",
        },
      ],
      attendances: [
        {
          id: "open-evidence",
          student_id: "student-a",
          date: "2026-09-01",
          status: "Hadir",
        },
      ],
      leaveRequests: [
        {
          id: "future-leave",
          student_id: "student-a",
          date: "2026-09-02",
          category: "sakit",
          approval_status: "approved",
        },
      ],
      now: "2026-09-01T07:00:00+07:00",
    }),
  );
  const row = result.classes[0]!.rows[0]!;
  assert.equal(row.cells["2026-09-01"], "");
  assert.deepEqual(
    row.days.find((day) => day.date === "2026-09-01")!.attendanceIds,
    ["open-evidence"],
  );
  assert.equal(row.cells["2026-09-02"], "");
  assert.equal(
    row.days.find((day) => day.date === "2026-09-02")!.leaveRequestId,
    "future-leave",
  );
  assert.equal(row.totals.alpha, 0);
});

test("terminal unknown-end history keeps evidence despite later metadata and account binding", () => {
  for (const status of ["graduated", "archived", "promoted", "transferred"]) {
    const result = aggregateMonthlyAttendance(
      fixture({
        enrollments: [
          {
            id: "legacy",
            user_id: "user-a",
            academic_period_id: "period-1",
            class_id: "class-1",
            status,
            created_at: "2026-10-01",
            updated_at: "2026-11-01",
          },
        ],
        attendances: [
          {
            id: "historic-arrival",
            student_id: "student-a",
            date: "2026-09-01",
            status: "Datang",
          },
        ],
        leaveRequests: [
          {
            id: "historic-leave",
            user_id: "user-a",
            date: "2026-09-02",
            category: "pergi",
            approval_status: "approved",
          },
        ],
        now: "2026-10-02",
      }),
    );
    const row = result.classes[0]!.rows[0]!;
    assert.equal(row.cells["2026-09-01"], "✓");
    assert.equal(row.cells["2026-09-02"], "I");
    assert.equal(row.cells["2026-09-03"], "");
    assert.equal(row.totals.alpha, 0);
    assert.equal(row.totals.expectedDays, 0);
  }
});

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

test("projects cross-month Sakit and WIB-boundary Izin", () => {
  const result = aggregateMonthlyAttendance(
    fixture({
      leaveRequests: [
        {
          id: "cross-month-sick",
          user_id: "user-a",
          category: "sakit",
          date: "2026-08-25",
          requested_start_date: "2026-08-25",
          original_end_date: "2026-09-05",
          effective_end_date: "2026-09-05",
          approval_status: "approved",
        },
        {
          id: "wib-boundary-pergi",
          user_id: "user-b",
          category: "pergi",
          date: "2026-08-31T17:00:00.000Z",
          approval_status: "approved",
        },
      ],
      now: "2026-10-01T10:00:00+07:00",
    }),
  );

  const ayu = result.classes[0]!.rows.find((row) => row.fullName === "Ayu")!;
  const budi = result.classes[0]!.rows.find((row) => row.fullName === "Budi")!;
  assert.equal(ayu.cells["2026-09-04"], "S");
  assert.equal(ayu.cells["2026-09-07"], "A");
  assert.equal(budi.cells["2026-09-01"], "I");
});
