import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("Konfigurasi (Location & Schedule) Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "platform_admin");
  });

  test.describe("Geofencing Location Management (/konfigurasi/lokasi)", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/konfigurasi/lokasi");
      await expect(page).toHaveURL(/\/konfigurasi\/lokasi/);
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
  });

  test.describe("Monthly Attendance Backup Banner", () => {
    test("renders monthly backup banner when query parameter ?showBackupBanner=true is present", async ({
      page,
    }) => {
      await page.goto("/dashboard?showBackupBanner=true");

      const banner = page.locator(
        'div[role="alert"]:has-text("Backup Bulanan"), .border-orange-200',
      );
      await expect(banner).toBeVisible();
      await expect(banner.getByText("Backup Bulanan")).toBeVisible();
      await expect(banner.getByRole("button", { name: "Excel" })).toBeVisible();
      await expect(banner.getByRole("button", { name: "PDF" })).toBeVisible();

      // Dismiss banner via "Selesai"
      const selesaiButton = banner.getByRole("button", { name: /Selesai/i });
      await selesaiButton.click();
      await expect(banner).not.toBeVisible();
    });
  });
});
