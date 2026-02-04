"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
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
    User,
    Eye,
    Search,
    Users,
    ArrowLeft,
} from "lucide-react";

// Helper function to format date
function formatDate(date: Date | undefined): string {
    if (!date) return "";
    return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function formatTime(date: Date): string {
    return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

/**
 * Statistics Card Component
 */
interface StatCardProps {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
    return (
        <Card className="bg-white">
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-gray-600">{label}</p>
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                    </div>
                    <div className={`rounded-full ${color} p-2`}>{icon}</div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ClassDetailPage() {
    const params = useParams();
    const className = decodeURIComponent(params.className as string);

    const today = new Date();
    const [selectedDate, setSelectedDate] = useState<Date>(today);
    const [search, setSearch] = useState("");

    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

    // Fetch all students in selected class
    const { data: students, isLoading: studentsLoading } =
        api.userProfiles.list.useQuery({ className: className, limit: 100 });

    // Get student userIds for filtering
    const studentUserIds = useMemo(() => {
        if (!students?.data) return new Set<string>();
        return new Set(students.data.map((s) => s.userId));
    }, [students]);

    const studentUserIdsArray = useMemo(() => {
        if (!students?.data) return [];
        return students.data.map((s) => s.userId);
    }, [students]);

    // Fetch attendance records for selected date
    const { data: absences } = api.absences.list.useQuery(
        {
            date: dateStr,
            userIds: studentUserIdsArray,
            limit: 500,
        },
        { enabled: studentUserIdsArray.length > 0 }
    );

    // Fetch permissions for selected date
    const { data: permissionsRaw } = api.perizinan.list.useQuery({
        date: dateStr,
        limit: 100,
    });

    // Filter permissions to only include students from selected class
    const permissions = useMemo(() => {
        if (!permissionsRaw) return [];
        return permissionsRaw.filter((p) => studentUserIds.has(p.userId));
    }, [permissionsRaw, studentUserIds]);

    // Build attendance status map
    const attendanceMap = useMemo(() => {
        const map = new Map<
            string,
            { status: string; time?: string; id?: string; isPermission?: boolean }
        >();

        // First, add approved permissions as "Izin"
        permissions.forEach((permission) => {
            if (permission.approvalStatus === "approved") {
                const time = permission.createdAt
                    ? formatTime(new Date(permission.createdAt))
                    : undefined;
                map.set(permission.userId, {
                    status: "Izin",
                    time,
                    id: permission.id,
                    isPermission: true,
                });
            }
        });

        // Then, add absence records (overrides Izin if both exist)
        absences?.forEach((absence) => {
            const time = absence.createdAt
                ? formatTime(new Date(absence.createdAt))
                : undefined;
            const isLate = absence.status === "Terlambat";

            map.set(absence.userId, {
                status: isLate ? "Terlambat" : "Hadir",
                time,
                id: absence.id,
                isPermission: false,
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
                    hadir++;
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

    // Filter students by search
    const filteredStudents = useMemo(() => {
        if (!students?.data) return [];
        if (!search.trim()) return students.data;
        return students.data.filter(
            (s) =>
                s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
                s.nis?.toLowerCase().includes(search.toLowerCase())
        );
    }, [students, search]);

    const loading = studentsLoading;

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen space-y-6">
            {/* Breadcrumb */}
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/absensi">Presensi</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/absensi/perkelas">Per Kelas</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{className}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Header */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/absensi/perkelas">
                        <Button variant="outline" size="icon" aria-label="Kembali">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{className}</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Data kehadiran siswa untuk {formatDate(selectedDate)}
                        </p>
                    </div>
                </div>
                {/* Date Picker */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            {formatDate(selectedDate)}
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

            {/* Statistics Cards */}
            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard
                        label="Total Siswa"
                        value={stats.total}
                        icon={<Users className="h-5 w-5 text-blue-600" />}
                        color="bg-blue-100"
                    />
                    <StatCard
                        label="Hadir"
                        value={stats.hadir}
                        icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
                        color="bg-green-100"
                    />
                    <StatCard
                        label="Terlambat"
                        value={stats.terlambat}
                        icon={<Clock className="h-5 w-5 text-yellow-600" />}
                        color="bg-yellow-100"
                    />
                    <StatCard
                        label="Izin"
                        value={stats.izin}
                        icon={<FileText className="h-5 w-5 text-purple-600" />}
                        color="bg-purple-100"
                    />
                    <StatCard
                        label="Belum Presensi"
                        value={stats.belumPresensi}
                        icon={<UserX className="h-5 w-5 text-red-600" />}
                        color="bg-red-100"
                    />
                </div>
            )}

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    type="search"
                    placeholder="Cari nama atau NIS..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Student List */}
            <Card className="bg-white">
                <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase">
                        Daftar Siswa ({filteredStudents.length} siswa)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                    {loading ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} className="h-20" />
                            ))}
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-gray-500">Tidak ada data siswa</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredStudents
                                .sort((a, b) => {
                                    const numA = parseInt(a.absenceNumber ?? "999");
                                    const numB = parseInt(b.absenceNumber ?? "999");
                                    return numA - numB;
                                })
                                .map((student) => {
                                    const attendance = attendanceMap.get(student.userId);
                                    const status = attendance?.status || "Belum Presensi";
                                    const time = attendance?.time || null;
                                    const recordId = attendance?.id;
                                    const isPermission = attendance?.isPermission;

                                    const statusColor =
                                        status === "Hadir"
                                            ? "bg-green-100 text-green-800"
                                            : status === "Terlambat"
                                                ? "bg-yellow-100 text-yellow-800"
                                                : status === "Izin"
                                                    ? "bg-purple-100 text-purple-800"
                                                    : "bg-red-100 text-red-800";

                                    const detailHref = isPermission
                                        ? `/perizinan/show/${recordId}`
                                        : `/absensi/show/${recordId}`;

                                    return (
                                        <div
                                            key={student.id}
                                            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex items-start gap-4 flex-1">
                                                <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    <User className="h-5 w-5 text-gray-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900">
                                                        {student.absenceNumber
                                                            ? `${student.absenceNumber}. `
                                                            : ""}
                                                        {student.fullName ?? "-"}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                                                        <span>NIS: {student.nis ?? "-"}</span>
                                                        {time && (
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {time}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <Badge className={`${statusColor} capitalize`}>
                                                    {status}
                                                </Badge>
                                                {recordId && (
                                                    <Button
                                                        asChild
                                                        variant="outline"
                                                        size="icon"
                                                        aria-label="Detail"
                                                    >
                                                        <Link href={detailHref}>
                                                            <Eye className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
