import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import { AppSidebar } from "~/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { CurrentPageTitle } from "~/components/current-page-title";
import { MonthlyBackupBanner } from "~/components/monthly-backup-banner";

// Layout untuk semua halaman dalam grup (dash)
// - Mengecek autentikasi sekali di sini (server component)
// - Menyediakan Sidebar di setiap halaman anak
// Taruh halaman baru di dalam (dash)/* tanpa perlu ulangi wrapper sidebar.
export default async function DashLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    const logtoContext = await getLogtoContext(logtoConfig);

    if (!logtoContext.isAuthenticated || !logtoContext.claims) {
      redirect("/login");
    }

    const claims = extractExtendedClaims(logtoContext.claims);
    if (isPasswordChangeRequired(claims)) {
      redirect("/ganti-password");
    }

    const rawRoles = claims?.roles ?? [];
    const userRole = resolveLogtoRole(rawRoles);
    if (!userRole || !isPrivilegedRole(userRole)) {
      redirect("/login?error=forbidden_role");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/login");
  }

  // Persist default open state for collapsible sidebar via cookie (shadcn pattern)
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        {/* Banner backup bulanan (tgl 25) */}
        <MonthlyBackupBanner />
        {/* Top toolbar with trigger */}
        <div className="flex h-12 items-center gap-3 border-b px-3">
          <SidebarTrigger />
          <CurrentPageTitle className="text-base" />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
