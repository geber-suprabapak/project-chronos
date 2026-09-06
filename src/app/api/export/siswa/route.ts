import { NextResponse } from "next/server";
import { Workbook } from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { makeWorkbookMetadata, workbookToResponseBuffer } from "../utils";
import { requireExportAccess } from "~/server/auth/export-guard";
import { astraRequest, AstraRequestError } from "~/lib/astra/client";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import { getAsiaJakartaCurrentInfo } from "~/server/export/date-bounds";
import { writeOperationalEvent } from "~/lib/observability";

// Ensure fresh data on each request
export const dynamic = "force-dynamic";
// Excel and PDF generation requires Node.js
export const runtime = "nodejs";

interface AstraStudentProfile {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  nis?: string | null;
  class_name?: string | null;
  absence_number?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  lifecycle_status?: string | null;
  gender?: string | null;
}

/**
 * Helper to format gender display
 */
function formatGender(kelamin: string | null): string {
  if (kelamin === "L") return "Laki-laki";
  if (kelamin === "P") return "Perempuan";
  return "-";
}

/**
 * Helper to format activation status
 */
function formatActivated(activated: boolean): string {
  return activated ? "Aktif" : "Belum Aktif";
}

export async function GET(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const access = await requireExportAccess("siswa");
  if (!access.ok) {
    access.response.headers.set("X-Request-ID", requestId);
    return access.response;
  }

  const { searchParams } = new URL(request.url);
  const formatParam = (searchParams.get("format") ?? "xlsx").toLowerCase();
  if (formatParam !== "xlsx" && formatParam !== "pdf") {
    return NextResponse.json(
      { error: "Format ekspor tidak didukung. Pilih 'xlsx' atau 'pdf'." },
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
        },
      },
    );
  }

  // Fetch all siswa data from Astra
  let students: AstraStudentProfile[];
  try {
    students = await runWithRequestId(requestId, () =>
      astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
    );
  } catch (error) {
    const isTimeout = error instanceof AstraRequestError && error.isTimeout();
    const status = isTimeout ? 504 : 502;
    const message =
      error instanceof Error
        ? error.message
        : "Gagal menghubungi layanan Astra";
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/siswa",
      status,
      error: message,
    });
    return NextResponse.json(
      { error: message },
      {
        status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
        },
      },
    );
  }

  try {
    // Order by class, then absen, then name
    const sortedRows = [...students].sort((a, b) => {
      const classA = a.class_name ?? "~~~~";
      const classB = b.class_name ?? "~~~~";
      const classComp = classA.localeCompare(classB);
      if (classComp !== 0) return classComp;

      const absNumA = a.absence_number ? parseInt(a.absence_number, 10) : 999;
      const absNumB = b.absence_number ? parseInt(b.absence_number, 10) : 999;
      const safeAbsA = Number.isNaN(absNumA) ? 999 : absNumA;
      const safeAbsB = Number.isNaN(absNumB) ? 999 : absNumB;
      if (safeAbsA !== safeAbsB) return safeAbsA - safeAbsB;

      const nameA = a.full_name ?? "~~~~";
      const nameB = b.full_name ?? "~~~~";
      return nameA.localeCompare(nameB);
    });

    if (formatParam === "pdf") {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const nowInfo = getAsiaJakartaCurrentInfo();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Data Siswa Skanida", 14, 15);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Dicetak pada: ${nowInfo.isoDate} (Asia/Jakarta) | Total: ${sortedRows.length} siswa`,
        14,
        21,
      );

      const headers = [
        "NIS",
        "Nama Siswa",
        "Kelas",
        "Absen",
        "Jenis Kelamin",
        "Status Aktivasi",
      ];
      const body: string[][] =
        sortedRows.length > 0
          ? sortedRows.map((r) => {
              const absenceNum = r.absence_number
                ? parseInt(r.absence_number, 10)
                : null;
              const absen =
                absenceNum === null || Number.isNaN(absenceNum)
                  ? "-"
                  : String(absenceNum);
              const isActivated = r.lifecycle_status === "approved";
              return [
                r.nis ?? "-",
                r.full_name ?? "-",
                r.class_name ?? "-",
                absen,
                formatGender(r.gender ?? null),
                formatActivated(isActivated),
              ];
            })
          : [["-", "-", "-", "Tidak ada data siswa", "-", "-"]];

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
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
        },
        columnStyles: {
          0: { cellWidth: 25 }, // NIS
          1: { cellWidth: 45 }, // Nama Siswa
          2: { cellWidth: 25 }, // Kelas
          3: { cellWidth: 20 }, // Absen
          4: { cellWidth: 32 }, // Jenis Kelamin
          5: { cellWidth: 35 }, // Status Aktivasi
        },
        theme: "grid",
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          const currentPage = data.pageNumber;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Halaman ${currentPage} dari ${pageCount} — Chronos Authoritative Export`,
            14,
            doc.internal.pageSize.height - 10,
          );
        },
      });

      const arrayBuffer = doc.output("arraybuffer");
      return new NextResponse(new Uint8Array(arrayBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="data-siswa.pdf"`,
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
        },
      });
    }

    // Create a new workbook and add metadata
    const wb = new Workbook();
    Object.assign(wb, makeWorkbookMetadata("Data Siswa"));

    // Create worksheet with columns
    const ws = wb.addWorksheet("Data Siswa");
    ws.columns = [
      { header: "NIS", key: "nis", width: 15 },
      { header: "Nama", key: "nama", width: 30 },
      { header: "Kelas", key: "kelas", width: 12 },
      { header: "Absen", key: "absen", width: 8 },
      { header: "Jenis Kelamin", key: "kelamin", width: 15 },
      { header: "Status Aktivasi", key: "activated", width: 15 },
    ];

    // Style the header row
    ws.getRow(1).font = { bold: true };

    // Add rows to worksheet
    for (const r of sortedRows) {
      const absenceNum = r.absence_number
        ? parseInt(r.absence_number, 10)
        : null;
      const absen = Number.isNaN(absenceNum) ? "-" : absenceNum;
      const isActivated = r.lifecycle_status === "approved";

      ws.addRow({
        nis: r.nis ?? "-",
        nama: r.full_name ?? "-",
        kelas: r.class_name ?? "-",
        absen: absen,
        kelamin: formatGender(r.gender ?? null),
        activated: formatActivated(isActivated),
      });
    }

    // Auto-filter for all columns
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columns.length },
    };

    // Generate Excel buffer
    const buffer = await workbookToResponseBuffer(wb);

    // Return as downloadable Excel file
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="data-siswa.xlsx"`,
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengekspor data siswa";
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/siswa",
      status: 500,
      error: message,
    });
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
        },
      },
    );
  }
}
