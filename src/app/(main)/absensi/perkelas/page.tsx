"use client";

import { useMemo, useState, useEffect } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
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
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import { Eye, CalendarIcon, RotateCcw, Search } from "lucide-react";

// Helper function to format date in a readable format
function formatDate(date: Date | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function AbsensiPerKelasPage() {
  // Filter states
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(""); // YYYY-MM-DD (dari)
  const [endDate, setEndDate] = useState<string>(""); // YYYY-MM-DD (sampai)
  const [status, setStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>(""); // For instant client-side filtering (Nama/NIS)
  const [page, setPage] = useState<number>(1);

  const limit = 50; // Fetch more data for client-side filtering
  const offset = (page - 1) * limit;

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
        // Also set dates to today (same logic as handleClassChange)
        const today = formatToYMD(new Date());
        setStartDate(today);
        setEndDate(today);
      }
    }
  }, [currentUser, selectedClass]);

  // Fetch absences with className filter (server-side)
  const {
    data: absences,
    isLoading: absencesLoading,
    error: absencesError,
  } = api.absences.list.useQuery(
    {
      limit,
      offset,
      sort: "desc",
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status: status || undefined,
      className: selectedClass || undefined,
    },
    {
      enabled: !!selectedClass, // Only fetch when a class is selected
    },
  );

  // Fetch attendance summary for single date view (when startDate === endDate)
  const isSingleDate = startDate && startDate === endDate;
  const { data: attendanceSummary, isLoading: summaryLoading } =
    api.absences.getClassAttendanceSummary.useQuery(
      {
        className: selectedClass,
        date: startDate,
      },
      {
        enabled: !!selectedClass && !!isSingleDate,
      },
    );

  // Client-side instant filtering for Nama and NIS using useMemo
  const filteredAbsences = useMemo(() => {
    if (!absences) return [];

    const query = searchQuery.trim().toLowerCase();
    if (!query) return absences;

    return absences.filter((a) => {
      const fullName = (a.userProfile?.fullName ?? "").toLowerCase();
      const nis = (a.userProfile?.nis ?? "").toLowerCase();

      // Match by name or NIS
      return fullName.includes(query) || nis.includes(query);
    });
  }, [absences, searchQuery]);

  const startDateValue = startDate
    ? new Date(startDate + "T00:00:00")
    : undefined;
  const endDateValue = endDate ? new Date(endDate + "T00:00:00") : undefined;
  const loading = absencesLoading || userLoading || classNamesLoading;
  const hasMore = absences?.length === limit;

  // Helper to format date to YYYY-MM-DD
  const formatToYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };

  const renderTableRows = (
    absencesToRender: typeof filteredAbsences,
    options?: {
      includeActionColumn?: boolean;
      includeStatusBadge?: boolean;
      rowKeySuffix?: string;
    },
  ) => {
    const {
      includeActionColumn = false,
      includeStatusBadge = false,
      rowKeySuffix = "",
    } = options ?? {};

    return absencesToRender.map((a) => {
      const name = a.userProfile?.fullName ?? a.userProfile?.email ?? "-";
      const nis = a.userProfile?.nis ?? "-";
      const className = a.userProfile?.className ?? "-";
      const tanggal = typeof a.date === "string" ? a.date : String(a.date);
      const displayStatus = a.status === "Datang" ? "Hadir" : (a.status ?? "-");
      const waktu = a.createdAt
        ? new Date(a.createdAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-";

      return (
        <TableRow key={`${a.id}${rowKeySuffix}`}>
          <TableCell>{tanggal}</TableCell>
          <TableCell className={includeActionColumn ? "font-mono" : undefined}>
            {nis}
          </TableCell>
          <TableCell>{name}</TableCell>
          <TableCell>{className}</TableCell>
          <TableCell>
            {includeStatusBadge ? (
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  displayStatus === "Hadir"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : displayStatus === "Terlambat"
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : displayStatus === "Pulang"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {displayStatus}
              </span>
            ) : (
              displayStatus
            )}
          </TableCell>
          <TableCell>{waktu}</TableCell>
          {includeActionColumn && (
            <TableCell>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      asChild
                      variant="outline"
                      size="icon"
                      aria-label="Detail absensi"
                    >
                      <Link href={`/absensi/show/${a.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Detail</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
          )}
        </TableRow>
      );
    });
  };

  // Reset page when filters change
  const handleClassChange = (value: string) => {
    const newClass = value === "all" ? "" : value;
    setSelectedClass(newClass);
    setPage(1);
    setSearchQuery("");

    // Auto-set tanggal hari ini ketika kelas dipilih (startDate dan endDate sama = hari ini)
    if (newClass && !startDate) {
      const today = formatToYMD(new Date());
      setStartDate(today);
      setEndDate(today);
    }
  };

  const handleStartDateSelect = (d: Date | undefined) => {
    if (!d) {
      setStartDate("");
      return;
    }
    const dateStr = formatToYMD(d);
    setStartDate(dateStr);
    // Jika endDate belum diset atau lebih kecil dari startDate, set endDate sama
    if (!endDate || dateStr > endDate) {
      setEndDate(dateStr);
    }
    setPage(1);
  };

  const handleEndDateSelect = (d: Date | undefined) => {
    if (!d) {
      setEndDate("");
      return;
    }
    const dateStr = formatToYMD(d);
    setEndDate(dateStr);
    // Jika startDate belum diset atau lebih besar dari endDate, set startDate sama
    if (!startDate || dateStr < startDate) {
      setStartDate(dateStr);
    }
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value === "all" ? "" : value);
    setPage(1);
  };

  // Build export URL with date range
  const exportParams = new URLSearchParams();
  if (selectedClass) exportParams.set("className", selectedClass);
  if (startDate) exportParams.set("startDate", startDate);
  if (endDate) exportParams.set("endDate", endDate);
  const exportUrl = `/api/export/absences?${exportParams.toString()}`;

  return (
    <div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
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
        <div className="flex flex-row gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <DownloadExcelButton
            href={exportUrl}
            filename={`absensi-${selectedClass ? selectedClass : "semua"}${startDate ? `-${startDate}` : ""}${endDate && endDate !== startDate ? `-sd-${endDate}` : ""}.xlsx`}
            disabled={
              loading === true ||
              !selectedClass ||
              filteredAbsences.length === 0
            }
          />
          <DownloadPdfButton
            tableId="absensi-perkelas-table"
            filename={`absensi-${selectedClass ? selectedClass : "semua"}${startDate ? `-${startDate}` : ""}${endDate && endDate !== startDate ? `-sd-${endDate}` : ""}.pdf`}
            title={`Data Absensi Kelas ${selectedClass ?? ""}${startDate ? ` (${startDate}${endDate && endDate !== startDate ? ` s/d ${endDate}` : ""})` : ""}`}
            disabled={
              loading === true ||
              !selectedClass ||
              filteredAbsences.length === 0
            }
          />
        </div>
      </div>

      <Card className="p-2 sm:p-4 overflow-hidden">
        {/* Filter Controls */}
        <div className="flex flex-col gap-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 w-full">
            {/* Class Filter */}
            <div className="flex flex-col w-full">
              <Label
                htmlFor="filter-class"
                className="mb-2 text-sm font-medium"
              >
                Kelas
              </Label>
              <Select
                value={selectedClass || "all"}
                onValueChange={handleClassChange}
                disabled={classNamesLoading}
              >
                <SelectTrigger id="filter-class" className="w-full h-9">
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">-- Pilih Kelas --</SelectItem>
                  {(classNames ?? []).map((cn) => (
                    <SelectItem key={cn} value={cn!}>
                      {cn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter (Dari) */}
            <div className="flex flex-col w-full">
              <Label
                htmlFor="filter-start-date"
                className="mb-2 text-sm font-medium"
              >
                Dari Tanggal
              </Label>
              <div className="relative flex gap-2">
                <Input
                  id="filter-start-date"
                  placeholder="Pilih tanggal"
                  value={formatDate(startDateValue)}
                  readOnly
                  className="w-full pr-10"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0"
                    >
                      <CalendarIcon className="size-3.5" />
                      <span className="sr-only">Pilih tanggal mulai</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="end"
                    alignOffset={-8}
                  >
                    <Calendar
                      mode="single"
                      selected={startDateValue}
                      onSelect={handleStartDateSelect}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* End Date Filter (Sampai) */}
            <div className="flex flex-col w-full">
              <Label
                htmlFor="filter-end-date"
                className="mb-2 text-sm font-medium"
              >
                Sampai Tanggal
              </Label>
              <div className="relative flex gap-2">
                <Input
                  id="filter-end-date"
                  placeholder="Pilih tanggal"
                  value={formatDate(endDateValue)}
                  readOnly
                  className="w-full pr-10"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0"
                    >
                      <CalendarIcon className="size-3.5" />
                      <span className="sr-only">Pilih tanggal akhir</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="end"
                    alignOffset={-8}
                  >
                    <Calendar
                      mode="single"
                      selected={endDateValue}
                      onSelect={handleEndDateSelect}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex flex-col w-full">
              <Label
                htmlFor="filter-status"
                className="mb-2 text-sm font-medium"
              >
                Status
              </Label>
              <Select
                value={status || "all"}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger id="filter-status" className="w-full h-9">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="Hadir">Hadir</SelectItem>
                  <SelectItem value="Terlambat">Terlambat</SelectItem>
                  <SelectItem value="Pulang">Pulang</SelectItem>
                  <SelectItem value="Alpha">Alpha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Instant Search (Nama/NIS) - Client-side */}
            <div className="flex flex-col w-full">
              <Label
                htmlFor="filter-search"
                className="mb-2 text-sm font-medium"
              >
                Cari Nama/NIS
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="filter-search"
                  placeholder="Ketik nama atau NIS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9"
                />
              </div>
            </div>
          </div>

          {/* Reset Button */}
          {(startDate || endDate || status || searchQuery) && (
            <div className="flex justify-start">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setStatus("");
                        setSearchQuery("");
                        setPage(1);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Filter
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset semua filter</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>

        {/* Content */}
        {!selectedClass ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg">Silakan pilih kelas terlebih dahulu</p>
            <p className="text-sm mt-1">
              Pilih kelas dari dropdown di atas untuk melihat data absensi
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : absencesError ? (
          <div className="text-red-600">
            {absencesError?.message ?? "Terjadi kesalahan saat memuat data."}
          </div>
        ) : (
          <>
            {/* Attendance Summary Cards - Only shown for single date */}
            {isSingleDate && attendanceSummary && (
              <div className="mb-6">
                <h3 className="text-md font-semibold mb-3">
                  Ringkasan Kehadiran -{" "}
                  {formatDate(new Date(startDate + "T00:00:00"))}
                </h3>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {attendanceSummary.summary.hadir}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      Hadir
                    </div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {attendanceSummary.summary.terlambat}
                    </div>
                    <div className="text-sm text-yellow-700 dark:text-yellow-300">
                      Terlambat
                    </div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {attendanceSummary.summary.tidakHadir}
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      Tidak Hadir
                    </div>
                  </div>
                </div>

                {/* Detail Lists for Non-Present Students */}
                {attendanceSummary.summary.tidakHadir > 0 && (
                  <div className="grid grid-cols-1 gap-4">
                    {/* Tidak Hadir (Alpha) */}
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <h4 className="font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2">
                        <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                        Tidak Hadir ({attendanceSummary.summary.tidakHadir})
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {attendanceSummary.details.tidakHadir.map((s) => (
                          <li key={s.userId} className="flex justify-between">
                            <span>{s.fullName ?? "-"}</span>
                            <span className="text-muted-foreground font-mono text-xs">
                              {s.nis ?? "-"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* All present message */}
                {attendanceSummary.summary.tidakHadir === 0 && (
                  <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
                    <p className="text-green-700 dark:text-green-400 font-medium">
                      🎉 Semua siswa hadir hari ini!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Loading summary */}
            {isSingleDate && summaryLoading && (
              <div className="mb-6 space-y-2">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              </div>
            )}

            {/* Pagination Info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
              <span>
                Menampilkan {filteredAbsences.length} data
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

            {/* Main Table */}
            <div className="mb-4 w-full overflow-x-auto max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAbsences.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {searchQuery
                          ? `Tidak ada data yang cocok dengan "${searchQuery}"`
                          : "Tidak ada data absensi untuk kelas ini"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    renderTableRows(filteredAbsences, {
                      includeActionColumn: true,
                      includeStatusBadge: true,
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Hidden table for PDF export */}
            <div className="hidden">
              <Table id="absensi-perkelas-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>NIS</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Waktu</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderTableRows(filteredAbsences, {
                    includeActionColumn: false,
                    includeStatusBadge: false,
                    rowKeySuffix: "-pdf",
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Bottom Pagination */}
            <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
              <span>Menampilkan {filteredAbsences.length} data</span>
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
