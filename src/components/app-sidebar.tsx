"use client";

import * as React from "react";
import {
  Users,
  CalendarDays,
  GraduationCap,
  Settings,
  Monitor,
  Mail,
} from "lucide-react";
import { NavMain } from "~/components/nav-main";
import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "~/components/ui/sidebar";
import Image from "next/image";

// Update icons to match each link
const navItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Monitor,
  },
  {
    title: "Profiles",
    url: "/profiles",
    icon: Users,
  },
  {
    title: "Data Siswa",
    url: "/siswa",
    icon: GraduationCap,
  },
  {
    title: "Absensi",
    url: "/absensi",
    icon: CalendarDays,
    items: [
      {
        title: "Semua Absensi",
        url: "/absensi",
      },
      {
        title: "Per Kelas",
        url: "/absensi/perkelas",
      },
    ],
  },
  {
    title: "Perizinan",
    url: "/perizinan",
    icon: Mail,
  },
  {
    title: "Konfigurasi",
    url: "/konfigurasi/lokasi",
    icon: Settings,
    items: [
      {
        title: "Lokasi",
        url: "/konfigurasi/lokasi",
      },
      {
        title: "Jadwal",
        url: "/konfigurasi/jadwal",
      },
    ],
  },
];

type ChronosUser = {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = React.useState<ChronosUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    void fetch("/api/logto/user")
      .then(async (response) => {
        if (!response.ok) return null;
        // SAFETY: /api/logto/user returns the documented Logto context envelope.
        const context = (await response.json()) as {
          isAuthenticated?: boolean;
          claims?: { sub?: string; email?: string; name?: string } | null;
          userInfo?: { email?: string; name?: string } | null;
        };
        if (!context.isAuthenticated || !context.claims?.sub) return null;
        return {
          id: context.claims.sub,
          email: context.claims.email ?? context.userInfo?.email,
          user_metadata: {
            full_name: context.claims.name ?? context.userInfo?.name,
          },
        } satisfies ChronosUser;
      })
      .then((nextUser) => {
        if (active) setUser(nextUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex min-w-0 items-center gap-2 px-2 py-1 overflow-hidden">
          <Image
            src="/logo.png"
            alt="Skanida Apps"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="font-semibold tracking-tight flex-1 min-w-0 truncate group-data-[collapsible=icon]:hidden">
            Skanida Apps
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} loading={loading} />
      </SidebarFooter>
      {/* Sidebar rail for quick toggle and compact hit area */}
      <SidebarRail />
    </Sidebar>
  );
}
