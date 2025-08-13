import { HydrateClient, api } from "~/trpc/server";

export default async function Home() {
  // Ambil semua data absensi (raw)
  const allAbsences = await api.absences.listRaw();
  // Ambil semua data perizinan (raw)
  const allPerizinan = await api.perizinan.listRaw();

  return (
    <HydrateClient>
      <div className="p-6 space-y-4">
        <section className="space-y-6">
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
