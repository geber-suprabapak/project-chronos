"use client";

import * as React from "react";
import { useState } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { UserPlus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";

export function AbsenManualDialog() {
    const [open, setOpen] = useState(false);
    const [nis, setNis] = useState("");
    const [siswaData, setSiswaData] = useState<{
        nis: string;
        nama: string | null;
        kelas: string | null;
        absen: number | null;
    } | null>(null);
    const [status, setStatus] = useState<string>("");
    const [reason, setReason] = useState("");
    const [lateMinutes, setLateMinutes] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0] ?? "");

    // Query untuk cek siswa by NIS
    const { isLoading: siswaLoading, refetch: refetchSiswa } =
        api.biodataSiswa.getByNis.useQuery({ nis: nis || "0" }, { enabled: false });

    // Mutation untuk create absensi
    const createAbsence = api.absences.createManual.useMutation({
        onSuccess: () => {
            toast.success("Absensi berhasil ditambahkan!");
            // Reset form
            setNis("");
            setSiswaData(null);
            setStatus("");
            setReason("");
            setLateMinutes("");
            setDate(new Date().toISOString().split("T")[0] ?? "");
            setOpen(false);
        },
        onError: (error) => {
            toast.error(`Gagal menambahkan absensi: ${error.message}`);
        },
    });

    const handleCheckNis = async () => {
        if (!nis || nis.length < 5) {
            toast.error("Masukkan NIS yang valid (minimal 5 digit)");
            return;
        }

        const result = await refetchSiswa();
        if (result.data) {
            setSiswaData(result.data);
            toast.success("Siswa ditemukan!");
        } else {
            setSiswaData(null);
            toast.error("NIS tidak ditemukan");
        }
    };

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

        // Validasi untuk status terlambat
        if (status === "Terlambat" && !lateMinutes) {
            toast.error("Masukkan berapa menit terlambat");
            return;
        }

        createAbsence.mutate({
            nis: nis,
            status: status as "Hadir" | "Terlambat" | "Sakit" | "Izin" | "Alfa" | "Pulang",
            date: date,
            reason: reason || undefined,
            lateMinutes: status === "Terlambat" ? parseInt(lateMinutes) : undefined,
        });
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            // Reset form when closing
            setNis("");
            setSiswaData(null);
            setStatus("");
            setReason("");
            setLateMinutes("");
            setDate(new Date().toISOString().split("T")[0] ?? "");
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Absen Manual
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Absen Manual
                    </DialogTitle>
                    <DialogDescription>
                        Input absensi siswa secara manual oleh admin
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* NIS Input */}
                    <div className="space-y-2">
                        <Label htmlFor="nis">NIS Siswa</Label>
                        <div className="flex gap-2">
                            <Input
                                id="nis"
                                type="text"
                                placeholder="Masukkan NIS"
                                value={nis}
                                onChange={(e) => setNis(e.target.value)}
                                disabled={siswaLoading || createAbsence.isPending}
                            />
                            <Button
                                type="button"
                                onClick={handleCheckNis}
                                disabled={siswaLoading || !nis || createAbsence.isPending}
                            >
                                {siswaLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Cek"
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Siswa Info Alert */}
                    {siswaData && (
                        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-700 dark:text-green-400">
                                <div className="font-semibold">{siswaData.nama ?? "Nama tidak tersedia"}</div>
                                <div className="text-sm">
                                    Kelas {siswaData.kelas ?? "-"} • Absen #{siswaData.absen ?? "-"}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {nis && !siswaLoading && !siswaData && (
                        <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
                            <AlertCircle className="h-4 w-4 text-red-600" />
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
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger id="status">
                                        <SelectValue placeholder="Pilih status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Hadir">✅ Hadir</SelectItem>
                                        <SelectItem value="Terlambat">⏰ Terlambat</SelectItem>
                                        <SelectItem value="Pulang">👋 Pulang</SelectItem>
                                        <SelectItem value="Sakit">💊 Sakit</SelectItem>
                                        <SelectItem value="Izin">📝 Izin</SelectItem>
                                        <SelectItem value="Alfa">⭕ Alfa</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Late Minutes - Only show if Terlambat */}
                            {status === "Terlambat" && (
                                <div className="space-y-2">
                                    <Label htmlFor="lateMinutes">Berapa Menit Terlambat?</Label>
                                    <Input
                                        id="lateMinutes"
                                        type="number"
                                        min="1"
                                        max="120"
                                        placeholder="Contoh: 15"
                                        value={lateMinutes}
                                        onChange={(e) => setLateMinutes(e.target.value)}
                                    />
                                </div>
                            )}

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

                            {/* Reason */}
                            <div className="space-y-2">
                                <Label htmlFor="reason">
                                    Keterangan <span className="text-muted-foreground">(Opsional)</span>
                                </Label>
                                <Textarea
                                    id="reason"
                                    placeholder="Contoh: Siswa terlambat karena macet"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
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
                                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                                    disabled={createAbsence.isPending || !status}
                                >
                                    {createAbsence.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
