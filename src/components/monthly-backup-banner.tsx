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
    } catch { }

    if (forceShow) {
      setVisible(true);
    } else if (day <= 27) {
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
    } catch { }
  }, [day, storageKey]);

  const markDone = useCallback(() => {
    try { localStorage.setItem(storageKey, "done"); } catch { }
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
      className="fixed top-4 right-4 w-100 z-50 border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-800 shadow-lg"
      role="alert"
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-sm text-orange-900 dark:text-orange-100">
              Backup Bulanan
            </h3>
            <p className="text-xs text-orange-700 dark:text-orange-300">
              Backup data absensi sekarang
            </p>
          </div>
          <div>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 px-2 text-xs text-orange-600 dark:text-orange-400"
              onClick={markDone}
            >
              Selesai
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
