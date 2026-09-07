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
import {
  ArrowLeft,
  ExternalLink,
  Image as ImageIcon,
  RefreshCw,
  Terminal,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateOnly, isDateOnlyValue } from "~/lib/date-utils";

// Helper function to format date
// - Handles date-only strings (YYYY-MM-DD) without applying timezone shift
//   to avoid showing 07:00 due to UTC parsing.
const formatDate = (input: string | Date | null | undefined) => {
  if (!input) return "N/A";

  if (isDateOnlyValue(input)) {
    return formatDateOnly(input);
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "N/A";
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

function safeAttachmentHref(src: string): string | null {
  try {
    const protocol = new URL(src, "http://localhost").protocol;
    return protocol === "http:" || protocol === "https:" ? src : null;
  } catch {
    return null;
  }
}

function AttachmentFallback({
  src,
  onRetry,
}: {
  src: string;
  onRetry: () => void;
}) {
  const href = safeAttachmentHref(src);

  return (
    <div
      role="status"
      className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 rounded bg-slate-50 p-4 text-center text-muted-foreground"
    >
      <ImageIcon aria-hidden="true" className="h-5 w-5" />
      <p className="text-sm">Bukti foto tidak dapat ditampilkan.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Coba lagi
        </Button>
        {href ? (
          <Button asChild type="button" variant="outline" size="sm">
            <a href={href} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Buka lampiran langsung
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AttachmentImage({
  src,
  alt,
  className,
  onLoad,
  onError,
}: {
  src: string;
  alt: string;
  className: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <AttachmentFallback
        src={src}
        onRetry={() => {
          setHasError(false);
          setAttempt((current) => current + 1);
        }}
      />
    );
  }

  return (
    <img
      key={attempt}
      src={src}
      alt={alt}
      className={className}
      onLoad={onLoad}
      onError={() => {
        setHasError(true);
        onError?.();
      }}
    />
  );
}

function AttachmentThumbnail({
  src,
  onOpen,
}: {
  src: string;
  onOpen: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="relative h-[30dvh] min-h-[140px] max-h-[220px] w-full overflow-hidden rounded bg-slate-50 p-2">
      <AttachmentImage
        src={src}
        alt="Bukti Foto Izin"
        className="h-full w-full rounded object-cover"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(false)}
      />
      {isLoaded ? (
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-2 rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label="Lihat bukti foto ukuran penuh"
        />
      ) : null}
    </div>
  );
}

export default function ShowPerizinanPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id)
    ? (params.id[0] ?? "")
    : (params.id ?? "");

  const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [isPhotoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [durationDays, setDurationDays] = useState(1);

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
        toast.success(
          `Status perizinan berhasil diperbarui menjadi ${
            data.approvalStatus === "approved"
              ? "Disetujui"
              : data.approvalStatus === "rejected"
                ? "Ditolak"
                : "Menunggu"
          }.`,
        );
      } else {
        toast.success("Status perizinan berhasil diperbarui.");
      }
    },
    onError: (err) => {
      toast.error(`Gagal memperbarui status: ${err.message}`);
    },
  });

  const handleApprove = () => {
    updateStatusMutation.mutate({
      id,
      approvalStatus: "approved",
      durationDays,
    });
  };

  const handleRejectConfirm = () => {
    if (!rejectionReason.trim()) {
      toast.error("Alasan penolakan tidak boleh kosong.");
      return;
    }
    updateStatusMutation.mutate({
      id,
      approvalStatus: "rejected",
      rejectionReason,
    });
  };

  if (!id) return <div className="p-8 text-destructive">ID tidak valid.</div>;
  if (isLoading) return <SkeletonLayout />;
  if (error)
    return (
      <div className="p-8 text-destructive">
        Terjadi kesalahan: {error.message}
      </div>
    );
  if (!perizinan)
    return <div className="p-8">Data perizinan tidak ditemukan.</div>;

  const isActionable = perizinan.approvalStatus === "pending";
  const user = perizinan.userProfile;

  return (
    <div className="min-h-[calc(100dvh-4rem)] overflow-y-auto p-3 md:p-4 flex flex-col gap-3 md:gap-4">
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
          <h1 className="text-2xl font-bold tracking-tight">
            Detail Permohonan Izin
          </h1>
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
                    <p className="text-sm font-medium text-muted-foreground">
                      Kategori
                    </p>
                    <Badge variant="secondary" className="mt-1 capitalize">
                      {perizinan.kategoriIzin ?? "-"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Deskripsi
                    </p>
                    <p className="mt-1 text-sm">{perizinan.deskripsi ?? "-"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Tanggal Izin
                  </p>
                  <p className="mt-1 text-sm">
                    {formatDate(
                      perizinan.requestedStartDate ?? perizinan.tanggal,
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <div>
                  <p className="font-medium text-muted-foreground">
                    Mulai diminta
                  </p>
                  <p>
                    {formatDate(
                      perizinan.requestedStartDate ?? perizinan.tanggal,
                    )}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    Akhir asli
                  </p>
                  <p>{formatDate(perizinan.originalEndDate)}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">
                    Akhir efektif
                  </p>
                  <p>{formatDate(perizinan.effectiveEndDate)}</p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                <p className="text-sm font-medium">Bukti Foto</p>
                {perizinan.linkFoto ? (
                  <AttachmentThumbnail
                    src={perizinan.linkFoto}
                    onOpen={() => setPhotoDialogOpen(true)}
                  />
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
                  <p className="text-base font-semibold truncate">
                    {user?.fullName ?? "N/A"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {user?.email ?? "N/A"}
                  </p>
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
                  <p className="text-muted-foreground">
                    {formatDate(perizinan.createdAt)}
                  </p>
                </div>
              </div>
              {perizinan.approvalStatus === "approved" && (
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-green-500" />
                  <div className="text-sm">
                    <p className="font-medium">Disetujui</p>
                    <p className="text-muted-foreground">
                      {formatDate(perizinan.approvedAt)}
                    </p>
                  </div>
                </div>
              )}
              {perizinan.approvalStatus === "rejected" && (
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                  <div className="text-sm">
                    <p className="font-medium">Ditolak</p>
                    <p className="text-muted-foreground">
                      {formatDate(perizinan.rejectedAt)}
                    </p>
                  </div>
                </div>
              )}
              {perizinan.approvalStatus === "pending" && (
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <div className="text-sm">
                    <p className="font-medium">Menunggu Persetujuan</p>
                    <p className="text-muted-foreground">
                      Status saat ini: pending
                    </p>
                  </div>
                </div>
              )}
              {perizinan.rejectionReason && (
                <Alert className="mt-3">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Alasan Penolakan</AlertTitle>
                  <AlertDescription>
                    {perizinan.rejectionReason}
                  </AlertDescription>
                </Alert>
              )}
              <div className="h-px bg-border my-3" />
              {isActionable ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">
                    Setujui atau tolak permintaan ini.
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Durasi (hari kalender)
                    </span>
                    <select
                      value={durationDays}
                      onChange={(event) =>
                        setDurationDays(Number(event.target.value))
                      }
                      className="rounded-md border bg-background px-2 py-1"
                      aria-label="Durasi cuti dalam hari kalender"
                    >
                      {Array.from({ length: 30 }, (_, index) => index + 1).map(
                        (days) => (
                          <option key={days} value={days}>
                            {days}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={updateStatusMutation.isPending}
                      size="lg"
                      variant="success"
                      className="w-full"
                    >
                      {updateStatusMutation.isPending
                        ? "Menyetujui..."
                        : "Setujui"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={updateStatusMutation.isPending}
                      size="lg"
                      className="w-full"
                    >
                      Tolak
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
                ? "Menolak..."
                : "Konfirmasi Tolak"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isPhotoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="p-0 max-w-none sm:max-w-none w-[95vw] md:w-[85vw] lg:w-[75vw] xl:w-[65vw] h-[80vh] overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto Surat Izin</DialogTitle>
            <DialogDescription>
              Pratinjau bukti foto surat izin
            </DialogDescription>
          </DialogHeader>
          <div className="relative w-full h-full bg-muted">
            {perizinan.linkFoto ? (
              <AttachmentImage
                src={perizinan.linkFoto}
                alt="Bukti Perizinan"
                className="h-full w-full object-contain"
              />
            ) : null}
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
