"use client";

import { TrendingUp } from "lucide-react";
import { LabelList, Pie, PieChart, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { api } from "~/trpc/react";
import { useMemo } from "react";

export function StatistikPieChart() {
  // Ambil semua user, absensi, dan perizinan
  const { data: users, isLoading: loadingUsers } = api.userProfiles.listRaw.useQuery();
  const { data: absensi, isLoading: loadingAbsensi } = api.absences.listRaw.useQuery();
  const { data: izin, isLoading: loadingIzin } = api.perizinan.listRaw.useQuery();

  // Always call hooks at the top level
  const chartData = useMemo(() => {
    if (!users || !absensi || !izin) return [];
    const userIds = new Set(users.map((u) => u.id));
    const sudahAbsen = new Set(absensi.map((a) => a.userId));
    let belumAbsen = new Set([...userIds]);
    sudahAbsen.forEach((id) => belumAbsen.delete(id));
    let pergi = 0;
    let sakit = 0;
    izin.forEach((p: any) => {
      if (p.kategoriIzin === "pergi") pergi++;
      if (p.kategoriIzin === "sakit") sakit++;
    });
    return [
      { name: "Belum Absen", value: belumAbsen.size, fill: "#a3a3a3" }, // abu-abu
      { name: "Sudah Absen", value: sudahAbsen.size, fill: "#3b82f6" }, // biru
      { name: "Sakit", value: sakit, fill: "#ef4444" }, // merah
      { name: "Pergi", value: pergi, fill: "#22c55e" }, // hijau
    ];
  }, [users, absensi, izin]);

  // Only render chart if all data is loaded and chartData is available
  if (loadingUsers || loadingAbsensi || loadingIzin || !users || !absensi || !izin) {
    return null;
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Pie Chart Kehadiran</CardTitle>
        <CardDescription>Rekap harian</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-row items-start gap-12 pb-0">
        <div style={{ minWidth: 200, minHeight: 200, maxWidth: 220, maxHeight: 220 }}>
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Tooltip />
              <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} stroke="none">
                {chartData.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
  <div className="flex flex-col gap-2 justify-center items-start" style={{ height: 200, marginLeft: '8px' }}>
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 4, background: entry.fill, border: 'none' }} />
              <span className="text-muted-foreground text-base font-medium">{entry.name}:</span>
              <span className="text-foreground font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
