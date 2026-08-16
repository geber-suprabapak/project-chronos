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

const formatCompactDate = (dateString: string | Date) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const getDateSortValue = (value: string | Date) => {
  if (value instanceof Date) return value.getTime();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime();
  }
  return new Date(value).getTime();
};

const formatInputDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [filter, setFilter] = useState<FilterBarValue>({});
  const [page, setPage] = useState<number>(1);

  const queryText = (filter.query ?? "").trim().toLowerCase();
  const isSearchingByName = queryText.length > 0;

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
      tanggal: isSearchingByName ? undefined : (filter.date ?? undefined),
      approvalStatus: filter.status ?? undefined,
    },
    {
      enabled: !isSearchingByName,
      refetchOnWindowFocus: false, // Optional: disable refetch on window focus
    },
  );

  const {
    data: perizinanRaw,
    isLoading: isLoadingRaw,
    error: rawError,
  } = api.perizinan.listRaw.useQuery(undefined, {
    enabled: isSearchingByName,
    refetchOnWindowFocus: false,
  });

  const activeError = isSearchingByName ? rawError : error;
  const sourceRows = isSearchingByName
    ? (perizinanRaw ?? [])
    : (perizinan ?? []);

  const rows = isSearchingByName
    ? sourceRows
        .filter((p) => {
          if (filter.status && p.approvalStatus !== filter.status) return false;

          if (filter.date) {
            const rowDate = formatInputDate(p.tanggal);
            if (rowDate !== filter.date) return false;
          }

          if (!queryText) return true;
          const name = p.userProfile?.fullName ?? p.userProfile?.email ?? "";
          return name.toLowerCase().includes(queryText);
        })
        .sort(
          (a, b) => getDateSortValue(b.tanggal) - getDateSortValue(a.tanggal),
        )
    : sourceRows.sort(
        (a, b) => getDateSortValue(b.tanggal) - getDateSortValue(a.tanggal),
      );

  const pagedRows = isSearchingByName
    ? rows.slice(offset, offset + limit)
    : rows;
  const hasMore = isSearchingByName
    ? offset + limit < rows.length
    : rows.length === limit;
  const loadingState = isSearchingByName ? isLoadingRaw : isLoading;
  const hasVisibleRows = pagedRows.length > 0;

  if (activeError) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-red-500">Error: {activeError.message}</p>
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
              disabled={loadingState || !hasVisibleRows}
            />
            <DownloadPdfButton
              tableId="perizinan-table"
              filename="perizinan.pdf"
              title="Data Perizinan"
              disabled={loadingState || !hasVisibleRows}
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
            fieldOrder={["query", "date", "status"]}
            showSort={false}
            className="mb-4"
          />
          {
            <>
              {/* Pagination Info */}
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                <span>
                  Halaman {page} - Menampilkan {pagedRows.length} dari{" "}
                  {rows.length} data
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
              <div className="w-full">
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[46px]">No</TableHead>
                      <TableHead className="w-[92px]">Tanggal</TableHead>
                      <TableHead className="w-[28%]">Nama</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Kelas
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Kategori
                      </TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead className="w-[96px]">Status</TableHead>
                      <TableHead className="w-[74px] text-right">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingState ? (
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
                          <TableCell className="hidden lg:table-cell">
                            <Skeleton className="h-4 w-20" />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
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
                    ) : pagedRows && pagedRows.length > 0 ? (
                      pagedRows.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-muted-foreground">
                            {offset + index + 1}
                          </TableCell>
                          <TableCell>
                            {formatCompactDate(item.tanggal)}
                          </TableCell>
                          <TableCell
                            className="truncate"
                            title={String(
                              item.userProfile?.fullName ??
                                item.userProfile?.email ??
                                item.userId ??
                                "",
                            )}
                          >
                            {item.userProfile?.fullName ??
                              item.userProfile?.email ??
                              item.userId}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge
                              variant="outline"
                              className="rounded-full px-2.5 py-0.5 font-medium"
                            >
                              {item.userProfile?.className ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge
                              variant="secondary"
                              className="rounded-full px-2.5 py-1"
                            >
                              {item.kategoriIzin ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="max-w-[160px] truncate sm:max-w-[220px]"
                            title={String(item.deskripsi ?? "")}
                          >
                            {item.deskripsi}
                          </TableCell>
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
                              <Button
                                variant="outline"
                                size="sm"
                                className="px-2"
                              >
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
                    {pagedRows && pagedRows.length > 0 ? (
                      pagedRows.map((item, index) => {
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
                  Halaman {page} - Menampilkan {pagedRows.length} dari{" "}
                  {rows.length} data
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
          }
        </CardContent>
      </Card>
    </div>
  );
}
