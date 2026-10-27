import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { makeWorkbookMetadata } from "../../app/api/export/utils.ts";
import type { PerClassStatusRow } from "../../lib/attendance-status.ts";
import type { ExportFormat } from "./types.ts";

export async function generateClassAttendanceExport(
  rows: readonly PerClassStatusRow[],
  options: { className: string; date: string; format: ExportFormat },
): Promise<Buffer> {
  const title = `Absensi Per Kelas ${options.className} (${options.date})`;
  const headers = ["No", "Nama", "NIS", "Kelas", "Status"];
  const body = rows.map((row) => [
    row.absenceNumber ?? "-",
    row.fullName ?? "-",
    row.nis ?? "-",
    options.className,
    row.status,
  ]);
  if (options.format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    Object.assign(workbook, makeWorkbookMetadata(title));
    const sheet = workbook.addWorksheet("Absensi Per Kelas");
    sheet.addRow(headers).font = { bold: true };
    sheet.addRows(body);
    [12, 32, 18, 20, 22].forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    sheet.autoFilter = "A1:E1";
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
  const doc = new jsPDF();
  doc.setFontSize(12);
  doc.text(title, 14, 15);
  autoTable(doc, {
    head: [headers],
    body,
    startY: 22,
    styles: { fontSize: 9, overflow: "linebreak" },
  });
  return Buffer.from(doc.output("arraybuffer"));
}
