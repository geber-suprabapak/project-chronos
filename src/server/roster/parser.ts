import ExcelJS from "exceljs";
import { z } from "zod";

type Worksheet = ExcelJS.Worksheet;
const scalarCellSchema = z.union([z.string(), z.number(), z.null()]);
const cellSchema = z.union([
  scalarCellSchema,
  z.object({ result: scalarCellSchema }).transform((cell) => cell.result),
]);
const objectCellSchema = z.object({}).passthrough();
type CellValue = z.infer<typeof scalarCellSchema>;

export type RosterGender = "L" | "P";

export interface ParsedRosterRow {
  worksheet: string;
  worksheetRow: number;
  className: string;
  absenceNumber: number;
  nis: string;
  fullName: string;
  gender: RosterGender;
}

export interface RosterParseError {
  worksheet: string;
  worksheetRow: number | null;
  field:
    | "workbook"
    | "structure"
    | "absenceNumber"
    | "nis"
    | "fullName"
    | "gender"
    | "className";
  message: string;
}

export interface RosterSheetReport {
  worksheet: string;
  headerRow: number;
  headerColumn: number;
  className: string | null;
  workbookYear: string | null;
  rowCount: number;
  studentRowCount: number;
}

export interface RosterParseReport {
  workbookYear: string | null;
  worksheetCount: number;
  totalRows: number;
  sheets: RosterSheetReport[];
  rows: ParsedRosterRow[];
  errors: RosterParseError[];
}

export interface IndexedRosterRejection {
  row_index: number;
  reason: string;
}

const HEADERS = ["no", "nis", "nama siswa", "l/p"] as const;

function normalizeText(value: CellValue): string {
  return value === null ? "" : String(value).trim().replace(/\s+/g, " ");
}

function cachedValue(value: ExcelJS.CellValue): CellValue {
  const parsed = cellSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function cellText(worksheet: Worksheet, row: number, column: number): string {
  return normalizeText(
    cachedValue(worksheet.getRow(row).getCell(column).value),
  );
}

function hasValues(worksheet: Worksheet): boolean {
  let found = false;
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (isPopulatedCell(cell.value)) {
        found = true;
      }
    });
  });
  return found;
}

function isPopulatedCell(value: ExcelJS.CellValue): boolean {
  if (value === null || value === undefined) return false;
  if (normalizeText(cachedValue(value)).length > 0) return true;
  return objectCellSchema.safeParse(value).success;
}

function metadataValue(worksheet: Worksheet, label: string): string | null {
  for (let row = 1; row <= worksheet.rowCount; row += 1) {
    const current = worksheet.getRow(row);
    for (let column = 1; column <= current.cellCount; column += 1) {
      const text = normalizeText(cachedValue(current.getCell(column).value));
      if (text.toLowerCase() !== label.toLowerCase()) continue;
      for (let offset = 1; offset <= 6; offset += 1) {
        const candidate = normalizeText(
          cachedValue(current.getCell(column + offset).value),
        );
        const match = candidate.match(/^:\s*(.+)$/);
        if (match?.[1]) return normalizeText(match[1]);
      }
    }
  }
  return null;
}

function findHeader(
  worksheet: Worksheet,
): { row: number; column: number } | null {
  let best: { row: number; column: number } | null = null;
  for (let row = 1; row <= worksheet.rowCount; row += 1) {
    const current = worksheet.getRow(row);
    for (
      let column = 1;
      column <= current.cellCount - HEADERS.length + 1;
      column += 1
    ) {
      if (
        HEADERS.every(
          (header, offset) =>
            cellText(worksheet, row, column + offset).toLowerCase() === header,
        )
      ) {
        if (
          best === null ||
          row < best.row ||
          (row === best.row && column < best.column)
        ) {
          best = { row, column };
        }
      }
    }
  }
  return best;
}

