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
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem
} from "~/components/ui/select";

interface ProfilesPageProps {
	searchParams?: Record<string, string | string[] | undefined>;
}

export default async function ProfilesPage({ searchParams }: ProfilesPageProps) {
	const name = typeof searchParams?.name === "string" ? searchParams.name.trim() : "";
	const className = typeof searchParams?.className === "string" ? searchParams.className : "";
	const pageParam = typeof searchParams?.page === "string" ? parseInt(searchParams.page, 10) : 1;
	const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
	const limit = 20; // fixed page size
	const offset = (page - 1) * limit;
	// Fetch on the server for less client JS and faster TTFB
	let rows: Array<{
		id: string | number | null;
		fullName: string | null;
		email: string;
		className: string | null;
		absenceNumber: string | null;
		role: string | null;
		nis?: string | null;
		updatedAt?: unknown;
	}> = [];
	let total = 0;
	let hasMore = false;

	try {
		const res = await api.userProfiles.list({ limit, offset, name: name || undefined, className: className || undefined });
		rows = res?.data ?? [];
		total = res?.meta.total ?? 0;
		hasMore = res?.meta.hasMore ?? false;
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
				<Card className="rounded-lg border-0 shadow-sm bg-background">
					<CardContent className="pt-6">
						<form method="get" className="flex flex-col gap-4 sm:flex-row sm:items-end">
							<div className="flex flex-col gap-2 flex-1 min-w-[220px]">
								<label htmlFor="name" className="text-sm font-medium">Cari Nama</label>
								<Input id="name" name="name" placeholder="Masukkan nama" defaultValue={name} />
							</div>
							<input type="hidden" name="page" value="1" />
							<div className="flex gap-2 items-end">
									<Select name="className" defaultValue={className || "ALL"}>
										<SelectTrigger className="w-[160px]">
											<SelectValue placeholder="Semua Jurusan" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ALL">Semua Jurusan</SelectItem>
											<SelectItem value="PPLG">PPLG</SelectItem>
											<SelectItem value="AKL">AKL</SelectItem>
											<SelectItem value="MPLB">MPLB</SelectItem>
											<SelectItem value="PM">PM</SelectItem>
										</SelectContent>
									</Select>
								<Button type="submit" variant="default">Search</Button>
								{(name || className) && (
									<Button asChild type="button" variant="outline">
										<Link href="/profiles">Reset</Link>
									</Button>
								)}
							</div>
						</form>
					</CardContent>
				</Card>
				<Separator />
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>Menampilkan {rows.length ? offset + 1 : 0}-{offset + rows.length} dari {total} data</span>
					<div className="flex gap-2">
						{page <= 1 ? (
							<Button variant="outline" size="sm" disabled>Prev</Button>
						) : (
							<Button asChild variant="outline" size="sm">
								<Link href={`/profiles?${new URLSearchParams({ ...(name ? { name } : {}), page: String(page - 1) }).toString()}`}>Prev</Link>
							</Button>
						)}
						{!hasMore ? (
							<Button variant="outline" size="sm" disabled>Next</Button>
						) : (
							<Button asChild variant="outline" size="sm">
								<Link href={`/profiles?${new URLSearchParams({ ...(name ? { name } : {}), page: String(page + 1) }).toString()}`}>Next</Link>
							</Button>
						)}
					</div>
				</div>
				<Card className="overflow-hidden">
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-[120px]">ID</TableHead>
									<TableHead className="w-[220px]">Full Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>NIS</TableHead>
									<TableHead>Class</TableHead>
									<TableHead>Absence #</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Updated At</TableHead>
									<TableHead className="w-[120px] text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length ? (
									rows.map((r, idx) => {
										// Stable key: prefer id; otherwise use a fallback including NIS/email and index
										const rowKey = r?.id ? `id:${String(r.id)}` : `f:${r.nis ?? r.email ?? 'unknown'}:${idx}`;
										return (
											<TableRow key={rowKey}>
												<TableCell className="font-mono text-xs">{r?.id ? String(r.id) : "-"}</TableCell>
												<TableCell className="font-medium">{r.fullName ?? "-"}</TableCell>
												<TableCell>{r.email}</TableCell>
												<TableCell>{r.nis ?? "-"}</TableCell>
												<TableCell>{r.className ?? "-"}</TableCell>
												<TableCell>{r.absenceNumber ?? "-"}</TableCell>
												<TableCell>{r.role ?? "-"}</TableCell>
												<TableCell>
													{r.updatedAt ? new Date(r.updatedAt as unknown as string).toLocaleString() : "-"}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex justify-end gap-2">
														{r?.id ? (
															<>
																<Button asChild variant="secondary" size="sm">
																	<Link href={`/profiles/show/${String(r.id)}`}>Detail</Link>
																</Button>
																<Button asChild variant="outline" size="sm">
																	<Link href={`/profiles/edit/${String(r.id)}`}>Edit</Link>
																</Button>
															</>
														) : (
															<>
																<Button variant="secondary" size="sm" disabled>
																	Detail
																</Button>
																<Button variant="outline" size="sm" disabled>
																	Edit
																</Button>
															</>
														)}
													</div>
												</TableCell>
											</TableRow>
										);
									})
								) : (
									<TableRow>
										<TableCell colSpan={9} className="h-24 text-center">
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
