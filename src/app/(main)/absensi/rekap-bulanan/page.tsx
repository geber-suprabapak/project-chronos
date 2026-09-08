"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return year && month ? `${year}-${month}` : "";
}

const stateLabel = {
  "✓": "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alpha",
  T: "Terlambat",
} satisfies Record<"✓" | "S" | "I" | "A" | "T", string>;

export default function MonthlyAttendanceRecapPage() {
  const [month, setMonth] = useState(currentMonth);
  const [className, setClassName] = useState("");
  const [nis, setNis] = useState("");
  const classes = api.biodataSiswa.getUniqueClasses.useQuery();
  const students = api.biodataSiswa.listRaw.useQuery();
  const recap = api.monthlyAttendance.get.useQuery(
    {
      month,
      className: className || undefined,
      nis: nis || undefined,
    },
    { enabled: /^\d{4}-(0[1-9]|1[0-2])$/.test(month) },
  );

  return (
    <main className="flex flex-1 flex-col gap-3 p-2 sm:p-3 md:p-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
          Rekap Absensi Bulanan
        </h1>
        <p className="text-sm text-muted-foreground">
          Matriks kehadiran berdasarkan jadwal sekolah dan Leave Period yang
          disetujui.
        </p>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label
            className="grid gap-1 text-sm font-medium"
            htmlFor="monthly-recap-month"
          >
            Bulan
            <input
              id="monthly-recap-month"
              aria-label="Pilih bulan rekap"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 font-normal"
            />
          </label>
          <label
            className="grid gap-1 text-sm font-medium"
            htmlFor="monthly-recap-class"
          >
            Kelas (opsional)
            <select
              id="monthly-recap-class"
              aria-label="Filter kelas rekap"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 font-normal"
            >
              <option value="">Semua kelas</option>
              {(classes.data ?? []).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-1 text-sm font-medium"
            htmlFor="monthly-recap-student"
          >
            Siswa (opsional)
            <select
              id="monthly-recap-student"
              aria-label="Filter siswa rekap"
              value={nis}
              onChange={(event) => setNis(event.target.value)}
              className="h-9 rounded-md border bg-background px-3 font-normal"
            >
              <option value="">Semua siswa</option>
              {(students.data ?? []).map((student) => (
                <option
                  key={`${student.nis}-${student.nama}`}
                  value={student.nis ?? ""}
                >
                  {student.nama ?? "Siswa"}{" "}
                  {student.nis ? `(${student.nis})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {recap.isLoading ? (
        <Card className="space-y-3 p-4" aria-label="Memuat rekap">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-40 w-full" />
        </Card>
      ) : recap.error ? (
        <Card className="p-4 text-sm text-destructive" role="alert">
          Gagal memuat rekap: {recap.error.message}
        </Card>
      ) : !recap.data || recap.data.classes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Tidak ada data enrollment atau jadwal sekolah untuk filter ini.
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {recap.data.dates.length} hari sekolah · {recap.data.totals.hadir}{" "}
            Hadir · {recap.data.totals.terlambat} Terlambat ·{" "}
            {recap.data.totals.sakit} Sakit · {recap.data.totals.izin} Izin ·{" "}
            {recap.data.totals.alpha} Alpha
          </p>
          {recap.data.warnings.length > 0 && (
            <Card
              className="border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
              role="status"
            >
              <p className="font-medium">Periksa Absence Number legacy</p>
              <ul className="list-inside list-disc">
                {recap.data.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Card>
          )}
          {recap.data.classes.map((group) => (
            <Card key={group.classId} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3 sm:px-4">
                <h2 className="font-semibold">{group.className}</h2>
                <span className="text-sm text-muted-foreground">
                  {group.rows.length} siswa · {group.totals.expectedDays} hari
                  terjadwal
                </span>
              </div>
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">
                        No
                      </TableHead>
                      <TableHead className="sticky left-10 min-w-48 bg-background">
                        Nama
                      </TableHead>
                      {recap.data.dates.map((date) => (
                        <TableHead
                          key={date.date}
                          className="min-w-16 text-center"
                          title={date.date}
                        >
                          {date.date.slice(8)}
                          <br />
                          {date.dayOfWeek.slice(0, 3)}
                        </TableHead>
                      ))}
                      <TableHead>✓</TableHead>
                      <TableHead>S</TableHead>
                      <TableHead>I</TableHead>
                      <TableHead>A</TableHead>
                      <TableHead>T</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => (
                      <TableRow
                        key={`${row.studentId ?? row.userId ?? row.nis ?? row.fullName}-${row.classId}`}
                      >
                        <TableCell
                          className="sticky left-0 bg-background font-mono"
                          title={row.warning ?? undefined}
                        >
                          {row.absenceNumber ?? "-"}
                        </TableCell>
                        <TableCell className="sticky left-10 bg-background font-medium">
                          {row.fullName}
                        </TableCell>
                        {recap.data.dates.map((date) => {
                          const state = row.cells[date.date] ?? "";
                          return (
                            <TableCell
                              key={date.date}
                              className="text-center"
                              title={
                                state ? stateLabel[state] : "Belum dievaluasi"
                              }
                            >
                              {state}
                            </TableCell>
                          );
                        })}
                        <TableCell>{row.totals.hadir}</TableCell>
                        <TableCell>{row.totals.sakit}</TableCell>
                        <TableCell>{row.totals.izin}</TableCell>
                        <TableCell>{row.totals.alpha}</TableCell>
                        <TableCell>{row.totals.terlambat}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
