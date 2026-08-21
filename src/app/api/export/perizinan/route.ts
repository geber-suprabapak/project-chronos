import { NextResponse } from "next/server";
import { Workbook } from "exceljs";
import { requireExportAccess } from "~/server/auth/export-guard";
import { makeWorkbookMetadata, workbookToResponseBuffer } from "../utils";
import { astraRequest } from "~/lib/astra/client";

// Ensure fresh data on each request
export const dynamic = "force-dynamic";
// Excel generation requires Node.js
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
  category: "sakit" | "pergi" | "dispensasi";
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

export async function GET() {
  const access = await requireExportAccess("perizinan");
  if (!access.ok) return access.response;

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

  // Fetch leave requests and student profiles from Astra
  const [leaveRequests, students] = await Promise.all([
    astraRequest<AstraLeaveRequest[]>("/v1/admin/leave-requests").catch(
      () => [],
    ),
    astraRequest<AstraStudentProfile[]>("/v1/admin/students").catch(() => []),
  ]);

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

  // Add rows to worksheet
  for (const r of sortedRows) {
    const profile = studentMap.get(r.user_id);
    const desc = r.description ?? "";
    const kategoriDisplay = /dipulangkan/i.test(desc)
      ? "dipulangkan"
      : /terlambat/i.test(desc)
        ? "terlambat"
        : r.category;

    // Format tanggal as YYYY-MM-DD only
    const tanggalStr = r.date
      ? r.date.includes("T")
        ? r.date.split("T")[0]
        : r.date
      : "-";

    // Build keterangan with kategori and status
    let keterangan = (kategoriDisplay ?? "-").toString();
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
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="perizinan.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
