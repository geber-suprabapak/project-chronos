
"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";

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
    const map = new Map<string, { fullName?: string | null; email: string | null }>();
    for (const p of profiles ?? []) {
      if (p.id) map.set(p.id, { fullName: p.fullName, email: p.email });
    }
    return map;
  }, [profiles]);
  const {
    data: perizinan,
    isLoading,
    error,
  } = api.perizinan.listRaw.useQuery(
    undefined,
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
    <div className="p-2 sm:p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <CardTitle>Daftar Perizinan</CardTitle>
            <CardDescription>
              Berikut adalah daftar semua perizinan yang tercatat.
            </CardDescription>
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-start sm:justify-end">
            <DownloadExcelButton href="/api/export/perizinan" filename="perizinan.xlsx" disabled={isLoading || !(perizinan && perizinan.length > 0)} />
            <DownloadPdfButton tableId="perizinan-table" filename="perizinan.pdf" title="Data Perizinan" disabled={isLoading || !(perizinan && perizinan.length > 0)} />
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            value={filter}
            onChange={setFilter}
            statuses={["approved", "rejected", "pending"]}
            labels={{ query: "Cari Nama", status: "Approval", date: "Tanggal" }}
            placeholders={{ query: "Nama...", status: "Pilih status" }}
            className="mb-4"
          />
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
              <>
                {/* Visible table for UI */}
                <div className="overflow-x-auto max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                {/* Hidden table for PDF export with optimized columns */}
                <div className="hidden">
                  <Table id="perizinan-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows && rows.length > 0 ? (
                        rows.map((item) => {
                          const prof = profileByUserId.get(item.userId);
                          const name = prof?.fullName ?? prof?.email ?? item.userId;

                          return (
                            <TableRow key={`${item.id}-pdf`}>
                              <TableCell>{formatDate(item.tanggal)}</TableCell>
                              <TableCell>{name}</TableCell>
                              <TableCell>{item.kategoriIzin}</TableCell>
                              <TableCell>{item.deskripsi}</TableCell>
                              <TableCell>{item.approvalStatus ?? "pending"}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center">
                            Tidak ada data perizinan.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
