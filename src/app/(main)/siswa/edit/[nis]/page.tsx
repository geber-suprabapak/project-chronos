import { api } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EditSiswaForm } from "~/components/siswa/edit-siswa-form";

export default async function EditSiswaPage({ params }: { params?: Promise<Record<string, string>> }) {
    const resolvedParams = params ? await params : undefined;
    const nis = resolvedParams?.nis;

    if (!nis) {
        return (
            <div className="p-6">
                <p className="text-red-600">Invalid NIS.</p>
            </div>
        );
    }

    // Convert string NIS to BigInt
    let nisNumber: bigint;
    try {
        nisNumber = BigInt(nis);
    } catch {
        return (
            <div className="p-6">
                <p className="text-red-600">NIS harus berupa angka yang valid.</p>
            </div>
        );
    }

    let data: Awaited<ReturnType<typeof api.biodataSiswa.getByNis>> | null = null;
    try {
        data = await api.biodataSiswa.getByNis({ nis: nisNumber });
        if (!data) {
            return (
                <div className="p-6">
                    <p className="text-red-600">Data siswa tidak ditemukan.</p>
                </div>
            );
        }
    } catch {
        return (
            <div className="p-6">
                <p className="text-red-600">Gagal memuat data siswa.</p>
            </div>
        );
    }

    return (
        <div className="p-6">
            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>Edit Data Siswa</CardTitle>
                </CardHeader>
                <CardContent>
                    <EditSiswaForm nis={nis} initialData={data} />
                </CardContent>
            </Card>
        </div>
    );
}
