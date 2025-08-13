"use client";

import {
  ChevronsUpDown,
  LogOut,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { redirect, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import * as React from "react";

interface NavUserProps {
  user: User | null;
  loading?: boolean;
}

export function NavUser({ user, loading }: NavUserProps) {
  const { isMobile } = useSidebar();
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.replace("/login");
  }

  // Skeleton / placeholder when loading or no user
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        Loading user...
      </div>
    );
  }
  if (!user) {
    redirect("/login");
  }

  // Derive display data (can extend with user_metadata avatar, name etc.)
  const displayName = (user.user_metadata?.full_name as string) ?? user.email;
  const avatarUrl = (user.user_metadata?.avatar_url as string);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="rounded-lg">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuItem onClick={handleLogout} disabled={signingOut}>
              <LogOut />
              {signingOut ? "Logging out..." : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
