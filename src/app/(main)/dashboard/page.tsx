import { api } from "~/trpc/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Search,
  Bell,
  User,
  Download,
  Users,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { AverageAttendanceChart } from "~/components/average-attendance-chart";

/**
 * Helper: Format date to readable Indonesian format
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Helper: Format time to HH:MM
 */
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Statistics Card Component
 */
interface StatCardProps {
  label: string;
  value: string;
  total: number;
  href: string;
}

function StatCard({ label, value, total, href }: StatCardProps) {
  return (
    <Link href={href} className="block transition-transform hover:scale-[1.02]">
      <Card className="bg-white hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-gray-100 p-3">
              <Users className="h-6 w-6 text-gray-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {value}/{total} STUDENTS {label}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Last Present Section
 */
interface LastPresentProps {
  students: Array<{
    id: string;
    fullName: string | null;
    createdAt: Date;
  }>;
}

function LastPresentSection({ students }: LastPresentProps) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase">
          Last Present
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {students.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">No recent attendance</p>
          </div>
        ) : (
          students.map((student) => (
            <div
              key={student.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {student.fullName ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatTime(student.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Permission Section
 */
interface PermissionSectionProps {
  permissions: Array<{
    id: string;
    kategoriIzin: string;
    tanggal: Date;
    userProfile: {
      fullName: string | null;
    } | null;
  }>;
}

function PermissionSection({ permissions }: PermissionSectionProps) {
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase">
          Permission
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {permissions.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">No permissions today</p>
          </div>
        ) : (
          permissions.map((permission) => (
            <div
              key={permission.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {permission.userProfile?.fullName ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {permission.kategoriIzin}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Main Dashboard Content Component
 */
async function DashboardContent() {
  const todayStr = new Date().toISOString().split("T")[0]!;

  // Fetch data
  const [stats, recentAbsences, perizinanToday, attendanceStats] = await Promise.all([
    api.biodataSiswa.getStatistics(),
    // Get recent absences for "Last Present" section
    api.absences.list({
      date: todayStr,
      limit: 100,
      offset: 0,
      sort: "desc",
    }),
    // Get permissions for today
    api.perizinan.list({
      tanggal: todayStr,
      limit: 5,
      offset: 0,
    }),
    // Get daily stats
    api.absences.getAttendanceStats({ days: 1 }),
  ]);

  const todayStats = attendanceStats[0] ?? {
    hadir: 0,
    terlambat: 0,
    izin: 0,
    tidakHadir: 0,
  };

  // Calculate statistics
  const totalStudents = stats.total;
  const presentCount = todayStats.hadir;
  const lateCount = todayStats.terlambat;
  const permissionCount = todayStats.izin;
  const absentCount = totalStudents - presentCount - permissionCount;

  // Get last present students
  const lastPresentStudents = recentAbsences
    .filter((a) => a.status === "Hadir" || a.status === "Datang" || a.status === "Terlambat")
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      fullName: a.userProfile?.fullName ?? null,
      createdAt: a.createdAt,
    }));

  const currentDate = new Date();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-10 bg-white"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(currentDate)}</span>
          </div>
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-gray-900">
          Dashboard
        </Link>
        <span>&gt;</span>
        <span className="text-gray-900 font-medium">Analytics</span>
      </div>

      {/* Page Title and Export Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Analytics</h1>
        </div>
        <Button className="gap-2">
          <Calendar className="h-4 w-4" />
          {formatDate(currentDate)}
          <Download className="h-4 w-4" />
          Export Recap
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ARE PRESENT"
          value={presentCount.toString()}
          total={totalStudents}
          href="/dashboard/detail/present"
        />
        <StatCard
          label="ARE LATE"
          value={lateCount.toString()}
          total={totalStudents}
          href="/dashboard/detail/late"
        />
        <StatCard
          label="ARE ABSENT"
          value={absentCount.toString()}
          total={totalStudents}
          href="/dashboard/detail/absent"
        />
        <StatCard
          label="ARE PERMITTED"
          value={permissionCount.toString()}
          total={totalStudents}
          href="/dashboard/detail/permitted"
        />
      </div>

      {/* Last Present and Permission Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LastPresentSection students={lastPresentStudents} />
        <PermissionSection permissions={perizinanToday} />
      </div>

      {/* Average Attendance Chart */}
      <AverageAttendanceChart />
    </div>
  );
}

/**
 * Main Dashboard Page Export
 */
export default async function DashboardPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <DashboardContent />
    </div>
  );
}
