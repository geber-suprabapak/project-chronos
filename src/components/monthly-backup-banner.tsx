"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Archive,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  type AppRole,
  canPerformMonthlyBackup,
  resolveLogtoRole,
} from "~/server/auth/rbac";

export type BackupStatusState =
  "idle" | "checking" | "pending" | "completed" | "unavailable";

export interface MonthlyBackupBannerProps {
  role?: AppRole | null;
  isAdmin?: boolean;
}

interface AsiaJakartaDateValues {
  yearMonth: string;
  day: number;
}

/**
 * Computes calendar date values in the Asia/Jakarta (WIB) timezone.
 */
function getAsiaJakartaDate(referenceDate = new Date()): AsiaJakartaDateValues {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);

  const yearStr = parts.find((p) => p.type === "year")?.value ?? "2026";
  const monthStr = parts.find((p) => p.type === "month")?.value ?? "09";
  const dayStr = parts.find((p) => p.type === "day")?.value ?? "01";

  return {
    yearMonth: `${yearStr}-${monthStr}`,
    day: parseInt(dayStr, 10),
  };
}

/**
 * Authoritative Monthly Backup Banner:
 * - Activates starting day 25 Asia/Jakarta or forced test query parameter `?showBackupBanner=true`
 * - Displays only for administrators (via canPerformMonthlyBackup)
 * - Models explicit status states: checking, pending, completed, unavailable
 * - Outage renders clear Indonesian cannot-verify status with Retry; never treated as completed
 * - Offers audited Excel and PDF downloads when status is verified pending
 * - Remembers dismissal for this month in the current browser tab only
 * - Automatically refetches status and dismisses upon confirmed persistence
 * - Avoids persistent localStorage, DOM lookups, console reset hooks, and fake "Selesai" dismissal
 */
