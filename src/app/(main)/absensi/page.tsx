"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import { AbsenManualDialog } from "~/components/absen-manual-dialog";

import { useState } from "react";
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
import { Checkbox } from "~/components/ui/checkbox";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AbsensiPage() {
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>(""); // Filter kelas
  const [page, setPage] = useState<number>(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

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
    sort: "desc",
    date: date || undefined,
    query: query.trim() || undefined,
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
      setSelectedIds(new Set(rows.map((r) => r.id)));
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
    <div className="flex flex-1 flex-col gap-3 p-2 sm:p-3 md:p-4">
      <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            Daftar Absensi
          </h1>
          <p className="text-muted-foreground text-sm">
            Ringkasan absensi terbaru
          </p>
        </div>
        <div className="flex w-full flex-row justify-start gap-2 sm:w-auto sm:justify-end">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={
                bulkDeleteMutation.isPending || deleteMutation.isPending
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus ({selectedIds.size})
            </Button>
          )}
          <AbsenManualDialog />
          <DownloadExcelButton
            href={exportUrl}
            filename={`absensi${selectedClass ? `-${selectedClass}` : ""}.xlsx`}
            disabled={loading || (absences && absences.length === 0)}
          />
          <DownloadPdfButton
            tableId="absensi-table"
            filename={`absensi${selectedClass ? `-${selectedClass}` : ""}.pdf`}
            title={`Data Absensi${selectedClass ? ` Kelas ${selectedClass}` : ""}`}
            disabled={loading || (absences && absences.length === 0)}
          />
        </div>
      </div>

      <Card className="overflow-hidden p-2 sm:p-3">
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
            <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search"
                className="h-9"
              />

              <Select
                value={status || "all"}
                onValueChange={(v) => {
                  setStatus(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Status</SelectItem>
                  <SelectItem value="Hadir">Hadir</SelectItem>
                  <SelectItem value="Terlambat">Terlambat</SelectItem>
                  <SelectItem value="Pulang">Pulang</SelectItem>
                  <SelectItem value="Alpha">Alpha</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setPage(1);
                }}
                className="h-9"
              />

              <Select
                value={selectedClass || "all"}
                onValueChange={(v) => {
                  setSelectedClass(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-full">
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
            {(() => {
              const rows = absences ?? [];
              const hasMore = rows.length === limit;

              return (
                <>
                  {/* Main UI table */}
                  <div className="mb-3 w-full max-w-[calc(100vw-2rem)] overflow-x-auto sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                selectedIds.size === rows.length &&
                                rows.length > 0
                              }
                              onCheckedChange={() => toggleSelectAll(rows)}
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
                        {rows.map((a) => {
                          const name =
                            a.userProfile?.fullName ??
                            a.userProfile?.email ??
                            a.userId;
                          const tanggal =
                            typeof a.date === "string"
                              ? a.date
                              : String(a.date);
                          const lokasi = [a.latitude, a.longitude]
                            .filter((v) => v != null)
                            .join(", ");
                          const displayStatus =
                            a.status === "Datang" ? "Hadir" : (a.status ?? "-");

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
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          aria-label="Hapus absensi"
                                          onClick={() =>
                                            handleDelete(a.id, name)
                                          }
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
                        {rows.map((a) => {
                          const name =
                            a.userProfile?.fullName ??
                            a.userProfile?.email ??
                            a.userId;
                          const tanggal =
                            typeof a.date === "string"
                              ? a.date
                              : String(a.date);
                          const displayStatus =
                            a.status === "Datang" ? "Hadir" : (a.status ?? "-");
                          const lokasi = [a.latitude, a.longitude]
                            .filter((v) => v != null)
                            .join(", ");
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
                  <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Halaman {page} - Menampilkan {rows.length} data
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
              );
            })()}
          </>
        )}
      </Card>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Absensi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus{" "}
              <strong>{selectedIds.size} data absensi</strong> yang dipilih?
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
