import { api } from "~/trpc/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { DashboardActionCard } from "~/components/dashboard-action-card";
import { StatistikPieChart } from "~/components/pie-chart";

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

function PendingPermissionsTable({
  permissions,
}: PendingPermissionsTableProps) {
  if (permissions.length === 0) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>Perizinan Tertunda</CardTitle>
          <CardDescription>
            Daftar perizinan yang menunggu persetujuan
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 items-center">
          <p className="text-sm text-muted-foreground text-center py-8">
            Tidak ada perizinan yang menunggu persetujuan
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Perizinan Tertunda</CardTitle>
        <CardDescription>
          Daftar perizinan yang menunggu persetujuan
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
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
                  <Badge
                    variant={
                      permission.kategoriIzin === "sakit"
                        ? "destructive"
                        : "default"
                    }
                  >
                    {permission.kategoriIzin}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(permission.tanggal)}</TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/perizinan/show/${permission.id}`}>
                      Detail
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {permissions.length === 5 && (
          <div className="mt-4 text-center">
            <Button asChild variant="info">
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
  const [perizinanToday, currentSchedule] = await Promise.all([
    api.perizinan.list({
      approvalStatus: "pending",
      tanggal: todayStr,
      limit: 100,
      offset: 0,
    }),
    api.jadwal.getCurrentDay(),
  ]);

  // Pending permissions only for today
  const pendingPermissions = perizinanToday.slice(0, 5);

  // Get current day name
  const dayOfWeek = new Date().getDay();
  const hariMap = [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ];
  const currentDayName = hariMap[dayOfWeek];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Section: Statistics & Actions */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Left Column: Statistik Kehadiran (Red Box) */}
        <div className="flex flex-col">
          <StatistikPieChart />
        </div>

        {/* Right Column: Actions & Pending Permissions */}
        <div className="flex flex-col gap-4 lg:h-full">
          {/* Top Right: Actions (Blue Box) */}
          <div className="lg:flex-1">
            <DashboardActionCard />
          </div>

          {/* Bottom Right: Pending Permissions (Yellow Box) */}
          <div className="lg:flex-1">
            <PendingPermissionsTable permissions={pendingPermissions} />
          </div>
        </div>
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
