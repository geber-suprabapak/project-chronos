import { NextResponse } from "next/server";
import { Workbook } from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { requireExportAccess } from "~/server/auth/export-guard";
import { makeWorkbookMetadata, workbookToResponseBuffer } from "../utils";
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
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

interface AstraStaffProfile {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  nis?: string | null;
  class_name?: string | null;
  absence_number?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  roles?: string[] | null;
  lifecycle_status?: string | null;
  gender?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

interface ProfileExportRow {
  id: string;
  nis: string;
  fullName: string;
  email: string;
  className: string;
  absenceNumber: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Helper to safely format date values
 */
function formatDate(val: Date | string | number | null | undefined): string {
  if (val == null) return "-";
  const d = val instanceof Date ? val : new Date(val);
  const t = d.getTime();
  return Number.isNaN(t) ? "-" : d.toISOString();
}

/**
 * Map role values to Indonesian display labels
 */
function formatRole(
  role?: string | null,
  roles?: readonly string[] | string[] | null,
): string {
  const candidate = role ?? (roles && roles[0]) ?? "student";
  const r = candidate.toLowerCase();
  if (r === "student" || r === "siswa") return "Siswa";
  if (r === "teacher" || r === "guru" || r === "wali_kelas") return "Guru";
  if (r === "staff" || r === "staf") return "Staf";
  if (r === "school_admin" || r === "admin" || r === "kepala_sekolah")
    return "Admin Sekolah";
  if (r === "platform_admin") return "Admin Platform";
  return candidate;
}

function getRolePriority(role: string): number {
  switch (role) {
    case "Admin Platform":
      return 1;
    case "Admin Sekolah":
      return 2;
    case "Guru":
      return 3;
    case "Staf":
      return 4;
    case "Siswa":
      return 5;
    default:
      return 99;
  }
}

export async function GET(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const access = await requireExportAccess("profiles");
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

  // Fetch both students and staff profiles from Astra in parallel (per ADR-001 D1)
  let students: AstraStudentProfile[];
  let staff: AstraStaffProfile[];
  try {
    [students, staff] = await runWithRequestId(requestId, () =>
      Promise.all([
        astraRequest<AstraStudentProfile[]>("/v1/admin/students"),
        astraRequest<AstraStaffProfile[]>("/v1/admin/staff"),
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
      path: "/api/export/profiles",
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
    const staffRows: ProfileExportRow[] = staff.map((st) => ({
      id: st.user_id,
      nis: st.nis ?? "-",
      fullName: st.full_name ?? "-",
      email: st.email ?? "-",
      className: st.class_name ?? "-",
      absenceNumber: st.absence_number ?? "-",
      role: formatRole(st.role, st.roles),
      createdAt: formatDate(st.created_at),
      updatedAt: formatDate(st.updated_at),
    }));

    const studentRows: ProfileExportRow[] = students.map((s) => ({
      id: s.user_id,
      nis: s.nis ?? "-",
      fullName: s.full_name ?? "-",
      email: s.email ?? "-",
      className: s.class_name ?? "-",
      absenceNumber: s.absence_number ?? "-",
      role: formatRole(s.role ?? "student"),
      createdAt: formatDate(s.created_at),
      updatedAt: formatDate(s.updated_at),
    }));

    const rows: ProfileExportRow[] = [];
    const seenIds = new Set<string>();
    for (const r of [...staffRows, ...studentRows]) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        rows.push(r);
      }
    }

    rows.sort((a, b) => {
      const pA = getRolePriority(a.role);
      const pB = getRolePriority(b.role);
      if (pA !== pB) return pA - pB;
      const classComp = a.className.localeCompare(b.className);
      if (classComp !== 0) return classComp;
      const nameComp = a.fullName.localeCompare(b.fullName);
      if (nameComp !== 0) return nameComp;
      return a.id.localeCompare(b.id);
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
      doc.text("Data Profil Pengguna", 14, 15);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Dicetak pada: ${nowInfo.isoDate} (Asia/Jakarta) | Total: ${rows.length} profil`,
        14,
        21,
      );

      const headers = [
        "ID",
        "NIS/NIP",
        "Nama Lengkap",
        "Email",
        "Kelas",
        "Nomor Absen",
        "Peran",
      ];
      const body: string[][] =
        rows.length > 0
          ? rows.map((r) => [
              r.id,
              r.nis,
              r.fullName,
              r.email,
              r.className,
              r.absenceNumber,
              r.role,
            ])
          : [["-", "-", "-", "Tidak ada data profil pengguna", "-", "-", "-"]];

      autoTable(doc, {
        head: [headers],
        body,
        startY: 25,
        margin: { left: 14, right: 14, top: 25, bottom: 18 },
        styles: {
          fontSize: 7,
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
          0: { cellWidth: 30 },
          1: { cellWidth: 20 },
          2: { cellWidth: 35 },
          3: { cellWidth: 37 },
          4: { cellWidth: 18 },
          5: { cellWidth: 18 },
          6: { cellWidth: 24 },
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
          "Content-Disposition": `attachment; filename="profiles.pdf"`,
          "Cache-Control": "no-store",
          "X-Request-ID": requestId,
        },
      });
    }

    // Create a new workbook and add metadata
    const wb = new Workbook();
    Object.assign(wb, makeWorkbookMetadata("Profil Pengguna"));

    // Create worksheet with localized Indonesian columns (per ADR-001 D1)
    const ws = wb.addWorksheet("Profil Pengguna");
    ws.columns = [
      { header: "ID", key: "id", width: 36 },
      { header: "NIS/NIP", key: "nis", width: 15 },
      { header: "Nama Lengkap", key: "fullName", width: 30 },
      { header: "Email", key: "email", width: 30 },
      { header: "Kelas", key: "className", width: 12 },
      { header: "Nomor Absen", key: "absenceNumber", width: 15 },
      { header: "Peran", key: "role", width: 18 },
      { header: "Dibuat Pada", key: "createdAt", width: 22 },
      { header: "Diperbarui Pada", key: "updatedAt", width: 22 },
    ];

    // Style the header row
    ws.getRow(1).font = { bold: true };

    // Add rows to worksheet
    for (const r of rows) {
      ws.addRow(r);
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
        "Content-Disposition": `attachment; filename="profiles.xlsx"`,
        "Cache-Control": "no-store",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengekspor data profil";
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/profiles",
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
