"use client";

import { Users, BarChart3, Calendar, Settings } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import Link from "next/link";

interface QuickAction {
    title: string;
    description: string;
    icon: React.ReactNode;
    href: string;
    variant?: "default" | "secondary" | "outline";
}

const quickActions: QuickAction[] = [
    {
        title: "Lihat Absensi",
        description: "Kelola data kehadiran",
        icon: <Users className="h-5 w-5" />,
        href: "/absensi",
        variant: "default",
    },
    {
        title: "Kelola Perizinan",
        description: "Review izin siswa",
        icon: <Calendar className="h-5 w-5" />,
        href: "/perizinan",
        variant: "secondary",
    },
    {
        title: "Lihat Statistik",
        description: "Analisis dan laporan",
        icon: <BarChart3 className="h-5 w-5" />,
        href: "/statistik",
        variant: "outline",
    },
    {
        title: "Data Profil",
        description: "Kelola profil siswa",
        icon: <Settings className="h-5 w-5" />,
        href: "/profiles",
        variant: "outline",
    },
];

export function QuickActions() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Aksi Cepat</CardTitle>
                <CardDescription>Navigasi cepat ke fitur utama</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {quickActions.map((action) => (
                        <Button
                            key={action.title}
                            asChild
                            variant={action.variant}
                            className="h-auto p-4 flex-col gap-2 text-left justify-start"
                        >
                            <Link href={action.href}>
                                <div className="flex items-center gap-2 w-full">
                                    {action.icon}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{action.title}</p>
                                        <p className="text-xs opacity-80 truncate">{action.description}</p>
                                    </div>
                                </div>
                            </Link>
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}