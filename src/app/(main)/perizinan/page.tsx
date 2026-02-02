"use client";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";

import Link from "next/link";
import { api } from "~/trpc/react";
import { useState } from "react";
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
      return "success" as const; // green
    case "rejected":
      return "destructive" as const; // red
    case "pending":
    default:
      return "outline" as const;
  }
};

export default function PerizinanPage() {
  const [filter, setFilter] = useState<FilterBarValue>({ sort: "desc" });
  const [page, setPage] = useState<number>(1);

  const limit = 20;
  const offset = (page - 1) * limit;

  const {
    data: perizinan,
    isLoading,
    error,
  } = api.perizinan.list.useQuery(
    {
      limit,
      offset,
      tanggal: filter.date ?? undefined,
      approvalStatus: filter.status ?? undefined,
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
            <DownloadExcelButton
              href="/api/export/perizinan"
              filename="perizinan.xlsx"
              disabled={isLoading || !(perizinan && perizinan.length > 0)}
            />
            <DownloadPdfButton
              tableId="perizinan-table"
              filename="perizinan.pdf"
              title="Data Perizinan"
              disabled={isLoading || !(perizinan && perizinan.length > 0)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <FilterBar
            value={filter}
            onChange={(newFilter) => {
              setFilter(newFilter);
              setPage(1); // Reset to page 1 when filter changes
            }}
            statuses={["approved", "rejected", "pending"]}
            labels={{ query: "Cari Nama", status: "Approval", date: "Tanggal" }}
            placeholders={{ query: "Nama...", status: "Pilih status" }}
            className="mb-4"
          />
          {(() => {
            const q = (filter.query ?? "").trim().toLowerCase();
            let rows = (perizinan ?? []).filter((p) => {
              if (!q) return true;
              const name =
                p.userProfile?.fullName ?? p.userProfile?.email ?? "";
              return name.toLowerCase().includes(q);
            });
            rows = rows.sort((a, b) => {
              const da = new Date(a.tanggal).getTime();
              const db = new Date(b.tanggal).getTime();
              return (filter.sort ?? "desc") === "desc" ? db - da : da - db;
            });
            const hasMore = rows.length === limit;

            return (
              <>
                {/* Pagination Info */}
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                  <span>
                    Halaman {page} - Menampilkan {rows.length} data
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasMore}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>

                {/* Visible table for UI */}
                <div className="overflow-x-auto max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">No</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
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
                              <Skeleton className="h-4 w-8" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-40" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-4 w-20" />
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
                        rows.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-muted-foreground">
                              {offset + index + 1}
                            </TableCell>
                            <TableCell>{formatDate(item.tanggal)}</TableCell>
                            <TableCell>
                              {item.userProfile?.fullName ??
                                item.userProfile?.email ??
                                item.userId}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="rounded-full px-2.5 py-0.5 font-medium"
                              >
                                {item.userProfile?.className ?? "-"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="rounded-full px-2.5 py-1"
                              >
                                {item.kategoriIzin ?? "-"}
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
                              <Link
                                href={`/perizinan/show/${item.id}`}
                                passHref
                              >
                                <Button variant="outline" size="sm">
                                  Detail
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center">
                            Tidak ada data perizinan.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Hidden table for PDF export with optimized columns */}
                <div className="hidden">
                  <Table id="perizinan-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Deskripsi</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows && rows.length > 0 ? (
                        rows.map((item, index) => {
                          const name =
                            item.userProfile?.fullName ??
                            item.userProfile?.email ??
                            item.userId;

                          return (
                            <TableRow key={`${item.id}-pdf`}>
                              <TableCell>{offset + index + 1}</TableCell>
                              <TableCell>{formatDate(item.tanggal)}</TableCell>
                              <TableCell>{name}</TableCell>
                              <TableCell>
                                {item.userProfile?.className ?? "-"}
                              </TableCell>
                              <TableCell>{item.kategoriIzin ?? "-"}</TableCell>
                              <TableCell>{item.deskripsi}</TableCell>
                              <TableCell>
                                {item.approvalStatus ?? "pending"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center">
                            Tidak ada data perizinan.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Bottom Pagination */}
                <div className="flex items-center justify-between text-sm text-muted-foreground mt-3">
                  <span>
                    Halaman {page} - Menampilkan {rows.length} data
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasMore}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
