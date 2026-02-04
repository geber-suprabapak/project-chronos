"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import Link from "next/link";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { ArrowLeft } from "lucide-react";

// Helper function to extract major from class name (dynamic)
function extractMajor(className: string): string {
  // Try to extract the major code after the grade level
  // Pattern: "X PPLG 1" -> "PPLG", "XI AKL 2" -> "AKL"
  const match = className.match(/^(?:X|XI|XII)\s+([A-Z]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback: get all uppercase sequences and use the last one
  const allMatches = className.match(/[A-Z]+/g);
  if (allMatches && allMatches.length > 0) {
    return allMatches[allMatches.length - 1] || "Lainnya";
  }

  return "Lainnya";
}

// Helper function to extract grade level
function extractGrade(className: string): string {
  const match = className.match(/^(X|XI|XII)/);
  return match ? match[0] : "";
}

// Helper function to get all unique grades from classes
function getUniqueGrades(classes: string[]): string[] {
  const grades = new Set<string>();
  classes.forEach((className) => {
    const grade = extractGrade(className);
    if (grade) grades.add(grade);
  });

  // Sort grades: X, XI, XII
  const gradeOrder: Record<string, number> = { X: 1, XI: 2, XII: 3 };
  return Array.from(grades).sort((a, b) => {
    return (gradeOrder[a] || 999) - (gradeOrder[b] || 999);
  });
}

export default function PerkelasPage() {
  const [search, setSearch] = useState("");

  // Fetch available classes
  const { data: availableClasses, isLoading } =
    api.userProfiles.getUniqueClassNames.useQuery();

  // Group classes by major and grade (dynamic)
  const groupedClasses = useMemo(() => {
    if (!availableClasses) return {};

    const validClasses = availableClasses.filter((c): c is string => c !== null);
    const groups: Record<string, Record<string, string[]>> = {};

    // First pass: collect all classes by major
    validClasses.forEach((className) => {
      const major = extractMajor(className);
      const grade = extractGrade(className);

      if (!groups[major]) {
        groups[major] = {};
      }

      if (grade) {
        if (!groups[major][grade]) {
          groups[major][grade] = [];
        }
        groups[major][grade]!.push(className);
      }
    });

    // Sort classes within each grade
    Object.keys(groups).forEach((major) => {
      Object.keys(groups[major]!).forEach((grade) => {
        groups[major]![grade]!.sort((a, b) => a.localeCompare(b));
      });
    });

    return groups;
  }, [availableClasses]);

  // Get all unique majors and sort them alphabetically
  const majors = useMemo(() => {
    return Object.keys(groupedClasses).sort((a, b) => a.localeCompare(b));
  }, [groupedClasses]);

  // Filter classes by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedClasses;

    const filtered: Record<string, Record<string, string[]>> = {};
    const searchLower = search.toLowerCase();

    Object.entries(groupedClasses).forEach(([major, grades]) => {
      const filteredGrades: Record<string, string[]> = {};
      let hasMatch = false;

      Object.entries(grades).forEach(([grade, classes]) => {
        const matchingClasses = classes.filter((c) =>
          c.toLowerCase().includes(searchLower)
        );

        if (matchingClasses.length > 0) {
          filteredGrades[grade] = matchingClasses;
          hasMatch = true;
        }
      });

      if (hasMatch) {
        filtered[major] = filteredGrades;
      }
    });

    return filtered;
  }, [groupedClasses, search]);

  return (
    <div className="p-4 md:p-6 min-h-screen space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/absensi">Presensi</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Per Kelas</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/absensi">
          <Button variant="ghost" size="icon" aria-label="Kembali">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Presensi Per Kelas</h1>
          <p className="text-sm text-muted-foreground">
            Pilih kelas untuk melihat data kehadiran siswa
          </p>
        </div>
      </div>

      {/* Class Grid - Grouped by Major, Rows by Grade */}
      {isLoading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(6)].map((_, j) => (
                  <Skeleton key={j} className="h-16" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : Object.keys(filteredGroups).length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground text-sm">
            {search ? "Kelas tidak ditemukan" : "Tidak ada data kelas"}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {majors.map((major) => {
            const grades = filteredGroups[major];
            if (!grades) return null;

            // Check if this major has any classes
            const hasClasses = Object.values(grades).some(classes => classes.length > 0);
            if (!hasClasses) return null;

            // Get unique grade levels for this major
            const gradeKeys = getUniqueGrades(
              Object.entries(grades).flatMap(([_, classes]) => classes)
            );

            return (
              <div key={major} className="space-y-3">
                {/* Major Header */}
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {major}
                  </h2>
                </div>

                {/* Classes Grid - Row by Grade */}
                <div className="space-y-3">
                  {gradeKeys.map((gradeKey) => {
                    const classesInGrade = grades[gradeKey];
                    if (!classesInGrade || classesInGrade.length === 0) return null;

                    return (
                      <div key={gradeKey} className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {classesInGrade.map((className) => (
                          <Link
                            key={className}
                            href={`/absensi/perkelas/${encodeURIComponent(className)}`}
                          >
                            <Card className="hover:bg-muted hover:shadow-md transition-all cursor-pointer h-full">
                              <CardContent className="p-3 flex items-center justify-center">
                                <span className="font-semibold text-foreground text-center">
                                  {className}
                                </span>
                              </CardContent>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
