"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";

import { useMemo, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Eye,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Activity,
  TrendingUp,
  AlertCircle,
  Home
} from "lucide-react";
import { Separator } from "~/components/ui/separator";
import { FilterBar, type FilterBarValue } from "~/components/filter-bar";

export default function AbsensiPage() {
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [sort, setSort] = useState<"asc" | "desc">("desc"); // newest (desc) by default
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const filter: FilterBarValue = { date: date || undefined, query, status: status || undefined, sort };

  // Fetch absences with pagination
  const {
    data: absences = [],
    isLoading: absencesLoading,
    error: absencesError,
  } = api.absences.listRaw.useQuery();

  // Fetch user profiles for name mapping
  const {
    data: profiles = [],
    isLoading: profilesLoading,
    error: profilesError,
  } = api.userProfiles.listRaw.useQuery();

  // Create a map for quick profile lookup by userId
  const profileByUserId = useMemo(() => {
    const map = new Map<string, (typeof profiles)[0]>();
    for (const profile of profiles) {
      map.set(profile.userId, profile);
    }
    return map;
  }, [profiles]);

  // Client-side filtering for more responsive experience
  const filteredData = useMemo(() => {
    if (!absences) return [];

    let rows = [...absences];

    // Apply search filter
    if (query) {
      const searchLower = query.toLowerCase();
      rows = rows.filter((a) => {
        const prof = profileByUserId.get(a.userId);
        const name = prof?.fullName ?? prof?.email ?? a.userId;
        const dateStr = typeof a.date === "string" ? a.date : String(a.date);
        return (
          name.toLowerCase().includes(searchLower) ||
          dateStr.includes(searchLower) ||
          (a.status?.toLowerCase() ?? "").includes(searchLower)
        );
      });
    }

    // Apply status filter
    if (status) {
      rows = rows.filter((a) => {
        if (!status) return true;
        return (a.status ?? "").toLowerCase() === status.toLowerCase();
      });
    }

    return rows;
  }, [absences, query, status, profileByUserId]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const loading = absencesLoading || profilesLoading;

  // Enhanced stats calculation
  const allAbsencesStats = useMemo(() => {
    if (!absences) return null;

    const total = absences.length;
    const hadir = absences.filter(a => a.status === 'Hadir').length;
    const pulang = absences.filter(a => a.status === 'Pulang').length;
    const datang = absences.filter(a => a.status === 'Datang').length;

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayAbsences = absences.filter(a => a.date === today);
    const todayHadir = todayAbsences.filter(a => a.status === 'Hadir').length;
    const todayPulang = todayAbsences.filter(a => a.status === 'Pulang').length;

    // This week's stats
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoString = weekAgo.toISOString().split('T')[0]!;
    const thisWeekAbsences = absences.filter(a => a.date >= weekAgoString).length;

    // Attendance with location
    const withLocation = absences.filter(a => a.latitude && a.longitude).length;
    const locationPercentage = total > 0 ? Math.round((withLocation / total) * 100) : 0;

    return {
      total,
      hadir,
      pulang,
      datang,
      todayHadir,
      todayPulang,
      thisWeekAbsences,
      withLocation,
      locationPercentage
    };
  }, [absences]);

  // Filtered stats for current view
  const filteredStats = useMemo(() => {
    const totalFiltered = filteredData.length;
    const hadirFiltered = filteredData.filter(a => a.status === 'Hadir').length;
    const pulangFiltered = filteredData.filter(a => a.status === 'Pulang').length;
    const datangFiltered = filteredData.filter(a => a.status === 'Datang').length;

    return {
      total: totalFiltered,
      hadir: hadirFiltered,
      pulang: pulangFiltered,
      datang: datangFiltered
    };
  }, [filteredData]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8" />
            Kelola Absensi
          </h1>
          <p className="text-muted-foreground">
            Pantau dan kelola data kehadiran siswa dengan analisis mendalam
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DownloadExcelButton
            href="/api/export/absences"
            filename="data-absensi.xlsx"
          />
          <DownloadPdfButton
            filename="data-absensi"
            tableId="absensi-table"
            title="Data Absensi Siswa"
          />
        </div>
      </div>

      {/* Enhanced Stats Cards */}
      {allAbsencesStats && !loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Absensi</p>
                  <p className="text-2xl font-bold text-blue-600">{allAbsencesStats.total}</p>
                  <p className="text-xs text-blue-600/80 mt-1">Semua data</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">Hadir</p>
                  <p className="text-2xl font-bold text-green-600">{allAbsencesStats.hadir}</p>
                  <p className="text-xs text-green-600/80 mt-1">
                    {allAbsencesStats.total > 0 ? Math.round((allAbsencesStats.hadir / allAbsencesStats.total) * 100) : 0}% dari total
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Pulang</p>
                  <p className="text-2xl font-bold text-orange-600">{allAbsencesStats.pulang}</p>
                  <p className="text-xs text-orange-600/80 mt-1">Hari ini: {allAbsencesStats.todayPulang}</p>
                </div>
                <Home className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800 dark:text-purple-200">GPS Tracking</p>
                  <p className="text-2xl font-bold text-purple-600">{allAbsencesStats.locationPercentage}%</p>
                  <p className="text-xs text-purple-600/80 mt-1">{allAbsencesStats.withLocation} dengan lokasi</p>
                </div>
                <MapPin className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Absensi</CardTitle>
          <CardDescription>Daftar kehadiran siswa dengan filter dan pencarian</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : absencesError || profilesError ? (
            <div className="text-red-600">
              {absencesError?.message ?? profilesError?.message ?? "Terjadi kesalahan saat memuat data."}
            </div>
          ) : (
            <>
              {/* Filter Bar */}
              <FilterBar
                value={filter}
                statuses={["Hadir", "Pulang"]}
                onChange={(next) => {
                  setDate(next.date ?? "");
                  setQuery(next.query ?? "");
                  setStatus(next.status ?? "");
                  setSort(next.sort ?? "desc");
                  setCurrentPage(1); // Reset to first page when filtering
                }}
                className="mb-4"
              />

              {/* Table with enhanced design */}
              <div className="border rounded-lg overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Siswa</TableHead>
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Waktu</TableHead>
                        <TableHead className="font-semibold">Lokasi</TableHead>
                        <TableHead className="font-semibold text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map((a, index) => {
                        const prof = profileByUserId.get(a.userId);
                        const name = prof?.fullName ?? prof?.email ?? a.userId;
                        const tanggal = typeof a.date === "string" ? a.date : String(a.date);
                        const lokasi = [a.latitude, a.longitude].filter((v) => v != null);
                        const coordinate = lokasi.length > 0 ? lokasi.join(", ") : null;

                        return (
                          <TableRow key={`absensi-${a.id}-${a.userId}-${index}`} className="hover:bg-muted/50">
                            <TableCell>
                              <div className="flex items-center space-x-3">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src="" />
                                  <AvatarFallback className="text-xs">
                                    {name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{name}</p>
                                  {prof?.nis && (
                                    <p className="text-xs text-muted-foreground">NIS: {prof.nis}</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <span>{tanggal}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={a.status === 'Hadir' ? 'default' : a.status === 'Pulang' ? 'secondary' : 'outline'}>
                                {a.status ?? 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {a.createdAt ? new Date(a.createdAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : '-'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {coordinate ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className="text-xs text-muted-foreground cursor-help">
                                      📍 Koordinat tersedia
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{coordinate}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button asChild variant="outline" size="icon" aria-label="Detail absensi">
                                      <Link href={`/absensi/show/${a.id}`}>
                                        <Eye className="h-4 w-4" />
                                      </Link>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Lihat Detail</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredData.length)} dari {filteredData.length} data
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Sebelumnya
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = i + 1;
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Selanjutnya
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Enhanced Analytics Section */}
              {filteredData.length > 0 && (
                <div className="pt-4 border-t space-y-4">
                  {/* Quick Summary */}
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>📊 Total: {filteredStats.total} absensi</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>🟢 Hadir: {filteredStats.hadir}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>🏠 Pulang: {filteredStats.pulang}</span>
                    {filteredStats.datang > 0 && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <span>🟡 Datang: {filteredStats.datang}</span>
                      </>
                    )}
                  </div>

                  {/* Insights Grid */}
                  {allAbsencesStats && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">Tingkat Kehadiran</span>
                        </div>
                        <div className="text-lg font-bold text-green-600">
                          {allAbsencesStats.total > 0 ?
                            Math.round((allAbsencesStats.hadir / allAbsencesStats.total) * 100) : 0}%
                        </div>
                        <p className="text-xs text-green-600/80 mt-1">Rata-rata keseluruhan</p>
                      </div>

                      <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <MapPin className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800 dark:text-purple-200">Akurasi GPS</span>
                        </div>
                        <div className="text-lg font-bold text-purple-600">
                          {allAbsencesStats.locationPercentage}%
                        </div>
                        <p className="text-xs text-purple-600/80 mt-1">{allAbsencesStats.withLocation} dari {allAbsencesStats.total}</p>
                      </div>

                      <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Trend Mingguan</span>
                        </div>
                        <div className="text-lg font-bold text-blue-600">
                          +{allAbsencesStats.thisWeekAbsences}
                        </div>
                        <p className="text-xs text-blue-600/80 mt-1">Absensi 7 hari terakhir</p>
                      </div>
                    </div>
                  )}

                  {/* Location Analysis */}
                  {allAbsencesStats && allAbsencesStats.withLocation > 0 && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Analisis Lokasi GPS</span>
                      </div>
                      <div className="grid gap-2 text-xs">
                        <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/10 rounded border-l-2 border-green-400">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-green-800 dark:text-green-200">Absensi dengan koordinat GPS</span>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {allAbsencesStats.withLocation} data
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-950/10 rounded border-l-2 border-gray-400">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-3 w-3 text-gray-600" />
                            <span className="text-gray-800 dark:text-gray-200">Tanpa data lokasi</span>
                          </div>
                          <Badge variant="outline" className="text-gray-600">
                            {allAbsencesStats.total - allAbsencesStats.withLocation} data
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hidden table for PDF export */}
              <div className="hidden">
                <Table id="absensi-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Alasan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((a, index) => {
                      const prof = profileByUserId.get(a.userId);
                      const name = prof?.fullName ?? prof?.email ?? a.userId;
                      const tanggal = typeof a.date === "string" ? a.date : String(a.date);
                      return (
                        <TableRow key={`pdf-export-${a.id}-${a.userId}-${index}`}>
                          <TableCell>{tanggal}</TableCell>
                          <TableCell>{name}</TableCell>
                          <TableCell>{a.status ?? "-"}</TableCell>
                          <TableCell>{a.reason ?? "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}