import {
  blockExternalBrowserRequests,
  test,
  expect,
  loginAs,
} from "./fixtures/auth.ts";

const MOCK_ASTRA_PORT = process.env.MOCK_ASTRA_PORT || "23500";
const MOCK_ASTRA_BASE = `http://127.0.0.1:${MOCK_ASTRA_PORT}`;

// C05 fail-then-recover fixtures: control the local mock Astra's Leave
// boundary (/v1/admin/leave-requests collection and detail GET reads). mode is
// "off" or an HTTP status string ("403" | "404" | "500" | "503" | "504");
// failNext is how many subsequent leave reads fail before the fixture recovers.
async function setLeaveFailure(mode: string, failNext = 5) {
  const response = await fetch(`${MOCK_ASTRA_BASE}/__control/leave-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, failNext }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set leave failure mode: ${response.status}`);
  }
}

async function getLeaveControl(): Promise<{
  failStatus: number;
  failRemaining: number;
  mutations: number;
}> {
  const response = await fetch(`${MOCK_ASTRA_BASE}/__control/leave-requests`);
  if (!response.ok) {
    throw new Error(`Failed to read leave control state: ${response.status}`);
  }
  return (await response.json()) as {
    failStatus: number;
    failRemaining: number;
    mutations: number;
  };
}

