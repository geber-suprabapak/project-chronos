import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { generateMonthlyAttendanceXlsx } from "../src/server/export/index.ts";
import {
  generateAttendanceXlsx,
  safeExcelText,
} from "../src/server/export/xlsx-generator.ts";
import { generateClassAttendanceExport } from "../src/server/export/class-attendance.ts";
import {
  aggregateMonthlyAttendance,
  type MonthlyRecapResult,
} from "../src/server/attendance/monthly-recap.ts";

const result: MonthlyRecapResult = {
  month: "2026-09",
  period: {
    id: "period-1",
    name: "2026/2027 Ganjil",
    startDate: "2026-07-01",
    endDate: "2026-12-31",
  },
  dates: [
    { date: "2026-09-01", dayOfWeek: "senin" },
    { date: "2026-09-02", dayOfWeek: "selasa" },
  ],
  classes: [
    {
      classId: "class-1",
      className: "X RPL 2",
      grade: 10,
      warning: "Ada Absence Number legacy yang perlu diperiksa.",
      rows: [
        {
          studentId: "student-1",
          userId: "user-1",
          nis: "1001",
          fullName: "Budi Santoso",
          classId: "class-1",
          className: "X RPL 2",
          absenceNumber: "1",
          warning: null,
          cells: { "2026-09-01": "✓", "2026-09-02": "T" },
          days: [],
          totals: {
            hadir: 1,
            sakit: 0,
            izin: 0,
            alpha: 0,
            terlambat: 1,
            expectedDays: 2,
          },
        },
        {
          studentId: "student-2",
          userId: "user-2",
          nis: "1002",
          fullName: "=SUM(A1:A2)",
          classId: "class-1",
          className: "X RPL 2",
          absenceNumber: "bad",
          warning: "Absence Number legacy tidak valid atau kosong.",
          cells: { "2026-09-01": "S", "2026-09-02": "I" },
          days: [],
          totals: {
            hadir: 0,
            sakit: 1,
            izin: 1,
            alpha: 0,
            terlambat: 0,
            expectedDays: 2,
          },
        },
      ],
      totals: {
        hadir: 1,
        sakit: 1,
        izin: 1,
        alpha: 0,
        terlambat: 1,
        expectedDays: 2,
      },
    },
  ],
  totals: {
    hadir: 1,
    sakit: 1,
    izin: 1,
    alpha: 0,
    terlambat: 1,
    expectedDays: 2,
  },
  warnings: [
    "X RPL 2: =SUM(A1:A2) — Absence Number legacy tidak valid atau kosong.",
  ],
};

