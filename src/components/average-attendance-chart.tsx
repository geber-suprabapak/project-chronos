"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
    AreaChart,
    Area,
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
            day: new Date(item.date).toLocaleDateString("en-US", {
                weekday: "short",
            }),
            attendance: item.hadir,
        }))
        : [
            { day: "Mon", attendance: 850 },
            { day: "Tue", attendance: 820 },
            { day: "Wed", attendance: 780 },
            { day: "Thu", attendance: 900 },
            { day: "Fri", attendance: 950 },
            { day: "Sat", attendance: 880 },
            { day: "Sun", attendance: 750 },
        ];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-semibold">
                    Average Attendance
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Loading chart...</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart
                            data={chartData}
                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                                dataKey="day"
                                tick={{ fill: "hsl(var(--foreground))" }}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                            />
                            <YAxis
                                tick={{ fill: "hsl(var(--foreground))" }}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "hsl(var(--popover))",
                                    borderColor: "hsl(var(--border))",
                                    borderRadius: "6px",
                                    color: "hsl(var(--popover-foreground))",
                                }}
                                itemStyle={{
                                    color: "hsl(var(--popover-foreground))",
                                }}
                                labelStyle={{
                                    color: "hsl(var(--muted-foreground))",
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="attendance"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorAttendance)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
