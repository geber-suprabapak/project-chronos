"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  MapPin,
  Save,
  RotateCcw,
  Settings,
  Globe,
  Target,
  Edit,
  Trash2,
  Building2,
  Activity,
  Info,
  Search,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import LocationPicker from "~/components/location-picker";

export default function ConfigurationPage() {
  const [formData, setFormData] = useState({
    name: "",
    latitude: "",
    longitude: "",
    distance: "",
  });
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    actionLabel: string;
    actionVariant?: "default" | "destructive";
    onConfirm: () => void;
  } | null>(null);

  // Search location states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      display_name: string;
      lat: string;
      lon: string;
      place_id: string;
      type?: string;
      class?: string;
      importance?: number;
    }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const currentSearchIdRef = useRef(0);

  // Queries
  const {
    data: locations,
    isLoading: locationsLoading,
    refetch: refetchLocations,
  } = api.location.getAll.useQuery();
  const { refetch: refetchActive } = api.location.getActive.useQuery();
  const { data: stats, refetch: refetchStats } =
    api.location.getStats.useQuery();

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
      setShowForm(false);
      setSelectedLocationId(null);
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
      toast.success(
        `Lokasi ${data?.isActive ? "diaktifkan" : "dinonaktifkan"}!`,
      );
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
      setShowForm(false);
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
      const location = locations.find((loc) => loc.id === selectedLocationId);
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
      if (
        event.target instanceof Element &&
        !event.target.closest(".search-container")
      ) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
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
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toString(),
      longitude: lng.toString(),
    }));
  }, []);

  // Search location function
  const searchLocation = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchError(null);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
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
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, {
        signal,
      });

      // If a newer search started, ignore this result
      if (searchId !== currentSearchIdRef.current || signal.aborted) return;

      if (!res.ok) {
        if (res.status === 429) {
          toast.error(
            "Layanan pencarian sedang sibuk. Silakan tunggu sebentar.",
          );
          setSearchError(
            "Layanan pencarian sedang sibuk (rate limit). Coba lagi dalam beberapa detik.",
          );
        } else if (res.status === 504) {
          toast.error("Pencarian lokasi melebihi batas waktu (timeout).");
          setSearchError(
            "Pencarian melebihi batas waktu 5 detik. Periksa koneksi atau coba lagi.",
          );
        } else {
          toast.error("Gagal mencari lokasi");
          setSearchError("Gagal memuat hasil pencarian lokasi.");
        }
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      // SAFETY: Internal proxy endpoint returns structured GeocodeResponsePayload
      const payload = (await res.json()) as {
        success?: boolean;
        data?: Array<{
          display_name: string;
          lat: string;
          lon: string;
          place_id: string;
          type?: string;
          class?: string;
          importance?: number;
        }>;
      };

      if (searchId !== currentSearchIdRef.current || signal.aborted) return;

      const items = Array.isArray(payload) ? payload : (payload.data ?? []);
      setSearchResults(items);
      setShowSearchResults(true);
      setSearchError(null);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Search request aborted, do nothing
      } else {
        console.error("Error searching location:", error);
        toast.error("Gagal mencari lokasi");
        setSearchError("Terjadi kesalahan jaringan saat mencari lokasi.");
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

  // Handle search input change with debounce (450ms)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSearchError(null);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If input becomes too short, abort current search and hide results quickly
    if (!value.trim() || value.trim().length < 3) {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      setIsSearching(false);
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    // Set new timeout - 450ms delay for rate-limit and human typing compliance
    searchTimeoutRef.current = setTimeout(() => {
      void searchLocation(value);
    }, 450);
  };

  // Utility: get next available location ID (only 2 or 3 allowed)
  const getNextLocationId = () => {
    const used = new Set((locations ?? []).map((l) => l.id));
    // Only allow IDs 2 and 3 (ID 1 is reserved as default)
    if (!used.has(2)) return 2;
    if (!used.has(3)) return 3;
    return null; // Max 3 locations reached
  };

  // Handle search result selection
  const handleSearchResultSelect = (result: (typeof searchResults)[0]) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Prefer name from result; fallback to existing form name; else generate
    const pickedName =
      result.display_name?.split(",")[0]?.trim() ??
      formData.name.trim() ??
      `Lokasi Baru ${new Date().toLocaleString()}`;
    const pickedDistance = Number.parseInt(formData.distance || "", 10);
    const safeDistance = Number.isFinite(pickedDistance) ? pickedDistance : 0;

    // Only fill form fields, do NOT auto-create
    setFormData((prev) => ({
      ...prev,
      name: prev.name?.trim() ? prev.name : pickedName,
      latitude: lat.toString(),
      longitude: lng.toString(),
      distance: prev.distance || String(safeDistance),
    }));

    toast.success(
      `Lokasi "${pickedName}" dipilih. Klik "Simpan" untuk menyimpan.`,
    );

    // Close search UI
    setSearchQuery("");
    setShowSearchResults(false);
    setSearchResults([]);
  };

  const handleOpenForm = (locationId: number | null = null) => {
    if (locationId) {
      // Edit mode
      const location = locations?.find((loc) => loc.id === locationId);
      if (location) {
        setSelectedLocationId(locationId);
        setFormData({
          name: location.name,
          latitude: location.latitude.toString(),
          longitude: location.longitude.toString(),
          distance: location.distance.toString(),
        });
      }
    } else {
      // Create new mode
      const nextId = getNextLocationId();
      if (nextId === null) {
        toast.error("Maksimal 3 lokasi. Hapus lokasi lain terlebih dahulu.");
        return;
      }
      setSelectedLocationId(null);
      setFormData({
        name: "",
        latitude: "",
        longitude: "",
        distance: "0",
      });
    }
    setShowForm(true);
    // Scroll to form
    setTimeout(() => {
      document
        .getElementById("location-form-card")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedLocationId(null);
    setSearchQuery("");
    setShowSearchResults(false);
    setSearchResults([]);
    // Reset form after a short delay to avoid visual glitch
    setTimeout(() => {
      setFormData({
        name: "",
        latitude: "",
        longitude: "",
        distance: "",
      });
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent editing ID 1
    if (selectedLocationId === 1) {
      toast.error("Lokasi default (ID #1) tidak dapat diubah");
      return;
    }

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

    if (selectedLocationId && selectedLocationId !== 1) {
      // Update existing location (not ID 1)
      updateMutation.mutate({
        id: selectedLocationId,
        data: payload,
      });
    } else if (!selectedLocationId) {
      // Create new location with next available ID
      const nextId = getNextLocationId();

      if (nextId === null) {
        toast.error("Maksimal 3 lokasi. Hapus lokasi lain terlebih dahulu.");
        return;
      }

      createMutation.mutate(
        {
          id: nextId,
          name,
          latitude,
          longitude,
          distance,
          isActive: true,
        },
        {
          onSuccess: () => {
            toast.success(
              `Lokasi "${name}" berhasil dibuat dengan ID #${nextId}`,
            );
            setShowForm(false);
            setSelectedLocationId(null);
            void refetchLocations();
            void refetchActive();
            void refetchStats();
          },
        },
      );
    }
  };

  // Removed unused manual create handler and dialog-related state

  const handleToggleActive = (id: number) => {
    if (id === 1) {
      toast.error(
        "Lokasi default (ID #1) selalu aktif dan tidak dapat dinonaktifkan",
      );
      return;
    }
    toggleActiveMutation.mutate({ id });
  };

  const handleDelete = (id: number, name: string) => {
    setConfirmDialog({
      open: true,
      title: "Hapus Lokasi",
      description: `Apakah Anda yakin ingin menghapus lokasi "${name}"? Tindakan ini tidak dapat dibatalkan.`,
      actionLabel: "Hapus",
      actionVariant: "destructive",
      onConfirm: () => deleteMutation.mutate({ id }),
    });
  };

  const handleReset = () => {
    setConfirmDialog({
      open: true,
      title: "Reset Konfigurasi",
      description:
        "Apakah Anda yakin ingin mereset konfigurasi ke nilai default?",
      actionLabel: "Reset",
      actionVariant: "default",
      onConfirm: () => resetMutation.mutate(),
    });
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
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 rounded-lg">
                <Settings className="h-7 w-7" />
              </div>
              Manajemen Lokasi Absensi
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Kelola beberapa lokasi untuk sistem absensi dengan kontrol status
              aktif/nonaktif
            </p>
          </div>
          <Button
            onClick={() => handleOpenForm(null)}
            disabled={locations && locations.length >= 3}
            variant="success"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Tambah Lokasi Baru
          </Button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Lokasi
                    </p>
                    <p className="text-3xl font-bold">
                      {stats.total}
                      <span className="text-lg text-muted-foreground">/3</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-full">
                    <Building2 className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Lokasi Aktif
                    </p>
                    <p className="text-3xl font-bold">{stats.active}</p>
                  </div>
                  <div className="p-3 rounded-full">
                    <Activity className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Location List */}
        {locations && locations.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Daftar Lokasi
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {locations.length} dari 3 lokasi tersedia
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto min-w-0 w-full">
                <Table className="min-w-[650px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">
                        Nama Lokasi
                      </TableHead>
                      <TableHead className="font-semibold">Koordinat</TableHead>
                      <TableHead className="font-semibold">Radius</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold text-right">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...locations]
                      .sort((a, b) => a.id - b.id)
                      .map((location, _index) => (
                        <TableRow
                          key={location.astraId}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300`}
                              >
                                #{location.id}
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {location.name}
                                  {location.id === 1 && (
                                    <Badge
                                      variant="default"
                                      className="text-xs"
                                    >
                                      Default
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                              {location.latitude.toFixed(6)},{" "}
                              {location.longitude.toFixed(6)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono">
                              {location.distance}m
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Switch
                                checked={location.isActive}
                                onCheckedChange={() =>
                                  handleToggleActive(location.id)
                                }
                                disabled={
                                  location.id === 1 ||
                                  toggleActiveMutation.isPending
                                }
                                aria-label={`Status aktif lokasi ${location.name}`}
                                className={
                                  location.isActive
                                    ? "data-[state=checked]:bg-emerald-600"
                                    : "data-[state=unchecked]:bg-red-600"
                                }
                              />
                              <Badge
                                variant={
                                  location.isActive ? "success" : "destructive"
                                }
                                className={cn(
                                  "flex items-center gap-1.5",
                                  location.isActive &&
                                    "bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-600 dark:text-white",
                                )}
                              >
                                {location.isActive ? "Aktif" : "Nonaktif"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={`${location.id === 1 ? "Lihat" : "Edit"} lokasi ${location.name}`}
                                onClick={() => handleOpenForm(location.id)}
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" />
                                {location.id === 1 ? "Lihat" : "Edit"}
                              </Button>
                              {location.id !== 1 && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  aria-label={`Hapus lokasi ${location.name}`}
                                  onClick={() =>
                                    handleDelete(location.id, location.name)
                                  }
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
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

        {/* Empty State */}
        {locations && locations.length === 0 && (
          <Card className="shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-muted rounded-full mb-4">
                <MapPin className="h-12 w-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Belum Ada Lokasi</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Mulai dengan menambahkan lokasi pertama untuk sistem absensi
                Anda
              </p>
              <Button
                onClick={() => handleOpenForm(null)}
                size="lg"
                variant="success"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Lokasi Pertama
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Card for Create/Edit Location */}
      {showForm && (
        <Card id="location-form-card" className="shadow-lg border">
          <CardHeader className="border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {selectedLocationId === 1 ? (
                  <>
                    <div className="p-2 rounded-lg">
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold flex items-center gap-2">
                        Lokasi Default
                        <Badge variant="secondary" className="text-xs">
                          Read-only
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Lokasi utama (ID #1) tidak dapat diubah
                      </CardDescription>
                    </div>
                  </>
                ) : selectedLocationId ? (
                  <>
                    <div className="p-2 rounded-lg">
                      <Edit className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold">
                        Edit Lokasi #{selectedLocationId}
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Ubah pengaturan lokasi yang dipilih
                      </CardDescription>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2 rounded-lg">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-semibold">
                        Tambah Lokasi Baru
                      </CardTitle>
                      <CardDescription className="text-sm mt-1">
                        Maksimal 3 lokasi untuk sistem absensi
                      </CardDescription>
                    </div>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCloseForm}
                aria-label="Tutup form lokasi"
                className="hover:bg-muted transition-colors rounded-full"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Tutup form lokasi</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {/* Form Section */}
              <div className="space-y-5">
                {/* Location Search */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Search className="h-4 w-4" />
                    <h4>Pencarian Lokasi</h4>
                  </div>
                  <div className="relative search-container">
                    {/* Screen Reader Live Announcement */}
                    <div
                      className="sr-only"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {isSearching
                        ? "Sedang mencari lokasi..."
                        : searchError
                          ? searchError
                          : showSearchResults && searchResults.length > 0
                            ? `${searchResults.length} hasil lokasi ditemukan.`
                            : showSearchResults &&
                                searchQuery.trim().length >= 3
                              ? "Lokasi tidak ditemukan."
                              : ""}
                    </div>

                    <Input
                      type="text"
                      id="location-search-input"
                      placeholder="Cari lokasi: nama jalan, sekolah, kantor, mall..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className="w-full pr-10 h-10"
                      role="combobox"
                      aria-expanded={
                        showSearchResults && searchResults.length > 0
                      }
                      aria-autocomplete="list"
                      aria-controls="geocoding-results-list"
                      aria-label="Pencarian nama lokasi atau alamat"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isSearching ? (
                        <Loader2
                          className="h-4 w-4 animate-spin text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <Search
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* Search Results */}
                    {showSearchResults && searchResults.length > 0 && (
                      <div
                        id="geocoding-results-list"
                        role="listbox"
                        aria-label="Daftar hasil pencarian lokasi"
                        className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-64 overflow-y-auto"
                      >
                        {searchResults.map((result, idx) => {
                          const locationName = result.display_name
                            ?.split(",")[0]
                            ?.trim();
                          const locationDetails = result.display_name
                            ?.split(",")
                            .slice(1)
                            .join(",")
                            .trim();
                          const locationType = result.type ?? result.class;

                          return (
                            <button
                              key={result.place_id}
                              type="button"
                              role="option"
                              aria-selected="false"
                              className={`w-full px-4 py-3 text-left hover:bg-muted border-b border-gray-200 dark:border-gray-700 last:border-b-0 text-sm transition-colors ${
                                idx === 0 ? "rounded-t-lg" : ""
                              } ${idx === searchResults.length - 1 ? "rounded-b-lg" : ""}`}
                              onClick={() => handleSearchResultSelect(result)}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="p-2 bg-muted rounded-lg flex-shrink-0"
                                  aria-hidden="true"
                                >
                                  <MapPin className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate flex items-center gap-2">
                                    {locationName}
                                    {locationType && (
                                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-normal">
                                        {locationType}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-muted-foreground text-xs mt-1 line-clamp-1 break-words">
                                    {locationDetails}
                                  </div>
                                  <div className="text-xs mt-1.5 font-mono text-muted-foreground">
                                    {parseFloat(result.lat).toFixed(6)},{" "}
                                    {parseFloat(result.lon).toFixed(6)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* No Results or Error State */}
                    {showSearchResults &&
                      searchResults.length === 0 &&
                      !isSearching &&
                      searchQuery.trim().length >= 3 && (
                        <div
                          role="status"
                          aria-live="polite"
                          className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-gray-800 border rounded-lg shadow-lg p-4 text-sm"
                        >
                          <div className="text-center text-muted-foreground">
                            <div
                              className="p-2 bg-muted rounded-full w-fit mx-auto mb-2"
                              aria-hidden="true"
                            >
                              <Search className="h-5 w-5" />
                            </div>
                            <div className="font-semibold mb-1 text-xs">
                              {searchError
                                ? "Pencarian Bermasalah"
                                : "Lokasi tidak ditemukan"}
                            </div>
                            <div className="text-xs">
                              {searchError
                                ? searchError
                                : "Coba kata kunci yang lebih umum atau periksa ejaan alamat."}
                            </div>
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  id="location-form"
                  className="space-y-4"
                >
                  {/* Form Fields */}
                  <div className="space-y-4">
                    {/* Location Name */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="name"
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <Building2 className="h-4 w-4" />
                        Nama Lokasi{" "}
                        <span className="text-muted-foreground">*</span>
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Contoh: Kantor Pusat, SMK Negeri 1 Jakarta"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        required
                        disabled={selectedLocationId === 1}
                        className="h-10"
                      />
                    </div>

                    {/* Latitude & Longitude */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label
                          htmlFor="latitude"
                          className="flex items-center gap-2 text-sm font-medium"
                        >
                          <MapPin className="h-4 w-4" />
                          Latitude{" "}
                          <span className="text-muted-foreground">*</span>
                        </Label>
                        <Input
                          id="latitude"
                          type="number"
                          step="any"
                          placeholder="-6.2088"
                          value={formData.latitude}
                          onChange={(e) =>
                            handleInputChange("latitude", e.target.value)
                          }
                          required
                          disabled={selectedLocationId === 1}
                          className="h-10 font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label
                          htmlFor="longitude"
                          className="flex items-center gap-2 text-sm font-medium"
                        >
                          <Globe className="h-4 w-4" />
                          Longitude{" "}
                          <span className="text-muted-foreground">*</span>
                        </Label>
                        <Input
                          id="longitude"
                          type="number"
                          step="any"
                          placeholder="106.8456"
                          value={formData.longitude}
                          onChange={(e) =>
                            handleInputChange("longitude", e.target.value)
                          }
                          required
                          disabled={selectedLocationId === 1}
                          className="h-10 font-mono text-sm"
                        />
                      </div>
                    </div>

                    {/* Distance */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="distance"
                        className="flex items-center gap-2 text-sm font-medium"
                      >
                        <Target className="h-4 w-4" />
                        Radius Absensi (meter){" "}
                        <span className="text-muted-foreground">*</span>
                      </Label>
                      <Input
                        id="distance"
                        type="number"
                        min="1"
                        max="10000"
                        placeholder="100"
                        value={formData.distance}
                        onChange={(e) =>
                          handleInputChange("distance", e.target.value)
                        }
                        required
                        disabled={selectedLocationId === 1}
                        className="h-10"
                      />
                      <p className="text-xs text-muted-foreground">
                        Siswa harus berada dalam radius ini untuk bisa absen
                        (1-10,000 meter)
                      </p>
                    </div>
                  </div>

                  {/* Helper Text */}
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Klik pada peta di bawah untuk memilih koordinat secara
                      visual, atau gunakan search box untuk mencari alamat.
                    </AlertDescription>
                  </Alert>
                </form>
              </div>

              {/* Map Section - Below Form */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4" />
                  <h4>Pemilih Lokasi</h4>
                </div>
                <div
                  className="border rounded-lg overflow-hidden shadow-md"
                  style={{ height: "500px" }}
                >
                  <LocationPicker
                    latitude={
                      formData.latitude
                        ? parseFloat(formData.latitude)
                        : -7.4771886
                    }
                    longitude={
                      formData.longitude
                        ? parseFloat(formData.longitude)
                        : 110.2182633
                    }
                    distance={
                      formData.distance ? parseInt(formData.distance) : 20
                    }
                    onLocationChange={handleLocationChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Klik pada peta atau drag marker untuk mengatur koordinat
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-6 border-t mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseForm}
                className="min-w-24"
              >
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              {!selectedLocationId && (
                <Button
                  type="button"
                  variant="warning"
                  onClick={handleReset}
                  disabled={resetMutation.isPending}
                  className="min-w-24"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              )}
              <Button
                type="submit"
                form="location-form"
                variant="success"
                disabled={
                  selectedLocationId === 1 ||
                  upsertMutation.isPending ||
                  updateMutation.isPending
                }
                className="min-w-32"
              >
                <Save className="mr-2 h-4 w-4" />
                {upsertMutation.isPending || updateMutation.isPending
                  ? "Menyimpan..."
                  : selectedLocationId === 1
                    ? "Read-only"
                    : selectedLocationId
                      ? "Update Lokasi"
                      : "Simpan Lokasi"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AlertDialog for Confirmations */}
      <AlertDialog
        open={Boolean(confirmDialog?.open)}
        onOpenChange={(open) => {
          if (!open) setConfirmDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialog(null)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmDialog?.actionVariant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={() => {
                confirmDialog?.onConfirm();
                setConfirmDialog(null);
              }}
            >
              {confirmDialog?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
