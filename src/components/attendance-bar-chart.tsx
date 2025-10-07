"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "~/trpc/react";
import { Calendar } from "lucide-react";

type TimeRange = "3" | "7" | "30" | "365";

const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
    { value: "3", label: "3 Hari Terakhir" },
    { value: "7", label: "7 Hari Terakhir" },
    { value: "30", label: "30 Hari Terakhir" },
    { value: "365", label: "1 Tahun Terakhir" },
];

export function AttendanceBarChart() {
    const [timeRange, setTimeRange] = useState<TimeRange>("7");

    const { data: stats, isLoading } = api.absences.getAttendanceStats.useQuery({
        days: parseInt(timeRange),
    });

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        if (timeRange === "365") {
            // Show month-day for yearly view
            return new Intl.DateTimeFormat("id-ID", {
                month: "short",
                day: "numeric",
            }).format(date);
        }
        // Show day-month for shorter ranges
        return new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
        }).format(date);
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const date = new Date(label);
            const formattedDate = new Intl.DateTimeFormat("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(date);

            return (
                <div className="bg-background border border-border rounded-lg shadow-lg p-3">
                    <p className="font-medium text-sm mb-2">{formattedDate}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-semibold">{entry.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <CardTitle>Statistik Kehadiran Siswa</CardTitle>
                    </div>
                    <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Pilih rentang waktu" />
                        </SelectTrigger>
                        <SelectContent>
                            {timeRangeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <CardDescription>
                    Perbandingan kehadiran, izin, dan ketidakhadiran siswa terverifikasi
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center justify-center h-[350px]">
                        <div className="text-sm text-muted-foreground">Memuat data...</div>
                    </div>
                ) : !stats || stats.length === 0 ? (
                    <div className="flex items-center justify-center h-[350px]">
                        <div className="text-sm text-muted-foreground">Tidak ada data tersedia</div>
                    </div>
                ) : (
                    <div className="w-full h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={stats}
                                margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatDate}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    className="text-xs"
                                />
                                <YAxis
                                    allowDecimals={false}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={10}
                                    className="text-xs"
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
                                <Legend
                                    wrapperStyle={{ paddingTop: "20px" }}
                                    iconType="circle"
                                />
                                <Bar
                                    dataKey="hadir"
                                    name="Hadir"
                                    fill="hsl(142, 76%, 36%)"
                                    radius={[4, 4, 0, 0]}
                                    stackId="a"
                                />
                                <Bar
                                    dataKey="izin"
                                    name="Izin"
                                    fill="hsl(47, 96%, 53%)"
                                    radius={[4, 4, 0, 0]}
                                    stackId="a"
                                />
                                <Bar
                                    dataKey="tidakHadir"
                                    name="Tidak Hadir"
                                    fill="hsl(0, 84%, 60%)"
                                    radius={[4, 4, 0, 0]}
                                    stackId="a"
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
