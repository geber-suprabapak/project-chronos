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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Badge } from "~/components/ui/badge";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem
} from "~/components/ui/select";
import { Users, UserCheck, User } from "lucide-react";

export default async function SiswaPage({
	searchParams
}: {
	searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
	// Process searchParams safely - await the promise in Next.js 15
	const resolvedSearchParams = await searchParams;
	const params = {
		nama: typeof resolvedSearchParams?.nama === 'string' ? resolvedSearchParams.nama : '',
		kelas: typeof resolvedSearchParams?.kelas === 'string' ? resolvedSearchParams.kelas : '',
		kelamin: typeof resolvedSearchParams?.kelamin === 'string' ? resolvedSearchParams.kelamin : '',
		activated: typeof resolvedSearchParams?.activated === 'string' ? resolvedSearchParams.activated : '',
		page: typeof resolvedSearchParams?.page === 'string' ? resolvedSearchParams.page : '',
	};

	// Parse parameters
	const nama = params?.nama ? params.nama.trim() : "";
	const kelas = params?.kelas ?? "";
	const kelamin = params?.kelamin && ['L', 'P'].includes(params.kelamin) ? params.kelamin as 'L' | 'P' : undefined;
	const activated = params?.activated === 'true' ? true : params?.activated === 'false' ? false : undefined;
	const pageParam = params?.page ? parseInt(params.page, 10) : 1;
	const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
	const limit = 50; // Maximum 50 per page as requested
	const offset = (page - 1) * limit;

	// Helper function to create query string safely
	function createQueryString(nama: string, kelas: string, kelamin?: string, activated?: boolean, pageNum?: number): string {
		const params = new URLSearchParams();
		if (nama) params.set('nama', nama);
		if (kelas && kelas !== 'ALL') params.set('kelas', kelas);
		if (kelamin) params.set('kelamin', kelamin);
		if (activated !== undefined) params.set('activated', String(activated));
		if (pageNum) params.set('page', String(pageNum));
		return params.toString();
	}

	let rows: Array<{
		nis: bigint;
		nama: string | null;
		kelas: string | null;
		absen: number | null;
		kelamin: string | null;
		activated: boolean;
	}> = [];
	let total = 0;
	let hasMore = false;
	let statistics = {
		total: 0,
		laki: 0,
		perempuan: 0,
		activated: 0,
	};
	let uniqueClasses: string[] = [];

	try {
		// Fetch data and statistics in parallel
		const [dataRes, statsRes, classesRes] = await Promise.all([
			api.biodataSiswa.list({
				limit,
				offset,
				nama: nama && nama.trim().length > 0 ? nama.trim() : undefined,
				kelas: kelas && kelas !== "ALL" && kelas.trim().length > 0 ? kelas.trim() : undefined,
				kelamin,
				activated,
			}),
			api.biodataSiswa.getStatistics(),
			api.biodataSiswa.getUniqueClasses(),
		]);

		if (dataRes) {
			rows = dataRes.data;
			total = dataRes.meta?.total ?? 0;
			hasMore = Boolean(dataRes.meta?.hasMore);
		}

		statistics = statsRes;
		uniqueClasses = classesRes.filter((kelas): kelas is string => kelas !== null);

		console.log(`Loaded ${rows.length} siswa out of ${total}`);
	} catch (error) {
		console.error("Failed to load siswa data:", error);
		return (
			<div className="p-6">
				<p className="text-red-600">Gagal memuat data siswa. Silahkan coba lagi.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 md:p-6">
			<section className="space-y-4">
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
					<h1 className="text-lg sm:text-xl font-semibold">Data Siswa</h1>
					<div className="flex gap-2 w-full sm:w-auto justify-start sm:justify-end">
						<DownloadExcelButton 
							href="/api/export/siswa" 
							filename="data-siswa.xlsx" 
							className="px-4 py-2" 
							disabled={rows.length === 0} 
						/>
						<DownloadPdfButton 
							tableId="siswa-table" 
							filename="data-siswa.pdf" 
							title="Data Siswa" 
							className="px-4 py-2" 
							disabled={rows.length === 0} 
						/>
					</div>
				</div>

				{/* Statistics Cards */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Siswa</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{statistics.total.toLocaleString()}</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Siswa Laki-laki</CardTitle>
							<User className="h-4 w-4 text-blue-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-blue-600">{statistics.laki.toLocaleString()}</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Siswa Perempuan</CardTitle>
							<User className="h-4 w-4 text-pink-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-pink-600">{statistics.perempuan.toLocaleString()}</div>
						</CardContent>
					</Card>
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Sudah Diaktifkan</CardTitle>
							<UserCheck className="h-4 w-4 text-green-600" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">{statistics.activated.toLocaleString()}</div>
						</CardContent>
					</Card>
				</div>

				{/* Filter Bar */}
				<Card className="rounded-lg border-0 shadow-sm bg-background">
					<CardContent className="pt-6">
						<form method="get" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
							<div className="flex flex-col gap-2 w-full">
								<label htmlFor="nama" className="text-sm font-medium">Cari Nama</label>
								<Input id="nama" name="nama" placeholder="Masukkan nama siswa" defaultValue={nama} />
							</div>
							<input type="hidden" name="page" value="1" />
							<div className="flex flex-col gap-2 w-full">
								<label htmlFor="kelas" className="text-sm font-medium">Kelas</label>
								<Select name="kelas" defaultValue={kelas ?? "ALL"}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Semua Kelas" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">Semua Kelas</SelectItem>
										{uniqueClasses.map((kelasName) => (
											<SelectItem key={kelasName} value={kelasName}>
												{kelasName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-2 w-full">
								<label htmlFor="kelamin" className="text-sm font-medium">Jenis Kelamin</label>
								<Select name="kelamin" defaultValue={kelamin ?? "ALL"}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Semua" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">Semua</SelectItem>
										<SelectItem value="L">Laki-laki</SelectItem>
										<SelectItem value="P">Perempuan</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex flex-col gap-2 w-full">
								<label htmlFor="activated" className="text-sm font-medium">Status Aktivasi</label>
								<Select name="activated" defaultValue={activated === undefined ? "ALL" : String(activated)}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Semua" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ALL">Semua</SelectItem>
										<SelectItem value="true">Sudah Diaktifkan</SelectItem>
										<SelectItem value="false">Belum Diaktifkan</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="flex gap-2 items-end w-full">
								<Button type="submit" variant="default" className="flex-1">Cari</Button>
								{(nama ?? kelas ?? kelamin ?? (activated !== undefined)) && (
									<Button asChild type="button" variant="outline" className="flex-1">
										<Link href="/siswa">Reset</Link>
									</Button>
								)}
							</div>
						</form>
					</CardContent>
				</Card>

				<Separator />

				{/* Top Pagination */}
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>Menampilkan {rows.length ? offset + 1 : 0}-{offset + rows.length} dari {total} data</span>
					<div className="flex gap-2">
						{page <= 1 ? (
							<Button variant="outline" size="sm" disabled>Prev</Button>
						) : (
							<Button asChild variant="outline" size="sm">
								<Link href={`/siswa?${createQueryString(nama, kelas, kelamin, activated, page - 1)}`}>Prev</Link>
							</Button>
						)}
						{!hasMore ? (
							<Button variant="outline" size="sm" disabled>Next</Button>
						) : (
							<Button asChild variant="outline" size="sm">
								<Link href={`/siswa?${createQueryString(nama, kelas, kelamin, activated, page + 1)}`}>Next</Link>
							</Button>
						)}
					</div>
				</div>

				{/* Data Table */}
				<Card className="overflow-hidden">
					<CardContent className="p-0 sm:p-6">
						<div className="overflow-x-auto max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-12rem)]">
							<Table id="siswa-table">
								<TableHeader>
									<TableRow>
										<TableHead className="w-[100px]">NIS</TableHead>
										<TableHead className="w-[200px]">Nama</TableHead>
										<TableHead className="w-[100px]">Kelas</TableHead>
										<TableHead className="w-[80px]">Absen</TableHead>
										<TableHead className="w-[120px]">Jenis Kelamin</TableHead>
										<TableHead className="w-[120px]">Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{rows.length ? (
										rows.map((siswa) => {
											const rowKey = `nis:${siswa.nis.toString()}`;
											return (
												<TableRow key={rowKey}>
													<TableCell className="font-mono text-xs">{siswa.nis.toString()}</TableCell>
													<TableCell className="font-medium">{siswa.nama ?? "-"}</TableCell>
													<TableCell>{siswa.kelas ?? "-"}</TableCell>
													<TableCell>{siswa.absen ?? "-"}</TableCell>
													<TableCell>
														{siswa.kelamin === 'L' ? (
															<Badge variant="outline" className="text-blue-600 border-blue-600">
																Laki-laki
															</Badge>
														) : siswa.kelamin === 'P' ? (
															<Badge variant="outline" className="text-pink-600 border-pink-600">
																Perempuan
															</Badge>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</TableCell>
													<TableCell>
														{siswa.activated ? (
															<Badge variant="default" className="bg-green-600 hover:bg-green-700">
																Aktif
															</Badge>
														) : (
															<Badge variant="secondary">
																Belum Aktif
															</Badge>
														)}
													</TableCell>
												</TableRow>
											);
										})
									) : (
										<TableRow>
											<TableCell colSpan={6} className="h-24 text-center">
												Tidak ada data siswa ditemukan.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>

				{/* Bottom Pagination */}
				<div className="flex items-center justify-between text-sm text-muted-foreground">
					<span>Menampilkan {rows.length ? offset + 1 : 0}-{offset + rows.length} dari {total} data</span>
					<div className="flex gap-2">
						{page <= 1 ? (
							<Button variant="outline" size="sm" disabled>Prev</Button>
						) : (
							<Button asChild variant="outline" size="sm">
								<Link href={`/siswa?${createQueryString(nama, kelas, kelamin, activated, page - 1)}`}>Prev</Link>
							</Button>
						)}
						{!hasMore ? (
							<Button variant="outline" size="sm" disabled>Next</Button>
						) : (
							<Button asChild variant="outline" size="sm">
								<Link href={`/siswa?${createQueryString(nama, kelas, kelamin, activated, page + 1)}`}>Next</Link>
							</Button>
						)}
					</div>
				</div>
			</section>
		</div>
	);
}
