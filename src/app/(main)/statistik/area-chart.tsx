"use client";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts";
import { api } from "~/trpc/react";
import { useMemo } from "react";

export default function StatistikAreaChart() {
  // Ambil semua absensi dan perizinan (tanpa limit/pagination)
  const { data: absensi } = api.absences.listRaw.useQuery();
  const { data: izin } = api.perizinan.listRaw.useQuery();

  // Gabungkan data per tanggal
  const chartData = useMemo(() => {
    if (!absensi && !izin) return [];
    const hadirPerTanggal: Record<string, Set<string>> = {};
    absensi?.forEach((a: any) => {
      const tgl = a.date instanceof Date ? a.date.toISOString().slice(0, 10) : a.date?.slice(0, 10);
      if (!tgl) return;
      if (!hadirPerTanggal[tgl]) hadirPerTanggal[tgl] = new Set();
      hadirPerTanggal[tgl].add(a.userId);
    });
    const izinPerTanggal: Record<string, Set<string>> = {};
    izin?.forEach((p: any) => {
      const tgl = p.tanggal instanceof Date ? p.tanggal.toISOString().slice(0, 10) : p.tanggal?.slice(0, 10);
      if (!tgl) return;
      if (!izinPerTanggal[tgl]) izinPerTanggal[tgl] = new Set();
      izinPerTanggal[tgl].add(p.userId);
    });
    const tanggalSet = new Set([
      ...Object.keys(hadirPerTanggal),
      ...Object.keys(izinPerTanggal),
    ]);
    const tanggalList = Array.from(tanggalSet).sort();
    return tanggalList.map((tgl) => ({
      tanggal: tgl,
      kehadiran: hadirPerTanggal[tgl]?.size ?? 0,
      perizinan: izinPerTanggal[tgl]?.size ?? 0,
    }));
  }, [absensi, izin]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Statistik Kehadiran & Perizinan Siswa</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 24, left: 24, bottom: 24 }}
              barGap={8}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="tanggal"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tickFormatter={(value) => value?.slice(5)}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, (dataMax: number) => (dataMax > 100 ? dataMax : 100)]}
              />
              <Tooltip cursor={false} />
              <Legend />
              <Bar dataKey="kehadiran" name="Kehadiran" fill="#22c55e" radius={8} >
                <LabelList dataKey="kehadiran" position="top" offset={12} className="fill-foreground" fontSize={12} />
              </Bar>
              <Bar dataKey="perizinan" name="Perizinan" fill="#ef4444" radius={8} >
                <LabelList dataKey="perizinan" position="top" offset={12} className="fill-foreground" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
