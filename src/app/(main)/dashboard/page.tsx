import { HydrateClient, api } from "~/trpc/server";
import StatistikSiswaDashboardClient from "./StatistikSiswaDashboardClient";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Users, Calendar, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { QuickActions } from "~/components/quick-actions";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ambil semua data absensi (raw)
  const allAbsences = await api.absences.listRaw();
  // Ambil semua data perizinan (raw)
  const allPerizinan = await api.perizinan.listRaw();
  // Ambil data profil untuk mendapatkan total siswa
  const allProfiles = await api.userProfiles.listRaw();

  // Hitung statistik
  const totalSiswa = allProfiles.length;
  const totalAbsensi = allAbsences.length;
  const totalPerizinan = allPerizinan.length;
  const hadirHariIni = allAbsences.filter(a => {
    const today = new Date().toISOString().split('T')[0];
    return a.date === today && a.status === 'Hadir';
  }).length;

  // Absensi terbaru (5 terakhir)
  const recentAbsences = allAbsences
    .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
    .slice(0, 5);

  // Perizinan terbaru (5 terakhir)
  const recentPerizinan = allPerizinan
    .sort((a, b) => new Date(b.createdAt || b.tanggal).getTime() - new Date(a.createdAt || a.tanggal).getTime())
    .slice(0, 5);

  return (
    <HydrateClient>
      <div className="flex flex-1 flex-col gap-6 p-2 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Selamat datang kembali, {user?.email ?? "User"}! Berikut ringkasan aktivitas hari ini.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSiswa}</div>
              <p className="text-xs text-muted-foreground">Siswa terdaftar</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hadir Hari Ini</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{hadirHariIni}</div>
              <p className="text-xs text-muted-foreground">Dari {totalSiswa} siswa</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Absensi</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAbsensi}</div>
              <p className="text-xs text-muted-foreground">Data absensi</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Perizinan</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{totalPerizinan}</div>
              <p className="text-xs text-muted-foreground">Izin & sakit</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Charts Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Statistik Kehadiran
            </CardTitle>
            <CardDescription>
              Grafik dan analisis kehadiran siswa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatistikSiswaDashboardClient />
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Absences */}
          <Card>
            <CardHeader>
              <CardTitle>Absensi Terbaru</CardTitle>
              <CardDescription>5 data absensi terakhir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentAbsences.length > 0 ? (
                recentAbsences.map((absence) => {
                  // Find profile by userId (absences.userId should match user_profiles.userId)
                  const profile = allProfiles.find(p => p.userId === absence.userId);
                  return (
                    <div key={absence.id} className="flex items-center justify-between space-x-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src="" />
                          <AvatarFallback className="text-xs">
                            {(profile?.fullName ?? profile?.email ?? "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {profile?.fullName ?? profile?.email ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {absence.date}
                          </p>
                        </div>
                      </div>
                      <Badge variant={absence.status === 'Hadir' ? 'default' : 'secondary'}>
                        {absence.status ?? 'Unknown'}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada data absensi</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Perizinan */}
          <Card>
            <CardHeader>
              <CardTitle>Perizinan Terbaru</CardTitle>
              <CardDescription>5 data perizinan terakhir</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentPerizinan.length > 0 ? (
                recentPerizinan.map((izin) => {
                  // Find profile by userId (perizinan.userId should match user_profiles.userId)
                  const profile = allProfiles.find(p => p.userId === izin.userId);
                  return (
                    <div key={izin.id} className="flex items-center justify-between space-x-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src="" />
                          <AvatarFallback className="text-xs">
                            {(profile?.fullName ?? profile?.email ?? "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {profile?.fullName ?? profile?.email ?? "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {izin.tanggal.toString()} • {izin.deskripsi?.substring(0, 30)}...
                          </p>
                        </div>
                      </div>
                      <Badge variant={izin.kategoriIzin === 'sakit' ? 'destructive' : 'outline'}>
                        {izin.kategoriIzin ?? 'Unknown'}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada data perizinan</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Profile Card - Minimized */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src="" />
                <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              Profil Pengguna
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Email:</span>
                <span className="text-sm text-muted-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">User ID:</span>
                <span className="text-sm text-muted-foreground font-mono">{user?.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant="default">Aktif</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </HydrateClient>
  );
}
