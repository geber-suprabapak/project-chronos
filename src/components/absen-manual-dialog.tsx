"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { UserPlus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { schoolDate } from "~/lib/date-utils";

interface AbsenManualDialogProps {
  trigger?: React.ReactNode;
}

export function AbsenManualDialog({ trigger }: AbsenManualDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [nis, setNis] = useState("");
  const [siswaData, setSiswaData] = useState<{
    nis: string;
    nama: string | null;
    kelas: string | null;
    absen: number | null;
  } | null>(null);
  const [status, setStatus] = useState<
    "Hadir" | "Terlambat" | "Pulang" | "Dipulangkan" | undefined
  >(undefined);
  // Default ke tanggal sekolah WIB, bukan tanggal UTC dari jam browser.
  const [date, setDate] = useState(() => schoolDate());
  const [reason, setReason] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [isCheckingNis, setIsCheckingNis] = useState(false);

  const utils = api.useUtils();

  // Query untuk cek siswa by NIS
  const { refetch: refetchSiswa } = api.biodataSiswa.getByNis.useQuery(
    { nis: nis || "0" },
    { enabled: false },
  );

  const attemptsQuery = api.absences.listManualAttempts.useQuery(
    {
      nis,
      actionType:
        status === "Pulang" || status === "Dipulangkan"
          ? "check_out"
          : "check_in",
      date,
    },
    { enabled: open && Boolean(siswaData && status && date) },
  );

  // Auto-check NIS saat mengetik (debounced)
  useEffect(() => {
    if (!nis || nis.length < 3) {
      setSiswaData(null);
      setIsCheckingNis(false);
      return;
    }

    setIsCheckingNis(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await refetchSiswa();
          if (result.data) {
            setSiswaData(result.data);
          } else {
            setSiswaData(null);
          }
        } catch {
          setSiswaData(null);
        } finally {
          setIsCheckingNis(false);
        }
      })();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [nis, refetchSiswa]);

  // Mutation untuk create absensi
  const createAbsence = api.absences.createManual.useMutation({
    onSuccess: async () => {
      toast.success("Absensi berhasil ditambahkan!");

      // Invalidate queries untuk refresh data
      await Promise.all([
        utils.absences.list.invalidate(),
        utils.absences.listRaw.invalidate(),
      ]);

      // Reset form
      setNis("");
      setSiswaData(null);
      setStatus(undefined);
      setDate(schoolDate());
      setReason("");
      setAttemptId("");
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Gagal menambahkan absensi: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!siswaData) {
      toast.error("Cek NIS siswa terlebih dahulu");
      return;
    }

    if (!status) {
      toast.error("Pilih status absensi");
      return;
    }

    if (!date) {
      toast.error("Pilih tanggal absensi");
      return;
    }

    if (reason.trim().length < 3) {
      toast.error("Isi alasan manual minimal 3 karakter");
      return;
    }

    if (!attemptId) {
      toast.error("Pilih percobaan presensi terkait");
      return;
    }

    createAbsence.mutate({
      nis: nis,
      status: status,
      date: date,
      reason: reason.trim(),
      attemptId,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setNis("");
      setSiswaData(null);
      setStatus(undefined);
      setDate(schoolDate());
      setReason("");
      setAttemptId("");
      setIsCheckingNis(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="success" size="default">
            <UserPlus />
            Absen Manual
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus />
            Absen Manual
          </DialogTitle>
          <DialogDescription className="sr-only">
            Formulir pencatatan absensi siswa secara manual
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* NIS Input */}
          <div className="space-y-2">
            <Label htmlFor="nis">NIS Siswa</Label>
            <div className="relative">
              <Input
                id="nis"
                type="text"
                placeholder="Masukkan NIS (min 3 digit)"
                value={nis}
                onChange={(e) => {
                  setNis(e.target.value);
                  setSiswaData(null);
                  setStatus(undefined);
                  setAttemptId("");
                }}
                disabled={createAbsence.isPending}
                className="pr-10"
              />
              {isCheckingNis && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {nis.length > 0 && nis.length < 3 && (
              <p className="text-xs text-muted-foreground">
                Minimal 3 digit untuk pengecekan otomatis
              </p>
            )}
          </div>

          {/* Siswa Info Alert */}
          {siswaData && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                <div className="font-semibold">
                  {siswaData.nama ?? "Nama tidak tersedia"}
                </div>
                <div className="text-sm">
                  Kelas {siswaData.kelas ?? "-"} • Absen #
                  {siswaData.absen ?? "-"}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {nis.length >= 5 && !isCheckingNis && !siswaData && (
            <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
              <AlertCircle className="text-red-600" />
              <AlertDescription className="text-red-700 dark:text-red-400">
                NIS tidak ditemukan. Cek kembali NIS yang dimasukkan.
              </AlertDescription>
            </Alert>
          )}

          {/* Status Selection - Only show if siswa found */}
          {siswaData && (
            <>
              <div className="space-y-2">
                <Label htmlFor="status">Status Absensi</Label>
                <Select
                  value={status ?? ""}
                  onValueChange={(
                    v: "Hadir" | "Terlambat" | "Pulang" | "Dipulangkan",
                  ) => {
                    setStatus(v);
                    setAttemptId("");
                  }}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hadir">Hadir</SelectItem>
                    <SelectItem value="Terlambat">Terlambat</SelectItem>
                    <SelectItem value="Pulang">Pulang</SelectItem>
                    <SelectItem value="Dipulangkan">Dipulangkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Tanggal</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setAttemptId("");
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="attendance-attempt">
                  Percobaan Presensi Terkait
                </Label>
                <Select value={attemptId} onValueChange={setAttemptId}>
                  <SelectTrigger id="attendance-attempt">
                    <SelectValue placeholder="Pilih percobaan presensi" />
                  </SelectTrigger>
                  <SelectContent>
                    {(attemptsQuery.data ?? []).map((attempt) => (
                      <SelectItem key={attempt.id} value={attempt.id}>
                        {`${attempt.status === "failed" ? "Gagal" : attempt.status === "error" ? "Gangguan" : "Berhasil"} · ${new Date(attempt.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} · ${(attempt.reason ?? "Tanpa keterangan").slice(0, 80)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {attemptsQuery.isLoading && (
                  <p className="text-xs text-muted-foreground">
                    Memuat percobaan presensi…
                  </p>
                )}
                {attemptsQuery.isError && (
                  <p role="alert" className="text-xs text-destructive">
                    Percobaan presensi gagal dimuat.{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={() => void attemptsQuery.refetch()}
                    >
                      Coba lagi
                    </button>
                  </p>
                )}
                {!attemptsQuery.isLoading &&
                  !attemptsQuery.isError &&
                  attemptsQuery.data?.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada percobaan gagal atau gangguan untuk aksi ini
                      pada tanggal WIB yang dipilih.
                    </p>
                  )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-attendance-reason">Alasan</Label>
                <Textarea
                  id="manual-attendance-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={500}
                  required
                  disabled={createAbsence.isPending}
                />
              </div>

              {/* Submit Button */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                  disabled={createAbsence.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  className="flex-1"
                  disabled={
                    createAbsence.isPending ||
                    !status ||
                    reason.trim().length < 3 ||
                    !attemptId ||
                    attemptsQuery.isError
                  }
                >
                  {createAbsence.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    "Simpan Absensi"
                  )}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
