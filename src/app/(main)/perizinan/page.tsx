
"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";

import Link from "next/link";
import { api } from "~/trpc/react";
import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { FilterBar, type FilterBarValue } from "~/components/filter-bar";

// Helper function to format date
const formatDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

// Helper to determine badge variant based on status
const getBadgeVariant = (status: string | null) => {
  switch (status) {
    case "approved":
      return "success" as const;
    case "rejected":
      return "destructive" as const;
    case "pending":
    default:
      return "secondary" as const;
  }
};

export default function PerizinanPage() {
  const [filter, setFilter] = useState<FilterBarValue>({ sort: "desc" });
  const { data: profiles } = api.userProfiles.listRaw.useQuery();
  const profileByUserId = useMemo(() => {
    const map = new Map<string, { fullName?: string | null; email: string }>();
    for (const p of profiles ?? []) {
      if (p.id) map.set(p.id, { fullName: p.fullName, email: p.email });
    }
    return map;
  }, [profiles]);
  const {
    data: perizinan,
    isLoading,
    error,
  } = api.perizinan.list.useQuery(
    {
      approvalStatus: filter.status || undefined,
      tanggal: filter.date || undefined,
    },
    {
      refetchOnWindowFocus: false, // Optional: disable refetch on window focus
    },
  );

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-red-500">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Daftar Perizinan</CardTitle>
            <CardDescription>
              Berikut adalah daftar semua perizinan yang tercatat.
            </CardDescription>
          </div>
          <DownloadPdfButton tableId="perizinan-table" filename="perizinan.pdf" title="Data Perizinan" disabled={isLoading || !(perizinan && perizinan.length > 0)} />
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <FilterBar
              value={filter}
              onChange={setFilter}
              statuses={["approved", "rejected", "pending"]}
              labels={{ query: "Cari Nama", status: "Approval", date: "Tanggal" }}
              placeholders={{ query: "Nama...", status: "Pilih status" }}
            />
          </div>
          {(() => {
            const q = (filter.query ?? "").trim().toLowerCase();
            let rows = (perizinan ?? []).filter((p) => {
              if (!q) return true;
              const name = profileByUserId.get(p.userId)?.fullName ?? profileByUserId.get(p.userId)?.email ?? "";
              return name.toLowerCase().includes(q);
            });
            rows = rows.sort((a, b) => {
              const da = new Date(a.tanggal).getTime();
              const db = new Date(b.tanggal).getTime();
              return (filter.sort ?? "desc") === "desc" ? db - da : da - db;
            });
            return (
              <Table id="perizinan-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    // Skeleton loading state
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-20" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Skeleton className="h-8 w-16 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows && rows.length > 0 ? (
                    rows.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.tanggal)}</TableCell>
                        <TableCell>
                          {(() => {
                            const prof = profileByUserId.get(item.userId);
                            return prof?.fullName ?? prof?.email ?? item.userId;
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full px-2.5 py-1">
                            {item.kategoriIzin}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.deskripsi}</TableCell>
                        <TableCell>
                          <Badge
                            variant={getBadgeVariant(item.approvalStatus)}
                            className="rounded-full px-2.5 py-1 capitalize"
                          >
                            {item.approvalStatus ?? "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/perizinan/show/${item.id}`} passHref>
                            <Button variant="outline" size="sm">
                              Detail
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        Tidak ada data perizinan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
