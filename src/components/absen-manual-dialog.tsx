"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { UserPlus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";

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
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );
  const [isCheckingNis, setIsCheckingNis] = useState(false);

  const utils = api.useUtils();

  // Query untuk cek siswa by NIS
  const { refetch: refetchSiswa } = api.biodataSiswa.getByNis.useQuery(
    { nis: nis || "0" },
    { enabled: false },
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
      setDate(new Date().toISOString().split("T")[0] ?? "");
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

    createAbsence.mutate({
      nis: nis,
      status: status,
      date: date,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setNis("");
      setSiswaData(null);
      setStatus(undefined);
      setDate(new Date().toISOString().split("T")[0] ?? "");
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
                onChange={(e) => setNis(e.target.value)}
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
                  value={status}
                  onValueChange={(
                    v: "Hadir" | "Terlambat" | "Pulang" | "Dipulangkan",
                  ) => setStatus(v)}
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
                  onChange={(e) => setDate(e.target.value)}
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
                  disabled={createAbsence.isPending || !status}
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
