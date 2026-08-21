import { NextResponse } from "next/server";
import { Workbook } from "exceljs";
import { makeWorkbookMetadata, workbookToResponseBuffer } from "../utils";
import { requireExportAccess } from "~/server/auth/export-guard";
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

export async function GET() {
  const access = await requireExportAccess("siswa");
  if (!access.ok) return access.response;

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

  // Fetch all siswa data from Astra
  const students =
    await astraRequest<AstraStudentProfile[]>("/v1/admin/students");

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

  // Add rows to worksheet
  for (const r of sortedRows) {
    const absenceNum = r.absence_number ? parseInt(r.absence_number, 10) : null;
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
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="data-siswa.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
