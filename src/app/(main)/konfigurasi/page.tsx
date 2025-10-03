"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
    MapPin, Save, RotateCcw, Settings, Globe, Target,
    Edit, Trash2, Building2,
    Activity, BarChart3, Power, PowerOff, Info, Search, Loader2
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

    // Search location states
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Array<{
        display_name: string;
        lat: string;
        lon: string;
        place_id: string;
        type?: string;
        class?: string;
        importance?: number;
    }>>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchAbortRef = useRef<AbortController | null>(null);
    const currentSearchIdRef = useRef(0);

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
            // Intentionally no global toast here to avoid duplicate messages; per-call onSuccess handles UI
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

    // Handle click outside to close search results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('.search-container')) {
                setShowSearchResults(false);
            }
        };

        if (showSearchResults) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showSearchResults]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleLocationChange = useCallback((lat: number, lng: number) => {
        setFormData(prev => ({
            ...prev,
            latitude: lat.toString(),
            longitude: lng.toString(),
        }));
    }, []);

    // Search location function
    const searchLocation = async (query: string) => {
        if (!query.trim() || query.trim().length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }
        setIsSearching(true);
        // Bump search id and create a fresh abort controller
        const searchId = ++currentSearchIdRef.current;
        // Abort any in-flight request
        if (searchAbortRef.current) {
            searchAbortRef.current.abort();
        }
        const controller = new AbortController();
        searchAbortRef.current = controller;
        const { signal } = controller;

        try {
            const base = "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1";
            const urls = [
                `${base}&q=${encodeURIComponent(query)}&limit=3&countrycodes=id`,
                `${base}&q=${encodeURIComponent(query)}&limit=2`,
                ...(query.trim().length <= 10 ? [
                    `${base}&q=${encodeURIComponent(query + " indonesia")}&limit=2`
                ] : []),
            ];

            const results = await Promise.allSettled(
                urls.map(async (u) => {
                    const res = await fetch(u, { signal });
                    if (!res.ok) throw new Error(String(res.status));
                    return res.json() as Promise<Array<{ display_name: string; lat: string; lon: string; place_id: string; type?: string; class?: string; importance?: number }>>;
                })
            );

            // If a newer search started, ignore this result
            if (searchId !== currentSearchIdRef.current || signal.aborted) return;

            const allResults: Array<{ display_name: string; lat: string; lon: string; place_id: string; type?: string; class?: string; importance?: number }> = [];
            for (const r of results) {
                if (r.status === "fulfilled" && Array.isArray(r.value)) allResults.push(...r.value);
            }

            const uniqueResults = allResults
                .filter((result, index, self) => index === self.findIndex(r => r.place_id === result.place_id))
                .sort((a, b) => {
                    const importanceA = a.importance ?? 0;
                    const importanceB = b.importance ?? 0;
                    const isIndonesianA = a.display_name?.toLowerCase().includes('indonesia') ? 1 : 0;
                    const isIndonesianB = b.display_name?.toLowerCase().includes('indonesia') ? 1 : 0;
                    return (isIndonesianB - isIndonesianA) || (importanceB - importanceA);
                })
                .slice(0, 6);

            setSearchResults(uniqueResults);
            setShowSearchResults(true);
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Error searching location:', error);
                toast.error('Gagal mencari lokasi');
                setSearchResults([]);
            }
        } finally {
            // Only stop the spinner if this is still the latest search
            if (searchId === currentSearchIdRef.current) setIsSearching(false);
        }
    };

    // Abort any in-flight search on unmount for cleanup
    useEffect(() => {
        return () => {
            if (searchAbortRef.current) searchAbortRef.current.abort();
        };
    }, []);

    // Search debounce timeout ref
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Handle search input change with debounce
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // If input becomes too short, abort current search and hide results quickly
        if (!value.trim() || value.trim().length < 2) {
            if (searchAbortRef.current) searchAbortRef.current.abort();
            setIsSearching(false);
            setShowSearchResults(false);
            setSearchResults([]);
            return;
        }

        // Set new timeout - shorter delay for better responsiveness
        searchTimeoutRef.current = setTimeout(() => {
            void searchLocation(value);
        }, 300);
    };

    // Utility: get next available location ID (reserve 1 for primary)
    const getNextLocationId = () => {
        const used = new Set((locations ?? []).map((l) => l.id));
        let candidate = 2; // reserve 1 for primary
        while (used.has(candidate)) candidate += 1;
        return candidate;
    };

    // Handle search result selection
    const handleSearchResultSelect = (result: typeof searchResults[0]) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        // Prefer name from result; fallback to existing form name; else generate
        const pickedName = result.display_name?.split(',')[0]?.trim() ?? formData.name.trim() ?? `Lokasi Baru ${new Date().toLocaleString()}`;
        const pickedDistance = Number.parseInt(formData.distance || "", 10);
        const safeDistance = Number.isFinite(pickedDistance) ? pickedDistance : 500;

        setFormData((prev) => ({
            ...prev,
            name: prev.name?.trim() ? prev.name : pickedName,
            latitude: lat.toString(),
            longitude: lng.toString(),
            distance: prev.distance || String(safeDistance),
        }));

        // Auto-create if not in edit mode
        if (!selectedLocationId) {
            const newId = getNextLocationId();
            createMutation.mutate(
                {
                    id: newId,
                    name: pickedName,
                    latitude: lat,
                    longitude: lng,
                    distance: safeDistance,
                    isActive: true,
                },
                {
                    onSuccess: () => {
                        setSelectedLocationId(newId);
                        toast.success(`Lokasi "${pickedName}" dibuat dan dipilih`);
                    },
                }
            );
        } else {
            toast.success(`Lokasi "${pickedName}" dipilih`);
        }

        // Close search UI
        setSearchQuery("");
        setShowSearchResults(false);
        setSearchResults([]);
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

    // Removed unused manual create handler and dialog-related state

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

            {/* Main Content - Form and Map in One Card */}
            <Card className="w-full">
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
                <CardContent className="space-y-6">
                    {/* Location Search */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            <h4 className="font-medium">Cari Lokasi</h4>
                        </div>
                        <div className="relative search-container">
                            <Input
                                type="text"
                                placeholder="Cari lokasi: kantor, sekolah, mall, jalan, atau ketik alamat..."
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="w-full pr-10"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {isSearching ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>

                            {/* Search Results */}
                            {showSearchResults && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-80 overflow-y-auto">
                                    {searchResults.map((result) => {
                                        const locationName = result.display_name?.split(',')[0]?.trim();
                                        const locationDetails = result.display_name?.split(',').slice(1).join(',').trim();
                                        const locationType = result.type ?? result.class;

                                        return (
                                            <button
                                                key={result.place_id}
                                                type="button"
                                                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 text-sm transition-colors"
                                                onClick={() => handleSearchResultSelect(result)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="h-4 w-4 mt-0.5 text-blue-600 flex-shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                            {locationName}
                                                            {locationType && (
                                                                <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                                                                    {locationType}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 line-clamp-2 break-words">
                                                            {locationDetails}
                                                        </div>
                                                        <div className="text-blue-600 dark:text-blue-400 text-xs mt-1 font-mono">
                                                            {parseFloat(result.lat).toFixed(6)}, {parseFloat(result.lon).toFixed(6)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* No Results */}
                            {showSearchResults && searchResults.length === 0 && !isSearching && searchQuery.trim() && searchQuery.trim().length >= 2 && (
                                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg p-4 text-sm">
                                    <div className="text-center text-gray-500 dark:text-gray-400">
                                        <div className="font-medium mb-2">Lokasi tidak ditemukan</div>
                                        <div className="text-xs space-y-1">
                                            <div>• Coba kata kunci yang lebih umum (misal: &ldquo;magelang&rdquo; bukan &ldquo;SMKN 2 Magelang&rdquo;)</div>
                                            <div>• Gunakan nama kota, jalan, atau landmark terkenal</div>
                                            <div>• Pastikan ejaan sudah benar</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            💡 <strong>Tips pencarian:</strong> Coba kata kunci seperti &ldquo;magelang&rdquo;, &ldquo;smk&rdquo;, &ldquo;mall&rdquo;, &ldquo;jalan sudirman&rdquo;, atau nama tempat spesifik.
                            Tidak perlu mengetik alamat lengkap.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Form Fields in Grid Layout */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Location Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="flex items-center gap-2 text-sm font-medium">
                                    <Building2 className="h-4 w-4" />
                                    Nama Lokasi *
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Contoh: Kantor Pusat"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                    required
                                    className="w-full"
                                />
                            </div>

                            {/* Latitude */}
                            <div className="space-y-2">
                                <Label htmlFor="latitude" className="flex items-center gap-2 text-sm font-medium">
                                    <MapPin className="h-4 w-4" />
                                    Latitude *
                                </Label>
                                <Input
                                    id="latitude"
                                    type="number"
                                    step="any"
                                    placeholder="-7.4503"
                                    value={formData.latitude}
                                    onChange={(e) => handleInputChange("latitude", e.target.value)}
                                    required
                                    className="w-full"
                                />
                            </div>

                            {/* Longitude */}
                            <div className="space-y-2">
                                <Label htmlFor="longitude" className="flex items-center gap-2 text-sm font-medium">
                                    <Globe className="h-4 w-4" />
                                    Longitude *
                                </Label>
                                <Input
                                    id="longitude"
                                    type="number"
                                    step="any"
                                    placeholder="110.2241"
                                    value={formData.longitude}
                                    onChange={(e) => handleInputChange("longitude", e.target.value)}
                                    required
                                    className="w-full"
                                />
                            </div>

                            {/* Distance */}
                            <div className="space-y-2">
                                <Label htmlFor="distance" className="flex items-center gap-2 text-sm font-medium">
                                    <Target className="h-4 w-4" />
                                    Radius (m) *
                                </Label>
                                <Input
                                    id="distance"
                                    type="number"
                                    min="1"
                                    max="10000"
                                    placeholder="500"
                                    value={formData.distance}
                                    onChange={(e) => handleInputChange("distance", e.target.value)}
                                    required
                                    className="w-full"
                                />
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium opacity-0">Actions</Label>
                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        disabled={upsertMutation.isPending || updateMutation.isPending}
                                        size="sm"
                                    >
                                        <Save className="mr-1 h-3 w-3" />
                                        {(upsertMutation.isPending || updateMutation.isPending)
                                            ? "Saving..."
                                            : selectedLocationId ? "Update" : "Simpan"
                                        }
                                    </Button>
                                    {selectedLocationId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedLocationId(null)}
                                        >
                                            Batal
                                        </Button>
                                    )}
                                    {!selectedLocationId && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleReset}
                                            disabled={resetMutation.isPending}
                                        >
                                            <RotateCcw className="mr-1 h-3 w-3" />
                                            Reset
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Helper Text */}
                        <p className="text-xs text-muted-foreground">
                            Jarak maksimal yang diizinkan untuk melakukan absensi (1-10000 meter).
                            Klik pada peta di bawah untuk memilih koordinat dengan mudah.
                        </p>
                    </form>

                    {/* Map Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <h4 className="font-medium">Pemilih Lokasi</h4>
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                            <LocationPicker
                                latitude={formData.latitude ? parseFloat(formData.latitude) : null}
                                longitude={formData.longitude ? parseFloat(formData.longitude) : null}
                                distance={formData.distance ? parseInt(formData.distance) : 500}
                                onLocationChange={handleLocationChange}
                            />
                        </div>
                    </div>

                    {/* Info Alert */}
                    <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            <strong>Tips:</strong> Pilih lokasi dari tabel di atas untuk mengedit, atau biarkan kosong untuk membuat/edit lokasi utama.
                            Lokasi yang aktif akan digunakan untuk validasi absensi. Klik pada peta untuk memilih koordinat secara visual.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        </div>
    );
}
