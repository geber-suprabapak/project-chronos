"use client";

import { type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import {
  type AppRole,
  canAccessConfiguration,
  canAccessDashboard,
  canAccessProfiles,
  isAdminRole,
} from "~/server/auth/rbac";

export type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  adminOnly?: boolean;
  items?: {
    title: string;
    url: string;
  }[];
};

export function NavMain({
  items,
  role,
  isAdmin: directIsAdmin,
}: {
  items: NavItem[];
  role?: AppRole | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = directIsAdmin ?? (role ? isAdminRole(role) : false);
  const isAuthorized = directIsAdmin || canAccessDashboard(role);
  const visibleItems = isAuthorized
    ? items.filter((item) => {
        if (item.url.startsWith("/konfigurasi")) {
          return directIsAdmin ?? canAccessConfiguration(role);
        }
        if (item.url.startsWith("/profiles")) {
          return directIsAdmin ?? canAccessProfiles(role);
        }
        if (item.adminOnly) {
          return isAdmin;
        }
        return true;
      })
    : [];

  const isSubItemActive = (url: string, siblingUrls: string[] = []) => {
    if (!url) return false;
    if (pathname === url) return true;
    const hasMoreSpecificSibling = siblingUrls.some(
      (sibling) =>
        sibling !== url &&
        (pathname === sibling || pathname.startsWith(sibling + "/")),
    );
    if (hasMoreSpecificSibling) return false;
    return pathname.startsWith(url + "/");
  };

  const isItemActive = (item: (typeof items)[number]) => {
    if (item.isActive) return true; // allow manual override
    if (item.items && item.items.length > 0) {
      const siblingUrls = item.items.map((s) => s.url);
      return item.items.some((sub) => isSubItemActive(sub.url, siblingUrls));
    }
    return isSubItemActive(item.url);
  };

  return (
    <SidebarGroup>
      <SidebarMenu>
        {visibleItems.map((item) => {
          const active = isItemActive(item);
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title} asChild isActive={active}>
                <Link href={item.url} className="flex items-center gap-2">
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
              {item.items && item.items.length > 0 && (
                <SidebarMenuSub>
                  {item.items.map((subItem) => {
                    const siblingUrls = item.items!.map((s) => s.url);
                    const subActive = isSubItemActive(subItem.url, siblingUrls);
                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild isActive={subActive}>
                          <Link href={subItem.url}>
                            <span>{subItem.title}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
