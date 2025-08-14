"use client";

import {
  ChevronsUpDown,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Check,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "~/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { getSupabaseBrowserClient } from "~/lib/supabase/client";
import * as React from "react";
import { useTheme } from "next-themes";

interface NavUserProps {
  user: User | null;
  loading?: boolean;
}

export function NavUser({ user, loading }: NavUserProps) {
  const { isMobile } = useSidebar();
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  async function handleLogout() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    router.replace("/login");
  }

  // Redirect ke /login jika user sudah hilang (misal setelah sign out) – dilakukan via efek client.
  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  // Skeleton / placeholder ketika masih loading
  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-sm">
        Loading user...
      </div>
    );
  }
  // Jika sudah tidak loading dan user null, jangan render apa-apa (efek di atas akan redirect)
  if (!user) return null;

  // Derive display data (can extend with user_metadata avatar, name etc.)
  const displayName = (user.user_metadata?.full_name as string) ?? user.email;
  const avatarUrl = user.user_metadata?.avatar_url as string;

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
            <DropdownMenuLabel className="text-xs font-normal">
              Signed in as
              <br />
              <span className="font-medium">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme === "system" ? "system" : (resolvedTheme ?? theme)}
              onValueChange={(val) => setTheme(val)}
            >
              <DropdownMenuRadioItem value="light">
                <Sun className="size-4" />
                <span className="flex-1">Light</span>
                {resolvedTheme === "light" && theme !== "system" && (
                  <Check className="ml-auto size-4" />
                )}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon className="size-4" />
                <span className="flex-1">Dark</span>
                {resolvedTheme === "dark" && theme !== "system" && (
                  <Check className="ml-auto size-4" />
                )}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor className="size-4" />
                <span className="flex-1">System</span>
                {theme === "system" && <Check className="ml-auto size-4" />}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
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
