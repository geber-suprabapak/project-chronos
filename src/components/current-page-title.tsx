"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

function toTitleCase(input: string) {
  return input
    .split("-")
    .map((s) => (s ? s[0]!.toUpperCase() + s.slice(1) : s))
    .join(" ");
}

export function CurrentPageTitle({ className }: { className?: string }) {
  const pathname = usePathname();

  // Example paths in this app: /dashboard, /absensi, /perizinan, /perizinan/show/[id], /profiles, /profiles/show/[id]
  const segments = React.useMemo(
    () => pathname.split("/").filter(Boolean),
    [pathname],
  );

  let title = "";
  const top = segments[0] ?? "";
  const second = segments[1] ?? "";

  switch (top) {
    case "dashboard":
      title = "Dashboard";
      break;
    case "absensi":
      if (second === "show") {
        title = "Absensi — Detail";
      } else if (second === "perkelas") {
        title = "Absensi — Per Kelas";
      } else if (second === "rekap-bulanan") {
        title = "Absensi — Rekap Bulanan";
      } else {
        title = "Absensi";
      }
      break;
    case "perizinan":
      if (second === "show") {
        title = "Perizinan — Detail";
      } else {
        title = "Perizinan";
      }
      break;
    case "profiles":
      if (second === "show") {
        title = "Profil Pengguna — Detail";
      } else {
        title = "Profil Pengguna";
      }
      break;
    case "siswa":
      title = "Data Siswa";
      break;
    case "konfigurasi":
      if (second === "lokasi") {
        title = "Konfigurasi — Lokasi";
      } else if (second === "jadwal") {
        title = "Konfigurasi — Jadwal";
      } else {
        title = "Konfigurasi";
      }
      break;
    case "test":
      title = "Test";
      break;
    default:
      title = toTitleCase(top || "");
      break;
  }

  if (!title) title = "";

  return (
    <div
      className={["text-sm font-medium truncate min-w-0", className]
        .filter(Boolean)
        .join(" ")}
    >
      {title}
    </div>
  );
}
