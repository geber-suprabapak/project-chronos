"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import {
    MapPin, Save, RotateCcw, Settings, Globe, Target,
    Database, Plus, Edit, Trash2, Building2,
    Activity, BarChart3, Power, PowerOff, Info
} from "lucide-react";
import LocationPicker from "~/components/location-picker";

export default function ConfigurationPage() {
    const [formData, setFormData] = useState({
        name: "",
        latitude: "",
        longitude: "",
        distance: "",
    });
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        id: "",
        name: "",
        latitude: "",
        longitude: "",
        distance: "",
    });

    // Queries
    const { data: locations, isLoading: locationsLoading, refetch: refetchLocations } = api.location.getAll.useQuery();
    const { refetch: refetchActive } = api.location.getActive.useQuery();
    const { data: stats, refetch: refetchStats } = api.location.getStats.useQuery();

    // Mutations
    const upsertMutation = api.location.upsert.useMutation({
        onSuccess: () => {
            toast.success("Konfigurasi lokasi berhasil disimpan!");
            void refetchLocations();
            void refetchActive();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal menyimpan konfigurasi: ${error.message}`);
        },
    });

    const createMutation = api.location.create.useMutation({
        onSuccess: () => {
            toast.success("Lokasi baru berhasil dibuat!");
            setIsCreateDialogOpen(false);
            setCreateForm({ id: "", name: "", latitude: "", longitude: "", distance: "" });
            void refetchLocations();
            void refetchActive();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal membuat lokasi: ${error.message}`);
        },
    });

    const updateMutation = api.location.updateById.useMutation({
        onSuccess: () => {
            toast.success("Lokasi berhasil diupdate!");
            void refetchLocations();
            void refetchActive();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal update lokasi: ${error.message}`);
        },
    });

    const toggleActiveMutation = api.location.toggleActive.useMutation({
        onSuccess: (data) => {
            toast.success(`Lokasi ${data?.isActive ? 'diaktifkan' : 'dinonaktifkan'}!`);
            void refetchLocations();
            void refetchActive();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal mengubah status: ${error.message}`);
        },
    });

    const deleteMutation = api.location.delete.useMutation({
        onSuccess: () => {
            toast.success("Lokasi berhasil dihapus!");
            if (selectedLocationId) {
                setSelectedLocationId(null);
            }
            void refetchLocations();
            void refetchActive();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal menghapus lokasi: ${error.message}`);
        },
    });

    const resetMutation = api.location.reset.useMutation({
        onSuccess: (data) => {
            toast.success("Konfigurasi berhasil direset ke nilai default!");
            if (data) {
                setFormData({
                    name: data.name,
                    latitude: data.latitude.toString(),
                    longitude: data.longitude.toString(),
                    distance: data.distance.toString(),
                });
            }
            setSelectedLocationId(null);
            void refetchLocations();
            void refetchActive();
            void refetchStats();
        },
        onError: (error) => {
            toast.error(`Gagal mereset konfigurasi: ${error.message}`);
        },
    });

    // Load selected location data
    useEffect(() => {
        if (selectedLocationId && locations) {
            const location = locations.find(loc => loc.id === selectedLocationId);
            if (location) {
                setFormData({
                    name: location.name,
                    latitude: location.latitude.toString(),
                    longitude: location.longitude.toString(),
                    distance: location.distance.toString(),
                });
            }
        } else if (selectedLocationId === null) {
            // Reset form when no location selected
            setFormData({
                name: "",
                latitude: "",
                longitude: "",
                distance: "",
            });
        }
    }, [selectedLocationId, locations]);

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLocationChange = (lat: number, lng: number) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat.toString(),
            longitude: lng.toString(),
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const name = formData.name.trim();
        const latitude = parseFloat(formData.latitude);
        const longitude = parseFloat(formData.longitude);
        const distance = parseInt(formData.distance);

        // Validation
        if (!name) {
            toast.error("Nama lokasi harus diisi");
            return;
        }

        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
            toast.error("Latitude harus berupa angka antara -90 dan 90");
            return;
        }

        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
            toast.error("Longitude harus berupa angka antara -180 dan 180");
            return;
        }

        if (isNaN(distance) || distance < 1 || distance > 10000) {
            toast.error("Jarak harus berupa angka antara 1 dan 10000 meter");
            return;
        }

        const payload = {
            name,
            latitude,
            longitude,
            distance,
        };

        if (selectedLocationId) {
            // Update existing location
            updateMutation.mutate({
                id: selectedLocationId,
                data: payload,
            });
        } else {
            // Upsert primary location
            upsertMutation.mutate(payload);
        }
    };

    const handleCreate = () => {
        const id = parseInt(createForm.id);
        const name = createForm.name.trim();
        const latitude = parseFloat(createForm.latitude);
        const longitude = parseFloat(createForm.longitude);
        const distance = parseInt(createForm.distance);

        // Validation
        if (isNaN(id) || id < 1) {
            toast.error("ID harus berupa angka positif");
            return;
        }

        if (!name) {
            toast.error("Nama lokasi harus diisi");
            return;
        }

        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
            toast.error("Latitude harus berupa angka antara -90 dan 90");
            return;
        }

        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
            toast.error("Longitude harus berupa angka antara -180 dan 180");
            return;
        }

        if (isNaN(distance) || distance < 1 || distance > 10000) {
            toast.error("Jarak harus berupa angka antara 1 dan 10000 meter");
            return;
        }

        createMutation.mutate({
            id,
            name,
            latitude,
            longitude,
            distance,
            isActive: true,
        });
    };

    const handleToggleActive = (id: number) => {
        toggleActiveMutation.mutate({ id });
    };

    const handleDelete = (id: number, name: string) => {
        if (confirm(`Apakah Anda yakin ingin menghapus lokasi "${name}"?`)) {
            deleteMutation.mutate({ id });
        }
    };

    const handleReset = () => {
        if (confirm("Apakah Anda yakin ingin mereset konfigurasi ke nilai default?")) {
            resetMutation.mutate();
        }
    };

    const isLoading = locationsLoading;

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
                    <Card>
                        <CardContent className="p-0">
                            <div className="h-96 bg-muted rounded animate-pulse"></div>
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
                                <Settings className="h-7 w-7 text-primary" />
                            </div>
                            Manajemen Lokasi Absensi
                        </h1>
                        <p className="text-muted-foreground">
                            Kelola beberapa lokasi untuk sistem absensi dengan kontrol status aktif/nonaktif
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Tambah Lokasi
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="flex items-center space-x-2">
                                        <MapPin className="h-5 w-5 text-primary" />
                                        <span>Buat Lokasi Baru</span>
                                    </DialogTitle>
                                    <DialogDescription>
                                        Tambahkan lokasi baru untuk sistem absensi.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="create-id" className="text-right">
                                            ID *
                                        </Label>
                                        <Input
                                            id="create-id"
                                            type="number"
                                            value={createForm.id}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, id: e.target.value }))}
                                            className="col-span-3"
                                            placeholder="Masukkan ID unik"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="create-name" className="text-right">
                                            Nama *
                                        </Label>
                                        <Input
                                            id="create-name"
                                            value={createForm.name}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                                            className="col-span-3"
                                            placeholder="Nama lokasi"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="create-latitude" className="text-right">
                                            Latitude *
                                        </Label>
                                        <Input
                                            id="create-latitude"
                                            type="number"
                                            step="any"
                                            value={createForm.latitude}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, latitude: e.target.value }))}
                                            className="col-span-3"
                                            placeholder="-7.4503"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="create-longitude" className="text-right">
                                            Longitude *
                                        </Label>
                                        <Input
                                            id="create-longitude"
                                            type="number"
                                            step="any"
                                            value={createForm.longitude}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, longitude: e.target.value }))}
                                            className="col-span-3"
                                            placeholder="110.2241"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="create-distance" className="text-right">
                                            Radius (m) *
                                        </Label>
                                        <Input
                                            id="create-distance"
                                            type="number"
                                            value={createForm.distance}
                                            onChange={(e) => setCreateForm(prev => ({ ...prev, distance: e.target.value }))}
                                            className="col-span-3"
                                            placeholder="500"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsCreateDialogOpen(false)}
                                    >
                                        Batal
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleCreate}
                                        disabled={createMutation.isPending}
                                    >
                                        {createMutation.isPending ? "Membuat..." : "Buat Lokasi"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Button variant="outline" asChild>
                            <a href="/konfigurasi/management">
                                <Database className="mr-2 h-4 w-4" />
                                Data Management
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Statistics Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                    <div>
                                        <p className="text-sm font-medium">Total Lokasi</p>
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
                                        <p className="text-sm font-medium">Lokasi Aktif</p>
                                        <p className="text-2xl font-bold">{stats.active}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <Target className="h-5 w-5 text-orange-600" />
                                    <div>
                                        <p className="text-sm font-medium">Rata-rata Radius</p>
                                        <p className="text-2xl font-bold">
                                            {Math.round(stats.avgDistance || 0)}m
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4">
                                <div className="flex items-center space-x-2">
                                    <BarChart3 className="h-5 w-5 text-purple-600" />
                                    <div>
                                        <p className="text-sm font-medium">Max Radius</p>
                                        <p className="text-2xl font-bold">
                                            {stats.maxDistance || 0}m
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Location List */}
                {locations && locations.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Globe className="h-5 w-5" />
                                Daftar Lokasi
                            </CardTitle>
                            <CardDescription>
                                Kelola semua lokasi dan status aktif/nonaktif mereka
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama Lokasi</TableHead>
                                            <TableHead>Koordinat</TableHead>
                                            <TableHead>Radius</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {locations.map((location) => (
                                            <TableRow key={location.id}>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Badge variant="outline">#{location.id}</Badge>
                                                        <span className="font-medium">{location.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm text-muted-foreground font-mono">
                                                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">{location.distance}m</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center space-x-2">
                                                        <Switch
                                                            checked={location.isActive}
                                                            onCheckedChange={() => handleToggleActive(location.id)}
                                                            disabled={toggleActiveMutation.isPending}
                                                        />
                                                        <Badge
                                                            variant={location.isActive ? "default" : "secondary"}
                                                            className="flex items-center gap-1"
                                                        >
                                                            {location.isActive ? (
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
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setSelectedLocationId(location.id)}
                                                        >
                                                            <Edit className="h-3 w-3 mr-1" />
                                                            Edit
                                                        </Button>
                                                        {location.id !== 1 && (
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleDelete(location.id, location.name)}
                                                                disabled={deleteMutation.isPending}
                                                            >
                                                                <Trash2 className="h-3 w-3 mr-1" />
                                                                Hapus
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Main Content - Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Settings className="h-5 w-5" />
                            <span>
                                {selectedLocationId ? `Edit Lokasi #${selectedLocationId}` : "Buat/Edit Lokasi Utama"}
                            </span>
                        </CardTitle>
                        <CardDescription>
                            {selectedLocationId
                                ? "Ubah pengaturan lokasi yang dipilih"
                                : "Tentukan atau edit lokasi utama sistem absensi (ID #1)"
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Location Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Nama Lokasi *
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Contoh: Kantor Pusat, Cabang Jakarta, dll"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                    required
                                />
                            </div>

                            {/* Coordinates */}
                            <div className="space-y-4">
                                <h4 className="font-medium flex items-center gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Koordinat Lokasi
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="latitude">Latitude *</Label>
                                        <Input
                                            id="latitude"
                                            type="number"
                                            step="any"
                                            placeholder="Contoh: -7.4503"
                                            value={formData.latitude}
                                            onChange={(e) => handleInputChange("latitude", e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="longitude">Longitude *</Label>
                                        <Input
                                            id="longitude"
                                            type="number"
                                            step="any"
                                            placeholder="Contoh: 110.2241"
                                            value={formData.longitude}
                                            onChange={(e) => handleInputChange("longitude", e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="distance" className="flex items-center gap-2">
                                        <Target className="h-4 w-4" />
                                        Radius Toleransi (meter) *
                                    </Label>
                                    <Input
                                        id="distance"
                                        type="number"
                                        min="1"
                                        max="10000"
                                        placeholder="Contoh: 500"
                                        value={formData.distance}
                                        onChange={(e) => handleInputChange("distance", e.target.value)}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Jarak maksimal yang diizinkan untuk melakukan absensi (1-10000 meter)
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <Button
                                    type="submit"
                                    disabled={upsertMutation.isPending || updateMutation.isPending}
                                    className="flex-1"
                                >
                                    <Save className="mr-2 h-4 w-4" />
                                    {(upsertMutation.isPending || updateMutation.isPending)
                                        ? "Menyimpan..."
                                        : selectedLocationId ? "Update Lokasi" : "Simpan Lokasi Utama"
                                    }
                                </Button>
                                {selectedLocationId && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setSelectedLocationId(null)}
                                    >
                                        Batal
                                    </Button>
                                )}
                                {!selectedLocationId && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleReset}
                                        disabled={resetMutation.isPending}
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        {resetMutation.isPending ? "Mereset..." : "Reset"}
                                    </Button>
                                )}
                            </div>
                        </form>

                        {/* Info Alert */}
                        <Alert className="mt-4">
                            <Info className="h-4 w-4" />
                            <AlertDescription>
                                <strong>Tips:</strong> Pilih lokasi dari tabel di atas untuk mengedit, atau biarkan kosong untuk membuat/edit lokasi utama.
                                Lokasi yang aktif akan digunakan untuk validasi absensi.
                            </AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>

                {/* Location Picker */}
                <LocationPicker
                    latitude={formData.latitude ? parseFloat(formData.latitude) : null}
                    longitude={formData.longitude ? parseFloat(formData.longitude) : null}
                    distance={formData.distance ? parseInt(formData.distance) : 500}
                    onLocationChange={handleLocationChange}
                />
            </div>
        </div>
    );
}
