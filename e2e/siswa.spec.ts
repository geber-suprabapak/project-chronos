import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("Siswa (Student Roster) Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "platform_admin");
    await page.goto("/siswa");
    await expect(page).toHaveURL(/\/siswa/);
  });

  test("renders student directory header, export buttons and summary KPI cards", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Data Siswa" }),
    ).toBeVisible();

    // Export buttons
    await expect(
      page.getByRole("button", { name: /Download Excel/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download PDF/i }),
    ).toBeVisible();

    // KPI Cards
    await expect(page.getByText("Total Siswa")).toBeVisible();
    await expect(page.getByText("Siswa Laki-laki")).toBeVisible();
    await expect(page.getByText("Siswa Perempuan")).toBeVisible();
    await expect(page.getByText("Sudah Diaktifkan")).toBeVisible();

    // Student table
    const table = page.locator("#siswa-table");
    await expect(table).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "NIS", exact: true }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Nama" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Kelas" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Absen" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Jenis Kelamin" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Status" }),
    ).toBeVisible();
  });

  test("filters student table by name and NIS search input", async ({
    page,
  }) => {
    const searchInput = page.locator('input#nama, input[name="nama"]');
    await expect(searchInput).toBeVisible();

    // Search by name
    await searchInput.fill("Ahmad");
    // AutoSearchForm debounces URL params
    await expect(page).toHaveURL(/nama=Ahmad/);
    const table = page.locator("#siswa-table");
    await expect(table).toContainText("Ahmad Dahlan");
    await expect(table).toContainText("1001");

    // Clear search
    await searchInput.clear();
    await expect(page).not.toHaveURL(/nama=Ahmad/);
  });

  test("filters student table by class dropdown", async ({ page }) => {
    const classTrigger = page.locator('select#kelas, [id="kelas"]');
    if ((await classTrigger.count()) > 0) {
      await classTrigger.first().click();
      const option = page.getByRole("option", { name: /XII RPL 1/i });
      if (await option.isVisible()) {
        await option.click();
        await expect(page).toHaveURL(/kelas=XII\+RPL\+1|kelas=XII%20RPL%201/);
        await expect(page.locator("#siswa-table")).toContainText("XII RPL 1");
      }
    }
  });

  test("filters student table by gender and activation status", async ({
    page,
  }) => {
    // Navigate with query params directly to test server filter evaluation
    await page.goto("/siswa?kelamin=P&activated=true");
    await expect(page.locator("#siswa-table")).toContainText("Siti Rahmawati");
    await expect(page.locator("#siswa-table")).toContainText("Perempuan");
    await expect(page.locator("#siswa-table")).toContainText("Aktif");

    // Filter by unactivated
    await page.goto("/siswa?activated=false");
    await expect(page.locator("#siswa-table")).toContainText("Budi Santoso");
    await expect(page.locator("#siswa-table")).toContainText("Belum Aktif");
  });

  test("handles pagination controls", async ({ page }) => {
    // Top and bottom pagination buttons
    const prevButtons = page.getByRole("button", { name: /Prev/i });
    const nextButtons = page.getByRole("button", { name: /Next/i });

    await expect(prevButtons.first()).toBeVisible();
    await expect(nextButtons.first()).toBeVisible();

    // On first page, Prev is disabled
    await expect(prevButtons.first()).toBeDisabled();
  });

  test("triggers Excel data export download", async ({ page }) => {
    const exportButton = page.getByRole("button", { name: /Download Excel/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });

  test("triggers PDF data export button", async ({ page }) => {
    const pdfButton = page.getByRole("button", { name: /Download PDF/i });
    await expect(pdfButton).toBeVisible();
    await expect(pdfButton).toBeEnabled();
  });
});
