"use client";

import {
  ChevronsUpDown,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Check,
} from "lucide-react";
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
import * as React from "react";
import { useTheme } from "next-themes";

type ChronosUser = {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; avatar_url?: string };
};

interface NavUserProps {
  user: ChronosUser | null;
  loading?: boolean;
}

export function NavUser({ user, loading }: NavUserProps) {
  const { isMobile } = useSidebar();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  function handleLogout() {
    setSigningOut(true);
    window.location.href = "/api/logto/sign-out";
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

  const fullName = user.user_metadata?.full_name;
  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName = fullName ?? user.email ?? "";

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
