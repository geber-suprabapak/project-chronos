import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("Dashboard & Metrics Overview", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "platform_admin");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("renders dashboard header and overview titles", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Dashboard Admin" }),
    ).toBeVisible();
    await expect(
      page.getByText("Ringkasan informasi dan metrik utama sistem"),
    ).toBeVisible();
  });

  test("renders attendance pie charts with check-in and check-out statistics", async ({
    page,
  }) => {
    // Statistik Kehadiran Card
    await expect(page.getByText("Statistik Kehadiran")).toBeVisible();
    await expect(page.getByText("Absen Masuk")).toBeVisible();
    await expect(page.getByText("Absen Pulang")).toBeVisible();

    // Verify legends
    await expect(
      page.getByText("Sudah Absen", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Belum Absen", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Izin", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Sakit", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Sudah Pulang", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Belum Pulang", { exact: true }).first(),
    ).toBeVisible();

    // Verify SVG pie charts exist in DOM
    const pieCharts = page.locator(
      "[data-chart], .recharts-wrapper, .recharts-responsive-container",
    );
    await expect(pieCharts.first()).toBeVisible();
  });

  test("renders quick action cards and launches modal dialogs", async ({
    page,
  }) => {
    // Absen Manual Tile Trigger
    const absenManualButton = page.getByRole("button", {
      name: /Absen Manual/i,
    });
    await expect(absenManualButton).toBeVisible();
    await absenManualButton.click();

    // Absen Manual Dialog should be visible
    const absenDialog = page.getByRole("dialog");
    await expect(absenDialog).toBeVisible();
    await expect(absenDialog.getByText("Absen Manual").first()).toBeVisible();

    // Close dialog
    await page.keyboard.press("Escape");
    await expect(absenDialog).not.toBeVisible();

    // Izin Manual Tile Trigger
    const izinManualButton = page.getByRole("button", { name: /Izin Manual/i });
    await expect(izinManualButton).toBeVisible();
    await izinManualButton.click();

    // Izin Manual Dialog should be visible
    const izinDialog = page.getByRole("dialog");
    await expect(izinDialog).toBeVisible();
    await expect(izinDialog.getByText("Izin Manual").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(izinDialog).not.toBeVisible();
  });

  test("renders pending permissions table with detail action links", async ({
    page,
  }) => {
    await expect(page.getByText("Perizinan Tertunda")).toBeVisible();
    await expect(
      page.getByText("Daftar perizinan yang menunggu persetujuan"),
    ).toBeVisible();

    // Table headers
    await expect(
      page.getByRole("columnheader", { name: "Nama" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Kategori" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Tanggal Izin" }),
    ).toBeVisible();

    // Table rows
    const detailButtons = page.locator('a[href^="/perizinan/show/"]');
    if ((await detailButtons.count()) > 0) {
      await expect(detailButtons.first()).toBeVisible();
      await detailButtons.first().click();
      await expect(page).toHaveURL(/\/perizinan\/show\//);
    }
  });
});
