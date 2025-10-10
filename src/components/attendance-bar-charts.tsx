"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";
import { useMemo, useState } from "react";

// Chart configuration untuk kehadiran
const kehadiranChartConfig = {
    hadir: {
        label: "Hadir",
        color: "hsl(142 76% 36%)", // Hijau
    },
} satisfies ChartConfig;

// Chart configuration untuk izin
const izinChartConfig = {
    izin: {
        label: "Izin",
        color: "hsl(262 83% 58%)", // Ungu
    },
    sakit: {
        label: "Sakit",
        color: "hsl(0 84% 60%)", // Merah
    },
} satisfies ChartConfig;

// Chart configuration untuk keterlambatan
const keterlambatanChartConfig = {
    terlambat: {
        label: "Terlambat",
        color: "hsl(47 96% 53%)", // Kuning
    },
} satisfies ChartConfig;

/**
 * Bar Chart Horizontal untuk Kehadiran (7 hari terakhir)
 */
export function KehadiranBarChart() {
    const [timeRange, setTimeRange] = useState<"7" | "30" | "365">("7");
    const days = parseInt(timeRange);
    
    const { data: statsData, isLoading } = api.absences.getAttendanceStats.useQuery({
        days,
    });
    // Fetch total activated students to scale domain & radius
    const { data: statsSummary } = api.biodataSiswa.getStatistics.useQuery();
    const totalActivated = statsSummary?.activated ?? 0;
    // radius in px: scale with totalActivated (capped)
    const cornerRadius = Math.min(24, Math.max(4, Math.round(totalActivated / 10)));
    const dynamicMaxBar = Math.min(40, Math.max(16, Math.round(totalActivated / 5)));

    const chartData = useMemo(() => {
        if (!statsData) return [];

        return statsData.map((item) => {
            // Format date to show day name
            const date = new Date(item.date);
            const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
            const dayName = dayNames[date.getDay()];
            const dateStr = `${dayName}, ${date.getDate()}`;

            return {
                date: dateStr,
                hadir: item.hadir,
            };
        });
    }, [statsData]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Kehadiran</CardTitle>
                    <CardDescription>7 hari terakhir</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[250px]">
                    <div className="text-sm text-muted-foreground">Memuat data...</div>
                </CardContent>
            </Card>
        );
    }

    const getDescription = () => {
        if (timeRange === "7") return "7 hari terakhir";
        if (timeRange === "30") return "30 hari terakhir";
        return "365 hari terakhir";
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Kehadiran</CardTitle>
                        <CardDescription>Siswa yang hadir dalam {getDescription()}</CardDescription>
                    </div>
                    <Select value={timeRange} onValueChange={(value) => setTimeRange(value as "7" | "30" | "365")}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Pilih periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7 Hari</SelectItem>
                            <SelectItem value="30">1 Bulan</SelectItem>
                            <SelectItem value="365">1 Tahun</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={kehadiranChartConfig}>
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 20,
                            left: 10,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" type="category" tickLine={false} axisLine={false} />
                        <YAxis type="number" domain={[0, Math.max(1, totalActivated)]} />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                            dataKey="hadir"
                            fill="var(--color-hadir)"
                            radius={cornerRadius}
                            maxBarSize={dynamicMaxBar}
                        />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

/**
 * Bar Chart Horizontal untuk Izin (7 hari terakhir)
 */
export function IzinBarChart() {
    const [timeRange, setTimeRange] = useState<"7" | "30" | "365">("7");
    const days = parseInt(timeRange);
    
    const { data: statsData, isLoading } = api.absences.getAttendanceStats.useQuery({
        days,
    });
    const { data: statsSummary } = api.biodataSiswa.getStatistics.useQuery();
    const totalActivated = statsSummary?.activated ?? 0;
    const cornerRadius = Math.min(24, Math.max(4, Math.round(totalActivated / 10)));
    const dynamicMaxBar = Math.min(40, Math.max(16, Math.round(totalActivated / 5)));

    const chartData = useMemo(() => {
        if (!statsData) return [];

        return statsData.map((item) => {
            // Format date to show day name
            const date = new Date(item.date);
            const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
            const dayName = dayNames[date.getDay()];
            const dateStr = `${dayName}, ${date.getDate()}`;

            return {
                date: dateStr,
                izin: item.izin,
            };
        });
    }, [statsData]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Perizinan</CardTitle>
                    <CardDescription>7 hari terakhir</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[250px]">
                    <div className="text-sm text-muted-foreground">Memuat data...</div>
                </CardContent>
            </Card>
        );
    }

    const getDescription = () => {
        if (timeRange === "7") return "7 hari terakhir";
        if (timeRange === "30") return "30 hari terakhir";
        return "365 hari terakhir";
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Perizinan</CardTitle>
                        <CardDescription>Siswa yang izin dalam {getDescription()}</CardDescription>
                    </div>
                    <Select value={timeRange} onValueChange={(value) => setTimeRange(value as "7" | "30" | "365")}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Pilih periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7 Hari</SelectItem>
                            <SelectItem value="30">1 Bulan</SelectItem>
                            <SelectItem value="365">1 Tahun</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={izinChartConfig}>
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 20,
                            left: 10,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" type="category" tickLine={false} axisLine={false} />
                        <YAxis type="number" domain={[0, Math.max(1, totalActivated)]} />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                            dataKey="izin"
                            fill="var(--color-izin)"
                            radius={cornerRadius}
                            maxBarSize={dynamicMaxBar}
                        />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

/**
 * Bar Chart Horizontal untuk Keterlambatan (7 hari terakhir)
 * Note: Untuk saat ini menggunakan data "tidak hadir" sebagai placeholder
 * Nanti bisa ditambahkan logic untuk mendeteksi keterlambatan dari waktu check-in
 */
export function KeterlambatanBarChart() {
    const [timeRange, setTimeRange] = useState<"7" | "30" | "365">("7");
    const days = parseInt(timeRange);
    
    const { data: absencesData, isLoading: loadingAbsences } = api.absences.listRaw.useQuery();
    const { data: statsSummary } = api.biodataSiswa.getStatistics.useQuery();
    const totalActivated = statsSummary?.activated ?? 0;
    const cornerRadius = Math.min(24, Math.max(4, Math.round(totalActivated / 10)));
    const dynamicMaxBar = Math.min(40, Math.max(16, Math.round(totalActivated / 5)));

    const chartData = useMemo(() => {
        if (!absencesData) return [];

        // Get last N days based on timeRange
        const dates: string[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            dates.push(date.toISOString().split('T')[0]!);
        }

        // Count late arrivals per day
        // Asumsi: terlambat jika status "Hadir" atau "Datang" dengan createdAt > jam masuk
        const lateByDate: Record<string, number> = {};

        absencesData.forEach((absence) => {
            const dateStr = absence.date;
            if (dates.includes(dateStr)) {
                // Placeholder logic: count all as potential late
                // TODO: Implement proper late detection based on schedule
                lateByDate[dateStr] = (lateByDate[dateStr] || 0);
            }
        });

        return dates.map((dateStr) => {
            const date = new Date(dateStr);
            const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
            const dayName = dayNames[date.getDay()];
            const formattedDate = `${dayName}, ${date.getDate()}`;

            return {
                date: formattedDate,
                terlambat: lateByDate[dateStr] || 0,
            };
        });
    }, [absencesData, days]);

    if (loadingAbsences) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Keterlambatan</CardTitle>
                    <CardDescription>7 hari terakhir</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[250px]">
                    <div className="text-sm text-muted-foreground">Memuat data...</div>
                </CardContent>
            </Card>
        );
    }

    const getDescription = () => {
        if (timeRange === "7") return "7 hari terakhir";
        if (timeRange === "30") return "30 hari terakhir";
        return "365 hari terakhir";
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Keterlambatan</CardTitle>
                        <CardDescription>Siswa yang terlambat dalam {getDescription()}</CardDescription>
                    </div>
                    <Select value={timeRange} onValueChange={(value) => setTimeRange(value as "7" | "30" | "365")}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Pilih periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">7 Hari</SelectItem>
                            <SelectItem value="30">1 Bulan</SelectItem>
                            <SelectItem value="365">1 Tahun</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={keterlambatanChartConfig}>
                    <BarChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            top: 10,
                            right: 20,
                            left: 10,
                            bottom: 5,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" type="category" tickLine={false} axisLine={false} />
                        <YAxis type="number" domain={[0, Math.max(1, totalActivated)]} />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                            dataKey="terlambat"
                            fill="var(--color-terlambat)"
                            radius={cornerRadius}
                            maxBarSize={dynamicMaxBar}
                        />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