test("monthly attendance export is an ExcelJS-readable projection of the recap", async () => {
  const buffer = await generateMonthlyAttendanceXlsx(result, {
    className: "X RPL 2",
    nis: "1002",
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  assert.equal(workbook.title, "Rekap Absensi Bulanan 2026-09");
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["X RPL 2"],
  );

  const sheet = workbook.getWorksheet("X RPL 2");
  assert.ok(sheet);
  assert.deepEqual(sheet.getRow(1).values, [
    ,
    "No. (absen)",
    "Nama",
    "2026-09-01",
    "2026-09-02",
    "✓",
    "S",
    "I",
    "A",
    "T",
  ]);
  assert.deepEqual(sheet.getRow(2).values, [
    ,
    "1",
    "Budi Santoso",
    "✓",
    "T",
    1,
    0,
    0,
    0,
    1,
  ]);
  assert.equal(sheet.getRow(3).getCell(1).value, "bad");
  assert.equal(sheet.getRow(3).getCell(2).value, "'=SUM(A1:A2)");
  assert.equal(
    sheet.getRow(3).getCell(1).note,
    "Absence Number legacy tidak valid atau kosong.",
  );
  assert.equal(
    sheet.getRow(4).getCell(1).value,
    "⚠ Ada Absence Number legacy yang perlu diperiksa.",
  );
  assert.equal(sheet.views[0]?.state, "frozen");
  assert.equal(sheet.views[0]?.xSplit, 2);
  assert.equal(sheet.views[0]?.ySplit, 1);

  const emptyWorkbook = new ExcelJS.Workbook();
  await emptyWorkbook.xlsx.load(
    (await generateMonthlyAttendanceXlsx({ ...result, classes: [] })) as any,
  );
  assert.equal(emptyWorkbook.worksheets.length, 0);
});

test("unknown enrollment workbook preserves evidence, blanks and the membership warning", async () => {
  const recap = aggregateMonthlyAttendance({
    month: "2026-10",
    period: { id: "period", start_date: "2026-07-01", end_date: "2026-12-31" },
    classes: [],
    students: [
      { student_id: "terminal-student", full_name: "Terminal fixture" },
    ],
    enrollments: [
      {
        id: "terminal",
        student_id: "terminal-student",
        academic_period_id: "period",
        status: "graduated",
      },
    ],
    schedules: [
      { day_of_week: "kamis", end_time: "07:30" },
      { day_of_week: "jumat", end_time: "07:30" },
    ],
    calendarExceptions: [],
    leaveRequests: [],
    attendances: [
      {
        id: "recorded-arrival",
        student_id: "terminal-student",
        date: "2026-10-01",
        status: "Hadir",
      },
      {
        id: "recorded-alpha",
        student_id: "terminal-student",
        date: "2026-10-02",
        status: "Alpha",
      },
    ],
    now: "2026-11-01",
  });
  const row = recap.classes[0]!.rows[0]!;
  assert.equal(row.totals.alpha, 1); // Only the actual recorded Alpha, never projected days.
  assert.equal(row.cells["2026-10-08"], "");
  assert.equal(row.totals.expectedDays, 0);
  const workbook = new ExcelJS.Workbook();
  // SAFETY: ExcelJS accepts the bytes produced by the workbook generator.
  await workbook.xlsx.load((await generateMonthlyAttendanceXlsx(recap)) as any);
  const sheet = workbook.worksheets[0]!;
  assert.equal(sheet.getRow(2).getCell(3).value, "✓");
  assert.equal(sheet.getRow(2).getCell(4).value, "A");
  assert.equal(sheet.getRow(2).getCell(5).value, "");
  assert.match(
    String(sheet.getRow(2).getCell(1).note),
    /Rentang enrollment tidak diketahui/,
  );
});

test("safeExcelText and attendance XLSX exports neutralize formula payloads (SEC-04)", async () => {
  assert.equal(safeExcelText("-"), "-");
  assert.equal(safeExcelText("=CMD()"), "'=CMD()");
  assert.equal(safeExcelText("+1"), "'+1");
  assert.equal(safeExcelText("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(safeExcelText("-1+1"), "'-1+1");
  assert.equal(safeExcelText("\t=1"), "'\t=1");

  const attendanceBuf = await generateAttendanceXlsx([
    {
      date: "2026-09-01",
      nis: "1001",
      className: "=1+1",
      name: "+CMD()",
      status: "Hadir",
      displayStatus: "Hadir",
      actionType: null,
      lokasi: "@loc",
      userId: "u1",
      id: "a1",
      createdAt: "2026-09-01T00:00:00Z",
    },
  ]);
  const attWb = new ExcelJS.Workbook();
  // SAFETY: ExcelJS accepts the Buffer generated by generateAttendanceXlsx.
  await attWb.xlsx.load(attendanceBuf as any);
  const attRow = attWb.getWorksheet("Absensi")!.getRow(2);
  assert.equal(attRow.getCell(3).value, "'=1+1");
  assert.equal(attRow.getCell(4).value, "'+CMD()");
  assert.equal(attRow.getCell(6).value, "'@loc");

  const classBuf = await generateClassAttendanceExport(
    [
      {
        userId: "u1",
        absenceNumber: "1",
        fullName: "-1+1",
        nis: "1001",
        status: "Hadir",
      },
    ],
    { className: "X RPL 1", date: "2026-09-01", format: "xlsx" },
  );
  const classWb = new ExcelJS.Workbook();
  // SAFETY: ExcelJS accepts the Buffer generated by generateClassAttendanceExport.
  await classWb.xlsx.load(classBuf as any);
  assert.equal(
    classWb.getWorksheet("Absensi Per Kelas")!.getRow(2).getCell(2).value,
    "'-1+1",
  );
});
