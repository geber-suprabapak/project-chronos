import { NextResponse } from 'next/server';
import { Workbook } from 'exceljs';
import { db } from '~/server/db';
import { biodataSiswa } from '~/server/db/schema';
import { makeWorkbookMetadata, workbookToResponseBuffer } from '../utils';

// Ensure fresh data on each request
export const dynamic = 'force-dynamic';
// Excel generation requires Node.js
export const runtime = 'nodejs';

export async function GET() {
    // Create a new workbook and add metadata
    const wb = new Workbook();
    Object.assign(wb, makeWorkbookMetadata('Biodata Siswa'));

    // Create worksheet with columns
    const ws = wb.addWorksheet('Biodata Siswa');
    ws.columns = [
        { header: 'NIS', key: 'nis', width: 15 },
        { header: 'Nama Lengkap', key: 'nama', width: 30 },
        { header: 'Kelas', key: 'kelas', width: 15 },
        { header: 'No. Absen', key: 'absen', width: 12 },
        { header: 'Jenis Kelamin', key: 'kelamin', width: 15 },
        { header: 'Status Aktif', key: 'activated', width: 15 },
    ];

    // Style the header row
    ws.getRow(1).font = { bold: true };

    // Fetch all biodata siswa data
    const rows = await db.select().from(biodataSiswa);

    // Add rows to worksheet
    for (const r of rows) {
        ws.addRow({
            nis: r.nis.toString(),
            nama: r.nama,
            kelas: r.kelas,
            absen: r.absen,
            kelamin: r.kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
            activated: r.activated ? 'Aktif' : 'Tidak Aktif',
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
            'Content-Disposition': `attachment; filename="biodata-siswa.xlsx"`,
            'Cache-Control': 'no-store',
        },
    });
}
