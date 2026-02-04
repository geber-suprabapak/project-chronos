"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
  MapPin,
  Clock,
} from "lucide-react";
import Image from "next/image";

// Helper: format date or datetime
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

const formatTime = (input: string | Date | null | undefined) => {
  if (!input) return "N/A";
  const date = new Date(input);
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getBadgeVariant = (status: string | null | undefined) => {
  const s = (status ?? "").toLowerCase();
  if (["approved", "present", "hadir"].includes(s)) return "default" as const;
  if (["rejected", "absent", "alpha", "izin", "sakit", "late", "terlambat"].includes(s))
    return "destructive" as const;
  return "outline" as const;
};

export default function ShowAbsensiPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = (params as Record<string, string | string[] | undefined>)?.id;
  const id: string =
    typeof idParam === "string"
      ? idParam
      : Array.isArray(idParam)
        ? (idParam[0] ?? "")
        : "";

  const [isPhotoDialogOpen, setPhotoDialogOpen] = useState(false);

  const {
    data: absence,
    isLoading,
    error,
  } = api.absences.getById.useQuery({ id }, { enabled: !!id });

  const user = absence?.userProfile ?? null;

  if (!id) return <div>Invalid ID.</div>;
  if (isLoading) return <SkeletonLayout />;
  if (error)
    return <div className="p-8 text-red-500">Error: {error.message}</div>;
  if (!absence) return <div className="p-8">Absensi tidak ditemukan.</div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/absensi">Absensi</BreadcrumbLink>
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
          <h1 className="text-xl font-bold text-foreground">
            Attendance Detail
          </h1>
          <p className="text-sm text-muted-foreground">
            View attendance record information
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left Column - Photo Evidence Only */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col overflow-hidden border-0 shadow-none bg-transparent sm:border sm:shadow-sm sm:bg-card">
            <CardHeader className="pb-3 px-0 sm:px-6 pt-0 sm:pt-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                Photo Evidence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0 flex-1 flex flex-col min-h-[400px]">
              {absence.photoUrl ? (
                <div
                  className="relative w-full flex-1 rounded-lg border bg-muted/30 overflow-hidden cursor-pointer hover:opacity-95 transition-opacity"
                  onClick={() => setPhotoDialogOpen(true)}
                >
                  <Image
                    src={absence.photoUrl}
                    alt="Attendance Evidence"
                    fill
                    style={{ objectFit: "cover" }}
                    className="rounded-lg"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-colors">
                    <span className="sr-only">View Fullscreen</span>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center border rounded-lg bg-muted/30 text-center p-6">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No photo evidence available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Student Profile + Attendance Info + History */}
        <div className="lg:col-span-1 space-y-3">
          {/* User Profile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-muted-foreground" />
                Student Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-muted">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm truncate">
                    {user?.fullName ?? user?.email ?? absence.userId}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email ?? "N/A"}
                  </p>
                </div>
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-2">
                {user?.nis && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">
                      NIS
                    </span>
                    <span className="text-xs text-foreground font-medium">
                      {user.nis}
                    </span>
                  </div>
                )}
                {user?.className && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">
                      Class
                    </span>
                    <Badge variant="outline" className="text-xs font-medium">
                      {user.className}
                    </Badge>
                  </div>
                )}
                {user?.absenceNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">
                      Absence No.
                    </span>
                    <span className="text-xs text-foreground font-medium">
                      {user.absenceNumber}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Attendance Information (Moved from Left Column) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Attendance Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Date & Time
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="text-sm font-medium">
                      {formatDate(absence.date as unknown as string)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {formatTime(absence.createdAt as unknown as Date)} WIB
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Status
                    </p>
                    <Badge
                      variant={getBadgeVariant(absence.status)}
                      className="capitalize px-2.5 py-0.5"
                    >
                      {absence.status ?? "-"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Location
                  </p>
                  <div className="flex items-center gap-1.5 text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-sm">
                      {[absence.latitude, absence.longitude]
                        .filter((v) => v != null)
                        .join(", ") || "Location not recorded"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Photo Dialog */}
      <Dialog open={isPhotoDialogOpen} onOpenChange={setPhotoDialogOpen}>
        <DialogContent className="p-0 max-w-none sm:max-w-none w-[95vw] md:w-[85vw] lg:w-[75vw] xl:w-[65vw] h-[80vh] overflow-hidden bg-background">
          <DialogHeader className="sr-only">
            <DialogTitle>View Photo Evidence</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-full bg-muted/50 flex items-center justify-center">
            <Image
              src={absence.photoUrl ?? ""}
              alt="Attendance Evidence"
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
  <div className="p-4 md:p-6 lg:p-8 space-y-6">
    <Skeleton className="h-6 w-48" />
    <Skeleton className="h-10 w-full" />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div className="lg:col-span-1">
        <Card className="h-full">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1 space-y-3">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);
