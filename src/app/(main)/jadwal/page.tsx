"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
    Clock, Save, RotateCcw, Settings, Calendar,
    Activity, Power, PowerOff, Info, Edit, Timer
} from "lucide-react";

// Day mapping
const DAY_MAP = {
    senin: { id: 1, label: "Senin", color: "blue" },
    selasa: { id: 2, label: "Selasa", color: "green" },
    rabu: { id: 3, label: "Rabu", color: "yellow" },
    kamis: { id: 4, label: "Kamis", color: "orange" },
    jumat: { id: 5, label: "Jumat", color: "red" },
    sabtu: { id: 6, label: "Sabtu", color: "purple" },
    minggu: { id: 7, label: "Minggu", color: "gray" },
} as const;

type DayKey = keyof typeof DAY_MAP;

export default function JadwalPage() {
    const [selectedDayId, setSelectedDayId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        mulaiMasuk: "",
        selesaiMasuk: "",
        mulaiPulang: "",
        selesaiPulang: "",
        kompensasiWaktu: "",
    });

    // Queries
    const { data: schedules, isLoading: schedulesLoading, refetch: refetchSchedules } = api.jadwal.getAll.useQuery();
    const { data: stats, refetch: refetchStats } = api.jadwal.getStats.useQuery();

    // Mutations
    const updateMutation = api.jadwal.update.useMutation({
        onSuccess: () => {
            toast.success("Jadwal berhasil diupdate!");
            void refetchSchedules();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal update jadwal: ${error.message}`);
        },
    });

    const toggleActiveMutation = api.jadwal.toggleActive.useMutation({
        onSuccess: (data) => {
            toast.success(`Jadwal ${data?.isActive ? 'diaktifkan' : 'dinonaktifkan'}!`);
            void refetchSchedules();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal mengubah status: ${error.message}`);
        },
    });

    const resetMutation = api.jadwal.reset.useMutation({
        onSuccess: () => {
            toast.success("Jadwal berhasil direset ke nilai default!");
            setSelectedDayId(null);
            void refetchSchedules();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal mereset jadwal: ${error.message}`);
        },
    });

    // Load selected day data
    useEffect(() => {
        if (selectedDayId && schedules) {
            const schedule = schedules.find(s => s.id === selectedDayId);
            if (schedule) {
                setFormData({
                    mulaiMasuk: schedule.mulaiMasuk.slice(0, 5), // HH:MM
                    selesaiMasuk: schedule.selesaiMasuk.slice(0, 5),
                    mulaiPulang: schedule.mulaiPulang.slice(0, 5),
                    selesaiPulang: schedule.selesaiPulang.slice(0, 5),
                    kompensasiWaktu: schedule.kompensasiWaktu.toString(),
                });
            }
        } else if (selectedDayId === null) {
            setFormData({
                mulaiMasuk: "",
                selesaiMasuk: "",
                mulaiPulang: "",
                selesaiPulang: "",
                kompensasiWaktu: "",
            });
        }
    }, [selectedDayId, schedules]);

    const handleInputChange = useCallback((field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDayId) {
            toast.error("Pilih hari terlebih dahulu");
            return;
        }

        // Validation
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(formData.mulaiMasuk)) {
            toast.error("Format Mulai Masuk harus HH:MM (contoh: 06:30)");
            return;
        }
        if (!timeRegex.test(formData.selesaiMasuk)) {
            toast.error("Format Selesai Masuk harus HH:MM");
            return;
        }
        if (!timeRegex.test(formData.mulaiPulang)) {
            toast.error("Format Mulai Pulang harus HH:MM");
            return;
        }
        if (!timeRegex.test(formData.selesaiPulang)) {
            toast.error("Format Selesai Pulang harus HH:MM");
            return;
        }

        const kompensasi = parseInt(formData.kompensasiWaktu);
        if (isNaN(kompensasi) || kompensasi < 0 || kompensasi > 120) {
            toast.error("Kompensasi waktu harus antara 0-120 menit");
            return;
        }

        updateMutation.mutate({
            id: selectedDayId,
            data: {
                mulaiMasuk: formData.mulaiMasuk + ":00",
                selesaiMasuk: formData.selesaiMasuk + ":00",
                mulaiPulang: formData.mulaiPulang + ":00",
                selesaiPulang: formData.selesaiPulang + ":00",
                kompensasiWaktu: kompensasi,
            },
        });
    };

    const handleToggleActive = (id: number) => {
        toggleActiveMutation.mutate({ id });
    };

    const handleReset = () => {
        if (confirm("Apakah Anda yakin ingin mereset semua jadwal ke nilai default?")) {
            resetMutation.mutate();
        }
    };

    const isLoading = schedulesLoading;

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <div className="space-y-2">
                    <div className="h-8 bg-muted rounded animate-pulse"></div>
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <div className="h-6 bg-muted rounded animate-pulse"></div>
                            <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="h-4 bg-muted rounded animate-pulse"></div>
                                <div className="h-10 bg-muted rounded animate-pulse"></div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <Calendar className="h-7 w-7 text-primary" />
                            </div>
                            Konfigurasi Jadwal Absensi
                        </h1>
                        <p className="text-muted-foreground">
                            Kelola jadwal absensi harian untuk sistem kehadiran sekolah
                        </p>
                    </div>
                </div>

                {/* Statistics Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <Calendar className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="text-sm font-medium">Total Hari</p>
                                        <p className="text-2xl font-bold">{stats.total}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <Activity className="h-5 w-5 text-green-600" />
                                    <div>
                                        <p className="text-sm font-medium">Hari Aktif</p>
                                        <p className="text-2xl font-bold">{stats.active}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <PowerOff className="h-5 w-5 text-orange-600" />
                                    <div>
                                        <p className="text-sm font-medium">Hari Libur</p>
                                        <p className="text-2xl font-bold">{stats.inactive}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <Timer className="h-5 w-5 text-purple-600" />
                                    <div>
                                        <p className="text-sm font-medium">Rata-rata Kompensasi</p>
                                        <p className="text-2xl font-bold">{stats.avgKompensasi} menit</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Schedule Table */}
                {schedules && schedules.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Daftar Jadwal Mingguan
                            </CardTitle>
                            <CardDescription>
                                Kelola jadwal absensi untuk setiap hari dalam seminggu
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Hari</TableHead>
                                            <TableHead>Waktu Masuk</TableHead>
                                            <TableHead>Waktu Pulang</TableHead>
                                            <TableHead>Kompensasi</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {schedules.map((schedule) => {
                                            const dayInfo = DAY_MAP[schedule.hari as DayKey];
                                            return (
                                                <TableRow key={schedule.id}>
                                                    <TableCell>
                                                        <div className="flex items-center space-x-2">
                                                            <Badge variant="outline">#{schedule.id}</Badge>
                                                            <span className="font-medium">{dayInfo.label}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            <div className="font-medium">
                                                                {schedule.mulaiMasuk.slice(0, 5)} - {schedule.selesaiMasuk.slice(0, 5)}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            <div className="font-medium">
                                                                {schedule.mulaiPulang.slice(0, 5)} - {schedule.selesaiPulang.slice(0, 5)}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary">
                                                            +{schedule.kompensasiWaktu} menit
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center space-x-2">
                                                            <Switch
                                                                checked={schedule.isActive}
                                                                onCheckedChange={() => handleToggleActive(schedule.id)}
                                                                disabled={toggleActiveMutation.isPending}
                                                            />
                                                            <Badge
                                                                variant={schedule.isActive ? "default" : "secondary"}
                                                                className="flex items-center gap-1"
                                                            >
                                                                {schedule.isActive ? (
                                                                    <>
                                                                        <Power className="h-3 w-3" />
                                                                        Aktif
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <PowerOff className="h-3 w-3" />
                                                                        Nonaktif
                                                                    </>
                                                                )}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setSelectedDayId(schedule.id)}
                                                        >
                                                            <Edit className="h-3 w-3 mr-1" />
                                                            Edit
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Edit Form */}
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Settings className="h-5 w-5" />
                        <span>
                            {selectedDayId
                                ? `Edit Jadwal - ${DAY_MAP[schedules?.find(s => s.id === selectedDayId)?.hari as DayKey]?.label ?? ""}`
                                : "Edit Jadwal Absensi"
                            }
                        </span>
                    </CardTitle>
                    <CardDescription>
                        {selectedDayId
                            ? "Ubah pengaturan jadwal untuk hari yang dipilih"
                            : "Pilih hari dari tabel di atas untuk mengedit jadwal"
                        }
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Form Fields in Grid Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                            {/* Mulai Masuk */}
                            <div className="space-y-2">
                                <Label htmlFor="mulaiMasuk" className="flex items-center gap-2 text-sm font-medium">
                                    <Clock className="h-4 w-4" />
                                    Mulai Masuk *
                                </Label>
                                <Input
                                    id="mulaiMasuk"
                                    type="time"
                                    value={formData.mulaiMasuk}
                                    onChange={(e) => handleInputChange("mulaiMasuk", e.target.value)}
                                    required
                                    disabled={!selectedDayId}
                                    className="w-full"
                                />
                            </div>

                            {/* Selesai Masuk */}
                            <div className="space-y-2">
                                <Label htmlFor="selesaiMasuk" className="flex items-center gap-2 text-sm font-medium">
                                    <Clock className="h-4 w-4" />
                                    Selesai Masuk *
                                </Label>
                                <Input
                                    id="selesaiMasuk"
                                    type="time"
                                    value={formData.selesaiMasuk}
                                    onChange={(e) => handleInputChange("selesaiMasuk", e.target.value)}
                                    required
                                    disabled={!selectedDayId}
                                    className="w-full"
                                />
                            </div>

                            {/* Mulai Pulang */}
                            <div className="space-y-2">
                                <Label htmlFor="mulaiPulang" className="flex items-center gap-2 text-sm font-medium">
                                    <Clock className="h-4 w-4" />
                                    Mulai Pulang *
                                </Label>
                                <Input
                                    id="mulaiPulang"
                                    type="time"
                                    value={formData.mulaiPulang}
                                    onChange={(e) => handleInputChange("mulaiPulang", e.target.value)}
                                    required
                                    disabled={!selectedDayId}
                                    className="w-full"
                                />
                            </div>

                            {/* Selesai Pulang */}
                            <div className="space-y-2">
                                <Label htmlFor="selesaiPulang" className="flex items-center gap-2 text-sm font-medium">
                                    <Clock className="h-4 w-4" />
                                    Selesai Pulang *
                                </Label>
                                <Input
                                    id="selesaiPulang"
                                    type="time"
                                    value={formData.selesaiPulang}
                                    onChange={(e) => handleInputChange("selesaiPulang", e.target.value)}
                                    required
                                    disabled={!selectedDayId}
                                    className="w-full"
                                />
                            </div>

                            {/* Kompensasi Waktu */}
                            <div className="space-y-2">
                                <Label htmlFor="kompensasiWaktu" className="flex items-center gap-2 text-sm font-medium">
                                    <Timer className="h-4 w-4" />
                                    Kompensasi (menit) *
                                </Label>
                                <Input
                                    id="kompensasiWaktu"
                                    type="number"
                                    min="0"
                                    max="120"
                                    value={formData.kompensasiWaktu}
                                    onChange={(e) => handleInputChange("kompensasiWaktu", e.target.value)}
                                    required
                                    disabled={!selectedDayId}
                                    className="w-full"
                                    placeholder="15"
                                />
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium opacity-0">Actions</Label>
                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        disabled={!selectedDayId || updateMutation.isPending}
                                        size="sm"
                                    >
                                        <Save className="mr-1 h-3 w-3" />
                                        {updateMutation.isPending ? "Saving..." : "Simpan"}
                                    </Button>
                                    {selectedDayId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedDayId(null)}
                                        >
                                            Batal
                                        </Button>
                                    )}
                                    {!selectedDayId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleReset}
                                            disabled={resetMutation.isPending}
                                        >
                                            <RotateCcw className="mr-1 h-3 w-3" />
                                            Reset All
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Helper Text */}
                        <p className="text-xs text-muted-foreground">
                            <strong>Kompensasi Waktu:</strong> Toleransi keterlambatan dalam menit (0-120 menit).
                            Waktu dalam format 24 jam (HH:MM).
                        </p>
                    </form>

                    {/* Info Alert */}
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Tips:</strong> Pilih hari dari tabel di atas untuk mengedit jadwalnya.
                            Matikan status aktif untuk hari libur. Kompensasi waktu akan ditambahkan ke batas akhir waktu absen.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
