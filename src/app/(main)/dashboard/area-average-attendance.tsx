"use client";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type Point = { label: string; sudah: number; izin: number };

export function AreaAverageAttendance({
  title = "Rata-rata Kehadiran",
  description = "Rata-rata siswa per periode",
  data,
  year,
  onPrevYear,
  onNextYear,
}: {
  title?: string;
  description?: string;
  data: Point[];
  year?: number;
  onPrevYear?: () => void;
  onNextYear?: () => void;
}) {
  // Fallback if no data
  const chartData = Array.isArray(data) && data.length ? data : [
    { label: "Jan", sudah: 0, izin: 0 },
  ];
  const ticks = chartData.map((d) => d.label);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded border border-border hover:bg-muted text-sm"
              onClick={onPrevYear}
            >
              {"<"}
            </button>
            <span className="text-sm font-medium tabular-nums min-w-12 text-center">
              {year ?? "-"}
            </span>
            <button
              type="button"
              className="px-2 py-1 rounded border border-border hover:bg-muted text-sm"
              onClick={onNextYear}
            >
              {">"}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                ticks={ticks}
              />
              <Tooltip cursor={false} />
              <defs>
                <linearGradient id="fillSudah" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillIzin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <Area
                type="natural"
                dataKey="izin"
                name="Sakit"
                fill="url(#fillIzin)"
                fillOpacity={0.4}
                stroke="#ef4444"
                stackId="a"
              />
              <Area
                type="natural"
                dataKey="sudah"
                name="Sudah"
                fill="url(#fillSudah)"
                fillOpacity={0.4}
                stroke="#3b82f6"
                stackId="a"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Trending naik rata-rata <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              Periode dinamis sesuai filter
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

export default AreaAverageAttendance;
