"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import { AbsenManualDialog } from "~/components/absen-manual-dialog";

import { useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
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
  Eye,
  Trash2,
  Search,
  Calendar,
  User,
  MapPin,
  Clock,
  Users,
  UserCheck,
  UserX,
  Timer,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Helper: Format date to readable Indonesian format
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [yStr, mStr, dStr] = dateStr.split("-") as [string, string, string];
  const date = new Date(Number(yStr), Number(mStr) - 1, Number(dStr));
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Helper: Format time to HH:MM
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
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

export default function AbsensiPage() {
  const todayStr = new Date().toISOString().split("T")[0]!;
  const [date, setDate] = useState<string>(todayStr);
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");

  const utils = api.useUtils();

  const limit = 20;
  const offset = (page - 1) * limit;

  // Fetch absences with pagination
  const {
    data: absences,
    isLoading: absencesLoading,
    error: absencesError,
  } = api.absences.list.useQuery({
    limit,
    offset,
    sort: "desc",
    date: date || undefined,
    status: status || undefined,
    query: query || undefined,
  });

  // Fetch ALL absences for today's statistics
  const { data: todayAbsences, isLoading: statsLoading } =
    api.absences.list.useQuery({
      limit: 1000,
      offset: 0,
      sort: "desc",
      date: date || todayStr,
    });

  // Delete mutation
  const deleteMutation = api.absences.delete.useMutation({
    onSuccess: async () => {
      toast.success("Data absensi berhasil dihapus!");
      await Promise.all([
        utils.absences.list.invalidate(),
        utils.absences.listRaw.invalidate(),
      ]);
      setDeleteId(null);
      setDeleteName("");
    },
    onError: (error) => {
      toast.error(`Gagal menghapus: ${error.message}`);
    },
  });

  const handleDelete = (id: string, name: string) => {
    setDeleteId(id);
    setDeleteName(name);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate({ id: deleteId });
  };

  const filteredData = absences ?? [];
  const hasMore = filteredData.length === limit;

  // Calculate statistics
  const stats = {
    total: todayAbsences?.length ?? 0,
    hadir: (todayAbsences ?? []).filter(
      (a) => a.status === "Hadir" || a.status === "Datang",
    ).length,
    terlambat: (todayAbsences ?? []).filter((a) => a.status === "Terlambat")
      .length,
    pulang: (todayAbsences ?? []).filter((a) => a.status === "Pulang").length,
  };

  const loading = absencesLoading || statsLoading;

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
            <BreadcrumbPage>Presensi</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Catatan Absensi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kelola dan pantau kehadiran siswa
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AbsenManualDialog />
          <DownloadExcelButton
            href="/api/export/absences"
            filename="absensi.xlsx"
            disabled={loading || filteredData.length === 0}
          />
          <DownloadPdfButton
            tableId="absensi-table"
            filename="absensi.pdf"
            title="Data Absensi"
            disabled={loading || filteredData.length === 0}
          />
        </div>
      </div>

      {/* Navigation to Per Kelas */}
      <Card className="bg-card border-border text-card-foreground hover:bg-accent/50 transition-all cursor-pointer">
        <Link href="/absensi/perkelas">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Lihat Per Kelas</h3>
                <p className="text-sm text-muted-foreground">
                  Lihat data presensi berdasarkan kelas
                </p>
              </div>
            </div>
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Link>
      </Card>

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
            label="Total Catatan"
            value={stats.total}
            icon={<Users className="h-6 w-6 text-primary" />}
            color="bg-primary/10"
          />
          <StatCard
            label="Hadir"
            value={stats.hadir}
            icon={<UserCheck className="h-6 w-6 text-success" />}
            color="bg-success/10"
          />
          <StatCard
            label="Terlambat"
            value={stats.terlambat}
            icon={<Timer className="h-6 w-6 text-warning" />}
            color="bg-warning/10"
          />
          <StatCard
            label="Sudah Pulang"
            value={stats.pulang}
            icon={<UserX className="h-6 w-6 text-muted-foreground" />}
            color="bg-muted"
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
                <SelectItem value="Hadir">Hadir</SelectItem>
                <SelectItem value="Terlambat">Terlambat</SelectItem>
                <SelectItem value="Pulang">Pulang</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase">
            Daftar Absensi ({filteredData.length} catatan)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : absencesError ? (
            <div className="py-12 text-center">
              <p className="text-destructive">
                {absencesError?.message ?? "Error loading data"}
              </p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                Tidak ada data absensi ditemukan
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredData.map((a) => {
                const name =
                  a.userProfile?.fullName ?? a.userProfile?.email ?? a.userId;
                const tanggal =
                  typeof a.date === "string" ? a.date : String(a.date);
                const lokasi = [a.latitude, a.longitude]
                  .filter((v) => v != null)
                  .join(", ");
                const displayStatus =
                  a.status === "Datang" ? "Hadir" : (a.status ?? "-");

                const statusColor =
                  displayStatus === "Hadir"
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : displayStatus === "Terlambat"
                      ? "bg-warning/15 text-warning-foreground hover:bg-warning/25"
                      : displayStatus === "Pulang"
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/15 text-destructive hover:bg-destructive/25";

                return (
                  <div
                    key={a.id}
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
                            {formatDate(tanggal)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(a.createdAt)}
                          </span>
                          {lokasi && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {lokasi}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge className={`${statusColor} capitalize border-0`}>
                        {displayStatus}
                      </Badge>
                      <div className="flex items-center gap-2">
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
                        <Button
                          variant="destructive"
                          size="icon"
                          aria-label="Hapus absensi"
                          onClick={() => handleDelete(a.id, name)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
        <table id="absensi-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Nama</th>
              <th>Status</th>
              <th>Lokasi</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((a) => {
              const name =
                a.userProfile?.fullName ?? a.userProfile?.email ?? a.userId;
              const tanggal =
                typeof a.date === "string" ? a.date : String(a.date);
              const displayStatus =
                a.status === "Datang" ? "Hadir" : (a.status ?? "-");
              const lokasi = [a.latitude, a.longitude]
                .filter((v) => v != null)
                .join(", ");
              return (
                <tr key={`${a.id}-pdf`}>
                  <td>{tanggal}</td>
                  <td>{name}</td>
                  <td>{displayStatus}</td>
                  <td>{lokasi || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Absensi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data absensi untuk{" "}
              <strong>{deleteName}</strong>?
              <br />
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
