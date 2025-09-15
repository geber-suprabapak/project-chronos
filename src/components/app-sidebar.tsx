"use client";

import * as React from "react";
import { SquareTerminal, BarChart2 } from "lucide-react";
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
    icon: SquareTerminal,
  },
  {
    title: "Absensi",
    url: "/absensi",
    icon: SquareTerminal,
  },
  {
    title: "Perizinan",
    url: "/perizinan",
    icon: SquareTerminal,
  },
  {
    title: "Statistik Siswa",
    url: "/statistik",
    icon: BarChart2,
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
          <SquareTerminal className="size-5 shrink-0" />
          <span className="font-semibold tracking-tight flex-1 min-w-0 truncate group-data-[collapsible=icon]:hidden">
            Chronos Alpha
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
