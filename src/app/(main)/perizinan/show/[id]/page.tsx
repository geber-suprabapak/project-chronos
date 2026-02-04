"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  ArrowLeft,
  User,
  Image as ImageIcon,
  Calendar,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

/**
 * Helper: Format date to readable Indonesian format
 */
const formatDate = (input: string | Date | null | undefined) => {
  if (!input) return "N/A";

  const isDateOnly =
    typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input);

  if (isDateOnly) {
    const [yStr, mStr, dStr] = input.split("-") as [string, string, string];
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const date = new Date(y, m - 1, d);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  const date = new Date(input);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
      void utils.perizinan.list.invalidate();
      setRejectDialogOpen(false);
      setRejectionReason("");
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
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/perizinan">Perizinan</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Detail</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header with Back Button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.back()}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Permission Request Detail
          </h1>
          <p className="text-sm text-gray-600">
            View and manage permission request information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left Column - Photo + Request Info */}
        <div className="lg:col-span-1">
          <Card className="bg-white h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-gray-600" />
                Request Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 flex-1 flex flex-col">
              {/* Request Information */}
              <div className="space-y-3">
                <div className="grid gap-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-500">
                        Category
                      </p>
                      <Badge
                        variant="secondary"
                        className="capitalize px-2.5 py-0.5"
                      >
                        {perizinan.kategoriIzin ?? "-"}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-xs font-medium text-gray-500">
                        Permission Date
                      </p>
                      <div className="flex items-center gap-1.5 text-gray-900">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-sm font-medium">
                          {formatDate(perizinan.tanggal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-500">
                      Description
                    </p>
                    <p className="text-sm text-gray-900 leading-relaxed">
                      {perizinan.deskripsi || "No description provided"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200" />

              {/* Photo Evidence */}
              <div className="space-y-2 flex-1 flex flex-col">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-3.5 w-3.5 text-gray-600" />
                  <p className="text-xs font-semibold text-gray-700">Photo Evidence</p>
                </div>
                {perizinan.linkFoto ? (
                  <div
                    className="relative w-full flex-1 min-h-0 rounded-lg border bg-gray-50 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setPhotoDialogOpen(true)}
                  >
                    <Image
                      src={perizinan.linkFoto}
                      alt="Permission Evidence"
                      fill
                      style={{ objectFit: "cover" }}
                      className="rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="p-6 text-center border rounded-lg bg-gray-50 flex-1 flex items-center justify-center">
                    <div>
                      <ImageIcon className="h-8 w-8 mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500">No photo evidence provided</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Student Profile, Status History, Actions */}
        <div className="lg:col-span-1 space-y-3">
          {/* Student Profile */}
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-gray-600" />
                Student Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-gray-100">
                    <User className="h-6 w-6 text-gray-500" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {user?.fullName ?? "N/A"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email ?? "N/A"}
                  </p>
                </div>
              </div>

              <div className="h-px bg-gray-200" />

              <div className="space-y-2">
                {user?.nis && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500">
                      NIS
                    </span>
                    <span className="text-xs text-gray-900 font-medium">
                      {user.nis}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500">
                    Class
                  </span>
                  <Badge variant="outline" className="text-xs font-medium">
                    {user?.className ?? "-"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500">
                    Absence No.
                  </span>
                  <span className="text-xs text-gray-900 font-medium">
                    {user?.absenceNumber ?? "-"}
                  </span>
                </div>
                {user?.role && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500">
                      Role
                    </span>
                    <span className="text-xs text-gray-900 font-medium capitalize">
                      {user.role}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status History */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-gray-600" />
                Status History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900">
                      Request Created
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(perizinan.createdAt)}
                    </p>
                  </div>
                </div>

                {perizinan.approvalStatus === "approved" && (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">
                        Approved
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(perizinan.approvedAt)}
                      </p>
                    </div>
                  </div>
                )}

                {perizinan.approvalStatus === "rejected" && (
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900">
                        Rejected
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(perizinan.rejectedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {perizinan.rejectionReason && (
                <Alert className="border-red-200 bg-red-50 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <AlertTitle className="text-red-900 text-xs">
                    Rejection Reason
                  </AlertTitle>
                  <AlertDescription className="text-red-800 text-xs">
                    {perizinan.rejectionReason}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent>
              {isActionable ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    Review and respond to this permission request
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      size="sm"
                    >
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      {updateStatusMutation.isPending
                        ? "Approving..."
                        : "Approve"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectDialogOpen(true)}
                      disabled={updateStatusMutation.isPending}
                      className="flex-1"
                      size="sm"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ) : perizinan.approvalStatus === "rejected" ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">
                    This request was rejected. You can undo the rejection.
                  </p>
                  <Button
                    onClick={() => {
                      updateStatusMutation.mutate({
                        id,
                        approvalStatus: "pending",
                      });
                    }}
                    disabled={updateStatusMutation.isPending}
                    variant="outline"
                    className="w-full"
                    size="sm"
                  >
                    {updateStatusMutation.isPending
                      ? "Processing..."
                      : "Undo Rejection"}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-gray-600">
                  No actions available. This request has already been processed.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Permission Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this permission request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason">Rejection Reason</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Medical certificate is invalid or incomplete"
              className="mt-2"
              rows={4}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending
                ? "Rejecting..."
                : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Dialog */}
      <Dialog open={isPhotoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="p-0 max-w-none sm:max-w-none w-[95vw] md:w-[85vw] lg:w-[75vw] xl:w-[65vw] h-[80vh] overflow-hidden">
          <div className="relative w-full h-full bg-muted">
            <Image
              src={perizinan.linkFoto ?? ""}
              alt="Permission Evidence"
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
  <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen space-y-6">
    <Skeleton className="h-6 w-64" />
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-24 w-full" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);
