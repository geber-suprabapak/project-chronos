import ExcelJS from "exceljs";
import type { OrderedAttendanceRow } from "./types.ts";
import { makeWorkbookMetadata } from "../../app/api/export/utils.ts";
import type {
  MonthlyRecapClassGroup,
  MonthlyRecapResult,
} from "../attendance/monthly-recap.ts";

export interface GenerateXlsxOptions {
  title?: string;
  worksheetName?: string;
}

/**
 * Builds an authoritative XLSX buffer from sorted attendance rows.
 */
export async function generateAttendanceXlsx(
  rows: readonly OrderedAttendanceRow[],
  options: GenerateXlsxOptions = {},
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const title = options.title ?? "Data Absensi";
  Object.assign(wb, makeWorkbookMetadata(title));

  const ws = wb.addWorksheet(options.worksheetName ?? "Absensi");

  ws.columns = [
    { header: "Tanggal", key: "tanggal", width: 15 },
    { header: "NIS", key: "nis", width: 15 },
    { header: "Kelas", key: "kelas", width: 15 },
    { header: "Nama", key: "nama", width: 32 },
    { header: "Keterangan", key: "keterangan", width: 18 },
    { header: "Lokasi", key: "lokasi", width: 28 },
  ];

  // Header row formatting
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" }, // Indigo
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  let lastDate = "";
  for (const r of rows) {
    // Add separator row when date changes (after first date)
    if (lastDate && r.date !== lastDate) {
      ws.addRow({});
    }
    lastDate = r.date;

    const row = ws.addRow({
      tanggal: r.date || "-",
      nis: r.nis || "-",
      kelas: r.className || "-",
      nama: r.name || "-",
      keterangan: r.displayStatus || "-",
      lokasi: r.lokasi || "-",
    });

    row.alignment = { vertical: "middle" };
  }

  // Set autofilter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: ws.columns.length },
  };

  const buffer = await wb.xlsx.writeBuffer();
  // SAFETY: ExcelJS writeBuffer returns an ArrayBuffer or Buffer in Node.js
  return Buffer.from(buffer as ArrayBuffer);
}

export interface MonthlyAttendanceXlsxOptions {
  academicPeriodId?: string;
  className?: string;
  studentId?: string;
  userId?: string;
  nis?: string;
}

const MONTHLY_ATTENDANCE_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function safeExcelText(value: string): string {
  return /^(?:[=+@]|-(?=\S))/.test(value) ? `'${value}` : value;
}

function safeWorksheetName(
  value: string,
  index: number,
  usedNames: Set<string>,
): string {
  const base =
    value
      .replace(/[\\/*?:[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || `Kelas ${index + 1}`;
  let name = base;
  let suffix = 2;
  while (usedNames.has(name.toLowerCase())) {
    const suffixText = ` (${suffix++})`;
    name = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function monthlyFilterDescription(
  options: MonthlyAttendanceXlsxOptions,
): string {
  const filters = [
    options.academicPeriodId
      ? `Academic Period: ${options.academicPeriodId}`
      : null,
    options.className ? `Kelas: ${options.className}` : null,
    options.studentId ? `Student: ${options.studentId}` : null,
    options.userId ? `User: ${options.userId}` : null,
    options.nis ? `NIS: ${options.nis}` : null,
  ].filter((value): value is string => value !== null);
  return filters.length > 0 ? filters.join(" | ") : "Semua kelas dan siswa";
}

function configureMonthlyWorksheet(
  worksheet: ExcelJS.Worksheet,
  group: MonthlyRecapClassGroup,
  result: MonthlyRecapResult,
): void {
  const headers = [
    { header: "No. (absen)", key: "absenceNumber", width: 14 },
    { header: "Nama", key: "fullName", width: 32 },
    ...result.dates.map((date, index) => ({
      header: date.date,
      key: `date-${index}`,
      width: 13,
    })),
    { header: "✓", key: "hadir", width: 8 },
    { header: "S", key: "sakit", width: 8 },
    { header: "I", key: "izin", width: 8 },
    { header: "A", key: "alpha", width: 8 },
    { header: "T", key: "terlambat", width: 8 },
  ];
  worksheet.columns = headers;
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F46E5" },
  };
  headerRow.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  headerRow.height = 28;

  for (const row of group.rows) {
    const values: ExcelJS.CellValue[] = [
      safeExcelText(row.absenceNumber ?? "-"),
      safeExcelText(row.fullName),
      ...result.dates.map((date) => row.cells[date.date] ?? ""),
      row.totals.hadir,
      row.totals.sakit,
      row.totals.izin,
      row.totals.alpha,
      row.totals.terlambat,
    ];
    const outputRow = worksheet.addRow(values);
    outputRow.alignment = { vertical: "middle" };
    for (let column = 3; column <= 2 + result.dates.length; column += 1) {
      outputRow.getCell(column).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
    }
    if (row.warning) {
      outputRow.getCell(1).note = row.warning;
      outputRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF3CD" },
      };
    }
  }

  if (group.warning) {
    const warningRow = worksheet.addRow([`⚠ ${group.warning}`]);
    worksheet.mergeCells(
      warningRow.number,
      1,
      warningRow.number,
      worksheet.columnCount,
    );
    warningRow.font = { italic: true, color: { argb: "FF92400E" } };
    warningRow.alignment = { wrapText: true };
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount },
  };
  worksheet.views = [
    {
      state: "frozen",
      xSplit: 2,
      ySplit: 1,
      topLeftCell: "C2",
      activeCell: "C2",
    },
  ];
  worksheet.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };
  worksheet.headerFooter.oddHeader = `&BRekap Absensi Bulanan ${result.month} — ${safeExcelText(group.className)}`;
  worksheet.headerFooter.oddFooter = `Periode: ${safeExcelText(result.period.name ?? result.period.id)}`;
}

/** Builds one worksheet per populated class from the shared recap result. */
export async function generateMonthlyAttendanceXlsx(
  result: MonthlyRecapResult,
  options: MonthlyAttendanceXlsxOptions = {},
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const title = `Rekap Absensi Bulanan ${result.month}`;
  Object.assign(workbook, makeWorkbookMetadata(title));
  workbook.subject = `${title} | Periode: ${result.period.name ?? result.period.id} | ${monthlyFilterDescription(options)}`;
  workbook.keywords = "chronos,attendance,monthly-recap";

  const usedNames = new Set<string>();
  result.classes.forEach((group, index) => {
    const worksheet = workbook.addWorksheet(
      safeWorksheetName(group.className, index, usedNames),
    );
    configureMonthlyWorksheet(worksheet, group, result);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  // SAFETY: ExcelJS writeBuffer resolves to an ArrayBuffer or Buffer in Node.js.
  return Buffer.from(buffer as ArrayBuffer);
}

export { MONTHLY_ATTENDANCE_MIME_TYPE };
