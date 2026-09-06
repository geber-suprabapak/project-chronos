import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { OrderedAttendanceRow } from "./types.ts";
import { getAsiaJakartaCurrentInfo } from "./date-bounds.ts";

export interface GeneratePdfOptions {
  title?: string;
  subtitle?: string;
}

/**
 * Builds an authoritative PDF buffer from sorted attendance rows using Node-compatible jsPDF.
 */
export async function generateAttendancePdf(
  rows: readonly OrderedAttendanceRow[],
  options: GeneratePdfOptions = {},
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const title = options.title ?? "Data Absensi";
  const nowInfo = getAsiaJakartaCurrentInfo();
  const subtitle =
    options.subtitle ??
    `Dicetak pada: ${nowInfo.isoDate} (Asia/Jakarta) | Total: ${rows.length} data`;

  // Document Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 15);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text(subtitle, 14, 21);

  // Prepare table headers and body
  const headers = ["Tanggal", "NIS", "Kelas", "Nama", "Keterangan", "Lokasi"];
  const body: string[][] =
    rows.length > 0
      ? rows.map((r) => [
          r.date || "-",
          r.nis || "-",
          r.className || "-",
          r.name || "-",
          r.displayStatus || "-",
          r.lokasi || "-",
        ])
      : [["-", "-", "-", "Tidak ada data absensi untuk periode ini", "-", "-"]];

  autoTable(doc, {
    head: [headers],
    body,
    startY: 25,
    margin: { left: 14, right: 14, top: 25, bottom: 18 },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [79, 70, 229], // Indigo
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Tanggal
      1: { cellWidth: 20 }, // NIS
      2: { cellWidth: 22 }, // Kelas
      3: { cellWidth: 42 }, // Nama
      4: { cellWidth: 26 }, // Keterangan
      5: { cellWidth: "auto" }, // Lokasi
    },
    theme: "grid",
    didDrawPage: (data) => {
      // Footer page number
      const pageCount = doc.getNumberOfPages();
      const currentPage = data.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      doc.text(
        `Halaman ${currentPage} dari ${pageCount} — Chronos Authoritative Export`,
        14,
        doc.internal.pageSize.height - 10,
      );
    },
  });

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
