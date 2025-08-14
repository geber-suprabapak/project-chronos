import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "~/components/ui/sidebar";

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

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
