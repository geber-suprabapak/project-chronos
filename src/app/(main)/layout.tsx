import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "~/components/ui/sidebar";
import { CurrentPageTitle } from "~/components/current-page-title";

// Layout untuk semua halaman dalam grup (dash)
// - Mengecek autentikasi sekali di sini (server component)
// - Menyediakan Sidebar di setiap halaman anak
// Taruh halaman baru di dalam (dash)/* tanpa perlu ulangi wrapper sidebar.
export default async function DashLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Persist default open state for collapsible sidebar via cookie (shadcn pattern)
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
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
