
"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";

import Link from "next/link";
import { api } from "~/trpc/react";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Separator } from "~/components/ui/separator";
import { FilterBar, type FilterBarValue } from "~/components/filter-bar";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  Activity
} from "lucide-react";

// Helper function to format date
const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

// Helper to determine badge variant based on status
const getBadgeVariant = (status: string | null) => {
  switch (status) {
    case "approved":
      return "success" as const;
    case "rejected":
      return "destructive" as const;
    case "pending":
    default:
      return "secondary" as const;
  }
};

export default function PerizinanPage() {
  const [filter, setFilter] = useState<FilterBarValue>({ sort: "desc" });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  const { data: profiles } = api.userProfiles.listRaw.useQuery();
  const profileByUserId = useMemo(() => {
    const map = new Map<string, { fullName?: string | null; email?: string | null; nis?: string | null }>();
    for (const p of profiles ?? []) {
      if (p.userId) map.set(p.userId, { fullName: p.fullName, email: p.email ?? '', nis: p.nis ?? null });
    }
    return map;
  }, [profiles]);
  const {
    data: perizinan,
    isLoading,
    error,
  } = api.perizinan.listRaw.useQuery(
    undefined,
    {
      refetchOnWindowFocus: false, // Optional: disable refetch on window focus
    },
  );

  // Calculate statistics
  const stats = useMemo(() => {
    if (!perizinan) return null;

    const total = perizinan.length;
    const pending = perizinan.filter(p => p.approvalStatus === 'pending' || !p.approvalStatus).length;
    const approved = perizinan.filter(p => p.approvalStatus === 'approved').length;
    const rejected = perizinan.filter(p => p.approvalStatus === 'rejected').length;
    const sakit = perizinan.filter(p => p.kategoriIzin === 'sakit').length;
    const pergi = perizinan.filter(p => p.kategoriIzin === 'pergi').length;

    return { total, pending, approved, rejected, sakit, pergi };
  }, [perizinan]);

  // Filter and paginate data
  const filteredData = useMemo(() => {
    const q = (filter.query ?? "").trim().toLowerCase();
    let rows = (perizinan ?? []).filter((p) => {
      if (!q) return true;
      const name = profileByUserId.get(p.userId)?.fullName ?? profileByUserId.get(p.userId)?.email ?? "";
      return name.toLowerCase().includes(q);
    });

    // Filter by status
    if (filter.status && filter.status !== "all") {
      rows = rows.filter(p => p.approvalStatus === filter.status);
    }

    // Sort by date
    rows = rows.sort((a, b) => {
      const da = new Date(a.tanggal).getTime();
      const db = new Date(b.tanggal).getTime();
      return (filter.sort ?? "desc") === "desc" ? db - da : da - db;
    });

    return rows;
  }, [perizinan, filter, profileByUserId]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-red-500">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Kelola Perizinan
          </h1>
          <p className="text-muted-foreground">Manajemen izin dan persetujuan siswa</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto justify-start sm:justify-end">
          <DownloadExcelButton href="/api/export/perizinan" filename="perizinan.xlsx" disabled={isLoading || !(perizinan && perizinan.length > 0)} />
          <DownloadPdfButton tableId="perizinan-table" filename="perizinan.pdf" title="Data Perizinan" disabled={isLoading || !(perizinan && perizinan.length > 0)} />
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Perizinan</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total perizinan</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Menunggu Persetujuan</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Perlu review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Disetujui</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
              <p className="text-xs text-muted-foreground">Telah disetujui</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ditolak</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground">Tidak disetujui</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Breakdown */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kategori Izin</CardTitle>
              <CardDescription>Distribusi jenis perizinan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-sm">Sakit</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{stats.sakit}</span>
                  <span className="text-xs text-muted-foreground">
                    ({stats.total > 0 ? Math.round((stats.sakit / stats.total) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Pergi</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{stats.pergi}</span>
                  <span className="text-xs text-muted-foreground">
                    ({stats.total > 0 ? Math.round((stats.pergi / stats.total) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status Persetujuan</CardTitle>
              <CardDescription>Ringkasan approval perizinan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {stats.pending > 0 && (
                  <div className="flex items-center justify-between p-2 rounded bg-orange-50 dark:bg-orange-950/10">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">Butuh Perhatian</span>
                    </div>
                    <Badge variant="secondary">{stats.pending} pending</Badge>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-green-50 dark:bg-green-950/10 rounded">
                    <div className="font-semibold text-green-700 dark:text-green-400">{stats.approved}</div>
                    <div className="text-xs text-muted-foreground">Approved</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 dark:bg-red-950/10 rounded">
                    <div className="font-semibold text-red-700 dark:text-red-400">{stats.rejected}</div>
                    <div className="text-xs text-muted-foreground">Rejected</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Perizinan</CardTitle>
          <CardDescription>
            Kelola dan review perizinan siswa dengan filter dan pencarian
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              {/* Filter Bar */}
              <FilterBar
                value={filter}
                onChange={(newFilter) => {
                  setFilter(newFilter);
                  setCurrentPage(1); // Reset to first page when filtering
                }}
                statuses={["approved", "rejected", "pending"]}
                labels={{ query: "Cari Nama", status: "Approval", date: "Tanggal" }}
                placeholders={{ query: "Nama...", status: "Pilih status" }}
                className="mb-4"
              />

              {/* Enhanced Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Siswa</TableHead>
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Kategori</TableHead>
                        <TableHead className="font-semibold">Deskripsi</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.length > 0 ? (
                        paginatedData.map((item) => {
                          const prof = profileByUserId.get(item.userId);
                          const name = prof?.fullName ?? prof?.email ?? "Unknown";

                          return (
                            <TableRow key={item.id} className="hover:bg-muted/50">
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
                                  <span className="text-sm">{formatDate(item.tanggal)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={item.kategoriIzin === 'sakit' ? 'destructive' : 'secondary'}
                                  className="rounded-full px-2.5 py-1"
                                >
                                  {item.kategoriIzin}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs">
                                  <p className="text-sm truncate" title={item.deskripsi ?? ""}>
                                    {item.deskripsi ?? "-"}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge
                                        variant={getBadgeVariant(item.approvalStatus)}
                                        className="rounded-full px-2.5 py-1 capitalize cursor-help"
                                      >
                                        {item.approvalStatus === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                        {item.approvalStatus === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                                        {item.approvalStatus === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                                        {item.approvalStatus ?? "pending"}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {item.approvalStatus === 'pending' && "Menunggu persetujuan"}
                                        {item.approvalStatus === 'approved' && "Disetujui"}
                                        {item.approvalStatus === 'rejected' && "Ditolak"}
                                        {!item.approvalStatus && "Menunggu persetujuan"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableCell>
                              <TableCell className="text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button asChild variant="outline" size="icon">
                                        <Link href={`/perizinan/show/${item.id}`}>
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
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            <div className="flex flex-col items-center gap-2">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                              <p className="text-muted-foreground">Tidak ada data perizinan</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
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
                        const pageNum = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i));
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
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

              {/* Quick Summary */}
              {stats && filteredData.length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>📊 Total: {filteredData.length} perizinan</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>🟡 Pending: {filteredData.filter(p => p.approvalStatus === 'pending' || !p.approvalStatus).length}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>🟢 Approved: {filteredData.filter(p => p.approvalStatus === 'approved').length}</span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>🔴 Rejected: {filteredData.filter(p => p.approvalStatus === 'rejected').length}</span>
                  </div>
                </div>
              )}

              {/* Hidden table for PDF export */}
              <div className="hidden">
                <Table id="perizinan-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => {
                      const prof = profileByUserId.get(item.userId);
                      const name = prof?.fullName ?? prof?.email ?? "Unknown";
                      return (
                        <TableRow key={`${item.id}-pdf`}>
                          <TableCell>{formatDate(item.tanggal)}</TableCell>
                          <TableCell>{name}</TableCell>
                          <TableCell>{item.kategoriIzin}</TableCell>
                          <TableCell>{item.deskripsi}</TableCell>
                          <TableCell>{item.approvalStatus ?? "pending"}</TableCell>
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
