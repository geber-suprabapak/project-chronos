"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Separator } from "~/components/ui/separator";
import { User } from "lucide-react";
import { Button } from "~/components/ui/button";

// Helper to format date or datetime; handles date-only strings without timezone skew
const formatDate = (input: string | Date | null | undefined) => {
  if (!input) return "-";
  const isDateOnly = typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input);
  if (isDateOnly) {
    const [yStr, mStr, dStr] = input.split("-") as [string, string, string];
    const date = new Date(Number(yStr), Number(mStr) - 1, Number(dStr));
    return new Intl.DateTimeFormat("id-ID", { year: "numeric", month: "long", day: "numeric" }).format(date);
  }
  const date = new Date(input);
  return new Intl.DateTimeFormat("id-ID", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};

export default function ShowProfilePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data: profile, isLoading, error } = api.userProfiles.getById.useQuery(
    { id },
    { enabled: !!id }
  );

  // Related data (small lists) for additional context
  const { data: allAbsences } = api.absences.list.useQuery(
    { userId: profile?.id as string, limit: 5, offset: 0, sort: "desc" },
    { enabled: !!profile?.id }
  );
  const { data: recentLeaves } = api.perizinan.list.useQuery(
    undefined,
    { enabled: !!profile?.id }
  );

  if (!id) return <div className="p-8">Invalid ID.</div>;
  if (isLoading) return <SkeletonLayout />;
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>;
  if (!profile) return <div className="p-8">Profil tidak ditemukan.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-4 md:p-8">
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
                <p className="text-lg font-semibold">{profile.fullName ?? "-"}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <Separator />
            <div className="grid gap-2">
              <Row label="ID" value={String(profile.id)} mono />
              {profile.nis ? <Row label="NIS" value={profile.nis} /> : null}
              <Row label="Kelas" value={profile.className ?? "-"} />
              <Row label="No. Absen" value={profile.absenceNumber ?? "-"} />
              <Row label="Role" value={profile.role ?? "-"} />
              <Row label="Dibuat" value={formatDate(profile.createdAt as unknown as Date)} />
              <Row label="Diupdate" value={formatDate(profile.updatedAt as unknown as Date)} />
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
                  <TableHead>Alasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAbsences?.length ? (
                  allAbsences.map((a) => (
                    <TableRow key={String(a.id)}>
                      <TableCell>{formatDate(a.date as unknown as string)}</TableCell>
                      <TableCell>
                        <Badge variant={(a.status ?? "").toLowerCase() === "approved" ? "default" : (a.status ?? "") ? "outline" : "secondary"} className="capitalize">
                          {a.status ?? "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[360px] truncate">{a.reason ?? "-"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Tidak ada data.</TableCell>
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
                        <Badge variant={p.approvalStatus === "approved" ? "default" : p.approvalStatus === "rejected" ? "destructive" : "outline"} className="capitalize">
                          {p.approvalStatus ?? "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/perizinan/show/${p.id}`}>Detail</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">Tidak ada data.</TableCell>
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 items-center gap-2">
      <p className="col-span-1 text-sm font-semibold text-muted-foreground">{label}</p>
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
