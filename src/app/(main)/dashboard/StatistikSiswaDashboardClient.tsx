"use client";
import dynamic from "next/dynamic";
const StatistikSiswaDashboard = dynamic(() => import("./statistik-siswa"), { ssr: false });

export default function StatistikSiswaDashboardClient() {
  return <StatistikSiswaDashboard />;
}
