"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { downloadTableAsPDF } from "~/lib/pdf";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "~/components/ui/card";

// Banner muncul setiap tanggal 25 (hari apa saja) di seluruh halaman (main)
// sampai admin melakukan backup (ditandai lokal) atau menekan tombol "Tandai Selesai".
// Penyimpanan status hanya di localStorage browser (jika perlu server-side, perlu API tambahan).
export function MonthlyBackupBanner() {
  const [visible, setVisible] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const today = new Date();
  const day = today.getDate();
  const ymKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
  const storageKey = `backup_done_${ymKey}`;

  useEffect(() => {
    let forceShow = false;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has("showBackupBanner")) {
        forceShow = true;
      }
    } catch {}

    if (forceShow) {
      setVisible(true);
    } else if (day === 25) {
      try {
        const done = localStorage.getItem(storageKey) === "done";
        if (!done) setVisible(true);
      } catch {
        // ignore
      }
    }

    // Expose helper for manual reset in console: window.__resetMonthlyBackup()
    try {
      (window as any).__resetMonthlyBackup = () => {
        localStorage.removeItem(storageKey);
        setVisible(true);
        toast.info("Banner backup dimunculkan kembali.");
      };
    } catch {}
  }, [day, storageKey]);

  const markDone = useCallback(() => {
    try { localStorage.setItem(storageKey, "done"); } catch {}
    setVisible(false);
    toast.success("Backup ditandai selesai.");
  }, [storageKey]);

  const handleBackupNow = useCallback(() => {
    setIsBackingUp(true);
    try {
      const tableId = "absensi-table"; // Mengandalkan hidden table di halaman Absensi
      const table = document.getElementById(tableId);
      if (!table) {
        toast.info("Tabel absensi tidak ditemukan. Buka halaman Absensi lalu klik Backup lagi.");
        return;
      }
      const dateStamp = today.toISOString().slice(0, 10);
      downloadTableAsPDF({
        tableId,
        filename: `backup-absensi-${dateStamp}.pdf`,
        title: `Backup Data Absensi (${dateStamp})`,
      });
      toast.success("File PDF backup berhasil dibuat.");
      markDone();
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat backup PDF.");
    } finally {
      setIsBackingUp(false);
    }
  }, [markDone, today]);

  const handleBackupExcel = useCallback(async () => {
    setIsBackingUp(true);
    try {
      const dateStamp = today.toISOString().slice(0, 10);
      const href = "/api/export/absences";
      const response = await fetch(href, { method: "GET", cache: "no-store" });
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-absensi-${dateStamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("File Excel backup berhasil diunduh.");
      markDone();
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat backup Excel.");
    } finally {
      setIsBackingUp(false);
    }
  }, [markDone, today]);

  if (!visible) return null;

  return (
    <Card
      className="fixed top-4 right-4 w-[380px] md:w-[420px] z-50 border-amber-300 dark:border-amber-400 bg-amber-200 dark:bg-amber-300 text-amber-950 shadow-xl"
      role="alert"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Segera backup data siswa</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-2 text-xs leading-relaxed">
        Lakukan backup PDF data absensi hari ini (tanggal 25). Notifikasi ini akan tetap muncul sampai Anda menandai selesai.
      </CardContent>
      <CardFooter className="pt-0 flex flex-col gap-2">
        <div className="flex w-full gap-2">
          <Button size="sm" className="flex-1" onClick={handleBackupNow} disabled={isBackingUp}>
            {isBackingUp ? "Memproses..." : "Backup (PDF)"}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={handleBackupExcel} disabled={isBackingUp}>
            {isBackingUp ? "..." : "Backup (Excel)"}
          </Button>
        </div>
        <div className="flex w-full justify-end">
          <Button size="sm" variant="ghost" className="text-xs" onClick={markDone}>
            Tandai Selesai
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
