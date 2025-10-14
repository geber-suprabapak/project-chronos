import { api } from "~/trpc/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { Users, UserCheck, ClipboardList, MapPin, Calendar, Clock } from "lucide-react";
import { StatistikPieChart } from "~/components/pie-chart";
import { KehadiranBarChart, IzinBarChart, KeterlambatanBarChart } from "~/components/attendance-bar-charts";

/**
 * Helper: Format date to readable Indonesian format
 */
function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Helper Component: KPI Card
 */
interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  variant?: "default" | "primary" | "success" | "warning";
}

function KPICard({ title, value, description, icon, variant = "default" }: KPICardProps) {
  const colorClasses = {
    default: "text-muted-foreground",
    primary: "text-blue-600",
    success: "text-green-600",
    warning: "text-amber-600",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={colorClasses[variant]}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

interface PendingPermissionsTableProps {
  permissions: Array<{
    id: string;
    kategoriIzin: string;
    tanggal: Date;
    userProfile: {
      fullName: string | null;
    } | null;
  }>;
}

function PendingPermissionsTable({ permissions }: PendingPermissionsTableProps) {
  if (permissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Perizinan Tertunda</CardTitle>
          <CardDescription>Daftar perizinan yang menunggu persetujuan</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Tidak ada perizinan yang menunggu persetujuan
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perizinan Tertunda</CardTitle>
        <CardDescription>Daftar perizinan yang menunggu persetujuan</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Tanggal Izin</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissions.map((permission) => (
              <TableRow key={permission.id}>
                <TableCell className="font-medium">
                  {permission.userProfile?.fullName ?? "N/A"}
                </TableCell>
                <TableCell>
                  <Badge variant={permission.kategoriIzin === "sakit" ? "destructive" : "default"}>
                    {permission.kategoriIzin}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(permission.tanggal)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/perizinan/show/${permission.id}`}>Detail</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {permissions.length === 5 && (
          <div className="mt-4 text-center">
            <Button asChild variant="link">
              <Link href="/perizinan">Lihat Semua Perizinan</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Main Dashboard Content Component
 */
async function DashboardContent() {
  // Parallel data fetching using RSC
  const todayStr = new Date().toISOString().split("T")[0]!; // YYYY-MM-DD (UTC)
  const [stats, perizinanToday, activeLocation, currentSchedule] = await Promise.all([
    api.biodataSiswa.getStatistics(),
    api.perizinan.list({ approvalStatus: "pending", tanggal: todayStr, limit: 100, offset: 0 }),
    api.location.get(),
    api.jadwal.getCurrentDay(),
  ]);

  // Pending permissions only for today
  const pendingPermissions = perizinanToday.slice(0, 5);

  const pendingCount = perizinanToday.length;

  // Get current day name
  const dayOfWeek = new Date().getDay();
  const hariMap = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const currentDayName = hariMap[dayOfWeek];


  return (
    <div className="space-y-6">
      {/* KPI Cards Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Siswa"
          value={stats.total}
          description="Seluruh data siswa di sistem"
          icon={<Users className="h-4 w-4" />}
          variant="default"
        />
        <KPICard
          title="Siswa Aktif"
          value={stats.activated}
          description={`${((stats.activated / stats.total) * 100).toFixed(1)}% dari total siswa`}
          icon={<UserCheck className="h-4 w-4" />}
          variant="success"
        />
        <KPICard
          title="Perizinan Tertunda"
          value={pendingCount}
          description="Menunggu persetujuan"
          icon={<ClipboardList className="h-4 w-4" />}
          variant="warning"
        />
        <KPICard
          title="Lokasi Aktif"
          value={activeLocation?.name ?? "Tidak Ada"}
          description={
            activeLocation
              ? `Radius ${activeLocation.distance}m`
              : "Belum dikonfigurasi"
          }
          icon={<MapPin className="h-4 w-4" />}
          variant="primary"
        />
      </div>

      <PendingPermissionsTable permissions={pendingPermissions} />

      {/* Statistics Visualization Section */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StatistikPieChart />

        {/* Current Schedule Status Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Jadwal Hari Ini
            </CardTitle>
            <CardDescription>{currentDayName}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentSchedule ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status Jadwal</span>
                  </div>
                  <Badge variant={currentSchedule.isActive ? "default" : "secondary"}>
                    {currentSchedule.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Waktu Masuk</p>
                    <p className="text-sm font-semibold">
                      {currentSchedule.mulaiMasuk} - {currentSchedule.selesaiMasuk}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Waktu Pulang</p>
                    <p className="text-sm font-semibold">
                      {currentSchedule.mulaiPulang} - {currentSchedule.selesaiPulang}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Kompensasi Waktu</span>
                    <span className="text-sm font-medium">{currentSchedule.kompensasiWaktu} menit</span>
                  </div>
                </div>

                <Button asChild variant="outline" className="w-full mb-5">
                  <Link href="/konfigurasi/jadwal">Kelola Jadwal</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  Tidak ada jadwal untuk hari ini
                </p>
                <Button asChild variant="outline">
                  <Link href="/konfigurasi/jadwal">Konfigurasi Jadwal</Link>
                </Button>
              </div>
            )}


          </CardContent>
        </Card>
      </div>

      {/* Bar Charts Section - Kehadiran, Izin, Keterlambatan */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
        <KehadiranBarChart />
        <IzinBarChart />
        <KeterlambatanBarChart />
      </div>
    </div>
  );
}

/**
 * Main Dashboard Page Export
 */
export default async function DashboardPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Admin</h1>
        <p className="text-muted-foreground">
          Ringkasan informasi dan metrik utama sistem
        </p>
      </div>
      <DashboardContent />
    </div>
  );
}
