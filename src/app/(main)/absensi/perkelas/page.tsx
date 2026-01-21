"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import {
  CalendarIcon,
  CheckCircle2,
  Clock,
  FileText,
  UserX,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

// Helper function to format date
function formatDate(date: Date | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// Helper function to sort classes by grade level (X, XI, XII)
function sortClasses(classes: (string | null)[]): string[] {
  const validClasses = classes.filter((c): c is string => c !== null);

  return validClasses.sort((a, b) => {
    // Extract grade level (X, XI, XII)
    const gradeA = a.match(/^(X|XI|XII)/)?.[0] || "";
    const gradeB = b.match(/^(X|XI|XII)/)?.[0] || "";

    // Define grade order
    const gradeOrder: Record<string, number> = { X: 1, XI: 2, XII: 3 };

    // Compare by grade first
    const gradeComparison =
      (gradeOrder[gradeA] || 999) - (gradeOrder[gradeB] || 999);
    if (gradeComparison !== 0) return gradeComparison;

    // If same grade, sort alphabetically
    return a.localeCompare(b);
  });
}

export default function PerkelasPage() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  // Fetch available classes
  const { data: availableClasses } =
    api.userProfiles.getUniqueClassNames.useQuery();

  // Sort classes by grade level
  const sortedClasses = useMemo(() => {
    if (!availableClasses) return [];
    return sortClasses(availableClasses);
  }, [availableClasses]);

  // Fetch all students in selected class
  const { data: students, isLoading: studentsLoading } =
    api.userProfiles.list.useQuery(
      { className: selectedClass, limit: 100 },
      { enabled: !!selectedClass },
    );

  // Get student userIds for filtering
  const studentUserIds = useMemo(() => {
    if (!students?.data) return new Set<string>();
    return new Set(students.data.map((s) => s.userId));
  }, [students]);

  // Fetch attendance records for selected date (all classes, we'll filter by students later)
  const { data: absencesRaw } = api.absences.list.useQuery(
    { date: dateStr, limit: 1500 },
    { enabled: !!selectedClass },
  );

  // Filter absences to only include students from selected class
  const absences = useMemo(() => {
    if (!absencesRaw) return [];
    return absencesRaw.filter((a) => studentUserIds.has(a.userId));
  }, [absencesRaw, studentUserIds]);

  // Fetch permissions for selected date
  const { data: permissionsRaw } = api.perizinan.list.useQuery(
    { date: dateStr, limit: 100 },
    { enabled: !!selectedClass },
  );

  // Filter permissions to only include students from selected class
  const permissions = useMemo(() => {
    if (!permissionsRaw) return [];
    return permissionsRaw.filter((p) => studentUserIds.has(p.userId));
  }, [permissionsRaw, studentUserIds]);

  // Build attendance status map
  const attendanceMap = useMemo(() => {
    const map = new Map<string, { status: string; time?: string }>();

    // First, add approved permissions as "Izin"
    permissions.forEach((permission) => {
      if (permission.approvalStatus === "approved") {
        const time = permission.createdAt
          ? new Date(permission.createdAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : undefined;
        map.set(permission.userId, { status: "Izin", time });
      }
    });

    // Then, add absence records as "Hadir" (overrides Izin if both exist)
    // If student has any absence record, they are considered "Hadir" regardless of status
    absences?.forEach((absence) => {
      const time = absence.createdAt
        ? new Date(absence.createdAt).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : undefined;

      // Check if this is a late arrival
      const isLate = absence.status === "Terlambat";

      map.set(absence.userId, {
        status: isLate ? "Terlambat" : "Hadir",
        time,
      });
    });

    return map;
  }, [absences, permissions]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!students?.data)
      return { hadir: 0, izin: 0, terlambat: 0, belumPresensi: 0, total: 0 };

    let hadir = 0;
    let izin = 0;
    let terlambat = 0;

    students.data.forEach((student) => {
      const attendance = attendanceMap.get(student.userId);
      if (attendance) {
        if (attendance.status === "Terlambat") {
          terlambat++;
          hadir++; // Terlambat counts as present
        } else if (attendance.status === "Izin") {
          izin++;
        } else if (attendance.status === "Hadir") {
          hadir++;
        }
      }
    });

    const total = students.data.length;
    const belumPresensi = total - hadir - izin;

    return { hadir, izin, terlambat, belumPresensi, total };
  }, [students, attendanceMap]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
            Absensi Per Kelas
          </h1>
          <p className="text-muted-foreground text-sm">
            Lihat data kehadiran semua siswa dalam kelas
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Class Selection */}
          <div className="flex flex-col">
            <Label htmlFor="class-select" className="mb-2 text-sm font-medium">
              Kelas
            </Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger id="class-select" className="w-full">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {sortedClasses.map((className) => (
                  <SelectItem key={className} value={className}>
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="flex flex-col">
            <Label htmlFor="date-select" className="mb-2 text-sm font-medium">
              Tanggal
            </Label>
            <div className="relative flex gap-2">
              <input
                id="date-select"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={formatDate(selectedDate)}
                readOnly
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="absolute top-1/2 right-2 size-6 -translate-y-1/2 p-0"
                  >
                    <CalendarIcon className="size-3.5" />
                    <span className="sr-only">Pilih tanggal</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </Card>

      {/* Show content only when class is selected */}
      {!selectedClass ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Pilih kelas untuk melihat data kehadiran
          </p>
        </Card>
      ) : (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Hadir
                  </p>
                  <p className="text-2xl font-bold">{stats.hadir}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Izin
                  </p>
                  <p className="text-2xl font-bold">{stats.izin}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Terlambat
                  </p>
                  <p className="text-2xl font-bold">{stats.terlambat}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Belum Presensi
                  </p>
                  <p className="text-2xl font-bold">{stats.belumPresensi}</p>
                </div>
                <UserX className="h-8 w-8 text-red-500" />
              </div>
            </Card>
          </div>

          {/* Student List Table */}
          <Card className="p-2 sm:p-4 overflow-hidden">
            {studentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">No. Absen</TableHead>
                      <TableHead>NIS</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Waktu
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students?.data && students.data.length > 0 ? (
                      students.data
                        .sort((a, b) => {
                          const numA = parseInt(a.absenceNumber ?? "999");
                          const numB = parseInt(b.absenceNumber ?? "999");
                          return numA - numB;
                        })
                        .map((student) => {
                          const attendance = attendanceMap.get(student.userId);
                          const status = attendance?.status || "Belum Presensi";
                          const time = attendance?.time || "-";

                          return (
                            <TableRow
                              key={student.id}
                              className="hover:bg-muted/50"
                            >
                              <TableCell className="font-medium">
                                {student.absenceNumber ?? "-"}
                              </TableCell>
                              <TableCell>{student.nis ?? "-"}</TableCell>
                              <TableCell className="font-medium">
                                {student.fullName ?? "-"}
                              </TableCell>
                              <TableCell>
                                {status === "Hadir" && (
                                  <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                                    ✅ Hadir
                                  </span>
                                )}
                                {status === "Terlambat" && (
                                  <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                                    🟡 Terlambat
                                  </span>
                                )}
                                {status === "Izin" && (
                                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                    📄 Izin
                                  </span>
                                )}
                                {status === "Belum Presensi" && (
                                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                    ❌ Belum Presensi
                                  </span>
                                )}
                                {status !== "Hadir" &&
                                  status !== "Terlambat" &&
                                  status !== "Izin" &&
                                  status !== "Belum Presensi" && (
                                    <span>{status}</span>
                                  )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                {time}
                              </TableCell>
                            </TableRow>
                          );
                        })
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          Tidak ada data siswa untuk kelas ini
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
