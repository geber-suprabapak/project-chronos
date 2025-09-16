"use client";
import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "~/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { DatePicker } from "~/components/date-picker";
import * as RadixTabs from "@radix-ui/react-tabs";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

type UserProfile = {
  id: string | number;
  fullName?: string | null;
  className?: string | null;
};

// Narrowed types for absensi & perizinan rows (partial fields we actually use)
interface AbsensiRow { userId: string; }
interface PerizinanRow { userId: string; kategoriIzin: string; }

const kelasList = ["ALL", "PPLG", "AKL", "MPLB", "PM"];

function computeStatusMap(
  users: UserProfile[],
  absensi: readonly AbsensiRow[] = [],
  izin: readonly PerizinanRow[] = [],
) {
  const absensiUserIds = new Set<string | number>(absensi.map((a) => a.userId));
  const izinMap = new Map<string | number, string>();
  izin.forEach((p) => {
    if (p.kategoriIzin) izinMap.set(p.userId, p.kategoriIzin);
  });

  const sudah: UserProfile[] = [];
  const belum: UserProfile[] = [];
  const sakit: UserProfile[] = [];
  const pergi: UserProfile[] = [];

  users.forEach((u) => {
    const status = izinMap.get(u.id);
    if (status === "sakit") sakit.push(u);
    else if (status === "pergi") pergi.push(u);
    else if (absensiUserIds.has(u.id)) sudah.push(u);
    else belum.push(u);
  });

  return { sudah, belum, sakit, pergi };
}

