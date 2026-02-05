"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";

import Link from "next/link";
import { api } from "~/trpc/react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
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
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  User,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Search,
} from "lucide-react";

/**
 * Helper: Format date to readable Indonesian format
 */
function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Statistics Card Component
 */
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className={`rounded-full ${color} p-3`}>{icon}</div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PerizinanPage() {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const [date, setDate] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const limit = 20;
  const offset = (page - 1) * limit;

  // Fetch ALL permissions for statistics using new endpoint
  const { data: statsData, isLoading: statsLoading } =
    api.perizinan.getStats.useQuery({
      tanggal: date || undefined,
    });

  const {
    data: perizinan,
    isLoading,
    error,
  } = api.perizinan.list.useQuery(
    {
      limit,
      offset,
      tanggal: date || undefined,
      approvalStatus: status || undefined,
    },
    {
      refetchOnWindowFocus: false,
    },
  );

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-destructive">Error: {error.message}</p>
      </div>
    );
  }

  // Filter by query
  const q = query.trim().toLowerCase();
  let filteredData = (perizinan ?? []).filter((p) => {
    if (!q) return true;
    const name = p.userProfile?.fullName ?? p.userProfile?.email ?? "";
    return name.toLowerCase().includes(q);
  });

  const hasMore = filteredData.length === limit;

  // Calculate statistics
  const stats = {
    total: statsData?.total ?? 0,
    pending: statsData?.pending ?? 0,
    approved: statsData?.approved ?? 0,
    rejected: statsData?.rejected ?? 0,
  };

  const loading = isLoading || statsLoading;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Perizinan</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Catatan Perizinan
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola dan pantau permohonan izin siswa
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Izin"
            value={stats.total}
            icon={<FileText className="h-6 w-6 text-primary" />}
            color="bg-primary/10"
          />
          <StatCard
            label="Menunggu"
            value={stats.pending}
            icon={<Clock className="h-6 w-6 text-warning" />}
            color="bg-warning/10"
          />
          <StatCard
            label="Disetujui"
            value={stats.approved}
            icon={<CheckCircle className="h-6 w-6 text-success" />}
            color="bg-success/10"
          />
          <StatCard
            label="Ditolak"
            value={stats.rejected}
            icon={<XCircle className="h-6 w-6 text-destructive" />}
            color="bg-destructive/10"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari nama..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Date Filter */}
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              className="w-full"
            />

            {/* Status Filter */}
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value === "all" ? "" : value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="approved">Disetujui</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase">
            Daftar Perizinan ({filteredData.length} catatan)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                Tidak ada data perizinan ditemukan
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredData.map((item) => {
                const name =
                  item.userProfile?.fullName ??
                  item.userProfile?.email ??
                  item.userId;

                const statusColor =
                  item.approvalStatus === "approved"
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : item.approvalStatus === "rejected"
                      ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                      : "bg-warning/15 text-warning-foreground hover:bg-warning/25";

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(item.tanggal)}
                          </span>
                          <Badge
                            variant="outline"
                            className="rounded-full px-2.5 py-0.5 font-medium"
                          >
                            {item.userProfile?.className ?? "-"}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="rounded-full px-2.5 py-0.5"
                          >
                            {item.kategoriIzin ?? "-"}
                          </Badge>
                        </div>
                        {item.deskripsi && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {item.deskripsi}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge className={`${statusColor} capitalize border-0`}>
                        {item.approvalStatus ?? "pending"}
                      </Badge>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/perizinan/show/${item.id}`}>Detail</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && filteredData.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman {page} - Menampilkan {filteredData.length} data
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Selanjutnya
            </Button>
          </div>
        </div>
      )}

      {/* Hidden table for PDF export */}
      <div className="hidden">
        <table id="perizinan-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tanggal</th>
              <th>Nama</th>
              <th>Kelas</th>
              <th>Kategori</th>
              <th>Deskripsi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item, index) => {
              const name =
                item.userProfile?.fullName ??
                item.userProfile?.email ??
                item.userId;
              return (
                <tr key={`${item.id}-pdf`}>
                  <td>{offset + index + 1}</td>
                  <td>{formatDate(item.tanggal)}</td>
                  <td>{name}</td>
                  <td>{item.userProfile?.className ?? "-"}</td>
                  <td>{item.kategoriIzin ?? "-"}</td>
                  <td>{item.deskripsi}</td>
                  <td>{item.approvalStatus ?? "pending"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
