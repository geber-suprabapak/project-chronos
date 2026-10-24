"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Separator } from "~/components/ui/separator";
import { User, RefreshCw } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  PROFILE_DETAIL_MESSAGES,
  isRetryableProfileDetailUiState,
  profileDetailUiState,
} from "~/server/api/routers/user-profiles-detail";
import { formatDateOnly, isDateOnlyValue } from "~/lib/date-utils";

// Helper to format date or datetime; handles date-only strings without timezone skew
const formatDate = (input: string | Date | null | undefined) => {
  if (!input) return "-";
  if (isDateOnlyValue(input)) {
    return formatDateOnly(input);
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function ShowProfilePage() {
  const params = useParams();
  const id = Array.isArray(params.id)
    ? (params.id[0] ?? "")
    : (params.id ?? "");

  // retry: false keeps dependency-failure handling deterministic (no silent
  // background retries); recovery is user-driven through the explicit retry
  // action, which refetches the same read-only query on the same boundary.
  const {
    data: profile,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = api.userProfiles.getById.useQuery(
    { id },
    { enabled: !!id, retry: false },
  );

  // Related data (small lists) for additional context
  const { data: allAbsencesData } = api.absences.list.useQuery(
    {
      userId: profile ? profile.userId : "",
      limit: 5,
      offset: 0,
      sort: "desc",
    },
    { enabled: !!profile?.userId },
  );
  const { data: recentLeavesData } = api.perizinan.list.useQuery(
    { userId: profile ? profile.userId : "", limit: 5, offset: 0 },
    { enabled: !!profile?.userId },
  );

  const allAbsences = allAbsencesData?.rows ?? [];
  const recentLeaves = recentLeavesData?.rows ?? [];

  if (!id) return <div className="p-8 text-destructive">ID tidak valid.</div>;
  if (isLoading) return <SkeletonLayout />;
  if (error) {
    const uiState = profileDetailUiState(error.data?.code);
    if (uiState === "not_found") {
      return <ProfileDetailNotFound />;
    }
    const retryable = isRetryableProfileDetailUiState(uiState);
    return (
      <div className="p-8">
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>
              {uiState === "forbidden"
                ? "Akses ditolak"
                : "Layanan profil tidak tersedia"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {uiState === "forbidden"
                ? PROFILE_DETAIL_MESSAGES.forbidden
                : uiState === "unknown"
                  ? PROFILE_DETAIL_MESSAGES.unknown
                  : PROFILE_DETAIL_MESSAGES.dependency}
            </p>
            {retryable ? (
              <Button
                onClick={() => void refetch()}
                disabled={isRefetching}
                data-testid="profile-detail-retry"
              >
                <RefreshCw
                  className={isRefetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                />
                Coba Lagi
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!profile) return <ProfileDetailNotFound />;

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-4 md:p-8"
      data-testid="profile-detail-loaded"
    >
      {/* Left: Profile summary */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Detail Siswa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatarUrl ?? undefined} />
                <AvatarFallback>
                  <User />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold">
                  {profile.fullName ?? "-"}
                </p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <Separator />
            <div className="grid gap-2">
              <Row label="ID" value={String(profile.id)} mono />
              {profile.nis ? <Row label="NIS" value={profile.nis} /> : null}
              <Row label="Kelas" value={profile.className ?? "-"} />
              <Row label="No. Absen" value={profile.absenceNumber ?? "-"} />
              <Row label="Peran" value={profile.role ?? "-"} />
              <Row label="Dibuat" value={formatDate(profile.createdAt)} />
              <Row label="Diupdate" value={formatDate(profile.updatedAt)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right: recent activities */}
      <div className="lg:col-span-2 flex flex-col gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Absensi Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAbsences?.length ? (
                  allAbsences.map((a) => {
                    const waktu = a.createdAt
                      ? new Intl.DateTimeFormat("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }).format(new Date(a.createdAt))
                      : "-";

                    return (
                      <TableRow key={String(a.id)}>
                        <TableCell>{formatDate(a.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (a.status ?? "").toLowerCase() === "approved"
                                ? "default"
                                : (a.status ?? "")
                                  ? "outline"
                                  : "secondary"
                            }
                            className="capitalize"
                          >
                            {a.status ?? "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>{waktu}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perizinan Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLeaves?.length ? (
                  recentLeaves.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.tanggal)}</TableCell>
                      <TableCell>{p.kategoriIzin}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            p.approvalStatus === "approved"
                              ? "success"
                              : p.approvalStatus === "rejected"
                                ? "destructive"
                                : "outline"
                          }
                          className="capitalize"
                        >
                          {p.approvalStatus === "approved"
                            ? "Disetujui"
                            : p.approvalStatus === "rejected"
                              ? "Ditolak"
                              : "Menunggu"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/perizinan/show/${p.id}`}>Detail</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      Tidak ada data.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfileDetailNotFound() {
  return (
    <div className="p-8" data-testid="profile-detail-not-found">
      <p>Profil tidak ditemukan.</p>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <p className="col-span-1 text-sm font-semibold text-muted-foreground">
        {label}
      </p>
      <p className={`col-span-2 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

const SkeletonLayout = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-4 md:p-8">
    <div className="lg:col-span-1">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    </div>
    <div className="lg:col-span-2 flex flex-col gap-4 md:gap-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  </div>
);
