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
import LocationPicker from "~/components/location-picker";

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

    const handleLocationChange = (lat: number, lng: number) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat.toString(),
            longitude: lng.toString(),
        }));
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
        <div className="container mx-auto p-6 max-w-7xl space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                        <Settings className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                            Konfigurasi Lokasi
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Atur lokasi dan jarak toleransi untuk sistem absensi
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* Main Configuration Form */}
                <div className="xl:col-span-3 space-y-6">
                    <Card className="shadow-lg border-0 bg-gradient-to-br from-card via-card to-muted/20">
                        <CardHeader className="pb-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <MapPin className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Pengaturan Lokasi Absensi</CardTitle>
                                    <CardDescription className="text-base">
                                        Tentukan titik koordinat dan radius area yang diizinkan untuk melakukan absensi
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <Label htmlFor="latitude" className="text-sm font-medium">Latitude</Label>
                                        <Input
                                            id="latitude"
                                            type="number"
                                            step="any"
                                            placeholder="Contoh: -7.4503"
                                            value={formData.latitude}
                                            onChange={(e) => handleInputChange("latitude", e.target.value)}
                                            required
                                            className="h-11"
                                        />
                                        <p className="text-xs text-muted-foreground flex items-center">
                                            <Info className="h-3 w-3 mr-1" />
                                            Nilai antara -90 hingga 90
                                        </p>
                                    </div>

                                    <div className="space-y-3">
                                        <Label htmlFor="longitude" className="text-sm font-medium">Longitude</Label>
                                        <Input
                                            id="longitude"
                                            type="number"
                                            step="any"
                                            placeholder="Contoh: 110.2241"
                                            value={formData.longitude}
                                            onChange={(e) => handleInputChange("longitude", e.target.value)}
                                            required
                                            className="h-11"
                                        />
                                        <p className="text-xs text-muted-foreground flex items-center">
                                            <Info className="h-3 w-3 mr-1" />
                                            Nilai antara -180 hingga 180
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label htmlFor="distance" className="text-sm font-medium">Jarak Toleransi (meter)</Label>
                                    <Input
                                        id="distance"
                                        type="number"
                                        min="1"
                                        max="10000"
                                        placeholder="Contoh: 500"
                                        value={formData.distance}
                                        onChange={(e) => handleInputChange("distance", e.target.value)}
                                        required
                                        className="h-11"
                                    />
                                    <p className="text-xs text-muted-foreground flex items-center">
                                        <Info className="h-3 w-3 mr-1" />
                                        Radius area dalam meter (1 - 10,000 meter)
                                    </p>
                                </div>

                                <Separator className="my-6" />

                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        type="submit"
                                        disabled={upsertMutation.isPending}
                                        className="flex-1 h-12 text-base font-medium"
                                        size="lg"
                                    >
                                        <Save className="mr-2 h-5 w-5" />
                                        {upsertMutation.isPending ? "Menyimpan..." : "Simpan Konfigurasi"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleReset}
                                        disabled={resetMutation.isPending}
                                        className="h-12 px-6"
                                        size="lg"
                                    >
                                        <RotateCcw className="mr-2 h-5 w-5" />
                                        {resetMutation.isPending ? "Mereset..." : "Reset"}
                                    </Button>
                                </div>
                            </form>
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

                {/* Sidebar */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Current Configuration */}
                    {config && (
                        <Card className="shadow-lg border-0 bg-gradient-to-br from-green-50 via-card to-emerald-50/30 dark:from-green-950/20 dark:via-card dark:to-emerald-950/10">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex items-center space-x-2 text-green-700 dark:text-green-400">
                                    <CheckCircle className="h-5 w-5" />
                                    <span>Konfigurasi Aktif</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-4 bg-background/50 rounded-xl border">
                                        <span className="text-sm font-medium text-muted-foreground">Latitude</span>
                                        <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                                            {config.latitude}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-background/50 rounded-xl border">
                                        <span className="text-sm font-medium text-muted-foreground">Longitude</span>
                                        <Badge variant="secondary" className="font-mono text-sm px-3 py-1">
                                            {config.longitude}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-background/50 rounded-xl border">
                                        <span className="text-sm font-medium text-muted-foreground">Radius</span>
                                        <Badge variant="default" className="text-sm px-3 py-1">
                                            {config.distance} meter
                                        </Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Tips */}
                    <Card className="shadow-lg border-0 bg-gradient-to-br from-blue-50 via-card to-sky-50/30 dark:from-blue-950/20 dark:via-card dark:to-sky-950/10">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center space-x-2 text-blue-700 dark:text-blue-400">
                                <Info className="h-5 w-5" />
                                <span>Tips Penggunaan</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Alert className="border-0 bg-gradient-to-r from-blue-50/50 to-sky-50/50 dark:from-blue-950/30 dark:to-sky-950/30">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <AlertDescription>
                                    <ul className="space-y-3 text-sm leading-relaxed">
                                        <li className="flex items-start space-x-2">
                                            <span className="text-primary font-medium">•</span>
                                            <span>Klik langsung pada peta untuk memilih lokasi dengan mudah</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="text-primary font-medium">•</span>
                                            <span>Gunakan pencarian alamat untuk menemukan lokasi spesifik</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="text-primary font-medium">•</span>
                                            <span>Jarak toleransi 100-500 meter cocok untuk area sekolah/kantor</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="text-primary font-medium">•</span>
                                            <span>Lingkaran biru menunjukkan area toleransi absensi</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="text-primary font-medium">•</span>
                                            <span>Koordinat akan digunakan untuk validasi lokasi saat absensi</span>
                                        </li>
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="shadow-lg border-0 bg-gradient-to-br from-purple-50 via-card to-violet-50/30 dark:from-purple-950/20 dark:via-card dark:to-violet-950/10">
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center space-x-2 text-purple-700 dark:text-purple-400">
                                <Settings className="h-5 w-5" />
                                <span>Aksi Cepat</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Button
                                variant="outline"
                                className="w-full justify-start h-11"
                                onClick={() => {
                                    if (config) {
                                        const mapsUrl = `https://www.google.com/maps?q=${config.latitude},${config.longitude}`;
                                        window.open(mapsUrl, '_blank');
                                    }
                                }}
                                disabled={!config}
                            >
                                <MapPin className="mr-2 h-4 w-4" />
                                Lihat di Google Maps
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full justify-start h-11"
                                onClick={() => {
                                    if (config) {
                                        void navigator.clipboard.writeText(`${config.latitude}, ${config.longitude}`);
                                        toast.success("Koordinat disalin ke clipboard!");
                                    }
                                }}
                                disabled={!config}
                            >
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Salin Koordinat
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
