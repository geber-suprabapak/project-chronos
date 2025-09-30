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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { DownloadPdfButton } from "~/components/download-pdf-button";
import { DownloadExcelButton } from "~/components/download-excel-button";
import {
	Select,
	SelectTrigger,
	SelectValue,
	SelectContent,
	SelectItem
} from "~/components/ui/select";
import {
	Users,
	Search,
	Filter,
	Eye,
	Calendar,
	ChevronLeft,
	ChevronRight,
	GraduationCap,
	Mail,
	Hash,
	UserCheck,
	BarChart3,
	TrendingUp,
	BookOpen,
	Star
} from "lucide-react";
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
			rows = Array.isArray(res.data) ? res.data.map(r => ({ ...r, email: r.email ?? '' })) : [];
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

	// Calculate enhanced statistics
	const stats = {
		total,
		byClass: {
			PPLG: rows.filter(r => r.className === 'PPLG').length,
			AKL: rows.filter(r => r.className === 'AKL').length,
			MPLB: rows.filter(r => r.className === 'MPLB').length,
			PM: rows.filter(r => r.className === 'PM').length,
		},
		withNIS: rows.filter(r => r.nis).length,
		withEmail: rows.filter(r => r.email).length,
		activeStudents: rows.filter(r => r.role === 'student').length,
	};

	const classDistribution = [
		{ name: 'PPLG', count: stats.byClass.PPLG, color: 'bg-blue-500', percentage: total > 0 ? Math.round((stats.byClass.PPLG / total) * 100) : 0 },
		{ name: 'AKL', count: stats.byClass.AKL, color: 'bg-green-500', percentage: total > 0 ? Math.round((stats.byClass.AKL / total) * 100) : 0 },
		{ name: 'MPLB', count: stats.byClass.MPLB, color: 'bg-purple-500', percentage: total > 0 ? Math.round((stats.byClass.MPLB / total) * 100) : 0 },
		{ name: 'PM', count: stats.byClass.PM, color: 'bg-orange-500', percentage: total > 0 ? Math.round((stats.byClass.PM / total) * 100) : 0 },
	];

	return (
		<div className="flex flex-1 flex-col gap-6 p-2 sm:p-4 md:p-6">
			{/* Enhanced Header */}
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
						<Users className="h-8 w-8" />
						Profil Siswa
					</h1>
					<p className="text-muted-foreground">
						Kelola dan pantau data profil siswa dengan analisis mendalam
					</p>
				</div>
				<div className="flex items-center gap-2">
					<DownloadExcelButton
						href="/api/export/profiles"
						filename="profiles.xlsx"
						disabled={rows.length === 0}
					/>
					<DownloadPdfButton
						tableId="profiles-table"
						filename="profiles.pdf"
						title="Data Siswa"
						disabled={rows.length === 0}
					/>
				</div>
			</div>

			{/* Enhanced Statistics Dashboard */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-blue-800 dark:text-blue-200">Total Siswa</p>
								<p className="text-2xl font-bold text-blue-600">{total}</p>
								<p className="text-xs text-blue-600/80 mt-1">Terdaftar aktif</p>
							</div>
							<Users className="h-8 w-8 text-blue-600" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200 dark:border-green-800">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-green-800 dark:text-green-200">Data Lengkap</p>
								<p className="text-2xl font-bold text-green-600">{stats.withNIS}</p>
								<p className="text-xs text-green-600/80 mt-1">
									{total > 0 ? Math.round((stats.withNIS / total) * 100) : 0}% memiliki NIS
								</p>
							</div>
							<Hash className="h-8 w-8 text-green-600" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-purple-800 dark:text-purple-200">Kontak Email</p>
								<p className="text-2xl font-bold text-purple-600">{stats.withEmail}</p>
								<p className="text-xs text-purple-600/80 mt-1">
									{total > 0 ? Math.round((stats.withEmail / total) * 100) : 0}% terverifikasi
								</p>
							</div>
							<Mail className="h-8 w-8 text-purple-600" />
						</div>
					</CardContent>
				</Card>

				<Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200 dark:border-orange-800">
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm font-medium text-orange-800 dark:text-orange-200">Siswa Aktif</p>
								<p className="text-2xl font-bold text-orange-600">{stats.activeStudents}</p>
								<p className="text-xs text-orange-600/80 mt-1">Status student</p>
							</div>
							<UserCheck className="h-8 w-8 text-orange-600" />
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Class Distribution Analytics */}
			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<BarChart3 className="h-5 w-5" />
							Distribusi Jurusan
						</CardTitle>
						<CardDescription>Sebaran siswa berdasarkan program keahlian</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{classDistribution.map((item) => (
							<div key={item.name} className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<div className="flex items-center gap-2">
										<div className={`w-3 h-3 rounded-full ${item.color}`} />
										<span className="font-medium">{item.name}</span>
									</div>
									<div className="flex items-center gap-2">
										<span className="text-muted-foreground">{item.count} siswa</span>
										<Badge variant="secondary">{item.percentage}%</Badge>
									</div>
								</div>
								<div className="w-full bg-muted rounded-full h-2">
									<div
										className={`${item.color} h-2 rounded-full transition-all duration-300`}
										style={{ width: `${item.percentage}%` }}
									/>
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<TrendingUp className="h-5 w-5" />
							Insight Data
						</CardTitle>
						<CardDescription>Analisis kualitas dan kelengkapan data</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3">
							<div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
								<div className="flex items-center gap-2">
									<GraduationCap className="h-4 w-4 text-green-600" />
									<span className="text-sm font-medium text-green-800 dark:text-green-200">Kelengkapan NIS</span>
								</div>
								<Badge className="bg-green-100 text-green-800 hover:bg-green-100">
									{total > 0 ? Math.round((stats.withNIS / total) * 100) : 0}%
								</Badge>
							</div>

							<div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
								<div className="flex items-center gap-2">
									<Mail className="h-4 w-4 text-purple-600" />
									<span className="text-sm font-medium text-purple-800 dark:text-purple-200">Verifikasi Email</span>
								</div>
								<Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">
									{total > 0 ? Math.round((stats.withEmail / total) * 100) : 0}%
								</Badge>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
			{/* Enhanced Search and Filter */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Search className="h-5 w-5" />
						Pencarian & Filter
					</CardTitle>
					<CardDescription>Temukan siswa dengan mudah menggunakan nama atau jurusan</CardDescription>
				</CardHeader>
				<CardContent>
					<form method="get" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
						<div className="flex flex-col gap-2 w-full">
							<label htmlFor="name" className="text-sm font-medium flex items-center gap-2">
								<Search className="h-4 w-4" />
								Cari Nama
							</label>
							<Input
								id="name"
								name="name"
								placeholder="Masukkan nama siswa..."
								defaultValue={name}
								className="transition-all duration-200 focus:ring-2 focus:ring-blue-500/20"
							/>
						</div>
						<input type="hidden" name="page" value="1" />
						<div className="flex flex-col gap-2 w-full sm:col-span-1">
							<label htmlFor="className" className="text-sm font-medium flex items-center gap-2">
								<Filter className="h-4 w-4" />
								Program Keahlian
							</label>
							<Select name="className" defaultValue={className ?? "ALL"}>
								<SelectTrigger className="w-full transition-all duration-200 focus:ring-2 focus:ring-blue-500/20">
									<SelectValue placeholder="Semua Jurusan" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="ALL">🎓 Semua Jurusan</SelectItem>
									<SelectItem value="PPLG">💻 PPLG (Pengembangan Perangkat Lunak)</SelectItem>
									<SelectItem value="AKL">📊 AKL (Akuntansi & Keuangan)</SelectItem>
									<SelectItem value="MPLB">🏪 MPLB (Manajemen Perkantoran)</SelectItem>
									<SelectItem value="PM">🛠️ PM (Pemasaran)</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="flex gap-2 items-end w-full sm:col-span-2 md:col-span-1">
							<Button type="submit" variant="default" className="flex-1 sm:flex-none">
								<Search className="h-4 w-4 mr-2" />
								Cari
							</Button>
							{(name || className) && (
								<Button asChild type="button" variant="outline" className="flex-1 sm:flex-none">
									<Link href="/profiles">
										Reset
									</Link>
								</Button>
							)}
						</div>
					</form>
				</CardContent>
			</Card>
			{/* Results Summary */}
			<div className="flex items-center justify-between text-sm">
				<div className="flex items-center gap-4">
					<Badge variant="outline" className="px-3 py-1">
						<BookOpen className="h-3 w-3 mr-1" />
						{rows.length ? offset + 1 : 0}-{offset + rows.length} dari {total} siswa
					</Badge>
					{(name || className) && (
						<Badge variant="secondary" className="px-3 py-1">
							<Filter className="h-3 w-3 mr-1" />
							Filter aktif
						</Badge>
					)}
				</div>
				<div className="flex gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								{page <= 1 ? (
									<Button variant="outline" size="sm" disabled>
										<ChevronLeft className="h-4 w-4" />
									</Button>
								) : (
									<Button asChild variant="outline" size="sm">
										<Link href={`/profiles?${createQueryString(name, className, page - 1)}`}>
											<ChevronLeft className="h-4 w-4" />
										</Link>
									</Button>
								)}
							</TooltipTrigger>
							<TooltipContent>Halaman sebelumnya</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<span className="px-3 py-2 text-sm font-medium">
						{page}
					</span>

					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								{!hasMore ? (
									<Button variant="outline" size="sm" disabled>
										<ChevronRight className="h-4 w-4" />
									</Button>
								) : (
									<Button asChild variant="outline" size="sm">
										<Link href={`/profiles?${createQueryString(name, className, page + 1)}`}>
											<ChevronRight className="h-4 w-4" />
										</Link>
									</Button>
								)}
							</TooltipTrigger>
							<TooltipContent>Halaman selanjutnya</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			</div>

			{/* Enhanced Data Table */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Users className="h-5 w-5" />
						Data Siswa
						{rows.length > 0 && (
							<Badge variant="secondary" className="ml-auto">
								{rows.length} entries
							</Badge>
						)}
					</CardTitle>
					<CardDescription>
						Daftar lengkap profil siswa dengan informasi detail dan aksi cepat
					</CardDescription>
				</CardHeader>
				<CardContent className="p-0">
					<div className="overflow-x-auto">
						<Table id="profiles-table">
							<TableHeader>
								<TableRow className="bg-muted/50">
									<TableHead className="w-[80px] font-semibold">Foto</TableHead>
									<TableHead className="w-[200px] font-semibold">Nama Lengkap</TableHead>
									<TableHead className="font-semibold">Kontak</TableHead>
									<TableHead className="font-semibold">NIS</TableHead>
									<TableHead className="font-semibold">Program</TableHead>
									<TableHead className="font-semibold">No. Absen</TableHead>
									<TableHead className="font-semibold">Status</TableHead>
									<TableHead className="font-semibold">Terakhir Update</TableHead>
									<TableHead className="w-[120px] text-center font-semibold">Aksi</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{rows.length ? (
									rows.map((r, idx) => {
										// Stable key: prefer id; otherwise use a fallback including NIS/email and index
										const rowKey = r?.id ? `id:${String(r.id)}` : `f:${r.nis ?? r.email ?? 'unknown'}:${idx}`;
										const initials = r.fullName
											? r.fullName.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase()
											: r.email?.charAt(0).toUpperCase() ?? '?';

										return (
											<TableRow key={rowKey} className="hover:bg-muted/50 transition-colors">
												<TableCell>
													<Avatar className="h-10 w-10">
														<AvatarImage src="" />
														<AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-600 text-white font-semibold">
															{initials}
														</AvatarFallback>
													</Avatar>
												</TableCell>
												<TableCell>
													<div className="space-y-1">
														<p className="font-medium text-sm leading-none">
															{r.fullName ?? "-"}
														</p>
														{r?.id && (
															<p className="text-xs text-muted-foreground font-mono">
																ID: {String(r.id)}
															</p>
														)}
													</div>
												</TableCell>
												<TableCell>
													<div className="space-y-1">
														{r.email ? (
															<div className="flex items-center gap-1">
																<Mail className="h-3 w-3 text-muted-foreground" />
																<span className="text-xs">{r.email}</span>
															</div>
														) : (
															<span className="text-xs text-muted-foreground">Email tidak tersedia</span>
														)}
													</div>
												</TableCell>
												<TableCell>
													{r.nis ? (
														<Badge variant="outline" className="font-mono text-xs">
															{r.nis}
														</Badge>
													) : (
														<span className="text-xs text-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell>
													{r.className ? (
														<Badge
															variant="secondary"
															className={`text-xs ${r.className === 'PPLG' ? 'bg-blue-100 text-blue-800' :
																	r.className === 'AKL' ? 'bg-green-100 text-green-800' :
																		r.className === 'MPLB' ? 'bg-purple-100 text-purple-800' :
																			r.className === 'PM' ? 'bg-orange-100 text-orange-800' :
																				'bg-gray-100 text-gray-800'
																}`}
														>
															<GraduationCap className="h-3 w-3 mr-1" />
															{r.className}
														</Badge>
													) : (
														<span className="text-xs text-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell>
													{r.absenceNumber ? (
														<Badge variant="outline" className="font-mono text-xs">
															#{r.absenceNumber}
														</Badge>
													) : (
														<span className="text-xs text-muted-foreground">-</span>
													)}
												</TableCell>
												<TableCell>
													<Badge
														variant={r.role === 'student' ? 'default' : 'secondary'}
														className="text-xs"
													>
														<Star className="h-3 w-3 mr-1" />
														{r.role ?? 'N/A'}
													</Badge>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-1 text-xs text-muted-foreground">
														<Calendar className="h-3 w-3" />
														{r.updatedAt ? new Date(r.updatedAt as string).toLocaleDateString('id-ID') : "-"}
													</div>
												</TableCell>
												<TableCell className="text-center">
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																{r?.id ? (
																	<Button asChild variant="outline" size="sm">
																		<Link href={`/profiles/show/${String(r.id)}`}>
																			<Eye className="h-4 w-4" />
																		</Link>
																	</Button>
																) : (
																	<Button variant="outline" size="sm" disabled>
																		<Eye className="h-4 w-4" />
																	</Button>
																)}
															</TooltipTrigger>
															<TooltipContent>Lihat Detail Profil</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</TableCell>
											</TableRow>
										);
									})
								) : (
									<TableRow>
										<TableCell colSpan={9} className="h-32 text-center">
											<div className="flex flex-col items-center gap-2 text-muted-foreground">
												<Users className="h-8 w-8" />
												<p>Tidak ada data yang ditemukan</p>
												<p className="text-xs">Coba ubah kriteria pencarian atau filter</p>
											</div>
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
