import { NextResponse } from "next/server";
import { Workbook } from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { requireExportAccess } from "~/server/auth/export-guard";
import { makeWorkbookMetadata, workbookToResponseBuffer } from "../utils";
import { astraRequest, AstraRequestError } from "~/lib/astra/client";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import { formatLeaveCategory } from "~/server/api/routers/perizinan";
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

interface AstraLeaveRequest {
  id: string;
  user_id: string;
  student_name?: string | null;
  student_nis?: string | null;
  student_class?: string | null;
  absence_number?: string | null;
  category: "sakit" | "pergi" | "dispensasi" | "lainnya";
  description?: string | null;
  status: boolean;
  date: string;
  approval_status: "approved" | "rejected" | "pending";
  attachment_url?: string | null;
  rejection_reason?: string | null;
  rejected_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function GET(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const access = await requireExportAccess("perizinan");
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

  // Fetch leave requests and student profiles from Astra
  let leaveRequests: AstraLeaveRequest[];
  let students: AstraStudentProfile[];
  try {
    [leaveRequests, students] = await runWithRequestId(requestId, () =>
      Promise.all([
        astraRequest<AstraLeaveRequest[]>("/v1/admin/leave-requests"),
        astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
      ]),
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
      path: "/api/export/perizinan",
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
    const studentMap = new Map<string, AstraStudentProfile>(
      students.map((s) => [s.user_id, s]),
    );

    // Sort rows by date first, then by NIS
    const sortedRows = [...leaveRequests].sort((a, b) => {
      const dateA = a.date ?? "";
      const dateB = b.date ?? "";
      const dateCompare = dateA.localeCompare(dateB);

      if (dateCompare !== 0) return dateCompare;

      const nisA = a.student_nis ?? studentMap.get(a.user_id)?.nis ?? "";
      const nisB = b.student_nis ?? studentMap.get(b.user_id)?.nis ?? "";
      return nisA.localeCompare(nisB);
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
      doc.text("Daftar Perizinan Siswa", 14, 15);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Dicetak pada: ${nowInfo.isoDate} (Asia/Jakarta) | Total: ${sortedRows.length} perizinan`,
        14,
        21,
      );

      const headers = ["Tanggal", "NIS", "Kelas", "Nama", "Keterangan"];
      const body: string[][] =
        sortedRows.length > 0
          ? sortedRows.map((r) => {
              const profile = studentMap.get(r.user_id);
              const desc = r.description ?? "";
              const rawCategory = /dipulangkan/i.test(desc)
                ? "Dipulangkan"
                : /terlambat/i.test(desc)
                  ? "Terlambat"
                  : formatLeaveCategory(r.category);

              // Format tanggal as YYYY-MM-DD only
              const tanggalStr = r.date
                ? r.date.includes("T")
                  ? r.date.split("T")[0]
                  : r.date
                : "-";

              // Build keterangan with canonical Indonesian label and status suffix
              let keterangan = rawCategory;
              if (r.approval_status === "approved") {
                keterangan += " (Disetujui)";
              } else if (r.approval_status === "rejected") {
                keterangan += " (Ditolak)";
              } else if (r.approval_status === "pending") {
                keterangan += " (Menunggu)";
              }

              return [
                tanggalStr ?? "-",
                r.student_nis ?? profile?.nis ?? "-",
                r.student_class ?? profile?.class_name ?? "-",
                r.student_name ?? profile?.full_name ?? "-",
                keterangan,
              ];
            })
          : [["-", "-", "-", "Tidak ada data perizinan", "-"]];

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
          0: { cellWidth: 26 },
          1: { cellWidth: 24 },
          2: { cellWidth: 24 },
          3: { cellWidth: 44 },
          4: { cellWidth: "auto" },
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
          "Content-Disposition": `attachment; filename="perizinan.pdf"`,
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
        },
      });
    }

    // Create a new workbook and add metadata
    const wb = new Workbook();
    Object.assign(wb, makeWorkbookMetadata("Perizinan Data"));

    // Create worksheet with columns
    const ws = wb.addWorksheet("Perizinan");
    ws.columns = [
      { header: "Tanggal", key: "tanggal", width: 15 },
      { header: "NIS", key: "nis", width: 15 },
      { header: "Kelas", key: "kelas", width: 12 },
      { header: "Nama", key: "nama", width: 30 },
      { header: "Keterangan", key: "keterangan", width: 20 },
    ];

    // Style the header row
    ws.getRow(1).font = { bold: true };

    // Add rows to worksheet
    for (const r of sortedRows) {
      const profile = studentMap.get(r.user_id);
      const desc = r.description ?? "";
      const rawCategory = /dipulangkan/i.test(desc)
        ? "Dipulangkan"
        : /terlambat/i.test(desc)
          ? "Terlambat"
          : formatLeaveCategory(r.category);

      // Format tanggal as YYYY-MM-DD only
      const tanggalStr = r.date
        ? r.date.includes("T")
          ? r.date.split("T")[0]
          : r.date
        : "-";

      // Build keterangan with canonical Indonesian label and status suffix
      let keterangan = rawCategory;
      if (r.approval_status === "approved") {
        keterangan += " (Disetujui)";
      } else if (r.approval_status === "rejected") {
        keterangan += " (Ditolak)";
      } else if (r.approval_status === "pending") {
        keterangan += " (Menunggu)";
      }

      ws.addRow({
        tanggal: tanggalStr,
        nis: r.student_nis ?? profile?.nis ?? "-",
        kelas: r.student_class ?? profile?.class_name ?? "-",
        nama: r.student_name ?? profile?.full_name ?? "-",
        keterangan: keterangan,
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
        "Content-Disposition": `attachment; filename="perizinan.xlsx"`,
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal mengekspor data perizinan";
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/perizinan",
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
