import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { db } from '~/server/db';
import { userProfiles } from '~/server/db/schema';
import { makeWorkbookMetadata, workbookToResponseBuffer } from '../utils';

// Ensure fresh data on each request
export const dynamic = 'force-dynamic';
// Excel generation requires Node.js
export const runtime = 'nodejs';

/**
 * Helper to safely format date values
 */
function formatDate(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    const t = val.getTime();
    return Number.isNaN(t) ? null : val.toISOString();
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    const t = d.getTime();
    return Number.isNaN(t) ? null : d.toISOString();
  }
  return null;
}

export async function GET() {
  // Create a new workbook and add metadata
  const wb = new Workbook();
  Object.assign(wb, makeWorkbookMetadata('User Profiles'));
  
  // Create worksheet with columns
  const ws = wb.addWorksheet('Profiles');
  ws.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'NIS', key: 'nis', width: 15 },
    { header: 'Full Name', key: 'fullName', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Class', key: 'className', width: 12 },
    { header: 'Absence #', key: 'absenceNumber', width: 15 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Created At', key: 'createdAt', width: 20 },
    { header: 'Updated At', key: 'updatedAt', width: 20 },
  ];
  
  // Style the header row
  ws.getRow(1).font = { bold: true };
  
  // Fetch all profiles data
  const rows = await db.select().from(userProfiles);
  
  // Add rows to worksheet
  for (const r of rows) {
    ws.addRow({
      id: r.id,
      nis: r.nis,
      fullName: r.fullName,
      email: r.email,
      className: r.className,
      absenceNumber: r.absenceNumber,
      role: r.role,
      createdAt: formatDate(r.createdAt),
      updatedAt: formatDate(r.updatedAt),
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
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="profiles.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
