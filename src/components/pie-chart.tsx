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
  // Ambil semua user, absensi, dan perizinan
  const { data: users, isLoading: loadingUsers } = api.userProfiles.listRaw.useQuery();
  const { data: absensi, isLoading: loadingAbsensi } = api.absences.listRaw.useQuery();
  const { data: izin, isLoading: loadingIzin } = api.perizinan.listRaw.useQuery();

  // Ukuran pie chart tetap
  const outerRadius = 90;
  const innerRadius = 60;

  // Data untuk chart absen masuk
  const chartDataMasuk = useMemo(() => {
    if (!users || !absensi || !izin) return [];
    const userIds = new Set(users.map((u) => u.userId));

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]!;

    // Filter absensi untuk hari ini saja
    const absensiToday = absensi.filter((a) => {
      const absenDate = typeof a.date === 'string' ? a.date : String(a.date);
      return absenDate === todayString;
    });

    // Filter perizinan untuk hari ini saja
    const izinToday = izin.filter((p) => {
      const izinDate = typeof p.tanggal === 'string' ? p.tanggal : p.tanggal.toISOString().split('T')[0];
      return izinDate === todayString;
    });

    // Hitung absensi masuk (status: "Hadir", "Datang", atau "Terlambat")
    const sudahAbsenMasuk = new Set(
      absensiToday
        .filter((a) => a.status === "Hadir" || a.status === "Datang" || a.status === "Terlambat")
        .map((a) => a.userId)
    );

    // Hitung user yang izin atau sakit (mereka juga punya alasan valid untuk tidak hadir)
    const userIzinSakit = new Set(izinToday.map((p) => p.userId));

    // Belum absen masuk = semua user KECUALI yang sudah absen masuk ATAU yang izin/sakit
    const belumAbsenMasuk = new Set([...userIds]);
    sudahAbsenMasuk.forEach((id) => belumAbsenMasuk.delete(id));
    userIzinSakit.forEach((id) => belumAbsenMasuk.delete(id));

    // Hitung izin dan sakit hari ini
    let izinPergi = 0;
    let sakit = 0;
    izinToday.forEach((p) => {
      if (p.kategoriIzin === "pergi") izinPergi++;
      if (p.kategoriIzin === "sakit") sakit++;
    });

    return [
      {
        category: "sudahAbsenMasuk",
        value: sudahAbsenMasuk.size,
        fill: "var(--color-sudahAbsenMasuk)"
      },
      {
        category: "belumAbsenMasuk",
        value: belumAbsenMasuk.size,
        fill: "var(--color-belumAbsenMasuk)"
      },
      {
        category: "izin",
        value: izinPergi,
        fill: "var(--color-izin)"
      },
      {
        category: "sakit",
        value: sakit,
        fill: "var(--color-sakit)"
      },
    ];
  }, [users, absensi, izin]);

  // Data untuk chart absen pulang
  const chartDataPulang = useMemo(() => {
    if (!users || !absensi) return [];

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayString = today.toISOString().split('T')[0]!;

    // Filter absensi untuk hari ini saja
    const absensiToday = absensi.filter((a) => {
      const absenDate = typeof a.date === 'string' ? a.date : String(a.date);
      return absenDate === todayString;
    });

    // Hitung absensi masuk (status: "Hadir", "Datang", atau "Terlambat")
    const sudahAbsenMasuk = new Set(
      absensiToday
        .filter((a) => a.status === "Hadir" || a.status === "Datang" || a.status === "Terlambat")
        .map((a) => a.userId)
    );

    // Hitung absensi pulang (status: "Pulang")
    const sudahAbsenPulang = new Set(
      absensiToday
        .filter((a) => a.status === "Pulang")
        .map((a) => a.userId)
    );

    // Belum absen pulang = user yang sudah absen masuk tapi belum pulang
    const belumAbsenPulang = new Set([...sudahAbsenMasuk]);
    sudahAbsenPulang.forEach((id) => belumAbsenPulang.delete(id));

    return [
      {
        category: "sudahAbsenPulang",
        value: sudahAbsenPulang.size,
        fill: "var(--color-sudahAbsenPulang)"
      },
      {
        category: "belumAbsenPulang",
        value: belumAbsenPulang.size,
        fill: "var(--color-belumAbsenPulang)"
      },
    ];
  }, [users, absensi]);

  // Calculate totals
  const totalMasuk = useMemo(() => {
    return chartDataMasuk.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartDataMasuk]);

  const totalPulang = useMemo(() => {
    return chartDataPulang.reduce((acc, curr) => acc + curr.value, 0);
  }, [chartDataPulang]);

  // Only render chart if all data is loaded and chartData is available
  if (loadingUsers || loadingAbsensi || loadingIzin || !users || !absensi || !izin) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <CardTitle>Statistik Kehadiran</CardTitle>
          <CardDescription>Rekap Hari Ini</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <div className="text-sm text-muted-foreground">Memuat data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Statistik Kehadiran</CardTitle>
        <CardDescription>Rekap Hari Ini</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart Absen Masuk */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-sm font-semibold">Absen Masuk</h3>
              <p className="text-xs text-muted-foreground">Status kehadiran siswa</p>
            </div>
            <ChartContainer
              config={chartConfigMasuk}
              className="mx-auto aspect-square max-h-[250px]"
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
              <div className="text-2xl font-bold">{totalMasuk}</div>
              <div className="text-xs text-muted-foreground">Total Siswa</div>
            </div>
            {/* Legend untuk absen masuk */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {chartDataMasuk.map((entry) => {
                const config = chartConfigMasuk[entry.category as keyof typeof chartConfigMasuk];
                const percentage = totalMasuk > 0 ? ((entry.value / totalMasuk) * 100).toFixed(1) : '0.0';
                const color = 'color' in config ? config.color : 'hsl(var(--muted))';

                return (
                  <div
                    key={entry.category}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {config.label}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{entry.value}</span>
                        <span className="text-[10px]">({percentage}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart Absen Pulang */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-sm font-semibold">Absen Pulang</h3>
              <p className="text-xs text-muted-foreground">Status kepulangan siswa</p>
            </div>
            <ChartContainer
              config={chartConfigPulang}
              className="mx-auto aspect-square max-h-[250px]"
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
              <div className="text-2xl font-bold">{totalPulang}</div>
              <div className="text-xs text-muted-foreground">Total Siswa</div>
            </div>
            {/* Legend untuk absen pulang */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {chartDataPulang.map((entry) => {
                const config = chartConfigPulang[entry.category as keyof typeof chartConfigPulang];
                const percentage = totalPulang > 0 ? ((entry.value / totalPulang) * 100).toFixed(1) : '0.0';
                const color = 'color' in config ? config.color : 'hsl(var(--muted))';

                return (
                  <div
                    key={entry.category}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">
                        {config.label}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{entry.value}</span>
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
