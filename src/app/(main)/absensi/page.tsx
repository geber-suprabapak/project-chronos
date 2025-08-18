"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";

export default function AbsensiPage() {
  // Fetch absences with a reasonable default page size
  const {
    data: absences,
    isLoading: absencesLoading,
    error: absencesError,
  } = api.absences.list.useQuery({ limit: 50, offset: 0, sort: "desc" });

  // Fetch user profiles (raw) to map userId -> fullName/email
  const {
    data: profiles,
    isLoading: profilesLoading,
    error: profilesError,
  } = api.userProfiles.listRaw.useQuery();

  const profileByUserId = useMemo(() => {
    const map = new Map<string, { fullName?: string | null; email: string }>();
    for (const p of profiles ?? []) {
      map.set(p.userId, { fullName: p.fullName, email: p.email });
    }
    return map;
  }, [profiles]);

  const loading = absencesLoading || profilesLoading;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Daftar Absensi</h1>
        <p className="text-muted-foreground text-sm">Ringkasan absensi terbaru</p>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Foto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(absences ?? []).map((a) => {
                const prof = profileByUserId.get(a.userId);
                const name = prof?.fullName ?? prof?.email ?? a.userId;
                const tanggal = typeof a.date === "string" ? a.date : String(a.date);
                const lokasi = [a.latitude, a.longitude].filter((v) => v != null).join(", ");
                return (
                  <TableRow key={`${a.id}`}>
                    <TableCell>{tanggal}</TableCell>
                    <TableCell>{name}</TableCell>
                    <TableCell>{a.status ?? "-"}</TableCell>
                    <TableCell className="max-w-[28rem] truncate" title={a.reason ?? undefined}>
                      {a.reason ?? "-"}
                    </TableCell>
                    <TableCell>{lokasi || "-"}</TableCell>
                    <TableCell>
                      {a.photoUrl ? (
                        <a
                          href={a.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline"
                        >
                          Lihat
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
