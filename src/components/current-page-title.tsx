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

  // Example paths in this app: /dashboard, /absensi, /perizinan, /perizinan/show/[id], /profiles, /profiles/edit/[id]
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
      title = "Absensi";
      break;
    case "perizinan":
      if (second === "show") {
        title = "Perizinan — Detail";
      } else {
        title = "Perizinan";
      }
      break;
    case "profiles":
      if (second === "edit") {
        title = "Profiles — Edit";
      } else {
        title = "Profiles";
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
    <div className={["text-sm font-medium truncate", className].filter(Boolean).join(" ")}>{title}</div>
  );
}
