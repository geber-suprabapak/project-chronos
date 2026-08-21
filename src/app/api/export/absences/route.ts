import { NextResponse, type NextRequest } from "next/server";
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

interface AstraAttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: "Hadir" | "Terlambat" | "Pulang" | "Alpha" | "Datang";
  action_type?: "check_in" | "check_out" | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
}

export async function GET(request: NextRequest) {
  const access = await requireExportAccess("absences");
  if (!access.ok) return access.response;

  // Get filter params from query
  const { searchParams } = new URL(request.url);
  const className = searchParams.get("className");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  // Create a new workbook and add metadata
  const wb = new Workbook();
  Object.assign(wb, makeWorkbookMetadata("Absensi Data"));

  // Create worksheet with columns
  const ws = wb.addWorksheet("Absensi");
  ws.columns = [
    { header: "Tanggal", key: "tanggal", width: 15 },
    { header: "NIS", key: "nis", width: 15 },
    { header: "Kelas", key: "kelas", width: 12 },
    { header: "Nama", key: "nama", width: 30 },
    { header: "Keterangan", key: "keterangan", width: 15 },
  ];

  // Style the header row
  ws.getRow(1).font = { bold: true };

  // Fetch attendance records and student profiles from Astra
  const [attendances, students] = await Promise.all([
    astraRequest<AstraAttendanceRecord[]>(
      "/v1/admin/attendance?limit=100",
    ).catch(() =>
      astraRequest<AstraAttendanceRecord[]>(
        "/v1/admin/attendances?limit=100",
      ).catch(() => []),
    ),
    astraRequest<AstraStudentProfile[]>("/v1/admin/students").catch(() => []),
  ]);

  const studentMap = new Map<string, AstraStudentProfile>(
    students.map((s) => [s.user_id, s]),
  );

  let filtered = attendances;

  if (className && className !== "ALL") {
    const classQuery = className.trim().toLowerCase();
    filtered = filtered.filter((a) => {
      const student = studentMap.get(a.user_id);
      return (student?.class_name ?? "").toLowerCase().includes(classQuery);
    });
  }

  if (startDate) {
    filtered = filtered.filter((a) => a.date >= startDate);
  }

  if (endDate) {
    filtered = filtered.filter((a) => a.date <= endDate);
  }

  // Sort rows by date first, then by class, then by NIS
  const sortedRows = filtered.sort((a, b) => {
    const dateA = a.date ?? "";
    const dateB = b.date ?? "";
    const dateCompare = dateA.localeCompare(dateB);

    if (dateCompare !== 0) return dateCompare;

    // If dates are equal, sort by class
    const classA = studentMap.get(a.user_id)?.class_name ?? "";
    const classB = studentMap.get(b.user_id)?.class_name ?? "";
    const classCompare = classA.localeCompare(classB);

    if (classCompare !== 0) return classCompare;

    // If class is equal, sort by NIS
    const nisA = studentMap.get(a.user_id)?.nis ?? "";
    const nisB = studentMap.get(b.user_id)?.nis ?? "";
    return nisA.localeCompare(nisB);
  });

  // Add rows to worksheet with separator between dates
  let lastDate = "";
  for (const r of sortedRows) {
    const profile = studentMap.get(r.user_id);
    const currentDate = r.date ?? "-";

    // Add empty row as separator when date changes (except for first row)
    if (lastDate && currentDate !== lastDate) {
      ws.addRow({}); // Empty row as separator
    }
    lastDate = currentDate;

    ws.addRow({
      tanggal: currentDate,
      nis: profile?.nis ?? "-",
      kelas: profile?.class_name ?? "-",
      nama: profile?.full_name ?? "-",
      keterangan: r.status ?? "-",
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
      "Content-Disposition": `attachment; filename="absensi.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
