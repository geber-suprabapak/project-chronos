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
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem
} from "~/components/ui/select";
// Next.js App Router page component with search params

export default async function ProfilesPage({
	searchParams
}: {
	searchParams?: Record<string, string | string[] | undefined>
}) {
	// Process searchParams safely
	const params = {
		name: typeof searchParams?.name === 'string' ? searchParams.name : '',
		className: typeof searchParams?.className === 'string' ? searchParams.className : '',
		page: typeof searchParams?.page === 'string' ? searchParams.page : '',
	};

	// Akses searchParams dengan aman menggunakan params
	const name = params?.name ? params.name.trim() : "";
	const className = params?.className ?? "";
	const pageParam = params?.page ? parseInt(params.page, 10) : 1;
	const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
	const limit = 20; // fixed page size
	const offset = (page - 1) * limit;
	// Fetch on the server for less client JS and faster TTFB
	// Helper function to create query string safely
	function createQueryString(name: string, className: string, pageNum: number): string {
		const params = new URLSearchParams();
		if (name) params.set('name', name);
		if (className && className !== 'ALL') params.set('className', className);
		params.set('page', String(pageNum));
		return params.toString();
	}

	let rows: Array<{
		id: string | number | null;
		fullName: string | null;
		email: string | null;
		className: string | null;
		absenceNumber: string | null;
		role: string | null;
		nis?: string | null;
		updatedAt?: unknown;
	}> = [];
	let total = 0;
	let hasMore = false;

	try {
		// Pastikan parameter dikirim dengan benar dan sesuai dengan definisi input router
		const params = {
			limit,
			offset,
			name: name || undefined, // Hanya kirim jika ada nilai
			className: className && className !== "ALL" ? className : undefined // Hanya kirim jika bukan ALL dan ada nilai
		}; console.log("Loading profiles with params:", params);
		const res = await api.userProfiles.list(params);

		if (res) {
			// Pastikan data diproses dengan benar
			rows = Array.isArray(res.data) ? res.data : [];
			total = res.meta?.total ?? 0;
			hasMore = Boolean(res.meta?.hasMore);

			console.log(`Loaded ${rows.length} profiles out of ${total}`);
		} else {
			console.warn("API returned no result");
		}
	} catch (error) {
		console.error("Failed to load profiles:", error);
		return (
			<div className="p-6">
				<p className="text-red-600">Gagal memuat data profil. Silahkan coba lagi.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 md:p-6">
			<section className="space-y-4">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
					<h1 className="text-lg sm:text-xl font-semibold">User Profiles</h1>
					<div className="flex gap-2 w-full sm:w-auto justify-start sm:justify-end">
						<DownloadExcelButton href="/api/export/profiles" filename="profiles.xlsx" className="px-4 py-2" disabled={rows.length === 0} />
						<DownloadPdfButton tableId="profiles-table" filename="profiles.pdf" title="Data Siswa" className="px-4 py-2" disabled={rows.length === 0} />
					</div>
				</div>
				<Card className="rounded-lg border-0 shadow-sm bg-background">
					<CardContent className="pt-6">
						<form method="get" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
							<div className="flex flex-col gap-2 w-full">
								<label htmlFor="name" className="text-sm font-medium">Cari Nama</label>
								<Input id="name" name="name" placeholder="Masukkan nama" defaultValue={name} />
							</div>
							<input type="hidden" name="page" value="1" />
							<div className="flex flex-col gap-2 w-full sm:col-span-1">
								<label htmlFor="className" className="text-sm font-medium">Jurusan</label>
								<Select name="className" defaultValue={className ?? "ALL"}>
									<SelectTrigger className="w-full">
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
							</div>
							<div className="flex gap-2 items-end w-full sm:col-span-2 md:col-span-1">
								<Button type="submit" variant="default" className="flex-1 sm:flex-none">Search</Button>
								{(name || className) && (
									<Button asChild type="button" variant="outline" className="flex-1 sm:flex-none">
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
								<Link href={`/profiles?${createQueryString(name, className, page - 1)}`}>Prev</Link>
							</Button>
						)}
						{!hasMore ? (
							<Button variant="outline" size="sm" disabled>Next</Button>
						) : (
							<Button asChild variant="outline" size="sm">
								<Link href={`/profiles?${createQueryString(name, className, page + 1)}`}>Next</Link>
							</Button>
						)}
					</div>
				</div>
				<Card className="overflow-hidden">
					<CardContent className="p-0 sm:p-6">
						<div className="overflow-x-auto max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
							<Table id="profiles-table">
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
														<TableCell>
															{r.updatedAt ? new Date(r.updatedAt as string).toLocaleString() : "-"}
														</TableCell>
													</TableCell>
													<TableCell className="text-right">
														<div className="flex justify-end gap-2">
															{r?.id ? (
																<Button asChild variant="secondary" size="sm">
																	<Link href={`/profiles/show/${String(r.id)}`}>Detail</Link>
																</Button>
															) : (
																<Button variant="secondary" size="sm" disabled>
																	Detail
																</Button>
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
						</div>
					</CardContent>
				</Card>
			</section>
		</div>
	);
}
