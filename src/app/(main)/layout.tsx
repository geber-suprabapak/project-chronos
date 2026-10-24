import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  classifyLogtoFailure,
  isDegradedLogtoOutcome,
  LOGTO_OUTCOME_MESSAGES,
} from "~/lib/logto/outcome";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  canAccessDashboard,
  canPerformMonthlyBackup,
  resolveLogtoRole,
  type AppRole,
} from "~/server/auth/rbac";
import { AppSidebar } from "~/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { CurrentPageTitle } from "~/components/current-page-title";
import { MonthlyBackupBanner } from "~/components/monthly-backup-banner";
import { AuthRetryButton } from "~/components/auth-retry-button";

// Layout untuk semua halaman dalam grup (dash)
// - Mengecek autentikasi sekali di sini (server component)
// - Menyediakan Sidebar di setiap halaman anak
// Taruh halaman baru di dalam (dash)/* tanpa perlu ulangi wrapper sidebar.
export default async function DashLayout({
  children,
}: {
  children: ReactNode;
}) {
  let userRole: AppRole | null = null;
  let identityDegraded = false;
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
    userRole = resolveLogtoRole(rawRoles);
    if (!canAccessDashboard(userRole)) {
      redirect("/login?error=forbidden_role");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
      throw err;
    }
    // C09: an identity-provider failure (non-OK, malformed, timeout/network)
    // must not collapse into the login redirect. A genuinely absent/expired
    // session keeps the existing authentication route below; a degraded
    // outcome renders the application-owned identity-degraded state in place.
    const outcome = classifyLogtoFailure(err);
    if (isDegradedLogtoOutcome(outcome)) {
      identityDegraded = true;
    } else {
      redirect("/login");
    }
  }

  // Persist default open state for collapsible sidebar via cookie (shadcn pattern)
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  if (identityDegraded) {
    return (
      <div className="flex min-h-svh items-center justify-center p-4">
        <div className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <h1 className="text-lg font-semibold">
            Layanan autentikasi tidak tersedia
          </h1>
          <p className="mt-2 text-sm text-muted-foreground" role="alert">
            {LOGTO_OUTCOME_MESSAGES.degraded}
          </p>
          <div className="mt-4">
            <AuthRetryButton target="/dashboard" />
          </div>
        </div>
      </div>
    );
  }

  // The degraded early-return above is the only normal completion of the
  // catch; on every other reached path the role was resolved and admitted.
  // Re-check with the type guard so the narrowed role flows to the shell.
  if (!canAccessDashboard(userRole)) {
    redirect("/login?error=forbidden_role");
  }

  const canBackup = canPerformMonthlyBackup(userRole);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar role={userRole} />
      <SidebarInset>
        {/* Banner backup bulanan (tgl 25) - Admin only via canPerformMonthlyBackup */}
        {canBackup && <MonthlyBackupBanner role={userRole} />}
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
