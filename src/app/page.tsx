import { HydrateClient, api } from "~/trpc/server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { LogoutButton } from "~/components/logout-button";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Ambil semua data absensi (raw)
  const allAbsences = await api.absences.listRaw();
  // Ambil semua data perizinan (raw)
  const allPerizinan = await api.perizinan.listRaw();

  return (
    <HydrateClient>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <h1 className="font-semibold text-lg">Dashboard</h1>
          <LogoutButton />
        </div>
        <section className="space-y-6">
          <div>
            <h2 className="font-medium mb-2">Session</h2>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-80">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
          <div>
            <h2 className="font-medium mb-2">Raw Data Absences (Semua)</h2>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(allAbsences, null, 2)}
            </pre>
          </div>
          <div>
            <h2 className="font-medium mb-2">Raw Data Perizinan (Semua)</h2>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96">
              {JSON.stringify(allPerizinan, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </HydrateClient>
  );
}
