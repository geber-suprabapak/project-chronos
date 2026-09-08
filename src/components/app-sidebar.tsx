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
import { NavMain, type NavItem } from "~/components/nav-main";
import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "~/components/ui/sidebar";
import Image from "next/image";
import {
  type AppRole,
  canAccessConfiguration,
  canAccessDashboard,
  canAccessProfiles,
  isAdminRole,
  resolveLogtoRole,
} from "~/server/auth/rbac";

// Update icons to match each link
const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Monitor,
  },
  {
    title: "Profil Pengguna",
    url: "/profiles",
    icon: Users,
    adminOnly: true,
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
      {
        title: "Rekap Bulanan",
        url: "/absensi/rekap-bulanan",
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
    adminOnly: true,
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

export function AppSidebar({
  role: initialRole,
  ...props
}: React.ComponentProps<typeof Sidebar> & { role?: AppRole | null }) {
  const [user, setUser] = React.useState<ChronosUser | null>(null);
  const [role, setRole] = React.useState<AppRole | null>(initialRole ?? null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    void fetch("/api/logto/user")
      .then(async (response) => {
        if (!response.ok) return null;
        // SAFETY: /api/logto/user returns the documented Logto context envelope.
        const context = (await response.json()) as {
          isAuthenticated?: boolean;
          claims?: {
            sub?: string;
            email?: string;
            name?: string;
            roles?: string[];
          } | null;
          userInfo?: { email?: string; name?: string; roles?: string[] } | null;
        };
        if (!context.isAuthenticated || !context.claims?.sub) return null;
        const resolvedRole = resolveLogtoRole(
          context.claims.roles ?? context.userInfo?.roles ?? [],
        );
        if (resolvedRole && active) {
          setRole(resolvedRole);
        }
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

  const isAdmin = role ? isAdminRole(role) : false;
  const filteredNavItems = React.useMemo(() => {
    if (!canAccessDashboard(role)) {
      return [];
    }
    return navItems.filter((item) => {
      if (item.url.startsWith("/konfigurasi")) {
        return canAccessConfiguration(role);
      }
      if (item.url.startsWith("/profiles")) {
        return canAccessProfiles(role);
      }
      if (item.adminOnly) {
        return isAdmin;
      }
      return true;
    });
  }, [isAdmin, role]);

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
        <NavMain items={filteredNavItems} role={role} isAdmin={isAdmin} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} loading={loading} />
      </SidebarFooter>
      {/* Sidebar rail for quick toggle and compact hit area */}
      <SidebarRail />
    </Sidebar>
  );
}
