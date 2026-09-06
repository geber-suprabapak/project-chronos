import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("Authoritative Monthly Backup Banner and Exports", () => {
  test.describe("Admin Role - Monthly Backup Banner Lifecycle", () => {
    test.beforeEach(async ({ page, request }) => {
      const astraPort = process.env.MOCK_ASTRA_PORT || "23500";
      try {
        await request.delete(`http://127.0.0.1:${astraPort}/v1/admin/backups`);
      } catch {
        // ignore if unreachable
      }
      await loginAs(page, "platform_admin");
    });

    test("activates banner via forced test query, renders Excel & PDF actions, and lacks fake Selesai", async ({
      page,
    }) => {
      await page.goto("/dashboard?showBackupBanner=true&month=2026-09");

      const banner = page.locator(
        'div[role="alert"]:has-text("Backup Bulanan")',
      );
      await expect(banner).toBeVisible();
      await expect(banner.getByText("Backup Bulanan (2026-09)")).toBeVisible();
      await expect(banner.getByRole("button", { name: "Excel" })).toBeVisible();
      await expect(banner.getByRole("button", { name: "PDF" })).toBeVisible();

      // Ensure fake client-side "Selesai" button is completely removed
      const selesaiButton = banner.getByRole("button", { name: /Selesai/i });
      await expect(selesaiButton).not.toBeVisible();
    });

    test("audited Excel download generates artifact, persists to Astra, refetches status and auto-dismisses banner", async ({
      page,
    }) => {
      await page.goto("/dashboard?showBackupBanner=true&month=2026-09");

      const banner = page.locator(
        'div[role="alert"]:has-text("Backup Bulanan")',
      );
      await expect(banner).toBeVisible();

      // Listen for download event
      const downloadPromise = page.waitForEvent("download");
      await banner.getByRole("button", { name: "Excel" }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe("backup-absensi-2026-09.xlsx");

      // Auto-refetch after success verifies Astra persistence and hides banner
      await expect(banner).not.toBeVisible({ timeout: 15000 });
    });

    test("audited PDF download generates artifact, persists to Astra, refetches status and auto-dismisses banner", async ({
      page,
    }) => {
      // Use another month to verify uncompleted status initially
      await page.goto("/dashboard?showBackupBanner=true&month=2026-10");

      const banner = page.locator(
        'div[role="alert"]:has-text("Backup Bulanan")',
      );
      await expect(banner).toBeVisible();

      const downloadPromise = page.waitForEvent("download");
      await banner.getByRole("button", { name: "PDF" }).click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe("backup-absensi-2026-10.pdf");

      // Auto-dismisses upon refetching completed status from Astra
      await expect(banner).not.toBeVisible({ timeout: 15000 });
    });

    test("Astra outage renders unavailable Indonesian notice with retry and recovers to pending on retry", async ({
      page,
    }) => {
      // 1. Intercept status route to simulate backend outage / 502 Bad Gateway
      let simulateOutage = true;
      await page.route("**/api/export/backup/status*", async (route) => {
        if (simulateOutage) {
          await route.fulfill({
            status: 502,
            contentType: "application/json",
            body: JSON.stringify({
              error: "Layanan Astra backup status mengalami gangguan",
              details: "Astra 503 Service Unavailable",
            }),
          });
        } else {
          await route.continue();
        }
      });

      // Navigate to dashboard with forced backup banner
      await page.goto("/dashboard?showBackupBanner=true&month=2026-11");

      // 2. Assert unavailable state: outage alert is rendered, download actions are disabled/not visible
      const outageAlert = page.locator(
        'div[role="alert"]:has-text("Status Tidak Dapat Diverifikasi")',
      );
      await expect(outageAlert).toBeVisible({ timeout: 10000 });
      await expect(
        outageAlert.getByText(
          "Status pencadangan absensi periode 2026-11 tidak dapat diverifikasi karena layanan Astra mengalami gangguan.",
        ),
      ).toBeVisible();
      await expect(
        outageAlert.getByText("Unduhan dinonaktifkan sementara"),
      ).toBeVisible();

      // Retry button is available
      const retryBtn = outageAlert.getByRole("button", { name: "Coba Lagi" });
      await expect(retryBtn).toBeVisible();

      // Excel and PDF buttons are not rendered in unavailable state
      await expect(
        page.getByRole("button", { name: "Excel" }),
      ).not.toBeVisible();
      await expect(page.getByRole("button", { name: "PDF" })).not.toBeVisible();

      // 3. Astra recovers: stop simulating outage and click "Coba Lagi"
      simulateOutage = false;
      await retryBtn.click();

      // 4. Assert recovered state: transitions from unavailable -> pending
      const pendingBanner = page.locator(
        'div[role="alert"]:has-text("Backup Bulanan (2026-11)")',
      );
      await expect(pendingBanner).toBeVisible({ timeout: 10000 });
      await expect(
        pendingBanner.getByRole("button", { name: "Excel" }),
      ).toBeVisible();
      await expect(
        pendingBanner.getByRole("button", { name: "PDF" }),
      ).toBeVisible();
      await expect(
        pendingBanner.getByRole("button", { name: "Excel" }),
      ).toBeEnabled();
      await expect(
        pendingBanner.getByRole("button", { name: "PDF" }),
      ).toBeEnabled();

      // Outage alert is gone
      await expect(outageAlert).not.toBeVisible();
    });
  });

  test.describe("Non-Admin Role - Access Control", () => {
    test("teacher role cannot see the monthly backup banner", async ({
      page,
    }) => {
      await loginAs(page, "teacher");
      await page.goto("/dashboard?showBackupBanner=true");

      const banner = page.locator(
        'div[role="alert"]:has-text("Backup Bulanan")',
      );
      await expect(banner).not.toBeVisible();
    });
  });

  test.describe("Absences Page - Server PDF Export & Table Independence", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, "platform_admin");
    });

    test("absensi page offers server-side PDF and Excel downloads and has no hidden table", async ({
      page,
    }) => {
      await page.goto("/absensi");
      await expect(
        page.getByRole("heading", { name: "Daftar Absensi" }),
      ).toBeVisible();

      // Verify buttons exist
      const excelBtn = page.getByRole("button", { name: "Unduh Excel" });
      const pdfBtn = page.getByRole("button", { name: "Unduh PDF" });
      await expect(excelBtn).toBeVisible();
      await expect(pdfBtn).toBeVisible();

      // Verify hidden #absensi-table is completely gone from DOM
      const hiddenTable = page.locator("#absensi-table");
      await expect(hiddenTable).toHaveCount(0);

      // Verify PDF download triggers from server route
      const downloadPromise = page.waitForEvent("download");
      await pdfBtn.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^absensi.*\.pdf$/);
    });
  });
});
