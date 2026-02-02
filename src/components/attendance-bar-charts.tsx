"use client";

import { Bar, BarChart, XAxis, YAxis, LabelList } from "recharts";
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
  const [timeRange, setTimeRange] = useState<"7" | "30">("7");
  const days = parseInt(timeRange);

  const { data: statsData, isLoading } =
    api.absences.getAttendanceStats.useQuery({
      days,
    });
  // Fetch total activated students to scale domain & radius
  const { data: statsSummary } = api.biodataSiswa.getStatistics.useQuery();
  const totalActivated = statsSummary?.activated ?? 0;

  const chartData = useMemo(() => {
    if (!statsData) return [];

    if (timeRange === "7") {
      // Daily: Tampilkan per hari
      return statsData.map((item) => {
        const date = new Date(item.date);
        const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
        const dayName = dayNames[date.getDay()];
        const dateStr = `${dayName}, ${date.getDate()}`;

        return {
          date: dateStr,
          hadir: item.hadir,
        };
      });
    } else if (timeRange === "30") {
      // Weekly: Kelompokkan per minggu
      const weeklyData: Record<string, { hadir: number }> = {};

      statsData.forEach((item) => {
        const date = new Date(item.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Mulai dari Minggu
        const weekKey = weekStart.toISOString().split("T")[0]!;

        weeklyData[weekKey] ??= { hadir: 0 };
        weeklyData[weekKey].hadir += item.hadir;
      });

      return Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, data], index) => ({
          date: `Minggu ${index + 1}`,
          hadir: data.hadir,
        }));
    } else {
      // Monthly: Kelompokkan per bulan
      const monthlyData: Record<string, { hadir: number }> = {};

      statsData.forEach((item) => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        monthlyData[monthKey] ??= { hadir: 0 };
        monthlyData[monthKey].hadir += item.hadir;
      });

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];

      return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split("-");
          const monthIndex = parseInt(month!) - 1;

          return {
            date: `${monthNames[monthIndex]} ${year}`,
            hadir: data.hadir,
          };
        });
    }
  }, [statsData, timeRange]);

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
    return "30 hari terakhir";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Kehadiran</CardTitle>
            <CardDescription>
              Siswa yang hadir dalam {getDescription()}
            </CardDescription>
          </div>
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as "7" | "30")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Hari</SelectItem>
              <SelectItem value="30">1 Bulan</SelectItem>
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
              top: 20,
              right: 20,
              left: 10,
              bottom: 5,
            }}
          >
            <XAxis
              dataKey="date"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              type="number"
              domain={[0, Math.max(1, totalActivated)]}
              hide
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="hadir"
              fill="var(--color-hadir)"
              radius={8}
              maxBarSize={60}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
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
  const [timeRange, setTimeRange] = useState<"7" | "30">("7");
  const days = parseInt(timeRange);

  const { data: statsData, isLoading } =
    api.absences.getAttendanceStats.useQuery({
      days,
    });
  const { data: statsSummary } = api.biodataSiswa.getStatistics.useQuery();
  const totalActivated = statsSummary?.activated ?? 0;

  const chartData = useMemo(() => {
    if (!statsData) return [];

    if (timeRange === "7") {
      // Daily: Tampilkan per hari
      return statsData.map((item) => {
        const date = new Date(item.date);
        const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
        const dayName = dayNames[date.getDay()];
        const dateStr = `${dayName}, ${date.getDate()}`;

        return {
          date: dateStr,
          izin: item.izin,
        };
      });
    } else if (timeRange === "30") {
      // Weekly: Kelompokkan per minggu
      const weeklyData: Record<string, { izin: number }> = {};

      statsData.forEach((item) => {
        const date = new Date(item.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Mulai dari Minggu
        const weekKey = weekStart.toISOString().split("T")[0]!;

        weeklyData[weekKey] ??= { izin: 0 };
        weeklyData[weekKey].izin += item.izin;
      });

      return Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, data], index) => ({
          date: `Minggu ${index + 1}`,
          izin: data.izin,
        }));
    } else {
      // Monthly: Kelompokkan per bulan
      const monthlyData: Record<string, { izin: number }> = {};

      statsData.forEach((item) => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        monthlyData[monthKey] ??= { izin: 0 };
        monthlyData[monthKey].izin += item.izin;
      });

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];

      return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split("-");
          const monthIndex = parseInt(month!) - 1;

          return {
            date: `${monthNames[monthIndex]} ${year}`,
            izin: data.izin,
          };
        });
    }
  }, [statsData, timeRange]);

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
    return "30 hari terakhir";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Perizinan</CardTitle>
            <CardDescription>
              Siswa yang izin dalam {getDescription()}
            </CardDescription>
          </div>
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as "7" | "30")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Hari</SelectItem>
              <SelectItem value="30">1 Bulan</SelectItem>
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
              top: 20,
              right: 20,
              left: 10,
              bottom: 5,
            }}
          >
            <XAxis
              dataKey="date"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              type="number"
              domain={[0, Math.max(1, totalActivated)]}
              hide
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="izin"
              fill="var(--color-izin)"
              radius={8}
              maxBarSize={60}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
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
  const [timeRange, setTimeRange] = useState<"7" | "30">("7");
  const days = parseInt(timeRange);

  const { data: statsData, isLoading } =
    api.absences.getAttendanceStats.useQuery({
      days,
    });
  const { data: statsSummary } = api.biodataSiswa.getStatistics.useQuery();
  const totalActivated = statsSummary?.activated ?? 0;

  const chartData = useMemo(() => {
    if (!statsData) return [];

    if (timeRange === "7") {
      // Daily: Tampilkan per hari
      return statsData.map((item) => {
        const date = new Date(item.date);
        const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
        const dayName = dayNames[date.getDay()];
        const dateStr = `${dayName}, ${date.getDate()}`;

        return {
          date: dateStr,
          terlambat: item.terlambat,
        };
      });
    } else if (timeRange === "30") {
      // Weekly: Kelompokkan per minggu
      const weeklyData: Record<string, { terlambat: number }> = {};

      statsData.forEach((item) => {
        const date = new Date(item.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Mulai dari Minggu
        const weekKey = weekStart.toISOString().split("T")[0]!;

        weeklyData[weekKey] ??= { terlambat: 0 };
        weeklyData[weekKey].terlambat += item.terlambat;
      });

      return Object.entries(weeklyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, data], index) => ({
          date: `Minggu ${index + 1}`,
          terlambat: data.terlambat,
        }));
    } else {
      // Monthly: Kelompokkan per bulan
      const monthlyData: Record<string, { terlambat: number }> = {};

      statsData.forEach((item) => {
        const date = new Date(item.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        monthlyData[monthKey] ??= { terlambat: 0 };
        monthlyData[monthKey].terlambat += item.terlambat;
      });

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];

      return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split("-");
          const monthIndex = parseInt(month!) - 1;

          return {
            date: `${monthNames[monthIndex]} ${year}`,
            terlambat: data.terlambat,
          };
        });
    }
  }, [statsData, timeRange]);

  if (isLoading) {
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
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Keterlambatan</CardTitle>
            <CardDescription>
              Siswa yang terlambat dalam {getDescription()}
            </CardDescription>
          </div>
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as "7" | "30")}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Hari</SelectItem>
              <SelectItem value="30">1 Bulan</SelectItem>
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
              top: 20,
              right: 20,
              left: 10,
              bottom: 5,
            }}
          >
            <XAxis
              dataKey="date"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />
            <YAxis
              type="number"
              domain={[0, Math.max(1, totalActivated)]}
              hide
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar
              dataKey="terlambat"
              fill="var(--color-terlambat)"
              radius={8}
              maxBarSize={60}
            >
              <LabelList
                position="top"
                offset={12}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
