import { NextResponse } from "next/server";
import { Workbook } from "exceljs";
import { db } from "~/server/db";
import { perizinan, userProfiles } from "~/server/db/schema";
import { requireExportAccess } from "~/server/auth/export-guard";
import { makeWorkbookMetadata, workbookToResponseBuffer } from "../utils";

// Ensure fresh data on each request
export const dynamic = "force-dynamic";
// Excel generation requires Node.js
export const runtime = "nodejs";

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

  // Fetch all perizinan data
  const rows = await db.select().from(perizinan);

  // Fetch all profiles to map user IDs to names
  const profiles = await db.select().from(userProfiles);
  const profileMap = new Map<string, (typeof profiles)[number]>();

  // Create a lookup map of user profiles by ID
  for (const profile of profiles) {
    if (profile.userId) {
      profileMap.set(profile.userId, profile);
    }
  }

  // Sort rows by date first, then by NIS
  const sortedRows = rows.sort((a, b) => {
    const dateA = formatDate(a.tanggal) ?? "";
    const dateB = formatDate(b.tanggal) ?? "";
    const dateCompare = dateA.localeCompare(dateB);

    if (dateCompare !== 0) return dateCompare;

    // If dates are equal, sort by NIS
    const nisA = profileMap.get(a.userId)?.nis ?? "";
    const nisB = profileMap.get(b.userId)?.nis ?? "";
    return nisA.localeCompare(nisB);
  });

  // Add rows to worksheet
  for (const r of sortedRows) {
    const profile = profileMap.get(r.userId);
    const desc = r.deskripsi ?? "";
    const kategoriDisplay = /dipulangkan/i.test(desc)
      ? "dipulangkan"
      : /terlambat/i.test(desc)
        ? "terlambat"
        : r.kategoriIzin;

    // Format tanggal as YYYY-MM-DD only
    const tanggalStr = formatDate(r.tanggal)?.split("T")[0] ?? "-";

    // Build keterangan with kategori and status
    let keterangan = kategoriDisplay ?? "-";
    if (r.approvalStatus === "approved") {
      keterangan += " (Disetujui)";
    } else if (r.approvalStatus === "rejected") {
      keterangan += " (Ditolak)";
    } else if (r.approvalStatus === "pending") {
      keterangan += " (Menunggu)";
    }

    ws.addRow({
      tanggal: tanggalStr,
      nis: profile?.nis ?? "-",
      kelas: profile?.className ?? "-",
      nama: profile?.fullName ?? "-",
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
