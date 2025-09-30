"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { toast } from "sonner";
import { api } from "~/trpc/react";

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
            <div className="container mx-auto p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-2xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Konfigurasi Lokasi</h1>
                <p className="text-gray-600 mt-2">
                    Atur lokasi dan jarak toleransi untuk sistem absensi
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pengaturan Lokasi Absensi</CardTitle>
                    <CardDescription>
                        Tentukan titik koordinat dan radius area yang diizinkan untuk melakukan absensi.
                        Jarak diukur dalam meter dari titik koordinat yang ditentukan.
                    </CardDescription>
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
                                <p className="text-sm text-gray-500">
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
                                <p className="text-sm text-gray-500">
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
                            <p className="text-sm text-gray-500">
                                Radius area dalam meter (1 - 10,000 meter)
                            </p>
                        </div>

                        <Separator />

                        <div className="flex gap-4">
                            <Button
                                type="submit"
                                disabled={upsertMutation.isPending}
                                className="flex-1"
                            >
                                {upsertMutation.isPending ? "Menyimpan..." : "Simpan Konfigurasi"}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleReset}
                                disabled={resetMutation.isPending}
                            >
                                {resetMutation.isPending ? "Mereset..." : "Reset Default"}
                            </Button>
                        </div>
                    </form>

                    {config && (
                        <>
                            <Separator className="my-6" />
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-3">Konfigurasi Saat Ini</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-600">Latitude:</span>
                                        <p className="font-medium">{config.latitude}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Longitude:</span>
                                        <p className="font-medium">{config.longitude}</p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Jarak Toleransi:</span>
                                        <p className="font-medium">{config.distance} meter</p>
                                    </div>
                                </div>
                                <div className="mt-3 text-xs text-gray-500">
                                    Terakhir diupdate: {new Date(config.updatedAt).toLocaleString("id-ID")}
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">💡 Tips Penggunaan</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Gunakan Google Maps untuk mendapatkan koordinat yang akurat</li>
                    <li>• Jarak toleransi 100-500 meter cocok untuk area sekolah/kantor</li>
                    <li>• Koordinat akan digunakan untuk validasi lokasi saat absensi</li>
                    <li>• Pastikan koordinat sesuai dengan lokasi fisik institusi</li>
                </ul>
            </div>
        </div>
    );
}
