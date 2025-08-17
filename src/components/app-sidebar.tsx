"use client";

import * as React from "react";
import { SquareTerminal } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { NavMain } from "~/components/nav-main";
import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
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
    title: "Perizinan",
    url: "/perizinan",
    icon: SquareTerminal,
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
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <SquareTerminal className="size-5" />
          <span className="font-semibold tracking-tight">Chronos</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} loading={loading} />
      </SidebarFooter>
    </Sidebar>
  );
}
