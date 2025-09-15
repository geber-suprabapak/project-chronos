"use client";
import Link from "next/link";
import { BarChart2 } from "lucide-react";
import { cn } from "~/lib/utils";

export function SidebarStatistikLink({ className }: { className?: string }) {
  return (
    <Link
      href="/statistik"
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded hover:bg-muted transition text-sm font-medium",
        className
      )}
    >
      <BarChart2 className="w-4 h-4" />
      Statistik Siswa
    </Link>
  );
}
