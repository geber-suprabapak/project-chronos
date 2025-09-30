"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { MapPin, Settings, Save, RotateCcw, Info, CheckCircle } from "lucide-react";

export default function ConfigurationPage() {
    const [formData, setFormData] = useState({
        latitude: "",
        longitude: "",
        distance: "",
    });

    // Get current configuration
    const { data: config, isLoading, refetch } = api.configuration.get.useQuery();

    // Mutation for updating configuration
    const upsertMutation = api.configuration.upsert.useMutation({
        onSuccess: () => {
            toast.success("Konfigurasi lokasi berhasil disimpan!");
            void refetch();
        },
        onError: (error) => {
            toast.error(`Gagal menyimpan konfigurasi: ${error.message}`);
        },
    });

    // Mutation for resetting configuration
    const resetMutation = api.configuration.reset.useMutation({
        onSuccess: (data) => {
            toast.success("Konfigurasi berhasil direset ke nilai default!");
            if (data) {
                setFormData({
                    latitude: data.latitude.toString(),
                    longitude: data.longitude.toString(),
                    distance: data.distance.toString(),
                });
            }
            void refetch();
        },
        onError: (error) => {
            toast.error(`Gagal mereset konfigurasi: ${error.message}`);
        },
    });

    // Initialize form data when config is loaded
    useEffect(() => {
        if (config) {
            setFormData({
                latitude: config.latitude.toString(),
                longitude: config.longitude.toString(),
                distance: config.distance.toString(),
            });
        }
    }, [config]);

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const latitude = parseFloat(formData.latitude);
        const longitude = parseFloat(formData.longitude);
        const distance = parseInt(formData.distance);

        // Validation
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

        upsertMutation.mutate({
            latitude,
            longitude,
            distance,
        });
    };

    const handleReset = () => {
        if (confirm("Apakah Anda yakin ingin mereset konfigurasi ke nilai default?")) {
            resetMutation.mutate();
        }
    };

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6">
                <div className="space-y-2">
                    <div className="h-8 bg-muted rounded animate-pulse"></div>
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                </div>
                <Card>
                    <CardHeader>
                        <div className="h-6 bg-muted rounded animate-pulse"></div>
                        <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="h-4 bg-muted rounded animate-pulse"></div>
                                <div className="h-10 bg-muted rounded animate-pulse"></div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-4 bg-muted rounded animate-pulse"></div>
                                <div className="h-10 bg-muted rounded animate-pulse"></div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 bg-muted rounded animate-pulse"></div>
                            <div className="h-10 bg-muted rounded animate-pulse"></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center space-x-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Settings className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Konfigurasi Lokasi</h1>
                        <p className="text-muted-foreground">
                            Atur lokasi dan jarak toleransi untuk sistem absensi
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Configuration Form */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center space-x-2">
                                <MapPin className="h-5 w-5 text-primary" />
                                <div>
                                    <CardTitle>Pengaturan Lokasi Absensi</CardTitle>
                                    <CardDescription>
                                        Tentukan titik koordinat dan radius area yang diizinkan untuk melakukan absensi
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="latitude">Latitude</Label>
                                        <Input
                                            id="latitude"
                                            type="number"
                                            step="any"
                                            placeholder="Contoh: -7.4503"
                                            value={formData.latitude}
                                            onChange={(e) => handleInputChange("latitude", e.target.value)}
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Nilai antara -90 hingga 90
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="longitude">Longitude</Label>
                                        <Input
                                            id="longitude"
                                            type="number"
                                            step="any"
                                            placeholder="Contoh: 110.2241"
                                            value={formData.longitude}
                                            onChange={(e) => handleInputChange("longitude", e.target.value)}
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Nilai antara -180 hingga 180
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="distance">Jarak Toleransi (meter)</Label>
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
                                        Radius area dalam meter (1 - 10,000 meter)
                                    </p>
                                </div>

                                <Separator />

                                <div className="flex gap-3">
                                    <Button
                                        type="submit"
                                        disabled={upsertMutation.isPending}
                                        className="flex-1"
                                    >
                                        <Save className="mr-2 h-4 w-4" />
                                        {upsertMutation.isPending ? "Menyimpan..." : "Simpan Konfigurasi"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleReset}
                                        disabled={resetMutation.isPending}
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        {resetMutation.isPending ? "Mereset..." : "Reset"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Current Configuration */}
                    {config && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                    <span>Konfigurasi Aktif</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                        <span className="text-sm font-medium">Latitude</span>
                                        <Badge variant="secondary" className="font-mono">
                                            {config.latitude}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                        <span className="text-sm font-medium">Longitude</span>
                                        <Badge variant="secondary" className="font-mono">
                                            {config.longitude}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                        <span className="text-sm font-medium">Radius</span>
                                        <Badge variant="secondary">
                                            {config.distance} meter
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Tips */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Info className="h-5 w-5 text-blue-500" />
                                <span>Tips Penggunaan</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>
                                    <ul className="space-y-2 text-sm">
                                        <li>• Gunakan Google Maps untuk mendapatkan koordinat yang akurat</li>
                                        <li>• Jarak toleransi 100-500 meter cocok untuk area sekolah/kantor</li>
                                        <li>• Koordinat akan digunakan untuk validasi lokasi saat absensi</li>
                                        <li>• Pastikan koordinat sesuai dengan lokasi fisik institusi</li>
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
