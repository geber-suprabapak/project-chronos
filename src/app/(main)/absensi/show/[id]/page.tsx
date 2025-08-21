"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { User, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

// Helper: format date or datetime
const formatDate = (input: string | Date | null | undefined) => {
  if (!input) return "N/A";

  const isDateOnly = typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input);

  if (isDateOnly) {
    const [yStr, mStr, dStr] = input.split("-") as [string, string, string];
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  const date = new Date(input);
  return new Intl.DateTimeFormat("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getBadgeVariant = (status: string | null | undefined) => {
  const s = (status ?? "").toLowerCase();
  if (["approved", "present", "hadir"].includes(s)) return "default" as const;
  if (["rejected", "absent", "alpha", "izin", "sakit"].includes(s)) return "destructive" as const;
  return "outline" as const;
};

export default function ShowAbsensiPage() {
  const params = useParams();
  const rawId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const id = Number(rawId);

  const [isPhotoDialogOpen, setPhotoDialogOpen] = useState(false);

  const { data: absence, isLoading, error } = api.absences.getById.useQuery(
    { id },
    { enabled: Number.isFinite(id) }
  );

  const { data: profiles } = api.userProfiles.listRaw.useQuery(undefined, { enabled: true });

  const user = useMemo(() => {
    if (!absence || !profiles) return null;
    return profiles.find((p) => p.userId === absence.userId) ?? null;
  }, [absence, profiles]);

  if (!Number.isFinite(id)) return <div className="p-8">Invalid ID.</div>;
  if (isLoading) return <SkeletonLayout />;
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>;
  if (!absence) return <div className="p-8">Absensi tidak ditemukan.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-4 md:p-8">
      {/* Left Column */}
      <div className="lg:col-span-2 flex flex-col gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Detail Absensi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-2">
              <div className="grid grid-cols-2 items-center">
                <p className="text-sm font-semibold text-muted-foreground">Tanggal</p>
                <p>{formatDate(absence.date as unknown as string)}</p>
              </div>
              <div className="grid grid-cols-2 items-center">
                <p className="text-sm font-semibold text-muted-foreground">Status</p>
                <Badge variant={getBadgeVariant(absence.status)} className="capitalize">
                  {absence.status ?? "-"}
                </Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Alasan</p>
              <p className="mt-1">{absence.reason ?? "-"}</p>
            </div>
            <div className="grid gap-2">
              <div className="grid grid-cols-2 items-center">
                <p className="text-sm font-semibold text-muted-foreground">Lokasi</p>
                <p>
                  {[absence.latitude, absence.longitude].filter((v) => v != null).join(", ") || "-"}
                </p>
              </div>
              <div className="grid grid-cols-2 items-center">
                <p className="text-sm font-semibold text-muted-foreground">Dibuat pada</p>
                <p>{formatDate(absence.createdAt as unknown as Date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="lg:col-span-1 flex flex-col gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Profil Pengguna</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback>
                <User />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user?.fullName ?? user?.email ?? absence.userId}</p>
              <p className="text-sm text-muted-foreground">{user?.email ?? "-"}</p>
            </div>
          </CardContent>
        </Card>

        {absence.photoUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Bukti Foto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative w-full h-72 rounded-md border bg-slate-50 overflow-hidden">
                <Image src={absence.photoUrl} alt="Bukti Absensi" fill style={{ objectFit: "cover" }} />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPhotoDialogOpen(true)}
                className="w-full"
              >
                <ImageIcon className="mr-2 h-4 w-4" /> Lihat Ukuran Penuh
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Photo Dialog */}
      <Dialog open={isPhotoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="p-0 max-w-none sm:max-w-none w-[95vw] md:w-[85vw] lg:w-[75vw] xl:w-[65vw] h-[80vh] overflow-hidden">
          <div className="relative w-full h-full bg-muted">
            <Image src={absence.photoUrl ?? ""} alt="Bukti Absensi" fill className="object-contain" priority />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SkeletonLayout = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-4 md:p-8">
    <div className="lg:col-span-2 flex flex-col gap-4 md:gap-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
    <div className="lg:col-span-1 flex flex-col gap-4 md:gap-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  </div>
);
