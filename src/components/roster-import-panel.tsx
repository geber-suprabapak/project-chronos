"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function RosterImportPanel() {
  const periods = api.rosterImport.periods.useQuery();
  const preview = api.rosterImport.preview.useMutation();
  const accept = api.rosterImport.accept.useMutation();
  const [periodId, setPeriodId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof preview.mutateAsync>
  > | null>(null);
  const [accepted, setAccepted] = useState(false);

  const canPreview = Boolean(periodId && file) && !preview.isPending;
  const report = result?.report;
  const parse = result?.parsed;
  const canAccept =
    Boolean(
      report?.id &&
      report.status === "staged" &&
      report.review_state === "pending" &&
      report.rejected_rows === 0 &&
      report.rejected_items.length === 0 &&
      parse &&
      parse.totalRows > 0 &&
      parse.errors.length === 0,
    ) &&
    !accept.isPending &&
    !accepted;

  async function previewWorkbook() {
    if (!file || !periodId) return;
    setResult(null);
    setAccepted(false);
    accept.reset();
    const bytes = new Uint8Array(await file.arrayBuffer());
    preview.mutate(
      {
        academicPeriodId: periodId,
        filename: file.name,
        workbookBase64: toBase64(bytes),
      },
      { onSuccess: setResult },
    );
  }

  function acceptWorkbook() {
    if (!report?.id) return;
    accept.mutate(
      { reportId: report.id },
      { onSuccess: () => setAccepted(true) },
    );
  }

  function resetImportState() {
    setResult(null);
    setAccepted(false);
    preview.reset();
    accept.reset();
  }

  return (
    <Card aria-label="Impor roster siswa" className="border-primary/30">
      <CardHeader>
        <CardTitle>Impor Roster Resmi</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pilih Academic Period lalu unggah workbook XLSX resmi untuk ditinjau.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="roster-academic-period"
          >
            Academic Period
            <select
              id="roster-academic-period"
              value={periodId}
              onChange={(event) => {
                setPeriodId(event.target.value);
                resetImportState();
              }}
              className="h-10 rounded-md border bg-background px-3 font-normal"
              disabled={
                periods.isPending || preview.isPending || accept.isPending
              }
            >
              <option value="">Pilih Academic Period</option>
              {periods.data?.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="grid gap-2 text-sm font-medium"
            htmlFor="roster-import-file"
          >
            Workbook XLSX
            <input
              id="roster-import-file"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                resetImportState();
              }}
              className="h-10 rounded-md border bg-background px-3 py-2 text-sm font-normal"
              disabled={preview.isPending || accept.isPending}
            />
          </label>
        </div>
        <Button type="button" onClick={previewWorkbook} disabled={!canPreview}>
          {preview.isPending ? "Memproses..." : "Tinjau Workbook"}
        </Button>

        {preview.error ? (
          <p role="alert" className="text-sm text-destructive">
            {preview.error.message}
          </p>
        ) : null}
        {accept.error ? (
          <p role="alert" className="text-sm text-destructive">
            {accept.error.message}
          </p>
        ) : null}
        {accept.data ? (
          <p role="status" className="text-sm text-emerald-700">
            Roster berhasil diterima.
          </p>
        ) : null}

        {parse ? (
          <div className="space-y-3" aria-live="polite">
            <div className="flex flex-wrap gap-2 text-sm">
              <span>{parse.sheets.length} worksheet</span>
              <span>{parse.rows.length} Student</span>
              <span>{parse.errors.length} error</span>
            </div>
            {parse.errors.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
                {parse.errors.map((error, index) => (
                  <li
                    key={`${error.worksheet}-${error.worksheetRow ?? "sheet"}-${index}`}
                  >
                    {error.worksheet}
                    {error.worksheetRow ? `:${error.worksheetRow}` : ""} —{" "}
                    {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
            {report && report.rejected_rows > 0 ? (
              <p role="alert" className="text-sm text-destructive">
                Astra menolak {report.rejected_rows} baris. Perbaiki workbook
                lalu tinjau ulang.
              </p>
            ) : null}
            {report && report.rejected_items.length > 0 ? (
              <ul
                aria-label="Error validasi Astra"
                className="list-disc space-y-1 pl-5 text-sm text-destructive"
              >
                {report.rejected_items.map((error) => {
                  const row = parse.rows[error.row_index];
                  const provenance =
                    error.provenance ??
                    (row
                      ? `${row.worksheet}:${row.worksheetRow}`
                      : `Workbook:${error.row_index + 1}`);
                  return (
                    <li key={`${error.row_index}-${error.reason}`}>
                      {provenance} — {error.reason}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="overflow-x-auto rounded-md border">
              <table
                className="w-full min-w-[680px] text-sm"
                aria-label="Preview roster"
              >
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="p-2">Worksheet</th>
                    <th className="p-2">No</th>
                    <th className="p-2">NIS</th>
                    <th className="p-2">Nama Siswa</th>
                    <th className="p-2">Kelas</th>
                    <th className="p-2">L/P</th>
                  </tr>
                </thead>
                <tbody>
                  {parse.rows.map((row) => (
                    <tr
                      key={`${row.worksheet}-${row.worksheetRow}`}
                      className="border-b last:border-0"
                    >
                      <td className="p-2">
                        {row.worksheet}:{row.worksheetRow}
                      </td>
                      <td className="p-2">{row.absenceNumber}</td>
                      <td className="p-2 font-mono">{row.nis}</td>
                      <td className="p-2">{row.fullName}</td>
                      <td className="p-2">{row.className}</td>
                      <td className="p-2">{row.gender}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              onClick={acceptWorkbook}
              disabled={!canAccept}
            >
              {accept.isPending ? "Menerima..." : "Terima Roster"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
