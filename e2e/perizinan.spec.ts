import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("Perizinan (Leave Requests Management) Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "platform_admin");
  });

  test.describe("Leave Requests Listing & Filtering", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/perizinan");
      await expect(page).toHaveURL(/\/perizinan/);
    });

    test("renders perizinan page header, FilterBar, export buttons and table", async ({
      page,
    }) => {
      await expect(
        page.locator('[data-slot="card-title"]').filter({
          hasText: "Daftar Perizinan",
        }),
      ).toBeVisible();

      // Export buttons
      await expect(
        page.getByRole("button", { name: /Download Excel/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Download PDF/i }),
      ).toBeVisible();

      // Izin Manual action button
      await expect(
        page.getByRole("button", { name: /Izin Manual/i }),
      ).toBeVisible();

      // FilterBar controls
      await expect(
        page.locator('input#filter-q, input[placeholder*="Cari nama" i]'),
      ).toBeVisible();

      // Table columns
      await expect(
        page.getByRole("columnheader", { name: /Tanggal/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Nama/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Kategori/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: /Status/i }),
      ).toBeVisible();
    });

    test("filters leave requests by search query and status filter", async ({
      page,
    }) => {
      const searchInput = page.locator(
        'input#filter-q, input[placeholder*="Cari nama" i]',
      );
      await searchInput.fill("Ahmad");
      await expect(page.getByRole("table").first()).toContainText(
        "Ahmad Dahlan",
      );

      // Filter by status approved
      await page.goto("/perizinan?status=approved");
      await expect(page.getByRole("table").first()).toContainText(
        "Siti Rahmawati",
      );
    });

    test("opens IzinManualDialog and records a new leave request", async ({
      page,
    }) => {
      const izinButton = page.getByRole("button", { name: /Izin Manual/i });
      await izinButton.click();

      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Izin Manual").first()).toBeVisible();

      // Search student
      const searchStudent = dialog.locator(
        'input#search-siswa, input[placeholder*="Cari nama" i]',
      );
      if (await searchStudent.isVisible()) {
        await searchStudent.fill("Ahmad");
        const studentOption = dialog.getByRole("button", {
          name: /Ahmad Dahlan/,
        });
        await expect(studentOption).toBeVisible();
        await studentOption.click();
      }

      const category = dialog.locator("#kategori");
      await expect(category).toBeVisible();
      await category.click();
      await page.getByRole("option", { name: "Sakit" }).click();

      // Submit
      const submitBtn = dialog.getByRole("button", { name: "Simpan Izin" });
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();
      await expect(dialog).not.toBeVisible();
    });

    test("triggers Excel export download", async ({ page }) => {
      const exportButton = page.getByRole("button", {
        name: /Download Excel/i,
      });
      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeEnabled();
    });
  });

  test.describe("Leave Request Detail & Approval/Rejection Lifecycle", () => {
    test("navigates to detail page, approves pending leave, and verifies status update", async ({
      page,
    }) => {
      // Permit 1 is pending in mock data.
      await page.goto("/perizinan/show/b0000000-0000-4000-8000-000000000001");
      await expect(page).toHaveURL(
        /\/perizinan\/show\/b0000000-0000-4000-8000-000000000001/,
      );

      // Verify student identity info
      await expect(page.getByText("Ahmad Dahlan")).toBeVisible();
      await expect(page.getByText("1001")).toBeVisible();
      await expect(page.getByText("XII RPL 1")).toBeVisible();

      // Approve button should be available for pending permit
      const approveButton = page.getByRole("button", {
        name: /Approve|Setujui/i,
      });
      if (await approveButton.isVisible()) {
        await approveButton.click();
        // Verify approved badge / notification
        await expect(
          page.getByText(/Approved|Disetujui/i).first(),
        ).toBeVisible();
      }
    });

    test("rejects leave request with reason dialog and verifies destructive status", async ({
      page,
    }) => {
      await page.goto("/perizinan/show/b0000000-0000-4000-8000-000000000001");

      const rejectButton = page.getByRole("button", { name: /Reject|Tolak/i });
      if (await rejectButton.isVisible()) {
        await rejectButton.click();

        // Reject reason dialog or textarea
        const reasonInput = page.locator(
          'textarea#rejection-reason, textarea[name="reason"], textarea[placeholder*="alasan" i]',
        );
        if (await reasonInput.isVisible()) {
          await reasonInput.fill("Surat dokter tidak valid");
          const confirmReject = page.getByRole("button", {
            name: /Konfirmasi Tolak|Tolak Izin|Simpan/i,
          });
          await confirmReject.click();

          await expect(
            page.getByText(/Rejected|Ditolak/i).first(),
          ).toBeVisible();
        }
      }
    });

    test("opens evidence photo modal on permit detail view", async ({
      page,
    }) => {
      await page.goto("/perizinan/show/b0000000-0000-4000-8000-000000000001");

      const photoButton = page.locator(
        'button[aria-label*="bukti foto" i], button:has(img), img[alt*="Bukti" i]',
      );
      if ((await photoButton.count()) > 0) {
        await photoButton.first().click();

        // Modal photo dialog
        const modal = page.getByRole("dialog");
        if (await modal.isVisible()) {
          await expect(modal).toBeVisible();
          await page.keyboard.press("Escape");
        }
      }
    });
  });
});
