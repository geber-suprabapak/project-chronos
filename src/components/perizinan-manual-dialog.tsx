"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import {
    Dialog,
    DialogContent,
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
    Search,
    Upload,
    X,
    FileText,
    User,
} from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface StudentResult {
    nis: string;
    nama: string;
    kelas: string;
    absen: number | null;
    kelamin: string | null;
    userId: string;
}

export function PerizinanManualDialog() {
    const [open, setOpen] = useState(false);

    // Search & student selection
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedKelas, setSelectedKelas] = useState("");
    const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

    // Form fields
    const [kategoriIzin, setKategoriIzin] = useState<"sakit" | "pergi" | undefined>(undefined);
    const [date, setDate] = useState(new Date().toISOString().split("T")[0] ?? "");
    const [deskripsi, setDeskripsi] = useState("");

    // File upload
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const utils = api.useUtils();

    // Fetch unique classes for filter
    const { data: classList } = api.biodataSiswa.getUniqueClasses.useQuery();

    // Search students query (debounced via enabled flag)
    const [debouncedQuery, setDebouncedQuery] = useState("");

    useEffect(() => {
        if (searchQuery.length < 1) {
            setDebouncedQuery("");
            return;
        }
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { data: searchResults, isLoading: isSearching } =
        api.biodataSiswa.searchStudents.useQuery(
            {
                query: debouncedQuery,
                kelas: selectedKelas || undefined,
            },
            {
                enabled: debouncedQuery.length >= 1 && !selectedStudent,
            },
        );

    // Calculate dropdown position relative to input
    const updateDropdownPos = useCallback(() => {
        if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
            });
        }
    }, []);

    // Show dropdown when there are results
    useEffect(() => {
        if (searchResults && searchResults.length > 0 && !selectedStudent) {
            setShowDropdown(true);
            setHighlightedIndex(0);
            updateDropdownPos();
        } else if (!isSearching && debouncedQuery.length >= 1 && !selectedStudent) {
            setShowDropdown(true);
            updateDropdownPos();
        } else {
            setShowDropdown(false);
        }
    }, [searchResults, isSearching, debouncedQuery, selectedStudent, updateDropdownPos]);

    // Reposition dropdown on scroll/resize
    useEffect(() => {
        if (!showDropdown) return;
        const handleReposition = () => updateDropdownPos();
        window.addEventListener("scroll", handleReposition, true);
        window.addEventListener("resize", handleReposition);
        return () => {
            window.removeEventListener("scroll", handleReposition, true);
            window.removeEventListener("resize", handleReposition);
        };
    }, [showDropdown, updateDropdownPos]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Keyboard navigation for dropdown
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (!showDropdown || !searchResults) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev < searchResults.length - 1 ? prev + 1 : 0,
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                    prev > 0 ? prev - 1 : searchResults.length - 1,
                );
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (searchResults[highlightedIndex]) {
                    handleSelectStudent(searchResults[highlightedIndex]);
                }
            } else if (e.key === "Escape") {
                setShowDropdown(false);
            }
        },
        [showDropdown, searchResults, highlightedIndex],
    );

    const handleSelectStudent = (student: StudentResult) => {
        setSelectedStudent(student);
        setSearchQuery(student.nama);
        setShowDropdown(false);
    };

    const handleClearStudent = () => {
        setSelectedStudent(null);
        setSearchQuery("");
        setShowDropdown(false);
        inputRef.current?.focus();
    };

    // File upload handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validate file size (max 5MB)
        if (selectedFile.size > 5 * 1024 * 1024) {
            toast.error("Ukuran file maksimal 5MB");
            return;
        }

        // Validate file type
        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(selectedFile.type)) {
            toast.error("Format file harus JPG, PNG, WebP, atau PDF");
            return;
        }

        setFile(selectedFile);
    };

    const handleRemoveFile = () => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Upload file to Supabase Storage
    const uploadFile = async (file: File): Promise<string | null> => {
        try {
            const supabase = getSupabaseBrowserClient();
            const fileExt = file.name.split(".").pop() ?? "jpg";
            const fileName = `perizinan-manual/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

            const { data, error } = await supabase.storage
                .from("perizinan")
                .upload(fileName, file, {
                    cacheControl: "3600",
                    upsert: false,
                });

            if (error) {
                console.error("Upload error:", error);
                throw new Error(`Upload gagal: ${error.message}`);
            }

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from("perizinan")
                .getPublicUrl(data.path);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.error("Upload error:", error);
            throw error;
        }
    };

    // Create perizinan mutation
    const createPerizinan = api.perizinan.createManual.useMutation({
        onSuccess: async () => {
            toast.success("Perizinan berhasil ditambahkan!");

            await Promise.all([
                utils.perizinan.list.invalidate(),
                utils.perizinan.listRaw.invalidate(),
            ]);

            resetForm();
            setOpen(false);
        },
        onError: (error) => {
            toast.error(`Gagal menambahkan perizinan: ${error.message}`);
        },
    });

    const resetForm = () => {
        setSearchQuery("");
        setSelectedStudent(null);
        setSelectedKelas("");
        setKategoriIzin(undefined);
        setDate(new Date().toISOString().split("T")[0] ?? "");
        setDeskripsi("");
        setFile(null);
        setIsUploading(false);
        setShowDropdown(false);
        setHighlightedIndex(0);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedStudent) {
            toast.error("Pilih siswa terlebih dahulu");
            return;
        }
        if (!kategoriIzin) {
            toast.error("Pilih kategori izin");
            return;
        }
        if (!date) {
            toast.error("Pilih tanggal perizinan");
            return;
        }
        if (!deskripsi.trim()) {
            toast.error("Masukkan deskripsi/alasan perizinan");
            return;
        }

        let linkFoto: string | undefined;

        // Upload file if provided
        if (file) {
            setIsUploading(true);
            try {
                const url = await uploadFile(file);
                if (url) linkFoto = url;
            } catch {
                toast.error("Gagal mengupload bukti perizinan");
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
        }

        createPerizinan.mutate({
            userId: selectedStudent.userId,
            kategoriIzin,
            tanggal: date,
            deskripsi: deskripsi.trim(),
            linkFoto,
        });
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            resetForm();
        }
    };

    const isPending = createPerizinan.isPending || isUploading;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="warning" size="default">
                    <ClipboardPlus className="h-4 w-4" />
                    Perizinan Manual
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardPlus className="h-5 w-5" />
                        Perizinan Manual
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Kelas Filter */}
                    <div className="space-y-2">
                        <Label htmlFor="kelas-filter">Filter Kelas</Label>
                        <Select
                            value={selectedKelas || "all"}
                            onValueChange={(v) => {
                                setSelectedKelas(v === "all" ? "" : v);
                                // Reset student selection when changing kelas
                                if (selectedStudent) {
                                    handleClearStudent();
                                }
                            }}
                            disabled={isPending}
                        >
                            <SelectTrigger id="kelas-filter">
                                <SelectValue placeholder="Semua Kelas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Kelas</SelectItem>
                                {(classList ?? []).map((kelas) => (
                                    <SelectItem key={kelas} value={kelas!}>
                                        {kelas}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Student Search with Dropdown */}
                    <div className="space-y-2">
                        <Label htmlFor="student-search">Cari Siswa (Nama / NIS)</Label>
                        <div className="relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    ref={inputRef}
                                    id="student-search"
                                    type="text"
                                    placeholder="Ketik nama atau NIS siswa..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (selectedStudent) {
                                            setSelectedStudent(null);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (searchResults && searchResults.length > 0 && !selectedStudent) {
                                            setShowDropdown(true);
                                        }
                                    }}
                                    onKeyDown={handleKeyDown}
                                    disabled={isPending}
                                    className="pl-9 pr-10"
                                    autoComplete="off"
                                />
                                {isSearching && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                                {selectedStudent && (
                                    <button
                                        type="button"
                                        onClick={handleClearStudent}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Results - rendered via Portal to escape dialog overflow */}
                            {showDropdown && dropdownPos && createPortal(
                                <div
                                    ref={dropdownRef}
                                    className="fixed z-[9999] rounded-md border bg-popover shadow-xl max-h-[240px] overflow-y-auto"
                                    style={{
                                        top: dropdownPos.top,
                                        left: dropdownPos.left,
                                        width: dropdownPos.width,
                                    }}
                                >
                                    {isSearching ? (
                                        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            Mencari...
                                        </div>
                                    ) : searchResults && searchResults.length > 0 ? (
                                        searchResults.map((student, index) => (
                                            <button
                                                key={student.nis}
                                                type="button"
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
                                                    index === highlightedIndex
                                                        ? "bg-accent"
                                                        : ""
                                                }`}
                                                onClick={() => handleSelectStudent(student)}
                                                onMouseEnter={() => setHighlightedIndex(index)}
                                            >
                                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">
                                                        {student.nama}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        NIS: {student.nis} • {student.kelas}
                                                        {student.absen ? ` • No. ${student.absen}` : ""}
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="py-4 text-center text-sm text-muted-foreground">
                                            Siswa tidak ditemukan
                                        </div>
                                    )}
                                </div>,
                                document.body,
                            )}
                        </div>
                    </div>

                    {/* Selected Student Info */}
                    {selectedStudent && (
                        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                            <CheckCircle2 className="text-green-600" />
                            <AlertDescription className="text-green-700 dark:text-green-400">
                                <div className="font-semibold">{selectedStudent.nama}</div>
                                <div className="text-sm">
                                    NIS: {selectedStudent.nis} • Kelas {selectedStudent.kelas}
                                    {selectedStudent.absen ? ` • Absen #${selectedStudent.absen}` : ""}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Form fields - Only show after student is selected */}
                    {selectedStudent && (
                        <>
                            {/* Kategori Izin */}
                            <div className="space-y-2">
                                <Label htmlFor="kategori">Kategori Izin</Label>
                                <Select
                                    value={kategoriIzin}
                                    onValueChange={(v: "sakit" | "pergi") => setKategoriIzin(v)}
                                    disabled={isPending}
                                >
                                    <SelectTrigger id="kategori">
                                        <SelectValue placeholder="Pilih kategori izin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sakit">Sakit</SelectItem>
                                        <SelectItem value="pergi">Izin / Pergi</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Tanggal */}
                            <div className="space-y-2">
                                <Label htmlFor="tanggal">Tanggal</Label>
                                <Input
                                    id="tanggal"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>

                            {/* Deskripsi */}
                            <div className="space-y-2">
                                <Label htmlFor="deskripsi">Deskripsi / Alasan</Label>
                                <Textarea
                                    id="deskripsi"
                                    placeholder="Tuliskan alasan perizinan..."
                                    value={deskripsi}
                                    onChange={(e) => setDeskripsi(e.target.value)}
                                    disabled={isPending}
                                    rows={3}
                                />
                            </div>

                            {/* Upload Bukti */}
                            <div className="space-y-2">
                                <Label>Bukti Perizinan (Opsional)</Label>
                                {!file ? (
                                    <div
                                        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm font-medium">
                                            Klik untuk upload bukti
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            JPG, PNG, WebP, atau PDF (Maks. 5MB)
                                        </p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,application/pdf"
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/30">
                                        <div className="flex-shrink-0 h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {(file.size / 1024).toFixed(1)} KB
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleRemoveFile}
                                            disabled={isPending}
                                            className="flex-shrink-0"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
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
                                    disabled={isPending}
                                >
                                    Batal
                                </Button>
                                <Button
                                    type="submit"
                                    variant="warning"
                                    className="flex-1"
                                    disabled={isPending || !kategoriIzin || !deskripsi.trim()}
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="animate-spin" />
                                            {isUploading ? "Mengupload..." : "Menyimpan..."}
                                        </>
                                    ) : (
                                        "Simpan Perizinan"
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
