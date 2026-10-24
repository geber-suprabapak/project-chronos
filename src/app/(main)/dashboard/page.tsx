import { api } from "~/trpc/server";
import { TRPCError } from "@trpc/server";
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
import { DashboardActionCard } from "~/components/dashboard-action-card";
import { StatistikPieChart } from "~/components/pie-chart";
import { DashboardDataError } from "~/components/dashboard-data-error";
import {
  dashboardDataUiState,
  type DashboardDataUiState,
} from "~/server/api/routers/dashboard-data-outcome";
import { formatDateOnly } from "~/lib/date-utils";

/**
 * Helper: Format date to readable Indonesian format
 */
function formatDate(dateString: string | Date | null | undefined): string {
  return formatDateOnly(dateString, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface PendingPermissionsTableProps {
  permissions: Array<{
    id: string;
    kategoriIzin: string;
    tanggal: string | Date;
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
    <Card className="flex h-full flex-col min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>Perizinan Tertunda</CardTitle>
        <CardDescription>
          Daftar perizinan yang menunggu persetujuan
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-w-0 px-3 sm:px-6">
        <div className="w-full overflow-x-auto min-w-0">
          <Table className="w-full min-w-0">
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
        </div>
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
  // Pending perizinan for today, read through the Leave collection boundary.
  // A failing Astra-backed read is classified and rendered as the
  // application-owned error/retry state (C09) instead of escaping as an
  // uncaught rejection or being presented as an empty table.
  const todayStr = new Date().toISOString().split("T")[0]!; // YYYY-MM-DD (UTC)
  let failureState: DashboardDataUiState | null = null;
  let perizinanToday: Awaited<ReturnType<typeof api.perizinan.list>> | null =
    null;
  try {
    perizinanToday = await api.perizinan.list({
      approvalStatus: "pending",
      tanggal: todayStr,
      limit: 100,
      offset: 0,
    });
  } catch (cause) {
    // The server-side tRPC caller rethrows the router's TRPCError; its code
    // is the classified seam code the UI-state mapper consumes.
    failureState = dashboardDataUiState(
      cause instanceof TRPCError ? cause.code : undefined,
    );
  }

  if (perizinanToday === null) {
    return (
      <div className="flex flex-col gap-6 min-w-0 w-full">
        <div className="grid grid-cols-1 gap-4 min-w-0 xl:grid-cols-2">
          <div className="flex flex-col min-w-0 w-full">
            <StatistikPieChart />
          </div>
          <div className="min-w-0 w-full xl:flex-1">
            <DashboardDataError state={failureState ?? "dependency"} />
          </div>
        </div>
      </div>
    );
  }

  // Pending permissions only for today
  const pendingPermissions = perizinanToday.rows.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 min-w-0 w-full">
      {/* Top Section: Statistics & Actions */}
      <div className="grid grid-cols-1 gap-4 min-w-0 xl:grid-cols-2">
        {/* Left Column: Statistik Kehadiran (Red Box) */}
        <div className="flex flex-col min-w-0 w-full">
          <StatistikPieChart />
        </div>

        {/* Right Column: Actions & Pending Permissions */}
        <div className="flex flex-col gap-4 min-w-0 w-full xl:h-full">
          {/* Top Right: Actions (Blue Box) */}
          <div className="min-w-0 w-full xl:flex-1">
            <DashboardActionCard />
          </div>

          {/* Bottom Right: Pending Permissions (Yellow Box) */}
          <div className="min-w-0 w-full xl:flex-1">
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
    <div className="p-4 md:p-6 lg:p-8 min-w-0 w-full">
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
