import ExcelJS from "exceljs";
import type { OrderedAttendanceRow } from "./types.ts";
import { makeWorkbookMetadata } from "../../app/api/export/utils.ts";

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
