"use client";

import { api } from "~/trpc/react";
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
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useState, useMemo } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";

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

export default function DashboardDetailPage() {
    const params = useParams();
    const status = params.status as string;

    // Validate status
    const validStatuses = ["present", "late", "absent", "permitted"];
    if (!validStatuses.includes(status)) {
        notFound();
    }

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState("");

    const todayStr = new Date().toISOString().split("T")[0]!;

    // Fetch data with pagination
    const { data, isLoading } = api.absences.getDetailsByStatus.useQuery({
        status: status as "present" | "late" | "absent" | "permitted",
        date: todayStr,
        limit: rowsPerPage,
        offset: (currentPage - 1) * rowsPerPage,
    });

    // Filter students based on search query
    const filteredStudents = useMemo(() => {
        if (!data?.students) return [];
        if (!searchQuery.trim()) return data.students;

        const query = searchQuery.toLowerCase();
        return data.students.filter((student) => {
            const name = student.name?.toLowerCase() ?? "";
            const nis = student.nis?.toLowerCase() ?? "";
            const className = student.className?.toLowerCase() ?? "";
            return name.includes(query) || nis.includes(query) || className.includes(query);
        });
    }, [data?.students, searchQuery]);

    const totalPages = data ? Math.ceil(data.total / rowsPerPage) : 0;

    const titleMap: Record<string, string> = {
        present: "Present Students",
        late: "Late Students",
        absent: "Absent Students",
        permitted: "Permitted Students",
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleRowsPerPageChange = (value: string) => {
        setRowsPerPage(Number(value));
        setCurrentPage(1); // Reset to first page when changing rows per page
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 min-h-screen space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link href="/dashboard" className="hover:text-foreground">
                    Dashboard
                </Link>
                <span>&gt;</span>
                <Link href="/dashboard" className="hover:text-foreground">
                    Analytics
                </Link>
                <span>&gt;</span>
                <span className="text-foreground font-medium capitalize">{status}</span>
            </div>

            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground capitalize">
                        {titleMap[status] ?? "Detail"}
                    </h1>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(new Date())}</span>
                </div>
            </div>

            {/* Search Bar and Rows Per Page Selector */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search student..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page:</span>
                    <Select value={rowsPerPage.toString()} onValueChange={handleRowsPerPageChange}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Student List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold uppercase">
                        Total: {data?.total ?? 0} Students
                        {searchQuery && ` (Showing ${filteredStudents.length} filtered)`}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                    {isLoading ? (
                        <div className="py-12 text-center">
                            <p className="text-muted-foreground">Loading...</p>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-muted-foreground">
                                {searchQuery
                                    ? "No students found matching your search."
                                    : "No students found for this category."}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {filteredStudents.map((student) => (
                                <div
                                    key={student.id}
                                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                            <User className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-foreground">
                                                {student.name ?? "Unknown"}
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                {student.nis} • {student.className ?? "No Class"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                            ${status === 'present' ? 'bg-success/15 text-success' : ''}
                            ${status === 'late' ? 'bg-warning/15 text-warning-foreground' : ''}
                            ${status === 'absent' ? 'bg-destructive/15 text-destructive' : ''}
                            ${status === 'permitted' ? 'bg-primary/15 text-primary' : ''}
                        `}>
                                            {student.status}
                                        </div>
                                        {student.timestamp && (
                                            <p className="text-xs text-muted-foreground mt-1">
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

            {/* Pagination Controls */}
            {!isLoading && data && data.total > 0 && !searchQuery && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                        {Math.min(currentPage * rowsPerPage, data.total)} of {data.total} students
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum: number;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <Button
                                        key={pageNum}
                                        variant={currentPage === pageNum ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => handlePageChange(pageNum)}
                                        className="w-10"
                                    >
                                        {pageNum}
                                    </Button>
                                );
                            })}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
