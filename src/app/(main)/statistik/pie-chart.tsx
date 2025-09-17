"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { useMemo } from "react";

export function StatistikPieChart() {
  const { data: users, isLoading: loadingUsers } = api.userProfiles.listRaw.useQuery();
  const { data: absensi, isLoading: loadingAbsensi } = api.absences.listRaw.useQuery();
  const { data: izin, isLoading: loadingIzin } = api.perizinan.listRaw.useQuery();

  const bars = useMemo(() => {
    if (!users || !absensi || !izin) return [] as Array<{ jurusan: string; hadir: number; izin: number; total: number }>;
    const jurusanList = ["PPLG", "AKL", "MPLB", "PM"] as const;
    const profileJurusan = new Map<string, string>();
    for (const u of users) {
      const cls = (u.className ?? "").toUpperCase();
      const j = jurusanList.find((jj) => cls.includes(jj)) ?? "PPLG";
      profileJurusan.set(u.id, j);
    }
    const map: Record<string, { hadir: number; izin: number }> = Object.fromEntries(
      jurusanList.map((j) => [j, { hadir: 0, izin: 0 }])
    ) as Record<string, { hadir: number; izin: number }>;

    const hadirUserIds = new Set(absensi.map((a) => a.userId));
    for (const uid of hadirUserIds) {
      const j = profileJurusan.get(uid);
      if (!j) continue;
      if (!map[j]) map[j] = { hadir: 0, izin: 0 };
      map[j].hadir += 1;
    }

    for (const p of izin) {
      const kategori = (p.kategoriIzin ?? "").toLowerCase();
      if (kategori !== "sakit" && kategori !== "pergi") continue;
      const j = profileJurusan.get(p.userId);
      if (!j) continue;
      if (!map[j]) map[j] = { hadir: 0, izin: 0 };
      map[j].izin += 1;
    }

    return jurusanList.map((j) => {
      const hadir = map[j]?.hadir ?? 0;
      const izinCount = map[j]?.izin ?? 0;
      return { jurusan: j, hadir, izin: izinCount, total: hadir + izinCount };
    });
  }, [users, absensi, izin]);

  const yMax = useMemo(() => {
    if (!bars || bars.length === 0) return 1;
    return Math.max(...bars.map((b) => b.total)) || 1;
  }, [bars]);

  const yTicks = useMemo(() => {
    const max = yMax;
    const step = max <= 10 ? 1 : max <= 20 ? 2 : max <= 50 ? 5 : max <= 100 ? 10 : Math.ceil(max / 10);
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    return ticks;
  }, [yMax]);

  if (loadingUsers || loadingAbsensi || loadingIzin || !users || !absensi || !izin) return null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-start pb-0">
        <CardTitle>Bar Chart Kehadiran</CardTitle>
        <CardDescription>Hadir (biru) vs Izin/Sakit (merah)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-6 pb-4">
        <div className="self-start">
          <BarChart
            accessibilityLayer
            data={bars}
            width={640}
            height={260}
            barCategoryGap={18}
            barGap={6}
            margin={{ top: 24 }}
          >
            <CartesianGrid vertical={false} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              width={28}
              domain={[0, yMax]}
              ticks={yTicks}
            />
            <XAxis dataKey="jurusan" tickLine={false} tickMargin={10} axisLine={false} />
            <Bar dataKey="hadir" fill="var(--chart-1)" radius={4} />
            <Bar dataKey="izin" fill="#ef4444" radius={4} />
          </BarChart>
        </div>
      </CardContent>
    </Card>
  );
}
