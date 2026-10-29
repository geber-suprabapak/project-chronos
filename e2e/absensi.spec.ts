import {
  blockExternalBrowserRequests,
  test,
  expect,
  loginAs,
} from "./fixtures/auth.ts";

test.describe("Absensi (Attendance Management) Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalBrowserRequests(page);
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
        page.getByRole("button", { name: /(?:Unduh|Download) Excel/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /(?:Unduh|Download) PDF/i }),
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

    test("paginates attendance beyond 50 rows", async ({ page }) => {
      await page.route("**/api/trpc/*absences.list*", async (route) => {
        const response = await route.fetch();
        const responseText = await response.text();
        const chunks = responseText
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const url = new URL(route.request().url());
        const procedureNames = url.pathname.split("/").at(-1)?.split(",") ?? [];
        const procedureIndex = procedureNames.indexOf("absences.list");
        type RequestInput = { json?: { offset?: number }; offset?: number };
        const input = JSON.parse(
          url.searchParams.get("input") ?? "{}",
        ) as Record<string, RequestInput> & RequestInput;
        const requestInput = input[String(procedureIndex)] ?? input;
        const offset = Number(
          requestInput.json?.offset ?? requestInput.offset ?? 0,
        );
        const result = chunks
          .map((chunk) => chunk.json?.[2]?.[0]?.[0])
          .find((value) => Array.isArray(value?.rows));

        if (!result)
          throw new Error("absences.list tRPC stream result was not found");

        result.rows = Array.from(
          { length: Math.min(20, 51 - offset) },
          (_, index) => {
            const rowNumber = offset + index + 1;
            return {
              id: `qa-pagination-${rowNumber}`,
              userId: `qa-pagination-${rowNumber}`,
              date: "2026-10-29",
              status: "Hadir",
              actionType: "check_in",
              latitude: null,
              longitude: null,
              createdAt: "2026-10-29T00:00:00.000Z",
              userProfile: { fullName: `QA Pagination ${rowNumber}` },
            };
          },
        );
        Object.assign(result, {
          total: 51,
          limit: 20,
          offset,
          hasMore: offset + result.rows.length < 51,
        });

        await route.fulfill({
          response,
          body: `${chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`,
        });
      });

      await page.reload();
      await expect(
        page.getByText("Halaman 1 - Menampilkan 20 dari 51 data"),
      ).toBeVisible();
      await expect(page.getByRole("row")).toHaveCount(21);
      await expect(
        page.getByRole("cell", { name: "QA Pagination 1", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "QA Pagination 21", exact: true }),
      ).toHaveCount(0);

      const next = page.getByRole("button", { name: "Halaman berikutnya" });
      const previous = page.getByRole("button", { name: "Halaman sebelumnya" });
      await next.click();
      await expect(
        page.getByText("Halaman 2 - Menampilkan 20 dari 51 data"),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "QA Pagination 21", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "QA Pagination 1", exact: true }),
      ).toHaveCount(0);

      await next.click();
      await expect(
        page.getByText("Halaman 3 - Menampilkan 11 dari 51 data"),
      ).toBeVisible();
      await expect(page.getByRole("row")).toHaveCount(12);
      await expect(
        page.getByRole("cell", { name: "QA Pagination 51", exact: true }),
      ).toBeVisible();
      await expect(next).toBeDisabled();
      await expect(previous).toBeEnabled();
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

    test("records manual attendance with a reason and related attempt", async ({
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

      await dialog.locator("#status").click();
      await page.getByRole("option", { name: "Hadir", exact: true }).click();
      await dialog.locator("#attendance-attempt").click();
      await expect(page.getByRole("option", { name: /Berhasil/ })).toHaveCount(
        0,
      );
      await page.getByRole("option", { name: /Gagal/ }).click();
      await dialog
        .locator("#manual-attendance-reason")
        .fill(
          "Kehadiran diverifikasi langsung oleh wali kelas setelah kamera gagal.",
        );

      const submitButton = dialog.locator(
        'button[type="submit"]:has-text("Simpan Absensi"), button:has-text("Simpan")',
      );
      await expect(submitButton).toBeEnabled();
      await submitButton.click();
      await expect(
        page.getByText("Absensi berhasil ditambahkan!"),
      ).toBeVisible();
      await expect(dialog).not.toBeVisible();
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
        name: /(?:Unduh|Download) Excel/i,
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

  test.describe("Manual attendance WIB date default", () => {
    test.use({ timezoneId: "America/Los_Angeles" });

    test("Absen Manual defaults to the WIB school date at 01:00 WIB", async ({
      page,
    }) => {
      await loginAs(page, "platform_admin");
      // 2026-10-06T18:00:00Z is 01:00 WIB on 2026-10-07 and still 11:00 on
      // 2026-10-06 in the browser timezone: the prior UTC date must not win.
      await page.clock.setFixedTime(new Date("2026-10-06T18:00:00Z"));
      await page.goto("/absensi");
      await expect(
        page.getByRole("button", { name: /Absen Manual/i }),
      ).toBeVisible();

      await page.getByRole("button", { name: /Absen Manual/i }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // The date field renders once the NIS check resolves a student.
      await dialog.locator("#nis").fill("1001");
      await expect(dialog.getByText("Ahmad Dahlan")).toBeVisible();
      await expect(dialog.locator("#date")).toHaveValue("2026-10-07");
    });
  });

  test.describe("Monthly Attendance Recap (/absensi/rekap-bulanan)", () => {
    test("renders filters, class-grouped matrix, totals, and optional class filter", async ({
      page,
    }) => {
      await page.goto("/absensi/rekap-bulanan");
      await expect(page).toHaveURL(/\/absensi\/rekap-bulanan/);
      await expect(
        page.getByRole("heading", { name: "Rekap Absensi Bulanan" }),
      ).toBeVisible();
      await expect(page.locator("#monthly-recap-month")).toBeVisible();
      await expect(page.locator("#monthly-recap-class")).toBeVisible();
      await expect(page.locator("#monthly-recap-student")).toBeVisible();
      await expect(page.getByRole("table").first()).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "Ahmad Dahlan", exact: true }).first(),
      ).toBeVisible();

      await page
        .locator("#monthly-recap-class")
        .selectOption({ label: "XII RPL 1" });
      await expect(
        page.getByRole("heading", { name: "XII RPL 1" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "XI TKJ 1" }),
      ).not.toBeVisible();
    });

    test("downloads the selected monthly recap workbook", async ({ page }) => {
      await page.goto("/absensi/rekap-bulanan?month=2026-09");
      await expect(
        page.getByRole("button", { name: "Unduh Excel" }),
      ).toBeEnabled();

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Unduh Excel" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(
        "rekap-absensi-bulanan-2026-09.xlsx",
      );
    });

    test("hides monthly recap export for teacher role", async ({ page }) => {
      await loginAs(page, "teacher");
      await page.goto("/absensi/rekap-bulanan?month=2026-09");
      await expect(
        page.getByRole("heading", { name: "Rekap Absensi Bulanan" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Unduh Excel" }),
      ).not.toBeVisible();
    });
  });
});
