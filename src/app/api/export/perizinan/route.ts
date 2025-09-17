import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { db } from '~/server/db';
import { perizinan, userProfiles } from '~/server/db/schema';
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
  Object.assign(wb, makeWorkbookMetadata('Perizinan Data'));
  
  // Create worksheet with columns
  const ws = wb.addWorksheet('Perizinan');
  ws.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Full Name', key: 'fullName', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'NIS', key: 'nis', width: 15 },
    { header: 'Class', key: 'className', width: 12 },
    { header: 'Tanggal', key: 'tanggal', width: 15 },
    { header: 'Kategori', key: 'kategoriIzin', width: 10 },
    { header: 'Deskripsi', key: 'deskripsi', width: 40 },
    { header: 'Status', key: 'approvalStatus', width: 10 },
    { header: 'Approved At', key: 'approvedAt', width: 20 },
    { header: 'Rejected At', key: 'rejectedAt', width: 20 },
    { header: 'Rejection Reason', key: 'rejectionReason', width: 40 },
    { header: 'Created At', key: 'createdAt', width: 20 },
    { header: 'Updated At', key: 'updatedAt', width: 20 },
  ];
  
  // Style the header row
  ws.getRow(1).font = { bold: true };
  
  // Fetch all perizinan data
  const rows = await db.select().from(perizinan);
  
  // Fetch all profiles to map user IDs to names
  const profiles = await db.select().from(userProfiles);
  const profileMap = new Map<string, typeof profiles[number]>();
  
  // Create a lookup map of user profiles by ID
  for (const profile of profiles) {
    if (profile.id) {
      profileMap.set(profile.id, profile);
    }
  }
  
  // Add rows to worksheet
  for (const r of rows) {
    const profile = profileMap.get(r.userId);
    
    ws.addRow({
      id: r.id,
      fullName: profile?.fullName ?? null,
      email: profile?.email ?? null,
      nis: profile?.nis ?? null,
      className: profile?.className ?? null,
      tanggal: formatDate(r.tanggal),
      kategoriIzin: r.kategoriIzin,
      deskripsi: r.deskripsi,
      approvalStatus: r.approvalStatus ?? null,
      approvedAt: formatDate(r.approvedAt),
      rejectedAt: formatDate(r.rejectedAt),
      rejectionReason: r.rejectionReason ?? null,
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
      'Content-Disposition': `attachment; filename="perizinan.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
