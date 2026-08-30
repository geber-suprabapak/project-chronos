import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("User Profiles Management Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "platform_admin");
  });

  test.describe("Profiles Directory Listing & Filters", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/profiles");
      await expect(page).toHaveURL(/\/profiles/);
    });

    test("renders profiles page header, export buttons and user directory table", async ({
      page,
    }) => {
      await expect(
        page.getByRole("heading", { name: "User Profiles" }),
      ).toBeVisible();

      // Export buttons
      await expect(
        page.getByRole("button", { name: /Download Excel/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Download PDF/i }),
      ).toBeVisible();

      // Search and filter inputs
      await expect(
        page.locator('input#name, input[placeholder*="Cari nama" i]'),
      ).toBeVisible();

      // Table columns
      await expect(
        page.getByRole("columnheader", { name: /NIS/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Full Name|Nama/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Class|Kelas/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Role|Peran/i }),
      ).toBeVisible();
    });

    test("filters profile directory by search name input", async ({ page }) => {
      const searchInput = page.locator(
        'input#name, input[placeholder*="Cari nama" i]',
      );
      await searchInput.fill("Ahmad");
      await expect(page.locator("table")).toContainText("Ahmad Dahlan");
    });

    test("triggers Excel profiles export download", async ({ page }) => {
      const excelBtn = page.getByRole("button", { name: /Download Excel/i });
      await expect(excelBtn).toBeVisible();
      await expect(excelBtn).toBeEnabled();
    });
  });

  test.describe("Profile Detail View (/profiles/show/[id])", () => {
    test("renders student identity card and recent history tables", async ({
      page,
    }) => {
      // Student 1 ID: 00000000-0000-0000-0000-000000000001
      await page.goto("/profiles/show/00000000-0000-0000-0000-000000000001");
      await expect(page).toHaveURL(
        /\/profiles\/show\/00000000-0000-0000-0000-000000000001/,
      );

      // Identity details
      await expect(page.getByText("Ahmad Dahlan")).toBeVisible();
      await expect(page.getByText("1001")).toBeVisible();
      await expect(page.getByText("XII RPL 1")).toBeVisible();

      // Attendance history card/table
      await expect(page.getByText(/Absensi Terakhir/i).first()).toBeVisible();

      // Leave requests history card/table
      await expect(page.getByText(/Perizinan Terakhir/i).first()).toBeVisible();
    });
  });
});
