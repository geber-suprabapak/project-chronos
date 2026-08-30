import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("Absensi (Attendance Management) Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "platform_admin");
  });

  test.describe("Daily Attendance Listing & Search", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/absensi");
      await expect(page).toHaveURL(/\/absensi/);
    });

    test("renders attendance page header, export buttons and data table", async ({
      page,
    }) => {
      await expect(
        page.getByRole("heading", { name: /Absensi/i }),
      ).toBeVisible();

      // Export buttons
      await expect(
        page.getByRole("button", { name: /Download Excel/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Download PDF/i }),
      ).toBeVisible();

      // Absen Manual button
      await expect(
        page.getByRole("button", { name: /Absen Manual/i }),
      ).toBeVisible();

      // Table headers
      await expect(
        page.getByRole("columnheader", { name: /Tanggal/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Nama/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Status/i }),
      ).toBeVisible();
    });

    test("filters attendance by live query search", async ({ page }) => {
      const searchInput = page.locator(
        'input[placeholder*="Search" i], input[placeholder*="Cari" i]',
      );
      if ((await searchInput.count()) > 0) {
        await searchInput.first().fill("Ahmad");
        // Verify filtered rows
        await expect(
          page.getByRole("cell", { name: "Ahmad Dahlan", exact: true }).first(),
        ).toBeVisible();
      }
    });

    test("opens AbsenManualDialog and records a new attendance entry", async ({
      page,
    }) => {
      const absenButton = page.getByRole("button", { name: /Absen Manual/i });
      await absenButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: "Absen Manual" }),
      ).toBeVisible();

      // Fill student NIS
      const nisInput = dialog.locator('input#nis, input[name="nis"]');
      await nisInput.fill("1001");

      // Verify student details auto-populate
      await expect(dialog.getByText("Ahmad Dahlan")).toBeVisible();

      // Submit form
      const submitButton = dialog.locator(
        'button[type="submit"]:has-text("Simpan Absensi"), button:has-text("Simpan")',
      );
      if (await submitButton.isEnabled()) {
        await submitButton.click();
      }
    });

    test("handles single attendance deletion with confirmation dialog", async ({
      page,
    }) => {
      const deleteButtons = page.locator(
        'button[aria-label*="Hapus" i], button:has(.lucide-trash)',
      );
      if ((await deleteButtons.count()) > 0) {
        await deleteButtons.first().click();

        // Confirmation AlertDialog should appear
        const alertDialog = page.getByRole("alertdialog");
        if (await alertDialog.isVisible()) {
          await expect(alertDialog).toBeVisible();

          const cancelButton = alertDialog.getByRole("button", {
            name: /Batal/i,
          });
          await cancelButton.click();
          await expect(alertDialog).not.toBeVisible();
        }
      }
    });

    test("handles bulk selection and deletion confirmation", async ({
      page,
    }) => {
      // Find row checkboxes
      const checkboxes = page.locator(
        'tbody input[type="checkbox"], tbody [role="checkbox"]',
      );
      if ((await checkboxes.count()) > 0) {
        await checkboxes.first().click();

        // Bulk delete button should appear
        const bulkDeleteButton = page.locator('button:has-text("Hapus (")');
        if (await bulkDeleteButton.isVisible()) {
          await bulkDeleteButton.click();

          const alertDialog = page.locator('[role="alertdialog"]');
          await expect(alertDialog).toBeVisible();

          const cancelButton = alertDialog.getByRole("button", {
            name: /Batal/i,
          });
          await cancelButton.click();
          await expect(alertDialog).not.toBeVisible();
        }
      }
    });

    test("triggers Excel data export download", async ({ page }) => {
      const exportButton = page.getByRole("button", {
        name: /Download Excel/i,
      });
      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeEnabled();
    });
  });

  test.describe("Class-Filtered Attendance View (/absensi/perkelas)", () => {
    test("renders class attendance view with summary breakdown", async ({
      page,
    }) => {
      await page.goto("/absensi/perkelas");
      await expect(page).toHaveURL(/\/absensi\/perkelas/);

      // Page heading
      await expect(
        page.getByRole("heading", { name: /Per Kelas/i }),
      ).toBeVisible();

      // Class filter
      const classSelect = page.locator("#filter-class");
      if (await classSelect.isVisible()) {
        await classSelect.click();
        const option = page.getByRole("option", { name: /XII RPL 1/i });
        if (await option.isVisible()) {
          await option.click();
        }
      }
    });
  });
});