function isBlankSourceRow(
  worksheet: Worksheet,
  row: number,
  column: number,
): boolean {
  return HEADERS.every((_, offset) => {
    const value = worksheet.getRow(row).getCell(column + offset).value;
    return !isPopulatedCell(value);
  });
}

function isRepeatedHeader(
  worksheet: Worksheet,
  row: number,
  column: number,
): boolean {
  return HEADERS.every(
    (header, offset) =>
      cellText(worksheet, row, column + offset).toLowerCase() === header,
  );
}

function numberValue(value: CellValue): number | null {
  const source = normalizeText(value);
  if (!/^\d+$/.test(source)) return null;
  const parsed = Number(source);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isSafeIntegerText(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed);
}

function hasMacroPackage(input: Uint8Array): boolean {
  const binary = Buffer.from(input).toString("latin1").toLowerCase();
  return binary.includes("vbaproject.bin") || binary.includes("macroenabled");
}

function isOlePackage(input: Uint8Array): boolean {
  return (
    input.byteLength >= 8 &&
    input[0] === 0xd0 &&
    input[1] === 0xcf &&
    input[2] === 0x11 &&
    input[3] === 0xe0 &&
    input[4] === 0xa1 &&
    input[5] === 0xb1 &&
    input[6] === 0x1a &&
    input[7] === 0xe1
  );
}

function addError(
  errors: RosterParseError[],
  worksheet: string,
  worksheetRow: number | null,
  field: RosterParseError["field"],
  message: string,
) {
  errors.push({ worksheet, worksheetRow, field, message });
}

export function rosterRowProvenance(
  rows: readonly Pick<ParsedRosterRow, "worksheet" | "worksheetRow">[],
  rowIndex: number,
): string {
  const row = rows[rowIndex];
  return row
    ? `${row.worksheet}:${row.worksheetRow}`
    : `Workbook:${rowIndex + 1}`;
}

export function canAcceptRosterReport(report: {
  rejected_rows: number;
  rejected_items: IndexedRosterRejection[];
  status: string;
  review_state: string;
}): boolean {
  return (
    report.status === "staged" &&
    report.review_state === "pending" &&
    report.rejected_rows === 0 &&
    report.rejected_items.length === 0
  );
}