export default function StatistikSiswaDashboard() {
  const [kelas, setKelas] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [tab, setTab] = useState<string>("sudah");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  // Helper to format to YYYY-MM-DD (local date, zero pad)
  function toYMD(d?: Date) {
    if (!d) return undefined;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const ymd = toYMD(selectedDate);

  const { data: users } = api.userProfiles.listRaw.useQuery();
  // Filter absences by date (param name: date)
  const { data: absensi } = api.absences.list.useQuery(
    ymd ? { date: ymd } : undefined,
  );
  // Filter perizinan by date (param name: tanggal)
  const { data: izin } = api.perizinan.list.useQuery(
    ymd ? { tanggal: ymd } : undefined,
  );

  // Users filtered untuk daftar (termasuk search) – ini tidak akan memengaruhi chart
  const filteredUsers = useMemo(() => {
    if (!users) return [] as UserProfile[];
    const list = users as UserProfile[];
    // Filter kelas dulu
    let byKelas: UserProfile[];
    if (kelas === "ALL") byKelas = list;
    else {
      const target = kelas.toLowerCase();
      byKelas = list.filter((u) => {
        const raw = (u.className ?? "").toLowerCase();
        if (!raw) return false;
        const c = raw.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
        if (!c) return false;
        if (c === target) return true;
        if (c.startsWith(target + " ")) return true;
        if (c.includes(" " + target + " ")) return true;
        if (c.endsWith(" " + target)) return true;
        if (c.includes(target)) return true;
        return false;
      });
    }
    // Terapkan search hanya ke daftar, bukan ke chart
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      byKelas = byKelas.filter(u => (u.fullName ?? "").toLowerCase().includes(term));
    }
    return byKelas;
  }, [users, kelas, search]);

  // Basis chart: tidak terpengaruh search, hanya kelas & tanggal (lewat absensi/izin query)
  const usersForChart = useMemo(() => {
    if (!users) return [] as UserProfile[];
    if (kelas === "ALL") return users as UserProfile[];
    const target = kelas.toLowerCase();
    return (users as UserProfile[]).filter(u => {
      const raw = (u.className ?? "").toLowerCase();
      if (!raw) return false;
      const c = raw.replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
      if (!c) return false;
      if (c === target) return true;
      if (c.startsWith(target + " ")) return true;
      if (c.includes(" " + target + " ")) return true;
      if (c.endsWith(" " + target)) return true;
      if (c.includes(target)) return true;
      return false;
    });
  }, [users, kelas]);

  const statusMapList = useMemo(
    () => computeStatusMap(
      filteredUsers,
      (absensi as AbsensiRow[] | undefined) ?? [],
      (izin as PerizinanRow[] | undefined) ?? [],
    ),
    [filteredUsers, absensi, izin],
  );

  const statusMapChart = useMemo(
    () => computeStatusMap(
      usersForChart,
      (absensi as AbsensiRow[] | undefined) ?? [],
      (izin as PerizinanRow[] | undefined) ?? [],
    ),
    [usersForChart, absensi, izin],
  );

  const chartData = useMemo(() => {
    const data = [
      { name: "Nihil", value: statusMapChart.belum.length, fill: "#a3a3a3" },
      { name: "Sudah Absen", value: statusMapChart.sudah.length, fill: "#3b82f6" },
      { name: "Sakit", value: statusMapChart.sakit.length, fill: "#ef4444" },
      { name: "Pergi", value: statusMapChart.pergi.length, fill: "#22c55e" },
    ];
    const total = data.reduce((acc, d) => acc + d.value, 0);
    if (total === 0) {
      return [{ name: "Tidak Ada Data", value: 1, fill: "#e5e7eb" }];
    }
    return data;
  }, [statusMapChart]);

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="items-start pb-2">
        <div className="flex flex-wrap items-center justify-between w-full gap-4">
          <div>
            <CardTitle className="text-lg">Rekap Kehadiran</CardTitle>
            <CardDescription className="text-sm">Per kelas & status</CardDescription>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama..."
              className="w-[200px] order-1"
            />
            <Select value={kelas} onValueChange={setKelas}>
              <SelectTrigger className="w-[160px] order-2">
                <SelectValue placeholder="Pilih Kelas" />
              </SelectTrigger>
              <SelectContent>
                {kelasList.map((k) => (
                  <SelectItem key={k} value={k}>{k === "ALL" ? "Semua Kelas" : k}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="order-3">
              <DatePicker
                placeholder=""
                locale="id-ID"
                value={selectedDate}
                onChange={setSelectedDate}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col lg:flex-row gap-8 w-full">
        {/* Left: Pie chart */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} stroke="none">
                  {chartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {chartData.length === 1 && chartData[0]?.name === "Tidak Ada Data" && (
            <p className="text-xs text-muted-foreground">Tidak ada data untuk kelas ini.</p>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <LegendBox color="#3b82f6" label="Sudah" value={statusMapChart.sudah.length} />
            <LegendBox color="#a3a3a3" label="Nihil" value={statusMapChart.belum.length} />
            <LegendBox color="#ef4444" label="Sakit" value={statusMapChart.sakit.length} />
            <LegendBox color="#22c55e" label="Pergi" value={statusMapChart.pergi.length} />
          </div>
        </div>
        {/* Right: Tabs with numeric indicators */}
        <div className="flex-1">
          <RadixTabs.Root value={tab} onValueChange={setTab} className="w-full">
            <RadixTabs.List className="grid grid-cols-4 w-full mb-2 text-sm font-medium">
              <RadixTabs.Trigger value="sudah" className="px-2 py-1 data-[state=active]:bg-primary/10 rounded">Sudah</RadixTabs.Trigger>
              <RadixTabs.Trigger value="belum" className="px-2 py-1 data-[state=active]:bg-primary/10 rounded">Nihil</RadixTabs.Trigger>
              <RadixTabs.Trigger value="sakit" className="px-2 py-1 data-[state=active]:bg-primary/10 rounded">Sakit</RadixTabs.Trigger>
              <RadixTabs.Trigger value="pergi" className="px-2 py-1 data-[state=active]:bg-primary/10 rounded">Pergi</RadixTabs.Trigger>
            </RadixTabs.List>
            <RadixTabs.Content value="sudah">
              <StatusList count={statusMapList.sudah.length} items={statusMapList.sudah} />
            </RadixTabs.Content>
            <RadixTabs.Content value="belum">
              <StatusList count={statusMapList.belum.length} items={statusMapList.belum} />
            </RadixTabs.Content>
            <RadixTabs.Content value="sakit">
              <StatusList count={statusMapList.sakit.length} items={statusMapList.sakit} />
            </RadixTabs.Content>
            <RadixTabs.Content value="pergi">
              <StatusList count={statusMapList.pergi.length} items={statusMapList.pergi} />
            </RadixTabs.Content>
          </RadixTabs.Root>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendBox({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block w-4 h-4 rounded-sm" style={{ background: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function StatusList({ count, items }: { count: number; items: UserProfile[] }) {
  if (items == null || count === 0) {
    return <div className="text-sm text-muted-foreground">Tidak ada data</div>;
  }
  // Deduplicate by stable key (id preferred, fallback to fullName)
  const seen = new Set<string>();
  const cleaned = items.filter((u) => {
    const key = (u.id?.toString?.() ?? u.fullName ?? "null").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <div>
      <div className="text-xs mb-2 text-muted-foreground">Total: {cleaned.length}</div>
      <div className="max-h-56 overflow-auto rounded border border-border/60 bg-muted/10">
        <ul className="divide-y divide-border/40 text-sm">
          {cleaned.map((u, idx) => {
            const rawKey = (u.id?.toString?.() ?? u.fullName ?? "item").trim() || "item";
            const key = rawKey === "" ? `item-${idx}` : rawKey;
            return (
              <li key={key} className="flex items-center px-3 py-1.5">
                <span className="truncate">{u.fullName ?? "Tanpa Nama"}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
