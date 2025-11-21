"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, UserCheck, User } from "lucide-react";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";

const LIMIT = 50;

export default function SiswaPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [kelas, setKelas] = useState("ALL");
    const [kelamin, setKelamin] = useState("ALL");
    const [activated, setActivated] = useState("ALL");
    const [page, setPage] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, kelas, kelamin, activated]);

    const offset = (page - 1) * LIMIT;

    const listInput = useMemo(() => ({
        limit: LIMIT,
        offset,
        nama: debouncedSearch || undefined,
        kelas: kelas !== "ALL" ? kelas : undefined,
        kelamin: kelamin !== "ALL" ? (kelamin as "L" | "P") : undefined,
        activated: activated === "true" ? true : activated === "false" ? false : undefined,
    }), [debouncedSearch, kelas, kelamin, activated, offset]);

    const siswaQuery = api.biodataSiswa.list.useQuery(listInput, {
        keepPreviousData: true,
    });
    const statsQuery = api.biodataSiswa.getStatistics.useQuery(undefined, { staleTime: 60000 });
    const classesQuery = api.biodataSiswa.getUniqueClasses.useQuery(undefined, { staleTime: 300000 });

    const rows = siswaQuery.data?.data ?? [];
    const total = siswaQuery.data?.meta.total ?? 0;
    const hasMore = siswaQuery.data?.meta.hasMore ?? false;
    const statistics = statsQuery.data ?? { total: 0, laki: 0, perempuan: 0, activated: 0 };
    const uniqueClasses = classesQuery.data ?? [];

    const handleReset = () => {
        setSearchTerm("");
        setKelas("ALL");
        setKelamin("ALL");
        setActivated("ALL");
        setPage(1);
    };

    const hasActiveFilters = Boolean(
        searchTerm || kelas !== "ALL" || kelamin !== "ALL" || activated !== "ALL"
    );

    const loadingRows = siswaQuery.isLoading && !siswaQuery.data;
    const errorMessage = siswaQuery.error?.message;

    return (
        <div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 md:p-6">
            <section className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h1 className="text-lg sm:text-xl font-semibold">Data Siswa</h1>
                    <div className="flex gap-2 w-full sm:w-auto justify-start sm:justify-end">
                        <DownloadExcelButton
                            href="/api/export/siswa"
                            filename="data-siswa.xlsx"
                            className="px-4 py-2"
                            disabled={rows.length === 0}
                        />
                        <DownloadPdfButton
                            tableId="siswa-table"
                            filename="data-siswa.pdf"
                            title="Data Siswa"
                            className="px-4 py-2"
                            disabled={rows.length === 0}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{statistics.total.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Siswa Laki-laki</CardTitle>
                            <User className="h-4 w-4 text-blue-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">{statistics.laki.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Siswa Perempuan</CardTitle>
                            <User className="h-4 w-4 text-pink-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-pink-600">{statistics.perempuan.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Sudah Diaktifkan</CardTitle>
                            <UserCheck className="h-4 w-4 text-green-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{statistics.activated.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-lg border-0 shadow-sm bg-background">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="flex flex-col gap-2 w-full">
                                <label htmlFor="nama" className="text-sm font-medium">
                                    Cari Nama/NIS
                                </label>
                                <Input
                                    id="nama"
                                    placeholder="Masukkan nama atau NIS siswa"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoComplete="off"
                                />
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label htmlFor="kelas" className="text-sm font-medium">
                                    Kelas
                                </label>
                                <Select value={kelas} onValueChange={setKelas} disabled={classesQuery.isLoading}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Semua Kelas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Semua Kelas</SelectItem>
                                        {uniqueClasses.map((kelasName) => (
                                            <SelectItem key={kelasName} value={kelasName}>
                                                {kelasName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label htmlFor="kelamin" className="text-sm font-medium">
                                    Jenis Kelamin
                                </label>
                                <Select value={kelamin} onValueChange={setKelamin}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Semua" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Semua</SelectItem>
                                        <SelectItem value="L">Laki-laki</SelectItem>
                                        <SelectItem value="P">Perempuan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-2 w-full">
                                <label htmlFor="activated" className="text-sm font-medium">
                                    Status Aktivasi
                                </label>
                                <Select value={activated} onValueChange={setActivated}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Semua" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">Semua</SelectItem>
                                        <SelectItem value="true">Sudah Diaktifkan</SelectItem>
                                        <SelectItem value="false">Belum Diaktifkan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex gap-2 items-end w-full">
                                {hasActiveFilters && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleReset}
                                        className="flex-1"
                                    >
                                        Reset
                                    </Button>
                                )}
                                {siswaQuery.isFetching && (
                                    <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                                        Memuat...
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Separator />

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        Menampilkan {rows.length ? offset + 1 : 0}-{offset + rows.length} dari {total} data
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        >
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!hasMore}
                            onClick={() => setPage((prev) => prev + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <CardContent className="p-0 sm:p-6">
                        {errorMessage ? (
                            <div className="p-6 text-red-600">{errorMessage}</div>
                        ) : (
                            <div className="overflow-x-auto max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
                                <Table id="siswa-table">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[100px]">NIS</TableHead>
                                            <TableHead className="w-[200px]">Nama</TableHead>
                                            <TableHead className="w-[100px]">Kelas</TableHead>
                                            <TableHead className="w-[80px]">Absen</TableHead>
                                            <TableHead className="w-[120px]">Jenis Kelamin</TableHead>
                                            <TableHead className="w-[120px]">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingRows ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center">
                                                    Memuat data siswa...
                                                </TableCell>
                                            </TableRow>
                                        ) : rows.length ? (
                                            rows.map((siswa) => {
                                                const rowKey = `nis:${siswa.nis.toString()}`;
                                                return (
                                                    <TableRow key={rowKey}>
                                                        <TableCell className="font-mono text-xs">{siswa.nis.toString()}</TableCell>
                                                        <TableCell className="font-medium">{siswa.nama ?? "-"}</TableCell>
                                                        <TableCell>{siswa.kelas ?? "-"}</TableCell>
                                                        <TableCell>{siswa.absen ?? "-"}</TableCell>
                                                        <TableCell>
                                                            {siswa.kelamin === "L" ? (
                                                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                                                    Laki-laki
                                                                </Badge>
                                                            ) : siswa.kelamin === "P" ? (
                                                                <Badge variant="outline" className="text-pink-600 border-pink-600">
                                                                    Perempuan
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            {siswa.activated ? (
                                                                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                                                    Aktif
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="secondary">
                                                                    Belum Aktif
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} className="h-24 text-center">
                                                    Tidak ada data siswa ditemukan.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                        Menampilkan {rows.length ? offset + 1 : 0}-{offset + rows.length} dari {total} data
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        >
                            Prev
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={!hasMore}
                            onClick={() => setPage((prev) => prev + 1)}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
