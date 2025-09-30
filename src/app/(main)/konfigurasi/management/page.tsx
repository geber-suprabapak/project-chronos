"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Edit, Plus, Trash2, Save, Database, MapPin, Navigation, Target, Info, Settings2, Zap } from "lucide-react";

type ConfigurationRow = {
    id: number;
    latitude: number;
    longitude: number;
    distance: number;
};

export default function ConfigurationManagementPage() {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({
        latitude: "",
        longitude: "",
        distance: "",
    });
    const [createForm, setCreateForm] = useState({
        id: "",
        latitude: "",
        longitude: "",
        distance: "",
    });
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    // Queries
    const { data: configurations, isLoading, refetch } = api.configuration.getAll.useQuery();

    // Mutations
    const updateMutation = api.configuration.updateById.useMutation({
        onSuccess: () => {
            toast.success("Konfigurasi berhasil diupdate!");
            setEditingId(null);
            void refetch();
        },
        onError: (error) => {
            toast.error(`Gagal update konfigurasi: ${error.message}`);
        },
    });

    const createMutation = api.configuration.create.useMutation({
        onSuccess: () => {
            toast.success("Konfigurasi baru berhasil dibuat!");
            setIsCreateDialogOpen(false);
            setCreateForm({ id: "", latitude: "", longitude: "", distance: "" });
            void refetch();
        },
        onError: (error) => {
            toast.error(`Gagal membuat konfigurasi: ${error.message}`);
        },
    });

    const deleteMutation = api.configuration.delete.useMutation({
        onSuccess: () => {
            toast.success("Konfigurasi berhasil dihapus!");
            void refetch();
        },
        onError: (error) => {
            toast.error(`Gagal menghapus konfigurasi: ${error.message}`);
        },
    });

    const updateFieldMutation = api.configuration.updateField.useMutation({
        onSuccess: () => {
            toast.success("Field berhasil diupdate!");
            void refetch();
        },
        onError: (error) => {
            toast.error(`Gagal update field: ${error.message}`);
        },
    });

    const handleEdit = (config: ConfigurationRow) => {
        setEditingId(config.id);
        setEditForm({
            latitude: config.latitude.toString(),
            longitude: config.longitude.toString(),
            distance: config.distance.toString(),
        });
    };

    const handleSaveEdit = () => {
        if (!editingId) return;

        const latitude = parseFloat(editForm.latitude);
        const longitude = parseFloat(editForm.longitude);
        const distance = parseInt(editForm.distance);

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

        updateMutation.mutate({
            id: editingId,
            data: { latitude, longitude, distance },
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditForm({ latitude: "", longitude: "", distance: "" });
    };

    const handleCreate = () => {
        const id = parseInt(createForm.id);
        const latitude = parseFloat(createForm.latitude);
        const longitude = parseFloat(createForm.longitude);
        const distance = parseInt(createForm.distance);

        if (isNaN(id) || id < 1) {
            toast.error("ID harus berupa angka positif");
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
            latitude,
            longitude,
            distance,
        });
    };

    const handleDelete = (id: number) => {
        if (confirm("Apakah Anda yakin ingin menghapus konfigurasi ini?")) {
            deleteMutation.mutate({ id });
        }
    };

    const handleQuickFieldUpdate = (id: number, field: "latitude" | "longitude" | "distance", value: string) => {
        const numValue = field === "distance" ? parseInt(value) : parseFloat(value);
        
        if (isNaN(numValue)) {
            toast.error("Nilai harus berupa angka yang valid");
            return;
        }

        updateFieldMutation.mutate({
            id,
            field,
            value: numValue,
        });
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-8 bg-muted rounded animate-pulse"></div>
                        <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                    </div>
                    <div className="h-10 w-40 bg-muted rounded animate-pulse"></div>
                </div>
                <Card>
                    <CardHeader>
                        <div className="h-6 bg-muted rounded animate-pulse"></div>
                        <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 bg-muted rounded animate-pulse"></div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Database className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Management Data Konfigurasi</h1>
                            <p className="text-muted-foreground">
                                Kelola semua data konfigurasi lokasi sistem absensi
                            </p>
                        </div>
                    </div>
                </div>
                
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Tambah Konfigurasi
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center space-x-2">
                                <Settings2 className="h-5 w-5 text-primary" />
                                <span>Buat Konfigurasi Baru</span>
                            </DialogTitle>
                            <DialogDescription>
                                Tambahkan konfigurasi lokasi baru untuk sistem absensi.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="create-id" className="text-right">
                                    ID
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
                                <Label htmlFor="create-latitude" className="text-right">
                                    Latitude
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
                                    Longitude
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
                                    Jarak (m)
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
                                {createMutation.isPending ? "Membuat..." : "Buat Konfigurasi"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center space-x-2">
                                <MapPin className="h-5 w-5 text-primary" />
                                <div>
                                    <CardTitle>Data Konfigurasi</CardTitle>
                                    <CardDescription>
                                        Daftar semua konfigurasi lokasi yang tersimpan dalam sistem.
                                        Klik nilai untuk quick edit atau gunakan tombol aksi.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {configurations && configurations.length > 0 ? (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">
                                                    <div className="flex items-center space-x-1">
                                                        <Zap className="h-4 w-4" />
                                                        <span>ID</span>
                                                    </div>
                                                </TableHead>
                                                <TableHead>
                                                    <div className="flex items-center space-x-1">
                                                        <Navigation className="h-4 w-4" />
                                                        <span>Latitude</span>
                                                    </div>
                                                </TableHead>
                                                <TableHead>
                                                    <div className="flex items-center space-x-1">
                                                        <Navigation className="h-4 w-4" />
                                                        <span>Longitude</span>
                                                    </div>
                                                </TableHead>
                                                <TableHead>
                                                    <div className="flex items-center space-x-1">
                                                        <Target className="h-4 w-4" />
                                                        <span>Jarak (m)</span>
                                                    </div>
                                                </TableHead>
                                                <TableHead className="text-right">Aksi</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {configurations.map((config) => (
                                                <TableRow key={config.id}>
                                                    <TableCell className="font-medium">
                                                        <Badge variant="outline">
                                                            #{config.id}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {editingId === config.id ? (
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                value={editForm.latitude}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, latitude: e.target.value }))}
                                                                className="w-32"
                                                            />
                                                        ) : (
                                                            <span
                                                                className="cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors font-mono text-sm"
                                                                onClick={() => {
                                                                    const newValue = prompt("Enter new latitude:", config.latitude.toString());
                                                                    if (newValue !== null) {
                                                                        handleQuickFieldUpdate(config.id, "latitude", newValue);
                                                                    }
                                                                }}
                                                            >
                                                                {config.latitude}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {editingId === config.id ? (
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                value={editForm.longitude}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, longitude: e.target.value }))}
                                                                className="w-32"
                                                            />
                                                        ) : (
                                                            <span
                                                                className="cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors font-mono text-sm"
                                                                onClick={() => {
                                                                    const newValue = prompt("Enter new longitude:", config.longitude.toString());
                                                                    if (newValue !== null) {
                                                                        handleQuickFieldUpdate(config.id, "longitude", newValue);
                                                                    }
                                                                }}
                                                            >
                                                                {config.longitude}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {editingId === config.id ? (
                                                            <Input
                                                                type="number"
                                                                value={editForm.distance}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, distance: e.target.value }))}
                                                                className="w-24"
                                                            />
                                                        ) : (
                                                            <span
                                                                className="cursor-pointer hover:bg-muted px-2 py-1 rounded transition-colors font-mono text-sm"
                                                                onClick={() => {
                                                                    const newValue = prompt("Enter new distance:", config.distance.toString());
                                                                    if (newValue !== null) {
                                                                        handleQuickFieldUpdate(config.id, "distance", newValue);
                                                                    }
                                                                }}
                                                            >
                                                                {config.distance}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {editingId === config.id ? (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={handleSaveEdit}
                                                                        disabled={updateMutation.isPending}
                                                                    >
                                                                        <Save className="mr-1 h-3 w-3" />
                                                                        Simpan
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={handleCancelEdit}
                                                                    >
                                                                        Batal
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() => handleEdit(config)}
                                                                    >
                                                                        <Edit className="mr-1 h-3 w-3" />
                                                                        Edit
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={() => handleDelete(config.id)}
                                                                        disabled={deleteMutation.isPending}
                                                                    >
                                                                        <Trash2 className="mr-1 h-3 w-3" />
                                                                        Hapus
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                                        <Database className="h-6 w-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">Belum ada data konfigurasi</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Mulai dengan membuat konfigurasi lokasi pertama
                                    </p>
                                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Buat Konfigurasi Pertama
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Quick Stats */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Statistik</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Total Konfigurasi</span>
                                    <Badge variant="secondary">
                                        {configurations?.length ?? 0}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tips */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2 text-lg">
                                <Info className="h-5 w-5" />
                                <span>Tips Penggunaan</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    <ul className="space-y-1 text-sm">
                                        <li>• <strong>Klik nilai</strong> dalam tabel untuk quick edit</li>
                                        <li>• <strong>Tombol Edit</strong> untuk edit multiple fields</li>
                                        <li>• <strong>ID unik</strong> diperlukan untuk setiap konfigurasi</li>
                                        <li>• <strong>Validation</strong> otomatis untuk koordinat</li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}