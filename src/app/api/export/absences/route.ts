import { NextResponse, type NextRequest } from "next/server";
import { Workbook } from "exceljs";
import { db } from "~/server/db";
import { absences, userProfiles } from "~/server/db/schema";
import { eq, and, ilike, exists, gte, lte } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { makeWorkbookMetadata, workbookToResponseBuffer } from "../utils";

// Ensure fresh data on each request
export const dynamic = "force-dynamic";
// Excel generation requires Node.js
export const runtime = "nodejs";

/**
 * Helper to safely format date values
 */
function formatDate(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    const t = val.getTime();
    return Number.isNaN(t) ? null : val.toISOString();
  }
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    const t = d.getTime();
    return Number.isNaN(t) ? null : d.toISOString();
  }
  return null;
}

export async function GET(request: NextRequest) {
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

  // Build WHERE conditions array
  const conditions: (SQL | undefined)[] = [];

  // className filter using EXISTS subquery
  if (className) {
    conditions.push(
      exists(
        db
          .select({ one: userProfiles.userId })
          .from(userProfiles)
          .where(
            and(
              eq(userProfiles.userId, absences.userId),
              ilike(userProfiles.className, `%${className}%`),
            ),
          ),
      ),
    );
  }

  // Date range filter
  if (startDate) conditions.push(gte(absences.date, startDate));
  if (endDate) conditions.push(lte(absences.date, endDate));

  // Combine conditions
  const validConds = conditions.filter(Boolean) as SQL[];
  const whereCondition = validConds.length > 0 ? and(...validConds) : undefined;

  // Fetch absences data with filters
  const rows = await db.select().from(absences).where(whereCondition);

  // Fetch all profiles to map user IDs to names
  const profiles = await db.select().from(userProfiles);
  const profileMap = new Map<string, (typeof profiles)[number]>();

  // Create a lookup map of user profiles by userId (not id)
  for (const profile of profiles) {
    if (profile.userId) {
      profileMap.set(profile.userId, profile);
    }
  }

  // Sort rows by date first, then by class, then by NIS
  const sortedRows = rows.sort((a, b) => {
    const dateA = typeof a.date === "string" ? a.date : String(a.date);
    const dateB = typeof b.date === "string" ? b.date : String(b.date);
    const dateCompare = dateA.localeCompare(dateB);

    if (dateCompare !== 0) return dateCompare;

    // If dates are equal, sort by class
    const classA = profileMap.get(a.userId)?.className ?? "";
    const classB = profileMap.get(b.userId)?.className ?? "";
    const classCompare = classA.localeCompare(classB);

    if (classCompare !== 0) return classCompare;

    // If class is equal, sort by NIS
    const nisA = profileMap.get(a.userId)?.nis ?? "";
    const nisB = profileMap.get(b.userId)?.nis ?? "";
    return nisA.localeCompare(nisB);
  });

  // Add rows to worksheet with separator between dates
  let lastDate = "";
  for (const r of sortedRows) {
    const profile = profileMap.get(r.userId);
    const currentDate = typeof r.date === "string" ? r.date : String(r.date);

    // Add empty row as separator when date changes (except for first row)
    if (lastDate && currentDate !== lastDate) {
      ws.addRow({}); // Empty row as separator
    }
    lastDate = currentDate;

    ws.addRow({
      tanggal: currentDate,
      nis: profile?.nis ?? "-",
      kelas: profile?.className ?? "-",
      nama: profile?.fullName ?? "-",
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
