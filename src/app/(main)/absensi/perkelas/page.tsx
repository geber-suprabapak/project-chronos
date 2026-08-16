"use client";

import { useMemo, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import { RotateCcw } from "lucide-react";

export default function AbsensiPerKelasPage() {
  // Filter states
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [status, setStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>(""); // For instant client-side filtering (Nama/NIS)
  const [page, setPage] = useState<number>(1);

  const limit = 50;

  // Get current user's profile to detect their class (for Wali Kelas)
  const { data: currentUser, isLoading: userLoading } =
    api.userProfiles.getMe.useQuery();

  // Get unique class names for dropdown
  const { data: classNames, isLoading: classNamesLoading } =
    api.userProfiles.getUniqueClassNames.useQuery();

  // Auto-set class filter based on logged-in user's className (Wali Kelas)
  useEffect(() => {
    if (currentUser?.className && !selectedClass) {
      // Check if user role is "wali_kelas" or "guru" - auto-fill their class
      if (currentUser.role === "wali_kelas" || currentUser.role === "guru") {
        setSelectedClass(currentUser.className);
        // Also set date to today (same logic as handleClassChange)
        const today = formatToYMD(new Date());
        setDate(today);
      }
    }
  }, [currentUser, selectedClass]);

  // Fetch attendance summary for selected date.
  // Endpoint ini sudah menghitung semua siswa di kelas + status hadir/izin/tidak hadir.
  const {
    data: attendanceSummary,
    isLoading: summaryLoading,
    error: summaryError,
  } = api.absences.getClassAttendanceSummary.useQuery(
    {
      className: selectedClass,
      date,
    },
    {
      enabled: !!selectedClass && !!date,
    },
  );

  const rows = useMemo(() => {
    if (!attendanceSummary) return [];

    type StudentLite = {
      userId: string;
      nis: string | null;
      fullName: string | null;
      absenceNumber: string | null;
    };

    const statusByUserId = new Map<
      string,
      "Hadir" | "Izin" | "Belum Presensi"
    >();
    const studentByUserId = new Map<string, StudentLite>();

    const upsertStudent = (
      students: readonly StudentLite[],
      status: "Hadir" | "Izin" | "Belum Presensi",
    ) => {
      for (const s of students) {
        studentByUserId.set(s.userId, s);

        const prev = statusByUserId.get(s.userId);
        if (!prev) {
          statusByUserId.set(s.userId, status);
          continue;
        }

        // Prioritas status untuk menghindari konflik data: Izin > Hadir > Belum Presensi.
        if (
          status === "Izin" ||
          (status === "Hadir" && prev === "Belum Presensi")
        ) {
          statusByUserId.set(s.userId, status);
        }
      }
    };

    upsertStudent(attendanceSummary.details.tidakHadir, "Belum Presensi");
    upsertStudent(attendanceSummary.details.hadir, "Hadir");
    upsertStudent(attendanceSummary.details.terlambat, "Hadir");
    upsertStudent(attendanceSummary.details.izin, "Izin");
    upsertStudent(attendanceSummary.details.sakit, "Izin");

    return Array.from(studentByUserId.values())
      .map((s) => ({
        userId: s.userId,
        nis: s.nis,
        fullName: s.fullName,
        absenceNumber: s.absenceNumber,
        className: selectedClass,
        date,
        status: statusByUserId.get(s.userId) ?? "Belum Presensi",
      }))
      .sort((a, b) => {
        const noA = Number(a.absenceNumber ?? Number.MAX_SAFE_INTEGER);
        const noB = Number(b.absenceNumber ?? Number.MAX_SAFE_INTEGER);
        if (noA !== noB) return noA - noB;
        return (a.fullName ?? "").localeCompare(b.fullName ?? "");
      });
  }, [attendanceSummary, date, selectedClass]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rows.filter((r) => {
      const matchStatus = !status || r.status === status;
      if (!matchStatus) return false;
      if (!q) return true;

      const name = (r.fullName ?? "").toLowerCase();
      const nis = (r.nis ?? "").toLowerCase();
      const noAbsen = String(r.absenceNumber ?? "").toLowerCase();
      return name.includes(q) || nis.includes(q) || noAbsen.includes(q);
    });
  }, [rows, searchQuery, status]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return filteredRows.slice(start, end);
  }, [filteredRows, limit, page]);

  const hasMore = page * limit < filteredRows.length;
  const loading = userLoading || classNamesLoading || summaryLoading;

  // Helper to format date to YYYY-MM-DD
  const formatToYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  // Reset page when filters change
  const handleClassChange = (value: string) => {
    const newClass = value === "all" ? "" : value;
    setSelectedClass(newClass);
    setPage(1);
    setSearchQuery("");

    // Auto-set tanggal hari ini ketika kelas dipilih
    if (newClass && !date) {
      const today = formatToYMD(new Date());
      setDate(today);
    }
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value === "all" ? "" : value);
    setPage(1);
  };

  // Build export URL with date range
  const exportParams = new URLSearchParams();
  if (selectedClass) exportParams.set("className", selectedClass);
  if (date) {
    exportParams.set("startDate", date);
    exportParams.set("endDate", date);
  }
  const exportUrl = `/api/export/absences?${exportParams.toString()}`;

  return (
    <div className="flex flex-1 flex-col gap-3 p-2 sm:p-3 md:p-4">
      <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            Absensi Per Kelas
          </h1>
          <p className="text-muted-foreground text-sm">
            Lihat data absensi berdasarkan kelas
            {currentUser?.role === "wali_kelas" && currentUser.className && (
              <span className="ml-1 font-medium text-primary">
                (Wali Kelas {currentUser.className})
              </span>
            )}
          </p>
        </div>
        <div className="flex w-full flex-row justify-start gap-2 sm:w-auto sm:justify-end">
          <DownloadExcelButton
            href={exportUrl}
            filename={`absensi-${selectedClass ? selectedClass : "semua"}${date ? `-${date}` : ""}.xlsx`}
            disabled={
              loading === true || !selectedClass || filteredRows.length === 0
            }
          />
          <DownloadPdfButton
            tableId="absensi-perkelas-table"
            filename={`absensi-${selectedClass ? selectedClass : "semua"}${date ? `-${date}` : ""}.pdf`}
            title={`Data Absensi Kelas ${selectedClass ?? ""}${date ? ` (${date})` : ""}`}
            disabled={
              loading === true || !selectedClass || filteredRows.length === 0
            }
          />
        </div>
      </div>

      <Card className="overflow-hidden p-2 sm:p-3">
        {/* Filter Controls */}
        <div className="mb-3">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            {/* Instant Search (Nama/NIS) - Client-side */}
            <div className="w-full">
              <Input
                id="filter-search"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full">
              <Select
                value={status || "all"}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger id="filter-status" className="h-9 w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Status</SelectItem>
                  <SelectItem value="Hadir">Hadir</SelectItem>
                  <SelectItem value="Belum Presensi">Belum Presensi</SelectItem>
                  <SelectItem value="Izin">Izin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Single Date Filter */}
            <div className="w-full">
              <Input
                id="filter-date"
                type="date"
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="h-9 w-full"
              />
            </div>

            {/* Class Filter */}
            <div className="w-full">
              <Select
                value={selectedClass || "all"}
                onValueChange={handleClassChange}
                disabled={classNamesLoading}
              >
                <SelectTrigger id="filter-class" className="h-9 w-full">
                  <SelectValue placeholder="Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Kelas</SelectItem>
                  {(classNames ?? []).map((cn) => (
                    <SelectItem key={cn} value={cn!}>
                      {cn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(date || status || searchQuery) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setDate("");
                  setStatus("");
                  setSearchQuery("");
                  setPage(1);
                }}
                aria-label="Reset filter"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {!selectedClass ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Silakan pilih kelas terlebih dahulu</p>
            <p className="text-sm mt-1">
              Pilih kelas dari dropdown di atas untuk melihat data absensi
            </p>
          </div>
        ) : !date ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Silakan pilih tanggal terlebih dahulu</p>
            <p className="text-sm mt-1">
              Tanggal diperlukan untuk menampilkan data absensi kelas ini
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : summaryError ? (
          <div className="text-red-600">
            {summaryError?.message ?? "Terjadi kesalahan saat memuat data."}
          </div>
        ) : (
          <>
            {/* Loading summary */}
            {summaryLoading && (
              <div className="mb-4 space-y-2">
                <Skeleton className="h-5 w-48" />
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              </div>
            )}

            <div className="mb-3 w-full max-w-[calc(100vw-2rem)] overflow-x-auto sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>
                      <div className="flex items-center justify-between gap-2">
                        <span>Status</span>
                        {date && attendanceSummary && (
                          <span className="font-serif text-[12px] font-semibold tracking-tight">
                            <span className="text-green-600">
                              H:
                              {rows.filter((r) => r.status === "Hadir").length}
                            </span>
                            <span className="text-amber-600">
                              {" | I:"}
                              {rows.filter((r) => r.status === "Izin").length}
                            </span>
                            <span className="text-red-600">
                              {" | BP:"}
                              {
                                rows.filter(
                                  (r) => r.status === "Belum Presensi",
                                ).length
                              }
                            </span>
                          </span>
                        )}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {searchQuery
                          ? `Tidak ada data yang cocok dengan "${searchQuery}"`
                          : "Tidak ada data siswa untuk filter ini"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagedRows.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell className="font-mono">
                          {row.absenceNumber ?? "-"}
                        </TableCell>
                        <TableCell>{row.fullName ?? "-"}</TableCell>
                        <TableCell>{row.nis ?? "-"}</TableCell>
                        <TableCell>{row.className || "-"}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              row.status === "Hadir"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : row.status === "Izin"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {row.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="hidden">
              <Table id="absensi-perkelas-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={`${row.userId}-pdf`}>
                      <TableCell>{row.absenceNumber ?? "-"}</TableCell>
                      <TableCell>{row.fullName ?? "-"}</TableCell>
                      <TableCell>{row.nis ?? "-"}</TableCell>
                      <TableCell>{row.className || "-"}</TableCell>
                      <TableCell>{row.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Menampilkan {pagedRows.length} dari {filteredRows.length} data
                siswa
                {searchQuery && ` (filter: "${searchQuery}")`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
