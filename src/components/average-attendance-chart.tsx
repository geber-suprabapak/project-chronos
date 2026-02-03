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
        <Card className="bg-white">
            <CardHeader>
                <CardTitle className="text-base font-semibold">
                    Average Attendance
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <p className="text-sm text-gray-500">Loading chart...</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="day"
                                stroke="#6b7280"
                                fontSize={12}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="#6b7280"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: "white",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: "6px",
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="attendance"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ fill: "#3b82f6", r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}
