"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  ClipboardPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  ImagePlus,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface SiswaResult {
  nis: string;
  nama: string | null;
  kelas: string | null;
  absen: number | null;
}

interface IzinManualDialogProps {
  trigger?: React.ReactNode;
}

export function IzinManualDialog({ trigger }: IzinManualDialogProps = {}) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState<SiswaResult | null>(null);
  const [kategori, setKategori] = useState<"sakit" | "pergi" | undefined>(
    undefined,
  );
  const [deskripsi, setDeskripsi] = useState("");
  const [linkFoto, setLinkFoto] = useState("");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = api.useUtils();

  // Search siswa by name or NIS
  const { data: searchResults, isFetching: isSearching } =
    api.biodataSiswa.list.useQuery(
      {
        nama: searchQuery,
        limit: 10,
        offset: 0,
        activated: true,
      },
      {
        enabled: searchQuery.length >= 2,
      },
    );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mutation for creating izin
  const createIzin = api.perizinan.createManual.useMutation({
    onSuccess: async () => {
      toast.success("Izin berhasil ditambahkan!");

      // Invalidate queries to refresh data
      await Promise.all([
        utils.perizinan.list.invalidate(),
        utils.perizinan.listRaw.invalidate(),
      ]);

      // Reset form
      resetForm();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Gagal menambahkan izin: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSearchQuery("");
    setSelectedSiswa(null);
    setKategori(undefined);
    setDeskripsi("");
    setLinkFoto("");
    setDate(new Date().toISOString().split("T")[0] ?? "");
    setShowDropdown(false);
    setActiveIndex(-1);
    setUploadFile(null);
    setUploadPreview(null);
    setIsUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Hanya file gambar yang diperbolehkan");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB");
      return;
    }

    setUploadFile(file);
    setLinkFoto(""); // clear URL if file is chosen

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      // SAFETY: FileReader readAsDataURL sets reader.result to a data URL string
      setUploadPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeFile = () => {
    setUploadFile(null);
    setUploadPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadToAstra = async (file: File): Promise<string | null> => {
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/astra/files", {
        method: "POST",
        body: form,
      });
      // SAFETY: The response was checked by the caller path and is decoded only for the upload contract fields.
      const result = (await response.json()) as {
        url?: string;
        file_id?: string;
        error?: string;
      };
      if (!response.ok || (!result.url && !result.file_id)) {
        toast.error(result.error ?? "Gagal upload foto");
        return null;
      }
      return result.file_id ?? result.url ?? null;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Gagal upload foto");
      return null;
    }
  };

  const handleSelectSiswa = (siswa: SiswaResult) => {
    setSelectedSiswa({
      nis: siswa.nis,
      nama: siswa.nama,
      kelas: siswa.kelas,
      absen: siswa.absen,
    });
    setSearchQuery(`${siswa.nama ?? "Tanpa Nama"} - ${siswa.nis}`);
    setShowDropdown(false);
    setActiveIndex(-1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSiswa) {
      toast.error("Pilih siswa terlebih dahulu");
      return;
    }

    if (!kategori) {
      toast.error("Pilih kategori izin");
      return;
    }

    if (!date) {
      toast.error("Pilih tanggal izin");
      return;
    }

    let finalLinkFoto = linkFoto || undefined;

    // Upload file if selected
    if (uploadFile) {
      setIsUploading(true);
      const uploadedUrl = await uploadToAstra(uploadFile);
      setIsUploading(false);

      if (!uploadedUrl) {
        return; // upload failed, error toast already shown
      }
      finalLinkFoto = uploadedUrl;
    }
    createIzin.mutate({
      nis: selectedSiswa.nis,
      kategoriIzin: kategori,
      deskripsi: deskripsi || undefined,
      linkFoto: finalLinkFoto,
      tanggal: date,
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="warning" size="default">
            <ClipboardPlus />
            Izin Manual
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPlus />
            Izin Manual
          </DialogTitle>
          <DialogDescription className="sr-only">
            Form pembuatan izin manual
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search Siswa Input with Dropdown */}
          <div className="space-y-2">
            <Label htmlFor="search-siswa">Cari Nama / NIS Siswa</Label>
            <div className="relative">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  ref={inputRef}
                  id="search-siswa"
                  type="text"
                  role="combobox"
                  aria-expanded={
                    showDropdown && searchQuery.length >= 2 && !selectedSiswa
                  }
                  aria-controls="siswa-search-results"
                  aria-autocomplete="list"
                  aria-activedescendant={
                    activeIndex >= 0 && searchResults?.data?.[activeIndex]
                      ? `siswa-option-${searchResults.data[activeIndex]?.nis}`
                      : undefined
                  }
                  placeholder="Ketik nama atau NIS siswa..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedSiswa(null);
                    setActiveIndex(-1);
                    if (e.target.value.length >= 2) {
                      setShowDropdown(true);
                    } else {
                      setShowDropdown(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    const results = searchResults?.data ?? [];
                    if (e.key === "Escape") {
                      setShowDropdown(false);
                      setActiveIndex(-1);
                      return;
                    }
                    if (
                      !showDropdown &&
                      (e.key === "ArrowDown" || e.key === "ArrowUp")
                    ) {
                      if (searchQuery.length >= 2 && results.length > 0) {
                        setShowDropdown(true);
                        setActiveIndex(0);
                        e.preventDefault();
                      }
                      return;
                    }
                    if (showDropdown && results.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex((prev) =>
                          prev + 1 >= results.length ? 0 : prev + 1,
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex((prev) =>
                          prev <= 0 ? results.length - 1 : prev - 1,
                        );
                      } else if (e.key === "Enter") {
                        if (activeIndex >= 0 && activeIndex < results.length) {
                          e.preventDefault();
                          const selected = results[activeIndex];
                          if (selected) {
                            handleSelectSiswa(selected);
                          }
                        }
                      }
                    }
                  }}
                  onFocus={() => {
                    if (searchQuery.length >= 2 && !selectedSiswa) {
                      setShowDropdown(true);
                    }
                  }}
                  disabled={createIzin.isPending}
                  className="pl-9 pr-10"
                />
                {isSearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2
                      className="h-4 w-4 animate-spin text-muted-foreground"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>

              {/* Dropdown results - positioned to overflow dialog */}
              {showDropdown && searchQuery.length >= 2 && !selectedSiswa && (
                <div
                  ref={dropdownRef}
                  id="siswa-search-results"
                  role="listbox"
                  aria-label="Hasil pencarian siswa"
                  className="absolute z-[9999] top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg"
                >
                  {isSearching ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2
                        className="h-4 w-4 animate-spin mr-2"
                        aria-hidden="true"
                      />
                      <span className="text-sm text-muted-foreground">
                        Mencari...
                      </span>
                    </div>
                  ) : searchResults?.data && searchResults.data.length > 0 ? (
                    searchResults.data.map((siswa, idx) => (
                      <div
                        key={siswa.nis.toString()}
                        id={`siswa-option-${siswa.nis}`}
                        role="option"
                        tabIndex={-1}
                        aria-selected={idx === activeIndex}
                        className={cn(
                          "w-full text-left px-3 py-2 transition-colors border-b last:border-b-0 cursor-pointer select-none",
                          idx === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground",
                        )}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => handleSelectSiswa(siswa)}
                      >
                        <div className="font-medium text-sm">
                          {siswa.nama ?? "Tanpa Nama"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          NIS: {siswa.nis.toString()} • Kelas{" "}
                          {siswa.kelas ?? "-"} • No. Absen {siswa.absen ?? "-"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Siswa tidak ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <p className="text-xs text-muted-foreground">
                Minimal 2 karakter untuk pencarian
              </p>
            )}
          </div>

          {/* Selected Siswa Info */}
          {selectedSiswa && (
            <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800">
              <CheckCircle2 className="text-emerald-700 dark:text-emerald-400" />
              <AlertDescription className="text-emerald-800 dark:text-emerald-300">
                <div className="font-semibold">
                  {selectedSiswa.nama ?? "Nama tidak tersedia"}
                </div>
                <div className="text-sm">
                  NIS: {selectedSiswa.nis} • Kelas {selectedSiswa.kelas ?? "-"}{" "}
                  • Absen #{selectedSiswa.absen ?? "-"}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {searchQuery.length >= 5 &&
            !isSearching &&
            !selectedSiswa &&
            searchResults?.data?.length === 0 && (
              <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
                <AlertCircle className="text-red-600" />
                <AlertDescription className="text-red-700 dark:text-red-400">
                  Siswa tidak ditemukan. Cek kembali nama atau NIS yang
                  dimasukkan.
                </AlertDescription>
              </Alert>
            )}

          {/* Form fields - Only show if siswa selected */}
          {selectedSiswa && (
            <>
              {/* Kategori Izin */}
              <div className="space-y-2">
                <Label htmlFor="kategori">Kategori Izin</Label>
                <Select
                  value={kategori}
                  onValueChange={(v: "sakit" | "pergi") => setKategori(v)}
                >
                  <SelectTrigger id="kategori">
                    <SelectValue placeholder="Pilih kategori izin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sakit">Sakit</SelectItem>
                    <SelectItem value="pergi">Pergi / Izin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tanggal */}
              <div className="space-y-2">
                <Label htmlFor="date-izin">Tanggal</Label>
                <Input
                  id="date-izin"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={createIzin.isPending}
                />
              </div>

              {/* Deskripsi */}
              <div className="space-y-2">
                <Label htmlFor="deskripsi">Deskripsi</Label>
                <Textarea
                  id="deskripsi"
                  placeholder="Keterangan izin (opsional)"
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  disabled={createIzin.isPending}
                  rows={3}
                />
              </div>

              {/* Lampirkan Foto */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4" />
                  Lampirkan Foto
                </Label>

                {/* File Upload Area */}
                {!uploadFile && !linkFoto && (
                  <button
                    type="button"
                    className="w-full border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    aria-label="Upload Foto Surat Izin"
                  >
                    <Upload
                      className="h-8 w-8 mx-auto mb-2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-medium">Upload Foto</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Klik atau tekan Enter untuk pilih gambar (maks 5MB)
                    </p>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={createIzin.isPending || isUploading}
                />

                {/* Upload Preview */}
                {uploadPreview && uploadFile && (
                  <div className="relative rounded-lg border overflow-hidden">
                    <img
                      src={uploadPreview}
                      alt="Preview Foto Surat Izin"
                      className="w-full max-h-40 object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label="Hapus foto"
                        className="h-6 w-6 rounded-full"
                        onClick={removeFile}
                        disabled={createIzin.isPending || isUploading}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">Hapus foto</span>
                      </Button>
                    </div>
                    <div className="p-2 bg-muted/50 text-xs truncate">
                      {uploadFile.name}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
                  disabled={createIzin.isPending}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="warning"
                  className="flex-1"
                  disabled={createIzin.isPending || isUploading || !kategori}
                >
                  {createIzin.isPending || isUploading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      {isUploading ? "Mengupload..." : "Menyimpan..."}
                    </>
                  ) : (
                    "Simpan Izin"
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
