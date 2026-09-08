import ExcelJS from "exceljs";
import { z } from "zod";

type Worksheet = ExcelJS.Worksheet;
const scalarCellSchema = z.union([z.string(), z.number(), z.null()]);
const cellSchema = z.union([
  scalarCellSchema,
  z.object({ result: scalarCellSchema }).transform((cell) => cell.result),
]);
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
  className: string | null;
  workbookYear: string | null;
  rowCount: number;
}

export interface RosterParseReport {
  workbookYear: string | null;
  worksheetCount: number;
  sheets: RosterSheetReport[];
  rows: ParsedRosterRow[];
  errors: RosterParseError[];
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
      if (normalizeText(cachedValue(cell.value))) found = true;
    });
  });
  return found;
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

function findHeader(worksheet: Worksheet): number | null {
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
          column < best.column ||
          (column === best.column && row < best.row)
        ) {
          best = { row, column };
        }
      }
    }
  }
  return best?.row ?? null;
}

function isBlankSourceRow(
  worksheet: Worksheet,
  row: number,
  column: number,
): boolean {
  return HEADERS.every(
    (_, offset) => cellText(worksheet, row, column + offset).length === 0,
  );
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

function addError(
  errors: RosterParseError[],
  worksheet: string,
  worksheetRow: number | null,
  field: RosterParseError["field"],
  message: string,
) {
  errors.push({ worksheet, worksheetRow, field, message });
}

export async function parseOfficialRosterWorkbook(
  input: ArrayBuffer | Uint8Array,
): Promise<RosterParseReport> {
  const workbook = new ExcelJS.Workbook();
  const workbookData =
    input instanceof ArrayBuffer ? input : Buffer.from(input);
  // SAFETY: ExcelJS's Node declaration uses its own Buffer type for binary workbook data.
  await workbook.xlsx.load(workbookData as never);

  const report: RosterParseReport = {
    workbookYear: null,
    worksheetCount: workbook.worksheets.length,
    sheets: [],
    rows: [],
    errors: [],
  };

  for (const worksheet of workbook.worksheets) {
    const worksheetHasValues = hasValues(worksheet);
    const headerRow = findHeader(worksheet);
    if (headerRow === null) {
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

    const className = metadataValue(worksheet, "Kelas");
    const workbookYear = metadataValue(worksheet, "Tahun Ajaran");
    const normalizedYear = workbookYear?.replace(/\s*\/\s*/g, "/") ?? null;
    report.sheets.push({
      worksheet: worksheet.name,
      headerRow,
      className,
      workbookYear: normalizedYear,
      rowCount: worksheet.rowCount,
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

    for (let row = headerRow + 1; row <= worksheet.rowCount; row += 1) {
      if (
        isBlankSourceRow(worksheet, row, 1) ||
        isRepeatedHeader(worksheet, row, 1)
      ) {
        continue;
      }
      const rawNo = worksheet.getRow(row).getCell(1).value;
      const rawNis = worksheet.getRow(row).getCell(2).value;
      const rawName = worksheet.getRow(row).getCell(3).value;
      const rawGender = worksheet.getRow(row).getCell(4).value;
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
      else if (!/^\d+$/.test(nisText))
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