export function MonthlyBackupBanner({
  role,
  isAdmin: directIsAdmin,
}: MonthlyBackupBannerProps = {}) {
  const [canBackup, setCanBackup] = useState<boolean>(
    directIsAdmin ?? canPerformMonthlyBackup(role),
  );
  const [statusState, setStatusState] = useState<BackupStatusState>("idle");
  const [isDismissed, setIsDismissed] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<
    "xlsx" | "pdf" | null
  >(null);

  // 1. Role verification: admin only
  useEffect(() => {
    if (directIsAdmin !== undefined || role !== undefined) return;
    let active = true;

    void fetch("/api/logto/user", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        // SAFETY: /api/logto/user returns the documented Logto context envelope.
        const context = (await response.json()) as {
          claims?: { roles?: string[] } | null;
          userInfo?: { roles?: string[] } | null;
        };
        const resolvedRole = resolveLogtoRole(
          context.claims?.roles ?? context.userInfo?.roles ?? [],
        );
        return canPerformMonthlyBackup(resolvedRole);
      })
      .then((allowed) => {
        if (active && allowed !== null) {
          setCanBackup(allowed);
        }
      })
      .catch(() => {
        if (active) setCanBackup(false);
      });

    return () => {
      active = false;
    };
  }, [directIsAdmin, role]);

  // 2. Asia/Jakarta date calculation
  const jakartaDate = useMemo(() => getAsiaJakartaDate(), []);

  // Check URL parameters for forced test activation or custom test month
  const { forceShow, targetMonth } = useMemo(() => {
    if (!globalThis.window) {
      return { forceShow: false, targetMonth: jakartaDate.yearMonth };
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const forced =
        params.has("showBackupBanner") &&
        params.get("showBackupBanner") !== "false";
      const customMonth = params.get("month");
      const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
      const validCustomMonth =
        customMonth && monthPattern.test(customMonth)
          ? customMonth
          : jakartaDate.yearMonth;

      return { forceShow: forced, targetMonth: validCustomMonth };
    } catch {
      return { forceShow: false, targetMonth: jakartaDate.yearMonth };
    }
  }, [jakartaDate]);

  const dismissalStorageKey = `monthly-backup-dismissed:${targetMonth}`;

  useEffect(() => {
    try {
      setIsDismissed(
        window.sessionStorage.getItem(dismissalStorageKey) === "true",
      );
    } catch {
      setIsDismissed(false);
    }
  }, [dismissalStorageKey]);

  const dismissNotice = useCallback(() => {
    setIsDismissed(true);
    try {
      window.sessionStorage.setItem(dismissalStorageKey, "true");
    } catch {
      // Dismissal still applies to the mounted component if storage is unavailable.
    }
  }, [dismissalStorageKey]);

  // Day 25 Asia/Jakarta rule
  const isDay25OrLater = jakartaDate.day >= 25;
  const isEligibleToActivate = forceShow || isDay25OrLater;

  // 3. Status checking from Astra-backed endpoint
  const checkBackupStatus = useCallback(async () => {
    if (!canBackup || !isEligibleToActivate) {
      setStatusState("idle");
      return;
    }

    setStatusState("checking");

    try {
      const res = await fetch(
        `/api/export/backup/status?month=${encodeURIComponent(targetMonth)}`,
        { cache: "no-store" },
      );

      if (!res.ok) {
        // Outage or server error: never treat as completed or silently disappear
        setStatusState("unavailable");
        return;
      }

      // SAFETY: Backup status response conforms to AstraBackupStatusResponse contract.
      const data = (await res.json()) as {
        completed?: boolean;
        record?: unknown;
      };

      if (data.completed === true && data.record != null) {
        setStatusState("completed");
      } else if (data.completed === false && data.record === null) {
        setStatusState("pending");
      } else {
        // Data contract anomaly: surface as unavailable rather than faking completion
        setStatusState("unavailable");
      }
    } catch (err) {
      console.error("Failed to query monthly backup status:", err);
      // Fail closed: render unavailable with retry
      setStatusState("unavailable");
    }
  }, [canBackup, isEligibleToActivate, targetMonth]);

  useEffect(() => {
    void checkBackupStatus();
  }, [checkBackupStatus]);

  // 4. Download handler for authoritative Excel and PDF backups
  const handleDownloadBackup = useCallback(
    async (format: "xlsx" | "pdf") => {
      setDownloadingFormat(format);
      try {
        const response = await fetch(
          `/api/export/backup?month=${encodeURIComponent(targetMonth)}&format=${format}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        if (!response.ok) {
          // SAFETY: Error response body optionally contains an error message string.
          const errData = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            errData?.error ||
              `Gagal melakukan backup: status ${response.status}`,
          );
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = `backup-absensi-${targetMonth}.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(downloadUrl);

        toast.success(
          `Backup bulanan (${format.toUpperCase()}) periode ${targetMonth} berhasil diunduh dan diaudit.`,
        );

        // Refetch persisted status to verify completion on Astra
        await checkBackupStatus();
      } catch (err) {
        console.error("Monthly backup error:", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses backup bulanan.",
        );
      } finally {
        setDownloadingFormat(null);
      }
    },
    [checkBackupStatus, targetMonth],
  );

  // Do not render if not eligible, not admin, or already completed
  if (
    !canBackup ||
    isDismissed ||
    statusState === "idle" ||
    statusState === "completed"
  ) {
    return null;
  }

  // Render outage / unavailable status with Retry action
  if (statusState === "unavailable") {
    return (
      <Card
        className="fixed bottom-4 right-4 sm:top-4 sm:bottom-auto w-[calc(100vw-2rem)] sm:w-96 z-50 border-rose-200/90 bg-rose-50/95 text-rose-950 shadow-md backdrop-blur-sm dark:border-rose-800/80 dark:bg-rose-950/90 dark:text-rose-100 transition-all duration-200"
        role="alert"
        aria-live="polite"
        aria-label="Pemberitahuan Gangguan Status Backup Bulanan"
      >
        <CardContent className="p-3.5">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="rounded-md bg-rose-200/60 dark:bg-rose-900/60 p-1.5 text-rose-800 dark:text-rose-200 shrink-0 mt-0.5">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm leading-tight text-rose-950 dark:text-rose-100">
                  Backup Bulanan: Status Tidak Dapat Diverifikasi
                </h3>
                <p className="text-xs text-rose-800/90 dark:text-rose-300/90 mt-0.5 leading-normal">
                  Status pencadangan absensi periode {targetMonth} tidak dapat
                  diverifikasi karena layanan Astra mengalami gangguan.
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-rose-800 hover:bg-rose-200/70 hover:text-rose-950 dark:text-rose-200 dark:hover:bg-rose-900 dark:hover:text-rose-100"
                onClick={dismissNotice}
                aria-label="Tutup pemberitahuan backup bulanan"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-rose-200/60 dark:border-rose-800/60">
              <p className="text-[11px] text-rose-700 dark:text-rose-400 italic">
                Unduhan dinonaktifkan sementara
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 text-xs font-medium border-rose-300 dark:border-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900 text-rose-950 dark:text-rose-100"
                onClick={() => void checkBackupStatus()}
                aria-label="Coba lagi verifikasi status backup"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Coba Lagi
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render pending or checking status
  const isChecking = statusState === "checking";

  return (
    <Card
      className="fixed bottom-4 right-4 sm:top-4 sm:bottom-auto w-[calc(100vw-2rem)] sm:w-96 z-50 border-amber-200/90 bg-amber-50/95 text-amber-950 shadow-md backdrop-blur-sm dark:border-amber-800/80 dark:bg-amber-950/90 dark:text-amber-100 transition-all duration-200"
      role="alert"
      aria-live="polite"
      aria-label="Pemberitahuan Backup Bulanan"
    >
      <CardContent className="p-3.5">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start gap-2.5">
            <div className="rounded-md bg-amber-200/60 dark:bg-amber-900/60 p-1.5 text-amber-800 dark:text-amber-200 shrink-0 mt-0.5">
              <Archive className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-tight text-amber-950 dark:text-amber-100">
                Backup Bulanan ({targetMonth})
              </h3>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-normal">
                {isChecking
                  ? "Memeriksa status pencadangan absensi..."
                  : "Pencadangan data absensi periode bulan ini wajib dilakukan ke arsip resmi."}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-amber-800 hover:bg-amber-200/70 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-900 dark:hover:text-amber-100"
              onClick={dismissNotice}
              aria-label="Tutup pemberitahuan backup bulanan"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/60">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs font-medium border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900"
              onClick={() => handleDownloadBackup("xlsx")}
              disabled={isChecking || downloadingFormat !== null}
              aria-label="Unduh backup format Excel"
            >
              {downloadingFormat === "xlsx" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Excel
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                  Excel
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant="default"
              className="h-8 px-3 text-xs font-medium bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-700 dark:hover:bg-amber-800 shadow-sm"
              onClick={() => handleDownloadBackup("pdf")}
              disabled={isChecking || downloadingFormat !== null}
              aria-label="Unduh backup format PDF"
            >
              {downloadingFormat === "pdf" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  PDF
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
