
"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";

import { useMemo, useState } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Eye } from "lucide-react";
import { FilterBar, type FilterBarValue } from "~/components/filter-bar";

export default function AbsensiPage() {
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [sort, setSort] = useState<"asc" | "desc">("desc"); // newest (desc) by default
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const filter: FilterBarValue = { date: date || undefined, query, status: status || undefined, sort };
  // Fetch absences with a reasonable default page size
  const {
    data: absences,
    isLoading: absencesLoading,
    error: absencesError,
  } = api.absences.list.useQuery({ limit: 50, offset: 0, sort, date: date || undefined, status: status || undefined });

  // Fetch user profiles (raw) to map userId -> fullName/email
  const {
    data: profiles,
    isLoading: profilesLoading,
    error: profilesError,
  } = api.userProfiles.listRaw.useQuery();

  const profileByUserId = useMemo(() => {
    const map = new Map<string, { fullName?: string | null; email: string; nis?: string | null }>();
    for (const p of profiles ?? []) {
      // user_profiles uses `id` (UUID PK). Absences `userId` references this.
      if (p.id) {
        map.set(p.id, { fullName: p.fullName, email: p.email, nis: p.nis ?? null });
      }
    }
    return map;
  }, [profiles]);

  const loading = absencesLoading || profilesLoading;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daftar Absensi</h1>
          <p className="text-muted-foreground text-sm">Ringkasan absensi terbaru</p>
        </div>
        <DownloadPdfButton tableId="absensi-table" filename="absensi.pdf" title="Data Absensi" disabled={loading || (absences && absences.length === 0)} />
      </div>

      <Card className="p-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : absencesError || profilesError ? (
          <div className="text-red-600">
            {absencesError?.message ?? profilesError?.message ?? "Terjadi kesalahan saat memuat data."}
          </div>
        ) : (
          <>
            {/* Reusable filter bar */}
            <FilterBar
              value={filter}
              statuses={["Hadir", "Pulang"]}
              onChange={(next) => {
                setDate(next.date ?? "");
                setQuery(next.query ?? "");
                setStatus(next.status ?? "");
                setSort(next.sort ?? "desc");
              }}
            />

            {(() => {
              const rows = (absences ?? []).filter((a) => {
                const q = query.trim().toLowerCase();
                if (!q) return true;
                const prof = profileByUserId.get(a.userId);
                const hayName = `${prof?.fullName ?? ""}`.toLowerCase();
                return hayName.includes(q);
              });
              const rows2 = rows.filter((a) => {
                if (!status) return true;
                return (a.status ?? "").toLowerCase() === status.toLowerCase();
              });
              return (
                <Table id="absensi-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows2.map((a) => {
                      const prof = profileByUserId.get(a.userId);
                      const name = prof?.fullName ?? prof?.email ?? a.userId;
                      const tanggal = typeof a.date === "string" ? a.date : String(a.date);
                      const lokasi = [a.latitude, a.longitude].filter((v) => v != null).join(", ");
                      return (
                        <TableRow key={`${a.id}`}>
                          <TableCell>{tanggal}</TableCell>
                          <TableCell>{name}</TableCell>
                          <TableCell>{a.status ?? "-"}</TableCell>
                          <TableCell>{lokasi || "-"}</TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button asChild variant="outline" size="icon" aria-label="Detail absensi">
                                    <Link href={`/absensi/show/${a.id}`}>
                                      <Eye className="h-4 w-4" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Detail</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              );
            })()}
          </>
        )}
      </Card>
    </div>
  );
}
