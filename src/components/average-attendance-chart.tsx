"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { api } from "~/trpc/react";

/**
 * Average Attendance Chart Component
 * Displays a line chart showing attendance trends over the past week
 */
export function AverageAttendanceChart() {
    // Fetch weekly attendance data (using getAttendanceStats with 7 days)
    const { data: weeklyData, isLoading } = api.absences.getAttendanceStats.useQuery({ days: 7 });

    // Map API data to chart format
    const chartData = weeklyData
        ? weeklyData.map((item) => ({
            day: new Date(item.date).toLocaleDateString("id-ID", {
                weekday: "short",
            }),
            attendance: item.hadir,
        }))
        : [
            { day: "Sen", attendance: 850 },
            { day: "Sel", attendance: 820 },
            { day: "Rab", attendance: 780 },
            { day: "Kam", attendance: 900 },
            { day: "Jum", attendance: 950 },
            { day: "Sab", attendance: 880 },
            { day: "Min", attendance: 750 },
        ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-semibold">
                    Rata-rata Kehadiran
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Memuat grafik...</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis
                                dataKey="day"
                                tick={{ fill: "var(--foreground)" }}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                            />
                            <YAxis
                                tick={{ fill: "var(--foreground)" }}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "var(--popover)",
                                    borderColor: "var(--border)",
                                    borderRadius: "6px",
                                    color: "var(--popover-foreground)",
                                }}
                                itemStyle={{
                                    color: "var(--popover-foreground)",
                                }}
                                labelStyle={{
                                    color: "var(--muted-foreground)",
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="attendance"
                                stroke="var(--primary)"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
