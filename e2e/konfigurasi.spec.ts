import { test, expect, loginAs } from "./fixtures/auth.ts";

const MOCK_ASTRA_PORT = process.env.MOCK_ASTRA_PORT || "23500";
const MOCK_ASTRA_BASE = `http://127.0.0.1:${MOCK_ASTRA_PORT}`;

// C07 fail-then-recover fixtures: control the local mock Astra's configuration
// location boundary (/v1/admin/locations collection GET reads). mode is "off"
// or an HTTP status string ("403" | "500" | "503" | "504"); failNext is how
// many subsequent location reads fail before the fixture recovers. empty=true
// models a genuine first-use/no-config collection.
async function setLocationsFailure(mode: string, failNext = 5) {
  const response = await fetch(`${MOCK_ASTRA_BASE}/__control/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, failNext }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set locations failure mode: ${response.status}`);
  }
}

async function setLocationsEmpty(empty: boolean) {
  const response = await fetch(`${MOCK_ASTRA_BASE}/__control/locations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "off", empty }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set locations empty mode: ${response.status}`);
  }
}

async function getLocationsControl(): Promise<{
  failStatus: number;
  failRemaining: number;
  empty: boolean;
  mutations: number;
}> {
  const response = await fetch(`${MOCK_ASTRA_BASE}/__control/locations`);
  if (!response.ok) {
    throw new Error(
      `Failed to read locations control state: ${response.status}`,
    );
  }
  return (await response.json()) as {
    failStatus: number;
    failRemaining: number;
    empty: boolean;
    mutations: number;
  };
}