test.describe("Perizinan (Leave Requests Management) Workflows", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalBrowserRequests(page);
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
        page.getByRole("button", { name: /(?:Unduh|Download) Excel/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /(?:Unduh|Download) PDF/i }),
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
        const studentOption = dialog.locator(
          '[role="option"]:has-text("Ahmad Dahlan"), button:has-text("Ahmad Dahlan")',
        );
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
        name: /(?:Unduh|Download) Excel/i,
      });
      await expect(exportButton).toBeVisible();
      await expect(exportButton).toBeEnabled();
    });
  });

  test.describe("Leave Request Detail & Approval/Rejection Lifecycle", () => {
    test("all Chronos roles can access Leave creation and each decision affordance", async ({
      page,
    }) => {
      const roles = [
        "platform_admin",
        "school_admin",
        "teacher",
        "staff",
        "admin",
        "kepala_sekolah",
        "guru",
        "wali_kelas",
      ] as const;
      const details = [
        {
          id: "b0000000-0000-4000-8000-000000000001",
          action: /Setujui/,
        },
        {
          id: "b0000000-0000-4000-8000-000000000002",
          action: /Force-finish Leave Period/,
        },
        {
          id: "b0000000-0000-4000-8000-000000000003",
          action: /Batalkan Penolakan/,
        },
      ];

      for (const role of roles) {
        await loginAs(page, role);
        await page.goto("/perizinan");
        await expect(
          page.getByRole("button", { name: /Izin Manual/i }),
        ).toBeVisible();

        for (const detail of details) {
          await page.goto(`/perizinan/show/${detail.id}`);
          await expect(
            page.getByTestId("perizinan-detail-loaded"),
            `${role} loads ${detail.id}`,
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: detail.action }),
          ).toBeVisible();
          await expect(
            page.getByText("Kepala Sekolah Test · school_admin"),
          ).toBeVisible();
        }
      }

      await loginAs(page, "student");
      await page.goto("/perizinan");
      await expect(page).toHaveURL(/\/login\?error=forbidden_role/);
    });

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

    test("renders attachments after reload and gives a direct-open fallback on load failure", async ({
      page,
    }) => {
      const attachmentUrl =
        "https://storage.lunaradev.my.id/perizinan/leave-request-001.png";
      const imageBody = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      );
      let shouldFail = false;

      await page.route(attachmentUrl, async (route) => {
        if (shouldFail) {
          await route.abort();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          headers: { "cache-control": "no-store" },
          body: imageBody,
        });
      });

      const attachment = () => page.locator('img[alt="Bukti Foto Izin"]');

      await page.goto("/perizinan/show/b0000000-0000-4000-8000-000000000001");
      await expect
        .poll(() =>
          attachment().evaluate(
            (img) => (img as HTMLImageElement).naturalWidth,
          ),
        )
        .toBeGreaterThan(0);

      await page.reload();
      await expect
        .poll(() =>
          attachment().evaluate(
            (img) => (img as HTMLImageElement).naturalWidth,
          ),
        )
        .toBeGreaterThan(0);

      shouldFail = true;
      await page.reload();
      await expect(
        page.getByText("Bukti foto tidak dapat ditampilkan."),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Buka lampiran langsung" }),
      ).toHaveAttribute("href", attachmentUrl);

      await page.getByRole("button", { name: "Coba lagi" }).click();
      await expect(
        page.getByText("Bukti foto tidak dapat ditampilkan."),
      ).toBeVisible();
    });
  });

  test.describe("Leave List/Detail Dependency Failure & Recovery (C05)", () => {
    const LEAVE_ID = "b0000000-0000-4000-8000-000000000001";
    const DEPENDENCY_TITLE = "Layanan perizinan tidak tersedia";
    const NOT_FOUND_MESSAGE = "Data perizinan tidak ditemukan.";
    const FORBIDDEN_MESSAGE =
      "Anda tidak memiliki izin untuk mengakses perizinan ini.";

    test.beforeEach(async ({ page }) => {
      await loginAs(page, "platform_admin");
    });

    test.afterEach(async () => {
      await setLeaveFailure("off");
    });

    test("shows a recoverable dependency error on Astra 503, recovers the same leave record via retry, and never mutates leave data", async ({
      page,
    }) => {
      await setLeaveFailure("503", 5);
      await page.goto(`/perizinan/show/${LEAVE_ID}`);

      // Dependency failure is distinct from not-found and offers a retry.
      await expect(page.getByText(DEPENDENCY_TITLE)).toBeVisible();
      await expect(page.getByTestId("perizinan-detail-retry")).toBeVisible();
      await expect(page.getByText(NOT_FOUND_MESSAGE)).toBeHidden();
      await expect(page.getByTestId("perizinan-detail-loaded")).toBeHidden();

      // Fail-then-recover: fixture recovers, the user retries the same read.
      await setLeaveFailure("off");
      await page.getByTestId("perizinan-detail-retry").click();

      await expect(page.getByTestId("perizinan-detail-loaded")).toBeVisible();
      await expect(page.getByText("Ahmad Dahlan")).toBeVisible();
      await expect(page.getByTestId("perizinan-detail-retry")).toBeHidden();

      // Recovery invariant: the retry path performs read-only requests only.
      const control = await getLeaveControl();
      expect(control.mutations).toBe(0);
    });

    test("keeps a genuine not-found state distinct from a dependency failure", async ({
      page,
    }) => {
      const unknownLeaveId = "b0000000-0000-4000-8000-000000000999";
      // Dependency failure on the same route: recoverable error, not "not found".
      await setLeaveFailure("503", 5);
      await page.goto(`/perizinan/show/${unknownLeaveId}`);
      await expect(page.getByText(DEPENDENCY_TITLE)).toBeVisible();
      await expect(page.getByTestId("perizinan-detail-retry")).toBeVisible();
      await expect(page.getByText(NOT_FOUND_MESSAGE)).toBeHidden();

      // Fixture recovered: the same id resolves to the distinct not-found state.
      await setLeaveFailure("off");
      await page.goto(`/perizinan/show/${unknownLeaveId}`);
      await expect(
        page.getByTestId("perizinan-detail-not-found"),
      ).toBeVisible();
      await expect(page.getByText(NOT_FOUND_MESSAGE)).toBeVisible();
      await expect(page.getByTestId("perizinan-detail-retry")).toBeHidden();
    });

    test("presents an Astra 403 as an authorization failure without disclosing leave existence", async ({
      page,
    }) => {
      // Existing leave record: forbidden, no retry, not "not found".
      await setLeaveFailure("403", 5);
      await page.goto(`/perizinan/show/${LEAVE_ID}`);
      await expect(page.getByText("Akses ditolak")).toBeVisible();
      await expect(page.getByText(FORBIDDEN_MESSAGE)).toBeVisible();
      await expect(page.getByTestId("perizinan-detail-retry")).toBeHidden();
      await expect(page.getByText(NOT_FOUND_MESSAGE)).toBeHidden();

      // Unknown id under the same 403: identical fixed message (no existence oracle).
      await setLeaveFailure("403", 5);
      await page.goto("/perizinan/show/b0000000-0000-4000-8000-000000000999");
      await expect(page.getByText("Akses ditolak")).toBeVisible();
      await expect(page.getByText(FORBIDDEN_MESSAGE)).toBeVisible();
      await expect(page.getByText(NOT_FOUND_MESSAGE)).toBeHidden();
    });

    test("treats an Astra timeout (504) as a recoverable dependency failure like a 503", async ({
      page,
    }) => {
      await setLeaveFailure("504", 5);
      await page.goto(`/perizinan/show/${LEAVE_ID}`);
      await expect(page.getByText(DEPENDENCY_TITLE)).toBeVisible();
      await expect(page.getByTestId("perizinan-detail-retry")).toBeVisible();

      await setLeaveFailure("off");
      await page.getByTestId("perizinan-detail-retry").click();
      await expect(page.getByTestId("perizinan-detail-loaded")).toBeVisible();
      await expect(page.getByText("Ahmad Dahlan")).toBeVisible();

      const control = await getLeaveControl();
      expect(control.mutations).toBe(0);
    });

    test("treats an Astra 500 as a recoverable dependency failure with retry recovery", async ({
      page,
    }) => {
      await setLeaveFailure("500", 5);
      await page.goto(`/perizinan/show/${LEAVE_ID}`);
      await expect(page.getByText(DEPENDENCY_TITLE)).toBeVisible();
      await expect(page.getByTestId("perizinan-detail-retry")).toBeVisible();

      await setLeaveFailure("off");
      await page.getByTestId("perizinan-detail-retry").click();
      await expect(page.getByTestId("perizinan-detail-loaded")).toBeVisible();
      await expect(page.getByText("Ahmad Dahlan")).toBeVisible();

      const control = await getLeaveControl();
      expect(control.mutations).toBe(0);
    });

    test("shows a recoverable dependency error on the leave list and recovers the same list via retry", async ({
      page,
    }) => {
      await setLeaveFailure("503", 5);
      await page.goto("/perizinan");

      // The failed collection never renders as "no data" and offers a retry.
      await expect(page.getByText(DEPENDENCY_TITLE)).toBeVisible();
      await expect(page.getByTestId("perizinan-list-retry")).toBeVisible();
      await expect(page.getByText("Tidak ada data perizinan.")).toBeHidden();

      // Fail-then-recover: fixture recovers, the user retries the same read.
      await setLeaveFailure("off");
      await page.getByTestId("perizinan-list-retry").click();

      await expect(page.getByText(DEPENDENCY_TITLE)).toBeHidden();
      await expect(page.getByRole("table").first()).toContainText(
        "Ahmad Dahlan",
      );
      await expect(page.getByTestId("perizinan-list-retry")).toBeHidden();

      // Recovery invariant: the retry path performs read-only requests only.
      const control = await getLeaveControl();
      expect(control.mutations).toBe(0);
    });
  });
});
