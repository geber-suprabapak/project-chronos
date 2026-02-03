import { api } from "~/trpc/server";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
    Search,
    User,
    ArrowLeft,
    Calendar,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

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
function formatTime(date: Date | null): string {
    if (!date) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

interface PageProps {
    params: Promise<{
        status: string;
    }>;
}

export default async function DashboardDetailPage({ params }: PageProps) {
    const { status } = await params;

    // Validate status
    const validStatuses = ["present", "late", "absent", "permitted"];
    if (!validStatuses.includes(status)) {
        notFound();
    }

    const todayStr = new Date().toISOString().split("T")[0]!;

    // Fetch data
    const students = await api.absences.getDetailsByStatus({
        status: status as "present" | "late" | "absent" | "permitted",
        date: todayStr,
    });

    const titleMap: Record<string, string> = {
        present: "Present Students",
        late: "Late Students",
        absent: "Absent Students",
        permitted: "Permitted Students",
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <Link href="/dashboard" className="hover:text-gray-900">
                    Dashboard
                </Link>
                <span>&gt;</span>
                <Link href="/dashboard" className="hover:text-gray-900">
                    Analytics
                </Link>
                <span>&gt;</span>
                <span className="text-gray-900 font-medium capitalize">{status}</span>
            </div>

            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 capitalize">
                        {titleMap[status] ?? "Detail"}
                    </h1>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(new Date())}</span>
                </div>
            </div>

            {/* Search Bar - (Client side filtering could be added here later, for now just UI) */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    type="search"
                    placeholder="Search student..."
                    className="pl-10 bg-white"
                />
            </div>

            {/* Student List */}
            <Card className="bg-white">
                <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase">
                        Total: {students.length} Students
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                    {students.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-gray-500">No students found for this category.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {students.map((student) => (
                                <div
                                    key={student.id}
                                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                            <User className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-900">
                                                {student.name ?? "Unknown"}
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                {student.nis} • {student.className ?? "No Class"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${status === 'present' ? 'bg-green-100 text-green-800' : ''}
                            ${status === 'late' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${status === 'absent' ? 'bg-red-100 text-red-800' : ''}
                            ${status === 'permitted' ? 'bg-blue-100 text-blue-800' : ''}
                        `}>
                                            {student.status}
                                        </div>
                                        {student.timestamp && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                {formatTime(student.timestamp)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