test.describe("Konfigurasi (Location & Schedule) Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "platform_admin");
  });

  test.describe("Geofencing Location Management (/konfigurasi/lokasi)", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/konfigurasi/lokasi");
      await expect(page).toHaveURL(/\/konfigurasi\/lokasi/);
    });

    test.afterEach(async () => {
      // Always release the fixture so other tests see the default collection.
      await setLocationsFailure("off");
      await setLocationsEmpty(false);
    });

    test("renders location management header, statistics and locations table", async ({
      page,
    }) => {
      await expect(
        page.getByRole("heading", { name: "Manajemen Lokasi Absensi" }),
      ).toBeVisible();

      // Statistics
      await expect(page.getByText("Total Lokasi")).toBeVisible();
      await expect(page.getByText("Lokasi Aktif")).toBeVisible();

      // Table columns
      await expect(
        page.getByRole("columnheader", { name: "Nama Lokasi" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Koordinat" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Radius" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Status" }),
      ).toBeVisible();

      // Default location #1
      await expect(page.getByText("Kantor Pusat")).toBeVisible();
      await expect(page.getByText("Default")).toBeVisible();
    });

    test("enforces default location #1 switch toggle immutability", async ({
      page,
    }) => {
      // Find the first switch corresponding to location #1
      const defaultSwitch = page.locator(
        'table tr:has-text("Kantor Pusat") button[role="switch"]',
      );
      await expect(defaultSwitch).toBeVisible();
      await expect(defaultSwitch).toBeDisabled();
    });

    test("toggles active status for non-default location", async ({ page }) => {
      const nonDefaultSwitch = page.locator(
        'table tr:has-text("Kampus 2 Skanida") button[role="switch"]',
      );
      if (await nonDefaultSwitch.isVisible()) {
        await nonDefaultSwitch.click();
        // Toggle action updates switch state
      }
    });

    test("opens add location form and validates coordinate inputs", async ({
      page,
    }) => {
      const addButton = page.getByRole("button", {
        name: /Tambah Lokasi Baru/i,
      });
      if (await addButton.isEnabled()) {
        await addButton.click();

        // Form fields
        await expect(
          page.locator('input#name, input[placeholder*="nama" i]').first(),
        ).toBeVisible();
        await expect(
          page
            .locator('input#latitude, input[placeholder*="latitude" i]')
            .first(),
        ).toBeVisible();
        await expect(
          page
            .locator('input#longitude, input[placeholder*="longitude" i]')
            .first(),
        ).toBeVisible();
      }
    });

    // C07: empty-vs-error-vs-recovered matrix at the configuration read
    // boundary. Fixtures are armed after the initial navigation and the page
    // is reloaded so the queries fire under the armed scenario.
    test("keeps a genuine first-use empty location list distinct from a read failure", async ({
      page,
    }) => {
      await setLocationsEmpty(true);
      await page.reload();

      // Genuine no-config state keeps its documented default behavior.
      await expect(page.getByText("Belum Ada Lokasi")).toBeVisible();
      await expect(page.getByTestId("konfigurasi-list-retry")).toBeHidden();

      // Fixture restored: the same page renders the actual locations.
      await setLocationsEmpty(false);
      await page.reload();
      await expect(page.getByText("Kantor Pusat")).toBeVisible();
      await expect(page.getByText("Belum Ada Lokasi")).toBeHidden();
    });

    test("shows a recoverable dependency error on Astra 503, recovers via retry, and never mutates configuration", async ({
      page,
    }) => {
      await setLocationsFailure("503", 5);
      await page.reload();

      // The failed read never renders as the empty state and offers a retry.
      await expect(page.getByText("Konfigurasi tidak tersedia")).toBeVisible();
      await expect(page.getByTestId("konfigurasi-list-retry")).toBeVisible();
      await expect(page.getByText("Belum Ada Lokasi")).toBeHidden();
      await expect(page.getByText("Kantor Pusat")).toBeHidden();

      // Fail-then-recover: fixture recovers, the user retries the same read.
      await setLocationsFailure("off");
      await page.getByTestId("konfigurasi-list-retry").click();

      await expect(page.getByText("Kantor Pusat")).toBeVisible();
      await expect(page.getByTestId("konfigurasi-list-retry")).toBeHidden();

      // Recovery invariant: the retry path performs read-only requests only.
      const control = await getLocationsControl();
      expect(control.mutations).toBe(0);
    });

    test("presents an Astra 403 as an authorization failure without a retry control", async ({
      page,
    }) => {
      await setLocationsFailure("403", 5);
      await page.reload();

      await expect(page.getByText("Akses ditolak")).toBeVisible();
      await expect(
        page.getByText(
          "Anda tidak memiliki izin untuk memuat konfigurasi lokasi.",
        ),
      ).toBeVisible();
      await expect(page.getByTestId("konfigurasi-list-retry")).toBeHidden();
      await expect(page.getByText("Belum Ada Lokasi")).toBeHidden();
    });

    test("treats an Astra timeout (504) as a recoverable dependency failure with retry recovery", async ({
      page,
    }) => {
      await setLocationsFailure("504", 5);
      await page.reload();

      await expect(page.getByText("Konfigurasi tidak tersedia")).toBeVisible();
      await expect(page.getByTestId("konfigurasi-list-retry")).toBeVisible();

      await setLocationsFailure("off");
      await page.getByTestId("konfigurasi-list-retry").click();
      await expect(page.getByText("Kantor Pusat")).toBeVisible();

      const control = await getLocationsControl();
      expect(control.mutations).toBe(0);
    });

    test("treats an Astra 500 as a recoverable dependency failure with retry recovery", async ({
      page,
    }) => {
      await setLocationsFailure("500", 5);
      await page.reload();

      await expect(page.getByText("Konfigurasi tidak tersedia")).toBeVisible();
      await expect(page.getByTestId("konfigurasi-list-retry")).toBeVisible();
      await expect(page.getByText("Belum Ada Lokasi")).toBeHidden();

      await setLocationsFailure("off");
      await page.getByTestId("konfigurasi-list-retry").click();
      await expect(page.getByText("Kantor Pusat")).toBeVisible();

      const control = await getLocationsControl();
      expect(control.mutations).toBe(0);
    });
  });

  test.describe("Schedule Configuration (/konfigurasi/jadwal)", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/konfigurasi/jadwal");
      await expect(page).toHaveURL(/\/konfigurasi\/jadwal/);
    });

    test("renders weekly schedule table for all 7 days", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /Jadwal/i }).first(),
      ).toBeVisible();

      // Check all 7 days are listed
      await expect(page.getByText(/Senin/i).first()).toBeVisible();
      await expect(page.getByText(/Selasa/i).first()).toBeVisible();
      await expect(page.getByText(/Rabu/i).first()).toBeVisible();
      await expect(page.getByText(/Kamis/i).first()).toBeVisible();
      await expect(page.getByText(/Jumat/i).first()).toBeVisible();
      await expect(page.getByText(/Sabtu/i).first()).toBeVisible();
      await expect(page.getByText(/Minggu/i).first()).toBeVisible();
    });

    test("opens day schedule edit modal and verifies time fields", async ({
      page,
    }) => {
      const editButton = page.locator('button:has-text("Edit")').first();
      if (await editButton.isVisible()) {
        await editButton.click();

        // Check dialog contains time inputs
        const dialog = page.getByRole("dialog");
        if (await dialog.isVisible()) {
          await expect(
            dialog.getByText(/Mulai Masuk|Jam Masuk/i).first(),
          ).toBeVisible();
          await page.keyboard.press("Escape");
        }
      }
    });

    test("reports per-day reset failure and safely completes after re-read", async ({
      page,
      request,
    }) => {
      const astraPort = process.env.MOCK_ASTRA_PORT || "23500";
      await request.post(`http://127.0.0.1:${astraPort}/__control/schedules`, {
        data: { start_time: "05:30:00", failAt: 2 },
      });

      await page.getByRole("button", { name: "Reset Semua" }).click();
      // Radix AlertDialog renders with the alertdialog role.
      const dialog = page.getByRole("alertdialog", {
        name: "Reset Jadwal ke Default",
      });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Reset" }).click();

      await expect(
        page.getByText(
          /Perubahan jadwal sebagian\. Senin: tersimpan; Selasa: gagal; Rabu: belum dicoba/,
        ),
      ).toBeVisible();
      const monday = page.getByRole("row").filter({ hasText: "Senin" });
      await expect(monday.getByText("06:30 - 07:30")).toBeVisible();

      // Retrying re-reads state; already-default Monday is skipped by the
      // router while the remaining days are completed.
      await page.getByRole("button", { name: "Reset Semua" }).click();
      const retryDialog = page.getByRole("alertdialog", {
        name: "Reset Jadwal ke Default",
      });
      await retryDialog.getByRole("button", { name: "Reset" }).click();
      await expect(
        page.getByText("Jadwal berhasil direset ke nilai default!"),
      ).toBeVisible();
    });
  });

  test.describe("Monthly Attendance Backup Banner", () => {
    test.beforeEach(async ({ request }) => {
      const astraPort = process.env.MOCK_ASTRA_PORT || "23500";
      try {
        await request.delete(`http://127.0.0.1:${astraPort}/v1/admin/backups`);
      } catch {
        // ignore if mock server is unreachable
      }
    });

    test("renders monthly backup banner when query parameter ?showBackupBanner=true is present", async ({
      page,
    }) => {
      await page.goto("/dashboard?showBackupBanner=true");

      const banner = page.locator(
        'div[role="alert"]:has-text("Backup Bulanan")',
      );
      await expect(banner).toBeVisible();
      await expect(banner.getByText("Backup Bulanan")).toBeVisible();
      await expect(banner.getByRole("button", { name: "Excel" })).toBeVisible();
      await expect(banner.getByRole("button", { name: "PDF" })).toBeVisible();

      // Verify fake "Selesai" button is removed
      const selesaiButton = banner.getByRole("button", { name: /Selesai/i });
      await expect(selesaiButton).not.toBeVisible();

      // Trigger audited Excel download and verify banner auto-dismisses upon persisted completion
      const downloadPromise = page.waitForEvent("download");
      await banner.getByRole("button", { name: "Excel" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^backup-absensi-.*\.xlsx$/);

      // Once audited backup completes on Astra, the banner refetches status and hides
      await expect(banner).not.toBeVisible({ timeout: 15000 });
    });
  });
});
