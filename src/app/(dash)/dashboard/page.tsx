import { HydrateClient, api } from "~/trpc/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { LogoutButton } from "~/components/logout-button";
import { AppSidebar } from "~/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "~/components/ui/sidebar";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ambil semua data absensi (raw)
  const allAbsences = await api.absences.listRaw();
  // Ambil semua data perizinan (raw)
  const allPerizinan = await api.perizinan.listRaw();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <HydrateClient>
          <header className="flex h-16 shrink-0 items-center gap-2 px-6">
            <h1 className="text-lg font-semibold">Dashboard</h1>
            <div className="ml-auto"><LogoutButton /></div>
          </header>
          <div className="flex flex-1 flex-col gap-6 p-6 pt-0">
            <section className="space-y-6">
              <div>
                <h2 className="mb-2 font-medium">User</h2>
                <pre className="max-h-80 overflow-auto rounded bg-gray-100 p-3 text-xs">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
              <div>
                <h2 className="mb-2 font-medium">Raw Data Absences (Semua)</h2>
                <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-3 text-xs">
                  {JSON.stringify(allAbsences, null, 2)}
                </pre>
              </div>
              <div>
                <h2 className="mb-2 font-medium">Raw Data Perizinan (Semua)</h2>
                <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-3 text-xs">
                  {JSON.stringify(allPerizinan, null, 2)}
                </pre>
              </div>
            </section>
          </div>
        </HydrateClient>
      </SidebarInset>
    </SidebarProvider>
  );
}
