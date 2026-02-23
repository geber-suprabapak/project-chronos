"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import { AbsenManualDialog } from "~/components/absen-manual-dialog";
import { PerizinanManualDialog } from "~/components/perizinan-manual-dialog";

import { useState } from "react";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
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
import { Eye, Trash2 } from "lucide-react";
import { FilterBar, type FilterBarValue } from "~/components/filter-bar";
import { toast } from "sonner";

export default function AbsensiPage() {
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [sort, setSort] = useState<"asc" | "desc">("desc"); // newest (desc) by default
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>(""); // Filter kelas
  const [page, setPage] = useState<number>(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const filter: FilterBarValue = { date: date || undefined, query, status: status || undefined, sort };

  const utils = api.useUtils();

  const limit = 20;
  const offset = (page - 1) * limit;

  // Get unique class names for dropdown
  const { data: classNames, isLoading: classNamesLoading } =
    api.userProfiles.getUniqueClassNames.useQuery();

  // Fetch absences with pagination and className filter
  const {
    data: absences,
    isLoading: absencesLoading,
    error: absencesError,
  } = api.absences.list.useQuery({
    limit,
    offset,
    sort,
    date: date || undefined,
    status: status || undefined,
    className: selectedClass || undefined,
  });

  // Delete mutation using tRPC
  const deleteMutation = api.absences.delete.useMutation({
    onSuccess: async () => {
      toast.success("Data absensi berhasil dihapus!");
      // Refresh the list
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

  // Bulk delete mutation using tRPC
  const bulkDeleteMutation = api.absences.bulkDelete.useMutation({
    onSuccess: async (data) => {
      toast.success(`Berhasil menghapus ${data.deletedCount} data absensi!`);
      // Refresh the list
      await Promise.all([
        utils.absences.list.invalidate(),
        utils.absences.listRaw.invalidate(),
      ]);
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    },
    onError: (error) => {
      toast.error(`Gagal menghapus: ${error.message}`);
      setShowBulkDeleteDialog(false);
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

  // Bulk delete handlers
  const toggleSelectAll = (rows: Array<{ id: string }>) => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const confirmBulkDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    bulkDeleteMutation.mutate({ ids: idsToDelete });
  };

  const loading = absencesLoading || classNamesLoading;

  // Build export URL with className filter
  const exportParams = new URLSearchParams();
  if (selectedClass) exportParams.set("className", selectedClass);
  if (date) exportParams.set("startDate", date);
  if (date) exportParams.set("endDate", date);
  const exportUrl = `/api/export/absences${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">Daftar Absensi</h1>
          <p className="text-muted-foreground text-sm">Ringkasan absensi terbaru</p>
        </div>
        <div className="flex flex-row gap-2 w-full sm:w-auto justify-start sm:justify-end">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending || deleteMutation.isPending}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus ({selectedIds.size})
            </Button>
          )}
          <AbsenManualDialog />
          <PerizinanManualDialog />
          <DownloadExcelButton href={exportUrl} filename={`absensi${selectedClass ? `-${selectedClass}` : ""}.xlsx`} disabled={loading || (absences && absences.length === 0)} />
          <DownloadPdfButton tableId="absensi-table" filename={`absensi${selectedClass ? `-${selectedClass}` : ""}.pdf`} title={`Data Absensi${selectedClass ? ` Kelas ${selectedClass}` : ""}`} disabled={loading || (absences && absences.length === 0)} />
        </div>
      </div>

      <Card className="p-2 sm:p-4 overflow-hidden">
        {loading ? (
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
            {/* Class filter dropdown */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex flex-col w-full sm:w-48">
                <Label htmlFor="filter-class" className="mb-2 text-sm font-medium">
                  Filter Kelas
                </Label>
                <Select
                  value={selectedClass || "all"}
                  onValueChange={(v) => {
                    setSelectedClass(v === "all" ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="filter-class" className="w-full h-9">
                    <SelectValue placeholder="Semua Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {(classNames ?? []).map((cn) => (
                      <SelectItem key={cn} value={cn!}>
                        {cn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reusable filter bar */}
            <FilterBar
              value={filter}
              statuses={["Hadir", "Terlambat", "Pulang", "Alpha"]}
              onChange={(next) => {
                setDate(next.date ?? "");
                setQuery(next.query ?? "");
                setStatus(next.status ?? "");
                setSort(next.sort ?? "desc");
                setPage(1); // Reset to page 1 when filter changes
              }}
              className="mb-4"
            />
            {(() => {
              const rows = (absences ?? []).filter((a) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                const hayName = `${a.userProfile?.fullName ?? ""}`.toLowerCase();
                return hayName.includes(q);
              });
              const rows2 = rows.filter((a) => {
                if (!status) return true;
                return (a.status ?? "").toLowerCase() === status.toLowerCase();
              });
              const hasMore = rows2.length === limit;

              return (
                <>
                  {/* Pagination Info */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                    <span>Halaman {page} - Menampilkan {rows2.length} data</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasMore}
                        onClick={() => setPage(p => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>

                  {/* Main UI table */}
                  <div className="mb-4 w-full overflow-x-auto max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedIds.size === rows2.length && rows2.length > 0}
                              onCheckedChange={() => toggleSelectAll(rows2)}
                              aria-label="Pilih semua"
                            />
                          </TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Lokasi</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows2.map((a) => {
                          const name = a.userProfile?.fullName ?? a.userProfile?.email ?? a.userId;
                          const tanggal = typeof a.date === "string" ? a.date : String(a.date);
                          const lokasi = [a.latitude, a.longitude].filter((v) => v != null).join(", ");
                          const displayStatus = a.status === "Datang" ? "Hadir" : (a.status ?? "-");

                          return (
                            <TableRow key={`${a.id}`}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(a.id)}
                                  onCheckedChange={() => toggleSelect(a.id)}
                                  aria-label={`Pilih ${name}`}
                                />
                              </TableCell>
                              <TableCell>{tanggal}</TableCell>
                              <TableCell>{name}</TableCell>
                              <TableCell>{displayStatus}</TableCell>
                              <TableCell>{lokasi || "-"}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button asChild variant="outline" size="icon" aria-label="Detail absensi">
                                          <Link href={`/absensi/show/${a.id}`}>
                                            <Eye />
                                          </Link>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Detail</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          aria-label="Hapus absensi"
                                          onClick={() => handleDelete(a.id, name)}
                                          disabled={deleteMutation.isPending}
                                        >
                                          <Trash2 />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Hapus</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Hidden table for PDF export with optimized columns */}
                  <div className="hidden">
                    <Table id="absensi-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Lokasi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows2.map((a) => {
                          const name = a.userProfile?.fullName ?? a.userProfile?.email ?? a.userId;
                          const tanggal = typeof a.date === "string" ? a.date : String(a.date);
                          const displayStatus = a.status === "Datang" ? "Hadir" : (a.status ?? "-");
                          const lokasi = [a.latitude, a.longitude].filter((v) => v != null).join(", ");
                          return (
                            <TableRow key={`${a.id}-pdf`}>
                              <TableCell>{tanggal}</TableCell>
                              <TableCell>{name}</TableCell>
                              <TableCell>{displayStatus}</TableCell>
                              <TableCell>{lokasi || "-"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Bottom Pagination */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
                    <span>Halaman {page} - Menampilkan {rows2.length} data</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasMore}
                        onClick={() => setPage(p => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        )}
      </Card>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Absensi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{selectedIds.size} data absensi</strong> yang dipilih?
              <br />
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending ? "Menghapus..." : "Hapus Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Absensi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data absensi untuk <strong>{deleteName}</strong>?
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
