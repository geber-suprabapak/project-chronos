"use client";

import * as React from "react";
import { SquareTerminal, Users, CalendarDays, FileClock, Shield } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { NavMain } from "~/components/nav-main";
import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarRail,
} from "~/components/ui/sidebar";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import { api } from "~/trpc/react";
import Image from 'next/image';

// Base navigation items available to all users
const baseNavItems = [
  {
    title: "Debug Dash",
    url: "/dashboard",
    icon: SquareTerminal,
  },
  {
    title: "test",
    url: "/test",
    icon: SquareTerminal,
  },
  {
    title: "Profiles",
    url: "/profiles",
    icon: Users,
  },
  {
    title: "Absensi",
    url: "/absensi",
    icon: CalendarDays,
  },
  {
    title: "Perizinan",
    url: "/perizinan",
    icon: FileClock,
  }
];

// Admin-only navigation items
const adminNavItems = [
  {
    title: "Admin Management",
    url: "/admin",
    icon: Shield,
  }
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    // Initial fetch
    void (async () => {
      try {
        const response = await supabase?.auth.getUser();
        if (!active || !response) return;
        setUser(response.data.user ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    // Listen to auth changes
    const authListener = supabase?.auth.onAuthStateChange(
      (_event: any, session: any) => {
        setUser(session?.user ?? null);
      },
    );
    return () => {
      active = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, [supabase]);

  // Get user role for navigation customization
  const { data: userRole } = api.admin.getMyRole.useQuery(undefined, {
    enabled: !!user, // Only run when user is authenticated
  });

  // Build navigation items based on user role
  const navItems = React.useMemo(() => {
    const items = [...baseNavItems];
    
    // Add admin-only items for admin and superadmin users
    if (userRole?.role && ['admin', 'superadmin'].includes(userRole.role)) {
      items.push(...adminNavItems);
    }
    
    return items;
  }, [userRole?.role]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex min-w-0 items-center gap-2 px-2 py-1 overflow-hidden">
          <Image src="/logo.png" alt="Skanida Apps" width={32} height={32} className="h-8 w-8" />
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
