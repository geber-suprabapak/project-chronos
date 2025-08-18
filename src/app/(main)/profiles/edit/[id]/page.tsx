import { api } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EditProfileForm } from "~/components/profiles/edit-profile-form";

export default async function EditProfilePage({ params }: { params?: Promise<Record<string, string>> }) {
	const resolvedParams = params ? await params : undefined;
	const id = resolvedParams?.id;
	if (!id) {
		return (
			<div className="p-6">
				<p className="text-red-600">Invalid profile id.</p>
			</div>
		);
	}

	let data: Awaited<ReturnType<typeof api.userProfiles.getById>> | null = null;
	try {
		data = await api.userProfiles.getById({ id });
		if (!data) {
			return (
				<div className="p-6">
					<p className="text-red-600">Profile tidak ditemukan.</p>
				</div>
			);
		}
	} catch {
		return (
			<div className="p-6">
				<p className="text-red-600">Gagal memuat data.</p>
			</div>
		);
	}

	return (
		<div className="p-6">
			<Card className="max-w-2xl">
				<CardHeader>
					<CardTitle>Edit Profile</CardTitle>
				</CardHeader>
				<CardContent>
					<EditProfileForm id={id} initialData={data} />
				</CardContent>
			</Card>
		</div>
	);
}
