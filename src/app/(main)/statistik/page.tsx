"use client";
import { StatistikPieChart } from "./pie-chart";
import StatistikAreaChart from "./area-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { api } from "~/trpc/react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { TrendingUp, Users, Calendar, Clock, BarChart3 } from "lucide-react";

export default function StatistikPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30");

  // Fetch data
  const { data: users } = api.userProfiles.listRaw.useQuery();
  const { data: absensi } = api.absences.listRaw.useQuery();
  const { data: perizinan } = api.perizinan.listRaw.useQuery();

  // Calculate statistics
  const stats = useMemo(() => {
    if (!users || !absensi || !perizinan) return null;

    const totalSiswa = users.length;
    const totalAbsensi = absensi.length;
    const totalPerizinan = perizinan.length;

    // Today's data
    const today = new Date().toISOString().split('T')[0];
    const hadirHariIni = absensi.filter(a => a.date === today && a.status === 'Hadir').length;
    const izinHariIni = perizinan.filter(p => {
      const tanggal = typeof p.tanggal === 'string' ? p.tanggal : p.tanggal.toISOString().split('T')[0];
      return tanggal === today;
    }).length;

    // This month's data
    const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const absenBulanIni = absensi.filter(a => a.date.startsWith(thisMonth)).length;
    const izinBulanIni = perizinan.filter(p => {
      const tanggal = typeof p.tanggal === 'string' ? p.tanggal : p.tanggal.toISOString().split('T')[0];
      return tanggal?.startsWith(thisMonth) ?? false;
    }).length;

    // Attendance percentage
    const attendanceRate = totalSiswa > 0 ? ((hadirHariIni / totalSiswa) * 100).toFixed(1) : '0';

    // Top attenders (most frequent in absensi)
    const attendanceCount = new Map<string, number>();
    absensi.forEach(a => {
      if (a.status === 'Hadir') {
        attendanceCount.set(a.userId, (attendanceCount.get(a.userId) ?? 0) + 1);
      }
    });

    const topAttenders = Array.from(attendanceCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([userId, count]) => {
        const user = users.find(u => u.id === userId);
        return {
          name: user?.fullName ?? user?.email ?? 'Unknown',
          count,
          nis: user?.nis
        };
      });

    return {
      totalSiswa,
      totalAbsensi,
      totalPerizinan,
      hadirHariIni,
      izinHariIni,
      absenBulanIni,
      izinBulanIni,
      attendanceRate,
      topAttenders
    };
  }, [users, absensi, perizinan]);

  if (!stats) {
    return (
      <div className="p-2 sm:p-4 md:p-6">
        <div className="space-y-6">
          <div className="h-8 bg-muted animate-pulse rounded" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Statistik & Analisis
          </h1>
          <p className="text-muted-foreground">Dashboard analisis kehadiran dan perizinan siswa</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Pilih periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Hari Terakhir</SelectItem>
              <SelectItem value="30">30 Hari Terakhir</SelectItem>
              <SelectItem value="90">3 Bulan Terakhir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tingkat Kehadiran</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.attendanceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.hadirHariIni} dari {stats.totalSiswa} siswa hari ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absensi Bulan Ini</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.absenBulanIni}</div>
            <p className="text-xs text-muted-foreground">
              Total kehadiran bulan ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Perizinan Bulan Ini</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.izinBulanIni}</div>
            <p className="text-xs text-muted-foreground">
              {stats.izinHariIni} izin hari ini
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Data</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAbsensi + stats.totalPerizinan}</div>
            <p className="text-xs text-muted-foreground">
              Absensi & perizinan terdaftar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        <StatistikPieChart />
        <Card>
          <CardHeader>
            <CardTitle>Siswa Teraktif</CardTitle>
            <CardDescription>5 siswa dengan kehadiran tertinggi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.topAttenders.length > 0 ? (
              stats.topAttenders.map((student, index) => (
                <div key={student.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{student.name}</p>
                      {student.nis && (
                        <p className="text-xs text-muted-foreground">NIS: {student.nis}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {student.count} hari
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                Belum ada data kehadiran
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Area Chart - Full Width */}
      <StatistikAreaChart />

      {/* Quick Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insight Cepat</CardTitle>
          <CardDescription>Analisis dan rekomendasi berdasarkan data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/10">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <h4 className="font-semibold text-green-800 dark:text-green-400">Kehadiran Baik</h4>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300">
                Tingkat kehadiran {stats.attendanceRate}% menunjukkan partisipasi siswa yang baik.
              </p>
            </div>

            <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/10">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-800 dark:text-blue-400">Tren Bulanan</h4>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {stats.absenBulanIni} kehadiran tercatat bulan ini dengan {stats.izinBulanIni} perizinan.
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Aktif: {stats.totalSiswa} siswa</Badge>
            <Badge variant="outline">Data: {stats.totalAbsensi + stats.totalPerizinan} record</Badge>
            <Badge variant="outline">Periode: {selectedPeriod} hari</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
