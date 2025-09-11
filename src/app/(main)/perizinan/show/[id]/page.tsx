"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Terminal, User, Image as ImageIcon } from "lucide-react";
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

// Helper to determine badge variant based on status
const getBadgeVariant = (status: string | null) => {
  switch (status) {
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
    case "pending":
    default:
      return "outline";
  }
};

export default function ShowPerizinanPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [isRejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [isPhotoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const utils = api.useUtils();
  const { data: perizinan, isLoading, error } = api.perizinan.getById.useQuery(
    { id },
    { enabled: !!id }
  );

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
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>;
  if (!perizinan) return <div className="p-8">Perizinan not found.</div>;

  const isActionable = perizinan.approvalStatus === "pending";
  const user = perizinan.userProfile;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 p-4 md:p-8">
      {/* Left Column */}
      <div className="lg:col-span-2 flex flex-col gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Detail Permintaan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-2">
              <div className="grid grid-cols-2 items-center">
                <p className="text-sm font-semibold text-muted-foreground">Kategori</p>
                <Badge variant="secondary">{perizinan.kategoriIzin}</Badge>
              </div>
              <div className="grid grid-cols-2 items-center">
                <p className="text-sm font-semibold text-muted-foreground">Tanggal Izin</p>
                <p>{formatDate(perizinan.tanggal)}</p>
              </div>
            </div>
            <div>
                <p className="text-sm font-semibold text-muted-foreground">Deskripsi</p>
                <p className="mt-1">{perizinan.deskripsi}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle>Riwayat Status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                 <p><strong>Status Saat Ini:</strong> <Badge variant={getBadgeVariant(perizinan.approvalStatus)} className="capitalize">{perizinan.approvalStatus}</Badge></p>
                <p><strong>Dibuat pada:</strong> {formatDate(perizinan.createdAt)}</p>
                {perizinan.approvalStatus === 'approved' && (
                  <p><strong>Disetujui pada:</strong> {formatDate(perizinan.approvedAt)}</p>
                )}
                {perizinan.approvalStatus === 'rejected' && (
                  <p><strong>Ditolak pada:</strong> {formatDate(perizinan.rejectedAt)}</p>
                )}
                {perizinan.rejectionReason && (
                   <Alert className="mt-4">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Alasan Penolakan</AlertTitle>
                    <AlertDescription>
                      {perizinan.rejectionReason}
                    </AlertDescription>
                  </Alert>
                )}
            </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="lg:col-span-1 flex flex-col gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Profil Pemohon</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatarUrl ?? undefined} />
              <AvatarFallback><User/></AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user?.fullName ?? "N/A"}</p>
              <p className="text-sm text-muted-foreground">{user?.email ?? "N/A"}</p>
            </div>
          </CardContent>
        </Card>
        {perizinan.linkFoto && (
            <Card>
                <CardHeader><CardTitle>Bukti Foto</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                    <div className="relative w-full h-72 rounded-md border bg-slate-50 overflow-hidden">
                        <Image src={perizinan.linkFoto} alt="Bukti Perizinan" fill style={{ objectFit: "cover" }}/>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setPhotoDialogOpen(true)} className="w-full">
                        <ImageIcon className="mr-2 h-4 w-4"/> Lihat Ukuran Penuh
                    </Button>
                </CardContent>
            </Card>
        )}
        <Card>
            <CardHeader><CardTitle>Panel Aksi</CardTitle></CardHeader>
            <CardContent>
                {isActionable ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">Setujui atau tolak permintaan ini.</p>
                        <Button onClick={handleApprove} disabled={updateStatusMutation.isPending} size="lg">
                          {updateStatusMutation.isPending ? "Approving..." : "Approve"}
                        </Button>
                        <Button variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={updateStatusMutation.isPending} size="lg">Reject</Button>
                    </div>
                ) : perizinan.approvalStatus === "rejected" ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">Permintaan ini ditolak. Anda bisa membatalkan penolakan.</p>
                        <Button onClick={() => {
                            updateStatusMutation.mutate({ id, approvalStatus: "pending" });
                        }} disabled={updateStatusMutation.isPending} size="lg">
                            {updateStatusMutation.isPending ? "Membatalkan..." : "Batalkan Penolakan"}
                        </Button>
                    </div>
                ) : (
                    <p>Tindakan tidak dapat dilakukan karena permintaan ini sudah direspon.</p>
                )}
            </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi Penolakan</DialogTitle><DialogDescription>Harap berikan alasan mengapa perizinan ini ditolak.</DialogDescription></DialogHeader>
          <div className="py-4"><Label htmlFor="rejection-reason">Alasan</Label><Textarea id="rejection-reason" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Contoh: Surat dokter tidak valid."/></div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Batal</Button></DialogClose><Button onClick={handleRejectConfirm} disabled={updateStatusMutation.isPending}>{updateStatusMutation.isPending ? "Rejecting..." : "Konfirmasi Tolak"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isPhotoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent
          className="p-0 max-w-none sm:max-w-none w-[95vw] md:w-[85vw] lg:w-[75vw] xl:w-[65vw] h-[80vh] overflow-hidden"
        >
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
            <Card><CardHeader><Skeleton className="h-8 w-1/2"/></CardHeader><CardContent className="space-y-4"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-3/4"/></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-8 w-1/2"/></CardHeader><CardContent className="space-y-2"><Skeleton className="h-4 w-full"/><Skeleton className="h-4 w-3/4"/></CardContent></Card>
        </div>
        <div className="lg:col-span-1 flex flex-col gap-4 md:gap-8">
            <Card><CardHeader><Skeleton className="h-8 w-1/2"/></CardHeader><CardContent><Skeleton className="h-16 w-full"/></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-8 w-1/2"/></CardHeader><CardContent><Skeleton className="h-48 w-full"/></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-8 w-1/2"/></CardHeader><CardContent><Skeleton className="h-24 w-full"/></CardContent></Card>
        </div>
    </div>
)
