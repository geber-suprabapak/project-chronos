'use client';

import React, { useState, useRef } from 'react';
import { api } from '~/trpc/react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '~/components/ui/table';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { DownloadExcelButton } from '~/components/download-excel-button';
import { DownloadPdfButton } from '~/components/download-pdf-button';
import { toast } from 'sonner';

/**
 * Client component untuk mengelola data biodata siswa
 * Fitur: Tabel, Pencarian, Tambah Data, Import CSV
 */
export function BiodataSiswaClient() {
    // State untuk pagination dan filter
    const [currentPage, setCurrentPage] = useState(1);
    const [searchNama, setSearchNama] = useState('');
    const [filterKelas, setFilterKelas] = useState<string>('all');
    const [filterKelamin, setFilterKelamin] = useState<string>('all');
    const [filterActivated, setFilterActivated] = useState<boolean | undefined>(undefined);

    // State untuk form tambah data
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        nis: '',
        nama: '',
        kelas: '',
        absen: '',
        kelamin: '' as 'L' | 'P' | '',
        activated: false,
    });

    // CSV import state
    const [csvData, setCsvData] = useState<Array<{
        nis: bigint;
        nama: string;
        kelas: string;
        absen: number;
        kelamin: 'L' | 'P';
        activated: boolean;
    }>>([]);
    const [replaceExisting, setReplaceExisting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const limit = 20;
    const offset = (currentPage - 1) * limit;

    // tRPC queries
    const {
        data: siswaData,
        isLoading,
        refetch,
    } = api.biodataSiswa.list.useQuery({
        limit,
        offset,
        nama: searchNama?.trim() || undefined,
        kelas: filterKelas === 'all' ? undefined : filterKelas?.trim() || undefined,
        kelamin: filterKelamin === 'all' ? undefined : (filterKelamin?.trim() as 'L' | 'P') || undefined,
        activated: filterActivated,
    }); const { data: stats } = api.biodataSiswa.getStats.useQuery();

    // Mutations
    const createMutation = api.biodataSiswa.create.useMutation({
        onSuccess: () => {
            toast.success('Data siswa berhasil ditambahkan');
            setIsAddDialogOpen(false);
            resetForm();
            void refetch();
        },
        onError: (error) => {
            toast.error(`Error: ${error.message}`);
        },
    });

    const bulkCreateMutation = api.biodataSiswa.bulkCreate.useMutation({
        onSuccess: (result) => {
            toast.success(
                `Import selesai: ${result.inserted} ditambahkan, ${result.updated} diupdate, ${result.errors.length} error`
            );
            setIsImportDialogOpen(false);
            setCsvData([]);
            void refetch();
        },
        onError: (error) => {
            toast.error(`Error import: ${error.message}`);
        },
    });

    const resetForm = () => {
        setFormData({
            nis: '',
            nama: '',
            kelas: '',
            absen: '',
            kelamin: '',
            activated: false,
        });
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nis || !formData.nama || !formData.kelas || !formData.absen || !formData.kelamin) {
            toast.error('Semua field wajib diisi');
            return;
        }

        try {
            // Validasi input NIS
            if (!/^\d+$/.test(formData.nis)) {
                toast.error('NIS harus berupa angka');
                return;
            }

            // Validasi input absen
            const absenNum = parseInt(formData.absen);
            if (isNaN(absenNum) || absenNum <= 0) {
                toast.error('Nomor absen harus berupa angka positif');
                return;
            }

            createMutation.mutate({
                nis: BigInt(formData.nis),
                nama: formData.nama,
                kelas: formData.kelas,
                absen: absenNum,
                kelamin: formData.kelamin,
                activated: formData.activated,
            });
        } catch (error) {
            console.error("Error saat validasi form:", error);
            toast.error('Format data tidak valid, mohon periksa kembali');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target?.result as string;
            const lines = csvText.trim().split('\n');
            const headers = lines[0]?.split(',').map(h => h.trim().toLowerCase()) ?? [];

            // Validasi header
            const requiredHeaders = ['nis', 'nama', 'kelas', 'absen', 'kelamin'];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

            if (missingHeaders.length > 0) {
                toast.error(`Header CSV tidak lengkap: ${missingHeaders.join(', ')}`);
                return;
            }

            const data: Array<{
                nis: bigint;
                nama: string;
                kelas: string;
                absen: number;
                kelamin: 'L' | 'P';
                activated: boolean;
            }> = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i]?.split(',').map(v => v.trim()) ?? [];
                if (values.length < requiredHeaders.length) continue;

                try {
                    const row = {
                        nis: BigInt(values[headers.indexOf('nis')] ?? '0'),
                        nama: values[headers.indexOf('nama')] ?? '',
                        kelas: values[headers.indexOf('kelas')] ?? '',
                        absen: parseInt(values[headers.indexOf('absen')] ?? '0'),
                        kelamin: (values[headers.indexOf('kelamin')] ?? '').toUpperCase() as 'L' | 'P',
                        activated: values[headers.indexOf('activated')]?.toLowerCase() === 'true',
                    };

                    // Validasi data
                    if (row.nis > 0 && row.nama && row.kelas && row.absen > 0 && (row.kelamin === 'L' || row.kelamin === 'P')) {
                        data.push(row);
                    }
                } catch (error) {
                    console.warn(`Baris ${i + 1} diabaikan karena error:`, error);
                }
            }

            setCsvData(data);
            toast.success(`${data.length} data valid ditemukan`);
        };

        reader.readAsText(file);
    };

    const handleImportSubmit = () => {
        if (csvData.length === 0) {
            toast.error('Tidak ada data untuk diimport');
            return;
        }

        bulkCreateMutation.mutate({
            data: csvData,
            replaceExisting,
        });
    };

    const rows = siswaData?.data ?? [];
    const total = siswaData?.meta.total ?? 0;
    const hasMore = siswaData?.meta.hasMore ?? false;

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Total Siswa</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Siswa Aktif</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{stats.activated}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Laki-laki</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.genderStats.find(g => g.kelamin === 'L')?.count ?? 0}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Perempuan</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.genderStats.find(g => g.kelamin === 'P')?.count ?? 0}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filter dan Actions */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-4">
                        {/* Baris 1: Search dan Filter */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <Label htmlFor="search-nama">Cari Nama</Label>
                                <Input
                                    id="search-nama"
                                    placeholder="Masukkan nama siswa"
                                    value={searchNama}
                                    onChange={(e) => setSearchNama(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Kelas</Label>
                                <Select value={filterKelas} onValueChange={setFilterKelas}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Semua Kelas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Kelas</SelectItem>
                                        <SelectItem value="X RPL">X RPL</SelectItem>
                                        <SelectItem value="XI RPL">XI RPL</SelectItem>
                                        <SelectItem value="XII RPL">XII RPL</SelectItem>
                                        <SelectItem value="X AKL">X AKL</SelectItem>
                                        <SelectItem value="XI AKL">XI AKL</SelectItem>
                                        <SelectItem value="XII AKL">XII AKL</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Jenis Kelamin</Label>
                                <Select value={filterKelamin} onValueChange={setFilterKelamin}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Semua" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua</SelectItem>
                                        <SelectItem value="L">Laki-laki</SelectItem>
                                        <SelectItem value="P">Perempuan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={filterActivated === undefined ? "all" : filterActivated.toString()}
                                    onValueChange={(value) => setFilterActivated(value === "all" ? undefined : value === "true")}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Semua Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Status</SelectItem>
                                        <SelectItem value="true">Aktif</SelectItem>
                                        <SelectItem value="false">Tidak Aktif</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Baris 2: Actions */}
                        <div className="flex flex-wrap gap-2 justify-between">
                            <div className="flex gap-2">
                                <Button onClick={() => setCurrentPage(1)}>
                                    Search
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearchNama('');
                                        setFilterKelas('all');
                                        setFilterKelamin('all');
                                        setFilterActivated(undefined);
                                        setCurrentPage(1);
                                    }}
                                >
                                    Reset
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button>Tambah Siswa</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Tambah Data Siswa</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleAddSubmit} className="space-y-4">
                                            <div>
                                                <Label htmlFor="nis">NIS</Label>
                                                <Input
                                                    id="nis"
                                                    type="number"
                                                    value={formData.nis}
                                                    onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="nama">Nama Lengkap</Label>
                                                <Input
                                                    id="nama"
                                                    value={formData.nama}
                                                    onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="kelas">Kelas</Label>
                                                <Input
                                                    id="kelas"
                                                    value={formData.kelas}
                                                    onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="absen">No. Absen</Label>
                                                <Input
                                                    id="absen"
                                                    type="number"
                                                    value={formData.absen}
                                                    onChange={(e) => setFormData({ ...formData, absen: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <Label>Jenis Kelamin</Label>
                                                <Select
                                                    value={formData.kelamin}
                                                    onValueChange={(value: 'L' | 'P') => setFormData({ ...formData, kelamin: value })}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Pilih jenis kelamin" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="L">Laki-laki</SelectItem>
                                                        <SelectItem value="P">Perempuan</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id="activated"
                                                    checked={formData.activated}
                                                    onChange={(e) => setFormData({ ...formData, activated: e.target.checked })}
                                                    className="h-4 w-4"
                                                />
                                                <Label htmlFor="activated">Aktif</Label>
                                            </div>
                                            <div className="flex gap-2 pt-4">
                                                <Button type="submit" disabled={createMutation.isPending}>
                                                    {createMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => setIsAddDialogOpen(false)}
                                                >
                                                    Batal
                                                </Button>
                                            </div>
                                        </form>
                                    </DialogContent>
                                </Dialog>

                                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline">Import CSV</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Import Data dari CSV</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <Alert>
                                                <AlertDescription>
                                                    Format CSV harus memiliki kolom: <strong>nis, nama, kelas, absen, kelamin</strong><br />
                                                    Kolom kelamin harus berisi &apos;L&apos; untuk laki-laki atau &apos;P&apos; untuk perempuan.
                                                </AlertDescription>
                                            </Alert>

                                            <div>
                                                <Label htmlFor="csv-file">Pilih File CSV</Label>
                                                <Input
                                                    ref={fileInputRef}
                                                    id="csv-file"
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={handleFileUpload}
                                                />
                                            </div>

                                            {csvData.length > 0 && (
                                                <div>
                                                    <div className="flex items-center space-x-2 mb-2">
                                                        <input
                                                            type="checkbox"
                                                            id="replace-existing"
                                                            checked={replaceExisting}
                                                            onChange={(e) => setReplaceExisting(e.target.checked)}
                                                            className="h-4 w-4"
                                                        />
                                                        <Label htmlFor="replace-existing">
                                                            Replace data yang sudah ada (berdasarkan NIS)
                                                        </Label>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {csvData.length} data siap diimport
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={handleImportSubmit}
                                                    disabled={csvData.length === 0 || bulkCreateMutation.isPending}
                                                >
                                                    {bulkCreateMutation.isPending ? 'Mengimport...' : 'Import'}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setIsImportDialogOpen(false);
                                                        setCsvData([]);
                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                    }}
                                                >
                                                    Batal
                                                </Button>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <DownloadExcelButton
                                    href="/api/export/biodata-siswa"
                                    filename="biodata-siswa.xlsx"
                                    disabled={rows.length === 0}
                                />
                                <DownloadPdfButton
                                    tableId="biodata-siswa-table"
                                    filename="biodata-siswa.pdf"
                                    title="Data Siswa"
                                    disabled={rows.length === 0}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Separator />

            {/* Pagination Info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                    Menampilkan {rows.length ? offset + 1 : 0}-{offset + rows.length} dari {total} data
                </span>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                    >
                        Prev
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasMore}
                        onClick={() => setCurrentPage(currentPage + 1)}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Data Table */}
            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <Table id="biodata-siswa-table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>NIS</TableHead>
                                <TableHead>Nama Lengkap</TableHead>
                                <TableHead>Kelas</TableHead>
                                <TableHead>No. Absen</TableHead>
                                <TableHead>Jenis Kelamin</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length ? (
                                rows.map((siswa) => (
                                    <TableRow key={siswa.nis.toString()}>
                                        <TableCell className="font-mono">{siswa.nis.toString()}</TableCell>
                                        <TableCell className="font-medium">{siswa.nama}</TableCell>
                                        <TableCell>{siswa.kelas}</TableCell>
                                        <TableCell>{siswa.absen}</TableCell>
                                        <TableCell>
                                            <Badge variant={siswa.kelamin === 'L' ? 'default' : 'secondary'}>
                                                {siswa.kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={siswa.activated ? 'default' : 'destructive'}>
                                                {siswa.activated ? 'Aktif' : 'Tidak Aktif'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        Tidak ada data siswa ditemukan
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
