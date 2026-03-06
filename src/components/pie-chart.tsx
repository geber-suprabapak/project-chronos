"use client";

import { Pie, PieChart } from "recharts";
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
import { api } from "~/trpc/react";
import { useMemo } from "react";

// Config untuk absen masuk
const chartConfigMasuk = {
  value: {
    label: "Jumlah Siswa",
  },
  sudahAbsenMasuk: {
    label: "Sudah Absen",
    color: "hsl(142 76% 36%)", // Hijau
  },
  belumAbsenMasuk: {
    label: "Belum Absen",
    color: "hsl(0 0% 60%)", // Abu-abu
  },
  izin: {
    label: "Izin",
    color: "hsl(262 83% 58%)", // Ungu
  },
  sakit: {
    label: "Sakit",
    color: "hsl(0 84% 60%)", // Merah
  },
} satisfies ChartConfig;

// Config untuk absen pulang
const chartConfigPulang = {
  value: {
    label: "Jumlah Siswa",
  },
  sudahAbsenPulang: {
    label: "Sudah Pulang",
    color: "hsl(221 83% 53%)", // Biru
  },
  belumAbsenPulang: {
    label: "Belum Pulang",
    color: "hsl(47 96% 53%)", // Kuning
  },
} satisfies ChartConfig;

export function StatistikPieChart() {
  // Gunakan endpoint agregat agar request ringan dan lebih stabil.
  const todayString = useMemo(
    () => new Date().toISOString().split("T")[0]!,
    [],
  );
  const { data: summary, isLoading: loadingSummary } =
    api.absences.getTodaySummary.useQuery({ date: todayString });

  // Compact chart sizing for dashboard top layout.
  const outerRadius = 68;
  const innerRadius = 44;

  // Data untuk chart absen masuk
  const chartDataMasuk = useMemo(() => {
    if (!summary) return [];

    return [
      {
        category: "sudahAbsenMasuk",
        value: summary.sudahAbsenMasuk,
        fill: "var(--color-sudahAbsenMasuk)",
      },
      {
        category: "belumAbsenMasuk",
        value: summary.belumAbsenMasuk,
        fill: "var(--color-belumAbsenMasuk)",
      },
      {
        category: "izin",
        value: summary.izin,
        fill: "var(--color-izin)",
      },
      {
        category: "sakit",
        value: summary.sakit,
        fill: "var(--color-sakit)",
      },
    ];
  }, [summary]);

  // Data untuk chart absen pulang
  const chartDataPulang = useMemo(() => {
    if (!summary) return [];

    return [
      {
        category: "sudahAbsenPulang",
        value: summary.sudahAbsenPulang,
        fill: "var(--color-sudahAbsenPulang)",
      },
      {
        category: "belumAbsenPulang",
        value: summary.belumAbsenPulang,
        fill: "var(--color-belumAbsenPulang)",
      },
    ];
  }, [summary]);

  // Calculate totals
  const totalMasuk = useMemo(() => {
    return chartDataMasuk.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartDataMasuk]);

  const totalPulang = useMemo(() => {
    return chartDataPulang.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartDataPulang]);

  // Only render chart if all data is loaded and chartData is available
  if (loadingSummary || !summary) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader className="items-center pb-2">
          <CardTitle>Statistik Kehadiran</CardTitle>
          <CardDescription>Rekap Hari Ini</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Memuat data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="items-center pb-2">
        <CardTitle>Statistik Kehadiran</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-0 pb-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-3">
          {/* Chart Absen Masuk */}
          <div className="space-y-2">
            <div className="text-center">
              <h3 className="text-sm font-semibold">Absen Masuk</h3>
            </div>
            <ChartContainer
              config={chartConfigMasuk}
              className="mx-auto aspect-square max-h-[150px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartDataMasuk}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  strokeWidth={3}
                  paddingAngle={2}
                />
              </PieChart>
            </ChartContainer>
            <div className="text-center">
              <div className="text-xl font-bold">{totalMasuk}</div>
              <div className="text-xs text-muted-foreground">Total Siswa</div>
            </div>
            {/* Legend untuk absen masuk */}
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {chartDataMasuk.map((entry) => {
                const config =
                  chartConfigMasuk[
                    entry.category as keyof typeof chartConfigMasuk
                  ];
                const percentage =
                  totalMasuk > 0
                    ? ((entry.value / totalMasuk) * 100).toFixed(1)
                    : "0.0";
                const color =
                  "color" in config ? config.color : "hsl(var(--muted))";

                return (
                  <div
                    key={entry.category}
                    className="flex items-center gap-1.5 rounded-md bg-muted/50 p-1.5 transition-colors hover:bg-muted"
                  >
                    <div
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[11px] font-medium">
                        {config.label}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {entry.value}
                        </span>
                        <span className="text-[10px]">({percentage}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart Absen Pulang */}
          <div className="space-y-2">
            <div className="text-center">
              <h3 className="text-sm font-semibold">Absen Pulang</h3>
            </div>
            <ChartContainer
              config={chartConfigPulang}
              className="mx-auto aspect-square max-h-[150px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartDataPulang}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  strokeWidth={3}
                  paddingAngle={2}
                />
              </PieChart>
            </ChartContainer>
            <div className="text-center">
              <div className="text-xl font-bold">{totalPulang}</div>
              <div className="text-xs text-muted-foreground">Total Siswa</div>
            </div>
            {/* Legend untuk absen pulang */}
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {chartDataPulang.map((entry) => {
                const config =
                  chartConfigPulang[
                    entry.category as keyof typeof chartConfigPulang
                  ];
                const percentage =
                  totalPulang > 0
                    ? ((entry.value / totalPulang) * 100).toFixed(1)
                    : "0.0";
                const color =
                  "color" in config ? config.color : "hsl(var(--muted))";

                return (
                  <div
                    key={entry.category}
                    className="flex items-center gap-1.5 rounded-md bg-muted/50 p-1.5 transition-colors hover:bg-muted"
                  >
                    <div
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[11px] font-medium">
                        {config.label}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {entry.value}
                        </span>
                        <span className="text-[10px]">({percentage}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
