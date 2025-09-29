import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { db } from '~/server/db';
import { biodataSiswa } from '~/server/db/schema';
import { makeWorkbookMetadata, workbookToResponseBuffer } from '../utils';
import { sql } from 'drizzle-orm';

// Ensure fresh data on each request
export const dynamic = 'force-dynamic';
// Excel generation requires Node.js
export const runtime = 'nodejs';

/**
 * Helper to format gender display
 */
function formatGender(kelamin: string | null): string {
    if (kelamin === 'L') return 'Laki-laki';
    if (kelamin === 'P') return 'Perempuan';
    return '-';
}

/**
 * Helper to format activation status
 */
function formatActivated(activated: boolean): string {
    return activated ? 'Aktif' : 'Belum Aktif';
}

export async function GET() {
    // Create a new workbook and add metadata
    const wb = new Workbook();
    Object.assign(wb, makeWorkbookMetadata('Data Siswa'));

    // Create worksheet with columns
    const ws = wb.addWorksheet('Data Siswa');
    ws.columns = [
        { header: 'NIS', key: 'nis', width: 15 },
        { header: 'Nama', key: 'nama', width: 30 },
        { header: 'Kelas', key: 'kelas', width: 12 },
        { header: 'Absen', key: 'absen', width: 8 },
        { header: 'Jenis Kelamin', key: 'kelamin', width: 15 },
        { header: 'Status Aktivasi', key: 'activated', width: 15 },
    ];

    // Style the header row
    ws.getRow(1).font = { bold: true };

    // Fetch all siswa data, ordered by class and absen
    const rows = await db
        .select()
        .from(biodataSiswa)
        .orderBy(
            sql`coalesce(${biodataSiswa.kelas}, '~~~~') ASC`,
            sql`coalesce(${biodataSiswa.absen}, 999) ASC`,
            sql`coalesce(${biodataSiswa.nama}, '~~~~') ASC`
        );

    // Add rows to worksheet
    for (const r of rows) {
        ws.addRow({
            nis: r.nis.toString(),
            nama: r.nama,
            kelas: r.kelas,
            absen: r.absen,
            kelamin: formatGender(r.kelamin),
            activated: formatActivated(r.activated),
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
            'Content-Disposition': `attachment; filename="data-siswa.xlsx"`,
            'Cache-Control': 'no-store',
        },
    });
}
