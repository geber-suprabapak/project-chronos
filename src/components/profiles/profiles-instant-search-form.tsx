"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

/**
 * Komponen form pencarian instan untuk halaman Profiles.
 * - Mengubah query string URL secara realtime (debounce 400ms) tanpa reload penuh.
 * - Reset page ke 1 saat filter berubah.
 * - Menyediakan tombol reset jika ada filter aktif.
 */
export function ProfilesInstantSearchForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const initialName = searchParams.get("name") ?? "";
    const [name, setName] = useState(initialName);
    const [openSuggest, setOpenSuggest] = useState(false);

    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    const buildAndPush = useCallback((n: string) => {
        const params = new URLSearchParams();
        if (n.trim()) params.set("name", n.trim());
        // Selalu reset page ke 1 setiap filter berubah
        params.set("page", "1");
        const qs = params.toString();
        router.replace(`/profiles${qs ? `?${qs}` : ""}`);
    }, [router]);

    // Debounce push URL (navigasi server render) ketika filter berubah
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            buildAndPush(name);
        }, 400);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [name, buildAndPush]);

    // Query suggestions jalan ketika ada minimal 1 karakter
    const enableSuggest = name.trim().length >= 1;
    const { data: suggestData, isFetching: suggestLoading } = api.userProfiles.list.useQuery(
        { limit: 8, offset: 0, name: name.trim() || undefined },
        { enabled: enableSuggest }
    );

    // Tutup suggestions saat klik luar
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            const target = e.target as HTMLElement;
            if (!target.closest?.('#profiles-search-wrapper')) {
                setOpenSuggest(false);
            }
        }
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, []);

    const hasActive = (name.trim() !== "");

    const onReset = () => {
        setName("");
        router.replace("/profiles?page=1");
    };

    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-2 flex-1 min-w-[260px] relative" id="profiles-search-wrapper">
                <label htmlFor="profiles-name" className="text-sm font-medium">Cari Nama</label>
                <Input
                    id="profiles-name"
                    placeholder="Ketik nama siswa..."
                    value={name}
                    autoComplete="off"
                    onFocus={() => { if (enableSuggest) setOpenSuggest(true); }}
                    onChange={(e) => {
                        setName(e.target.value);
                        if (!openSuggest) setOpenSuggest(true);
                    }}
                />
                {openSuggest && enableSuggest && (
                    <div className="absolute z-20 top-full mt-1 w-full rounded-md border bg-popover shadow-md max-h-72 overflow-auto">
                        <div className="p-1 text-xs text-muted-foreground flex items-center justify-between">
                            <span>{suggestLoading ? 'Memuat...' : (suggestData?.data?.length ? `${suggestData.data.length} hasil` : 'Tidak ada hasil')}</span>
                            {suggestLoading && <span className="animate-pulse">...</span>}
                        </div>
                        <ul className="divide-y">
                            {(suggestData?.data ?? []).map(row => (
                                <li key={row.id ?? row.email}>
                                    <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground text-sm flex flex-col"
                                        onClick={() => {
                                            // Set nama persis & dorong URL segera
                                            const chosen = row.fullName ?? '';
                                            setName(chosen);
                                            setOpenSuggest(false);
                                            buildAndPush(chosen);
                                        }}
                                    >
                                        <span className="font-medium line-clamp-1">{row.fullName ?? '-'}</span>
                                        <span className="text-[10px] text-muted-foreground">{row.className ?? '—'} · {row.email}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            {hasActive && (
                <div className="flex items-end">
                    <Button type="button" variant="outline" onClick={onReset}>Reset</Button>
                </div>
            )}
        </div>
    );
}
