import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { generateMonthlyAttendanceXlsx } from "../src/server/export/index.ts";
import type { MonthlyRecapResult } from "../src/server/attendance/monthly-recap.ts";

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
