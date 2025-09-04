"use client";

import * as React from "react";
import { SquareTerminal, CircleUserRound, Users, CalendarDays, FileClock } from "lucide-react";
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

// Update icons to match each link
const navItems = [
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    // Initial fetch
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        setUser(data.user ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    // Listen to auth changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="flex min-w-0 items-center gap-2 px-2 py-1 overflow-hidden">
          <img src="/logo.png" alt="Skanida Apps" className="h-8 w-8" />
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