export async function parseOfficialRosterWorkbook(
  input: ArrayBuffer | Uint8Array,
): Promise<RosterParseReport> {
  const workbook = new ExcelJS.Workbook();
  const workbookData = Buffer.from(
    input instanceof ArrayBuffer ? new Uint8Array(input) : input,
  );
  if (hasMacroPackage(workbookData)) {
    throw new Error("Macro-enabled workbooks are not supported.");
  }
  if (isOlePackage(workbookData)) {
    throw new Error("Encrypted or unsupported workbook.");
  }
  try {
    // SAFETY: Buffer.from above creates the binary Buffer required by ExcelJS's Node loader.
    // @ts-expect-error ExcelJS declares a duplicate Node Buffer type.
    await workbook.xlsx.load(workbookData);
  } catch {
    throw new Error("Workbook could not be read.");
  }

  const report: RosterParseReport = {
    workbookYear: null,
    worksheetCount: workbook.worksheets.length,
    totalRows: 0,
    sheets: [],
    rows: [],
    errors: [],
  };

  for (const worksheet of workbook.worksheets) {
    const worksheetHasValues = hasValues(worksheet);
    const header = findHeader(worksheet);
    if (header === null) {
      if (worksheetHasValues) {
        addError(
          report.errors,
          worksheet.name,
          null,
          "structure",
          "Official roster headers No, NIS, Nama Siswa, and L/P were not found.",
        );
      }
      continue;
    }

    const { row: headerRow, column: headerColumn } = header;
    const className = metadataValue(worksheet, "Kelas");
    const workbookYear = metadataValue(worksheet, "Tahun Ajaran");
    const normalizedYear = workbookYear?.replace(/\s*\/\s*/g, "/") ?? null;
    report.sheets.push({
      worksheet: worksheet.name,
      headerRow,
      headerColumn,
      className,
      workbookYear: normalizedYear,
      rowCount: worksheet.rowCount,
      studentRowCount: 0,
    });
    if (report.workbookYear === null && normalizedYear !== null) {
      report.workbookYear = normalizedYear;
    } else if (
      normalizedYear !== null &&
      report.workbookYear !== null &&
      normalizedYear !== report.workbookYear
    ) {
      addError(
        report.errors,
        worksheet.name,
        null,
        "workbook",
        `Workbook year ${normalizedYear} does not match ${report.workbookYear}.`,
      );
    }
    if (!className) {
      addError(
        report.errors,
        worksheet.name,
        null,
        "className",
        "Class metadata is missing.",
      );
    }
    if (!normalizedYear) {
      addError(
        report.errors,
        worksheet.name,
        null,
        "workbook",
        "Academic Period year metadata is missing.",
      );
    }

    for (let row = headerRow + 1; row <= worksheet.rowCount; row += 1) {
      if (
        isBlankSourceRow(worksheet, row, headerColumn) ||
        isRepeatedHeader(worksheet, row, headerColumn)
      ) {
        continue;
      }
      // SAFETY: the current worksheet was pushed immediately before scanning its rows.
      const sheet = report.sheets[report.sheets.length - 1]!;
      // Every nonblank source row counts toward the per-sheet/workbook bounds,
      // including rows that will be rejected below.
      sheet.studentRowCount += 1;
      report.totalRows += 1;
      const rawNo = worksheet.getRow(row).getCell(headerColumn).value;
      const rawNis = worksheet.getRow(row).getCell(headerColumn + 1).value;
      const rawName = worksheet.getRow(row).getCell(headerColumn + 2).value;
      const rawGender = worksheet.getRow(row).getCell(headerColumn + 3).value;
      const sourceValues = [rawNo, rawNis, rawName, rawGender].map((value) =>
        normalizeText(cachedValue(value)),
      );
      const noText = sourceValues[0] ?? "";
      const nisText = sourceValues[1] ?? "";
      const fullName = sourceValues[2] ?? "";
      const genderText = sourceValues[3] ?? "";
      const rowErrors: RosterParseError[] = [];
      if (!noText)
        addError(
          rowErrors,
          worksheet.name,
          row,
          "absenceNumber",
          "Absence Number is required.",
        );
      if (!nisText)
        addError(rowErrors, worksheet.name, row, "nis", "NIS is required.");
      else if (!isSafeIntegerText(nisText))
        addError(
          rowErrors,
          worksheet.name,
          row,
          "nis",
          "NIS must contain only digits.",
        );
      if (!fullName)
        addError(
          rowErrors,
          worksheet.name,
          row,
          "fullName",
          "Full name is required.",
        );
      const gender = genderText.toUpperCase();
      if (gender !== "L" && gender !== "P") {
        addError(
          rowErrors,
          worksheet.name,
          row,
          "gender",
          "Gender must be L or P.",
        );
      }
      const absenceNumber = numberValue(cachedValue(rawNo));
      if (noText && (absenceNumber === null || absenceNumber <= 0)) {
        addError(
          rowErrors,
          worksheet.name,
          row,
          "absenceNumber",
          "Absence Number must be a positive integer.",
        );
      }
      report.errors.push(...rowErrors);
      if (rowErrors.length === 0 && className) {
        // SAFETY: rowErrors includes the required positive-integer check above.
        const checkedAbsenceNumber = absenceNumber as number;
        // SAFETY: rowErrors includes the L/P membership check above.
        const checkedGender = gender as RosterGender;
        report.rows.push({
          worksheet: worksheet.name,
          worksheetRow: row,
          className,
          absenceNumber: checkedAbsenceNumber,
          nis: nisText,
          fullName,
          gender: checkedGender,
        });
      }
    }
  }

  return report;
}
