import React from 'react';
import { BiodataSiswaClient } from './biodata-siswa-client';

/**
 * Halaman Data Siswa / Biodata Siswa
 * Menampilkan tabel data siswa dengan fitur:
 * - Import CSV massal
 * - Tambah data tunggal via form
 * - Pagination dan pencarian
 */
export default function BiodataSiswaPage() {
    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold">Data Siswa</h1>
                <p className="text-muted-foreground">
                    Kelola data biodata siswa, import CSV, dan tambah data baru
                </p>
            </div>

            <BiodataSiswaClient />
        </div>
    );
}
