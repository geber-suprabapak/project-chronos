import Link from "next/link";
import { api } from "~/trpc/server";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";

export default async function ProfilesPage() {
	// Fetch on the server for less client JS and faster TTFB
	let rows: Array<{
		id: string | number;
		userId: string | number;
		fullName: string | null;
		email: string;
		className: string | null;
		absenceNumber: string | null;
		role: string | null;
		updatedAt?: unknown;
	}> = [];

	try {
		rows = (await api.userProfiles.list({ limit: 50, offset: 0 })) ?? [];
	} catch {
		// Let the page render an inline error instead of a full crash
		return (
			<div className="p-6">
				<p className="text-red-600">Gagal memuat data profil.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-6 p-4 md:p-8">
			<section className="space-y-4">
				<h1 className="text-xl font-semibold">User Profiles</h1>
				<Card className="overflow-hidden">
					<CardContent>
						<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[120px]">User ID</TableHead>
								<TableHead className="w-[220px]">Full Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Class</TableHead>
								<TableHead>Absence #</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Updated At</TableHead>
								<TableHead className="w-[120px] text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.length ? (
								rows.map((r) => (
									<TableRow key={String(r.id)}>
										<TableCell className="font-mono text-xs">{String(r.userId)}</TableCell>
										<TableCell className="font-medium">{r.fullName ?? "-"}</TableCell>
										<TableCell>{r.email}</TableCell>
										<TableCell>{r.className ?? "-"}</TableCell>
										<TableCell>{r.absenceNumber ?? "-"}</TableCell>
										<TableCell>{r.role ?? "-"}</TableCell>
										<TableCell>
											{r.updatedAt ? new Date(r.updatedAt as unknown as string).toLocaleString() : "-"}
										</TableCell>
										<TableCell className="text-right">
											<div className="flex justify-end gap-2">
												<Button asChild variant="secondary" size="sm">
													<Link href={`/profiles/show/${String(r.id)}`}>Detail</Link>
												</Button>
												<Button asChild variant="outline" size="sm">
													<Link href={`/profiles/edit/${String(r.id)}`}>Edit</Link>
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={8} className="h-24 text-center">
										No results.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
						</Table>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}
