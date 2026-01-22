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
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
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
      date: date || undefined,
      status: status || undefined,
      className: selectedClass || undefined,
    },
    {
      enabled: !!selectedClass, // Only fetch when a class is selected
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

  const dateValue = date ? new Date(date + "T00:00:00") : undefined;
  const loading =
    absencesLoading === true ||
    userLoading === true ||
    classNamesLoading === true;
  const hasMore = absences?.length === limit;

  // Reset page when filters change
  const handleClassChange = (value: string) => {
    setSelectedClass(value === "all" ? "" : value);
    setPage(1);
    setSearchQuery("");
  };

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) {
      setDate("");
      return;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    setDate(`${y}-${m}-${da}`);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value === "all" ? "" : value);
    setPage(1);
  };

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
            href={`/api/export/absences?className=${encodeURIComponent(selectedClass)}`}
            filename={`absensi-${selectedClass ? selectedClass : "semua"}.xlsx`}
            disabled={
              loading === true ||
              !selectedClass ||
              filteredAbsences.length === 0
            }
          />
          <DownloadPdfButton
            tableId="absensi-perkelas-table"
            filename={`absensi-${selectedClass ? selectedClass : "semua"}.pdf`}
            title={`Data Absensi Kelas ${selectedClass ?? ""}`}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full">
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

            {/* Date Filter */}
            <div className="flex flex-col w-full">
              <Label htmlFor="filter-date" className="mb-2 text-sm font-medium">
                Tanggal
              </Label>
              <div className="relative flex gap-2">
                <Input
                  id="filter-date"
                  placeholder="Pilih tanggal"
                  value={formatDate(dateValue)}
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
                      <span className="sr-only">Pilih tanggal</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="end"
                    alignOffset={-8}
                  >
                    <Calendar
                      mode="single"
                      selected={dateValue}
                      onSelect={handleDateSelect}
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
          {(date || status || searchQuery) && (
            <div className="flex justify-start">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDate("");
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
                    filteredAbsences.map((a) => {
                      const name =
                        a.userProfile?.fullName ?? a.userProfile?.email ?? "-";
                      const nis = a.userProfile?.nis ?? "-";
                      const className = a.userProfile?.className ?? "-";
                      const tanggal =
                        typeof a.date === "string" ? a.date : String(a.date);
                      const displayStatus =
                        a.status === "Datang" ? "Hadir" : (a.status ?? "-");
                      const waktu = a.createdAt
                        ? new Date(a.createdAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-";

                      return (
                        <TableRow key={a.id}>
                          <TableCell>{tanggal}</TableCell>
                          <TableCell className="font-mono">{nis}</TableCell>
                          <TableCell>{name}</TableCell>
                          <TableCell>{className}</TableCell>
                          <TableCell>
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
                          </TableCell>
                          <TableCell>{waktu}</TableCell>
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
                        </TableRow>
                      );
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
                  {filteredAbsences.map((a) => {
                    const name =
                      a.userProfile?.fullName ?? a.userProfile?.email ?? "-";
                    const nis = a.userProfile?.nis ?? "-";
                    const className = a.userProfile?.className ?? "-";
                    const tanggal =
                      typeof a.date === "string" ? a.date : String(a.date);
                    const displayStatus =
                      a.status === "Datang" ? "Hadir" : (a.status ?? "-");
                    const waktu = a.createdAt
                      ? new Date(a.createdAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "-";

                    return (
                      <TableRow key={`${a.id}-pdf`}>
                        <TableCell>{tanggal}</TableCell>
                        <TableCell>{nis}</TableCell>
                        <TableCell>{name}</TableCell>
                        <TableCell>{className}</TableCell>
                        <TableCell>{displayStatus}</TableCell>
                        <TableCell>{waktu}</TableCell>
                      </TableRow>
                    );
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
