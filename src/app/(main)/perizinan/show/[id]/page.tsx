"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ArrowLeft, Terminal, User, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

// Helper function to format date
// - Handles date-only strings (YYYY-MM-DD) without applying timezone shift
//   to avoid showing 07:00 due to UTC parsing.
const formatDate = (input: string | Date | null | undefined) => {
  if (!input) return "N/A";

  const isDateOnly =
    typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input);

  if (isDateOnly) {
    const [yStr, mStr, dStr] = input.split("-") as [string, string, string];
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    // Construct as local date (no time), avoiding UTC timezone offset issues
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
    // If you want a fixed timezone regardless of client device, uncomment:
    // timeZone: "Asia/Jakarta",
  }).format(date);
};

export default function ShowPerizinanPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [isPhotoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();
  const {
    data: perizinan,
    isLoading,
    error,
  } = api.perizinan.getById.useQuery({ id }, { enabled: !!id });

  const updateStatusMutation = api.perizinan.updateStatus.useMutation({
    onSuccess: (data) => {
      void utils.perizinan.getById.invalidate({ id });
      void utils.perizinan.listRaw.invalidate();
      setRejectDialogOpen(false);
      if (data) {
        toast.success(`Status updated to ${data.approvalStatus}`);
      } else {
        toast.success("Status updated successfully.");
      }
    },
    onError: (err) => {
      toast.error(`Error updating status: ${err.message}`);
    },
  });

  const handleApprove = () => {
    updateStatusMutation.mutate({ id, approvalStatus: "approved" });
  };

  const handleRejectConfirm = () => {
    if (!rejectionReason.trim()) {
      toast.error("Rejection reason cannot be empty.");
      return;
    }
    updateStatusMutation.mutate({
      id,
      approvalStatus: "rejected",
      rejectionReason,
    });
  };

  if (!id) return <div>Invalid ID.</div>;
  if (isLoading) return <SkeletonLayout />;
  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;
  if (!perizinan) return <div className="p-8">Perizinan not found.</div>;

  const isActionable = perizinan.approvalStatus === "pending";
  const user = perizinan.userProfile;

  return (
    <div className="h-[calc(100dvh-4rem)] overflow-hidden p-3 md:p-4 flex flex-col gap-3 md:gap-4">
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          aria-label="Kembali"
          className="mt-0.5"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detail Permohonan Izin</h1>
          <p className="text-sm text-muted-foreground">
            Lihat dan kelola informasi permohonan izin
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-5 gap-3 md:gap-4 items-start">
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Informasi Permohonan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Kategori</p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {perizinan.kategoriIzin ?? "-"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Deskripsi</p>
                    <p className="mt-1 text-sm">{perizinan.deskripsi ?? "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tanggal Izin</p>
                  <p className="mt-1 text-sm">{formatDate(perizinan.tanggal)}</p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <p className="text-sm font-medium">Bukti Foto</p>
                {perizinan.linkFoto ? (
                  <button
                    type="button"
                    onClick={() => setPhotoDialogOpen(true)}
                    className="w-full rounded-md bg-slate-50 p-2"
                    aria-label="Lihat bukti foto ukuran penuh"
                  >
                    <div className="relative h-[30dvh] min-h-[140px] max-h-[220px] w-full overflow-hidden rounded">
                      <Image
                        src={perizinan.linkFoto}
                        alt="Permission Evidence"
                        fill
                        className="object-cover"
                      />
                    </div>
                  </button>
                ) : (
                  <div className="w-full rounded-md bg-slate-50 p-2">
                    <div className="relative h-[30dvh] min-h-[140px] max-h-[220px] w-full overflow-hidden rounded">
                      <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="mb-2 h-5 w-5" />
                        <span className="text-sm">Tidak ada bukti foto</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-3 md:gap-4 min-h-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Profil Siswa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback>
                    <User />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{user?.fullName ?? "N/A"}</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email ?? "N/A"}</p>
                </div>
              </div>
              <div className="h-px bg-border" />
              <div className="grid gap-2 text-sm">
                {user?.nis && (
                  <div className="grid grid-cols-2 gap-2">
                    <p className="text-muted-foreground">NIS</p>
                    <p className="text-right">{user.nis}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">Kelas</p>
                  <p className="text-right">{user?.className ?? "-"}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <p className="text-muted-foreground">No. Absen</p>
                  <p className="text-right">{user?.absenceNumber ?? "-"}</p>
                </div>
                {user?.role && (
                  <div className="grid grid-cols-2 gap-2">
                    <p className="text-muted-foreground">Peran</p>
                    <p className="text-right capitalize">{user.role}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Riwayat Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                <div className="text-sm">
                  <p className="font-medium">Permohonan Dibuat</p>
                  <p className="text-muted-foreground">{formatDate(perizinan.createdAt)}</p>
                </div>
              </div>
              {perizinan.approvalStatus === "approved" && (
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-500" />
                  <div className="text-sm">
                    <p className="font-medium">Disetujui</p>
                    <p className="text-muted-foreground">{formatDate(perizinan.approvedAt)}</p>
                  </div>
                </div>
              )}
              {perizinan.approvalStatus === "rejected" && (
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                  <div className="text-sm">
                    <p className="font-medium">Ditolak</p>
                    <p className="text-muted-foreground">{formatDate(perizinan.rejectedAt)}</p>
                  </div>
                </div>
              )}
              {perizinan.approvalStatus === "pending" && (
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <div className="text-sm">
                    <p className="font-medium">Menunggu Persetujuan</p>
                    <p className="text-muted-foreground">Status saat ini: pending</p>
                  </div>
                </div>
              )}
              {perizinan.rejectionReason && (
                <Alert className="mt-3">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Alasan Penolakan</AlertTitle>
                  <AlertDescription>{perizinan.rejectionReason}</AlertDescription>
                </Alert>
              )}
              <div className="h-px bg-border my-3" />
              {isActionable ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    Setujui atau tolak permintaan ini.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={updateStatusMutation.isPending}
                      size="lg"
                      variant="success"
                      className="w-full"
                    >
                      {updateStatusMutation.isPending ? "Approving..." : "Approve"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={updateStatusMutation.isPending}
                      size="lg"
                      className="w-full"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : perizinan.approvalStatus === "rejected" ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    Permintaan ini ditolak. Anda bisa membatalkan penolakan.
                  </p>
                  <Button
                    onClick={() => {
                      updateStatusMutation.mutate({
                        id,
                        approvalStatus: "pending",
                      });
                    }}
                    disabled={updateStatusMutation.isPending}
                    size="lg"
                    variant="info"
                  >
                    {updateStatusMutation.isPending
                      ? "Membatalkan..."
                      : "Batalkan Penolakan"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tidak ada aksi tersedia. Permohonan ini sudah diproses.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi Penolakan</DialogTitle>
            <DialogDescription>
              Harap berikan alasan mengapa perizinan ini ditolak.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Alasan</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Contoh: Surat dokter tidak valid."
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Batal</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending
                ? "Rejecting..."
                : "Konfirmasi Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isPhotoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="p-0 max-w-none sm:max-w-none w-[95vw] md:w-[85vw] lg:w-[75vw] xl:w-[65vw] h-[80vh] overflow-hidden">
          <div className="relative w-full h-full bg-muted">
            <Image
              src={perizinan.linkFoto ?? ""}
              alt="Bukti Perizinan"
              fill
              className="object-contain"
              priority
            />
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
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-2">
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
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  </div>
);
