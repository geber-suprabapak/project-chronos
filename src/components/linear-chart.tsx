"use client"

import { TrendingUp } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "~/components/ui/card"
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "~/components/ui/chart"
import { api } from "~/trpc/react"
import { useMemo } from "react"

const chartConfig = {
    jumlah: {
        label: "Jumlah Siswa",
        color: "hsl(142 76% 36%)", // Green color that's visible in both light and dark mode
    },
} satisfies ChartConfig

export function AttendanceTimeChart() {
    const { data: absences, isLoading: absencesLoading } = api.absences.listRaw.useQuery();
    const { data: schedule, isLoading: scheduleLoading } = api.jadwal.getCurrentDay.useQuery();

    const isLoading = absencesLoading || scheduleLoading;

    const chartData = useMemo(() => {
        if (!absences || !schedule) return [];

        // Parse waktu dari jadwal (format HH:MM:SS)
        const parseTime = (timeStr: string) => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return { hours: hours ?? 0, minutes: minutes ?? 0 };
        };

        const startTime = parseTime(schedule.mulaiMasuk);
        const endTime = parseTime(schedule.selesaiPulang);

        // Get today's date
        const today = new Date();
        const todayString = today.toISOString().split('T')[0]!;

        // Filter absensi untuk hari ini (semua status untuk melihat absen masuk dan pulang)
        const todayAbsences = absences.filter((a) => {
            const absenDate = typeof a.date === 'string' ? a.date : String(a.date);
            return absenDate === todayString;
        });

        // Group by hour and 15-minute intervals
        const timeSlotCounts: Record<string, number> = {};

        todayAbsences.forEach((absence) => {
            if (absence.createdAt) {
                const date = new Date(absence.createdAt);
                const hour = date.getHours();
                const minute = date.getMinutes();

                // Round down to nearest 5-minute interval
                const roundedMinute = Math.floor(minute / 5) * 5;
                const timeKey = `${hour.toString().padStart(2, '0')}:${roundedMinute.toString().padStart(2, '0')}`;

                timeSlotCounts[timeKey] = (timeSlotCounts[timeKey] ?? 0) + 1;
            }
        });

        // Create array for time slots based on schedule
        const timeSlots: Array<{ jam: string; jumlah: number }> = [];

        for (let hour = startTime.hours; hour <= endTime.hours; hour++) {
            for (let minute = 0; minute < 60; minute += 5   ) {
                // Skip if before start time
                if (hour === startTime.hours && minute < startTime.minutes) continue;
                // Skip if after end time
                if (hour === endTime.hours && minute > endTime.minutes) break;

                const timeKey = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                timeSlots.push({
                    jam: timeKey,
                    jumlah: timeSlotCounts[timeKey] ?? 0,
                });
            }
        }

        return timeSlots;
    }, [absences, schedule]);

    const totalToday = useMemo(() => {
        return chartData.reduce((sum, item) => sum + item.jumlah, 0);
    }, [chartData]);

    const peakHour = useMemo(() => {
        if (chartData.length === 0) return null;
        const max = chartData.reduce((prev, current) =>
            current.jumlah > prev.jumlah ? current : prev
        );
        return max.jumlah > 0 ? max : null;
    }, [chartData]);

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Grafik Jam Kehadiran</CardTitle>
                    <CardDescription>Statistik jam absen siswa hari ini</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[300px]">
                    <div className="text-sm text-muted-foreground">Memuat data...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Grafik Jam Kehadiran</CardTitle>
                <CardDescription>
                    Menampilkan distribusi waktu absen siswa hari ini
                    {schedule && ` (${schedule.mulaiMasuk.slice(0, 5)} - ${schedule.selesaiPulang.slice(0, 5)})`}
                </CardDescription>
            </CardHeader>
            <CardContent className="px-2">
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                    <LineChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 0,
                            right: 0,
                            top: 20,
                            bottom: 60,
                        }}
                    >
                        <CartesianGrid
                            vertical={true}
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            opacity={0.3}
                        />
                        <XAxis
                            dataKey="jam"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            interval={3}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            allowDecimals={false}
                        />
                        <ChartTooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={<ChartTooltipContent
                                labelFormatter={(value) => `Pukul ${value}`}
                                formatter={(value) => [`${value} siswa`, 'Jumlah']}
                            />}
                        />
                        <Line
                            dataKey="jumlah"
                            type="monotone"
                            stroke="hsl(142 76% 36%)"
                            strokeWidth={3}
                            dot={{
                                fill: "hsl(142 76% 36%)",
                                r: 3,
                                stroke: "hsl(142 76% 36%)",
                                strokeWidth: 1,
                            }}
                            activeDot={{
                                r: 5,
                                stroke: "hsl(142 76% 36%)",
                                strokeWidth: 2,
                            }}
                        />
                    </LineChart>
                </ChartContainer>
                <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Total Absen Hari Ini</span>
                        <span className="text-2xl font-bold">{totalToday}</span>
                    </div>
                    {peakHour && (
                        <div className="flex flex-col gap-1 text-right">
                            <span className="text-xs text-muted-foreground">Jam Paling Ramai</span>
                            <div className="flex items-center gap-2 justify-end">
                                <span className="text-2xl font-bold">{peakHour.jam}</span>
                                <TrendingUp className="h-5 w-5 text-green-600" />
                            </div>
                            <span className="text-xs text-muted-foreground">{peakHour.jumlah} siswa</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
