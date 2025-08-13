import { HydrateClient, api } from "~/trpc/server";
import { createSupabaseServerClient } from "~/lib/supabase/server";

export default async function Home() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ambil semua data absensi (raw)
  const allAbsences = await api.absences.listRaw();
  // Ambil semua data perizinan (raw)
  const allPerizinan = await api.perizinan.listRaw();

  return (
    <HydrateClient>
      <div className="flex flex-1 flex-col gap-6 p-6">
        <section className="space-y-6">
          <div>
            <h2 className="mb-2 font-medium">User</h2>
            <pre className="max-h-80 overflow-auto rounded bg-gray-100 p-3 text-xs text-black">
              {JSON.stringify(user, null, 2)}
            </pre>
          </div>
          <div>
            <h2 className="mb-2 font-medium">Raw Data Absences (Semua)</h2>
            <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-3 text-xs text-black">
              {JSON.stringify(allAbsences, null, 2)}
            </pre>
          </div>
          <div>
            <h2 className="mb-2 font-medium">Raw Data Perizinan (Semua)</h2>
            <pre className="max-h-96 overflow-auto rounded bg-gray-100 p-3 text-xs text-black">
              {JSON.stringify(allPerizinan, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    </HydrateClient>
  );
}
