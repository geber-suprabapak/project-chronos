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
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

/**
 * Helper to safely format date values
 */
function formatDate(
  val: Date | string | number | null | undefined,
): string | null {
  if (val == null) return null;
  const d = val instanceof Date ? val : new Date(val);
  const t = d.getTime();
  return Number.isNaN(t) ? null : d.toISOString();
}

export async function GET() {
  const access = await requireExportAccess("profiles");
  if (!access.ok) return access.response;

  // Create a new workbook and add metadata
  const wb = new Workbook();
  Object.assign(wb, makeWorkbookMetadata("User Profiles"));

  // Create worksheet with columns
  const ws = wb.addWorksheet("Profiles");
  ws.columns = [
    { header: "ID", key: "id", width: 36 },
    { header: "NIS", key: "nis", width: 15 },
    { header: "Full Name", key: "fullName", width: 30 },
    { header: "Email", key: "email", width: 30 },
    { header: "Class", key: "className", width: 12 },
    { header: "Absence #", key: "absenceNumber", width: 15 },
    { header: "Role", key: "role", width: 15 },
    { header: "Created At", key: "createdAt", width: 20 },
    { header: "Updated At", key: "updatedAt", width: 20 },
  ];

  // Style the header row
  ws.getRow(1).font = { bold: true };

  // Fetch all profiles data from Astra
  const students =
    await astraRequest<AstraStudentProfile[]>("/v1/admin/students");

  // Add rows to worksheet
  for (const r of students) {
    ws.addRow({
      id: r.user_id,
      nis: r.nis ?? "-",
      fullName: r.full_name ?? "-",
      email: r.email ?? "-",
      className: r.class_name ?? "-",
      absenceNumber: r.absence_number ?? "-",
      role: r.role ?? "student",
      createdAt: formatDate(r.created_at),
      updatedAt: formatDate(r.updated_at),
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
      "Content-Disposition": `attachment; filename="profiles.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
