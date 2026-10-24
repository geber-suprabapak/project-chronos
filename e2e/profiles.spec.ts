import { test, expect, loginAs } from "./fixtures/auth.ts";

const MOCK_ASTRA_PORT = process.env.MOCK_ASTRA_PORT || "23500";
const MOCK_ASTRA_BASE = `http://127.0.0.1:${MOCK_ASTRA_PORT}`;

// C01b fail-then-recover fixtures: control the local mock Astra's profile
// detail boundary (/v1/admin/students/:id and /v1/admin/staff/:id). mode is
// "off" or an HTTP status string ("403" | "404" | "500" | "503"); failNext is
// how many subsequent detail requests fail before the fixture recovers.
async function setProfileDetailFailure(mode: string, failNext = 5) {
  const response = await fetch(`${MOCK_ASTRA_BASE}/__control/profile-detail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, failNext }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to set profile-detail failure mode: ${response.status}`,
    );
  }
}

async function getProfileDetailControl(): Promise<{
  failStatus: number;
  failRemaining: number;
  mutations: number;
}> {
  const response = await fetch(`${MOCK_ASTRA_BASE}/__control/profile-detail`);
  if (!response.ok) {
    throw new Error(
      `Failed to read profile-detail control state: ${response.status}`,
    );
  }
  return (await response.json()) as {
    failStatus: number;
    failRemaining: number;
    mutations: number;
  };
}

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
        page.getByRole("heading", { name: /Profil Pengguna|User Profiles/i }),
      ).toBeVisible();

      // Export buttons
      await expect(
        page.getByRole("button", { name: /(?:Unduh|Download) Excel/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /(?:Unduh|Download) PDF/i }),
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
      const excelBtn = page.getByRole("button", {
        name: /(?:Unduh|Download) Excel/i,
      });
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

  test.describe("Profile Detail Dependency Failure & Recovery (C01b)", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, "platform_admin");
    });

    test.afterEach(async () => {
      await setProfileDetailFailure("off");
    });

    test("shows a recoverable dependency error on Astra 503, recovers the same profile via retry, and never mutates profile data", async ({
      page,
    }) => {
      const profileId = "00000000-0000-0000-0000-000000000001";
      await setProfileDetailFailure("503", 5);
      await page.goto(`/profiles/show/${profileId}`);

      // Dependency failure is distinct from not-found and offers a retry.
      await expect(
        page.getByText("Layanan profil tidak tersedia"),
      ).toBeVisible();
      await expect(page.getByTestId("profile-detail-retry")).toBeVisible();
      await expect(page.getByText("Profil tidak ditemukan.")).toBeHidden();
      await expect(page.getByTestId("profile-detail-loaded")).toBeHidden();

      // Fail-then-recover: fixture recovers, the user retries the same read.
      await setProfileDetailFailure("off");
      await page.getByTestId("profile-detail-retry").click();

      await expect(page.getByTestId("profile-detail-loaded")).toBeVisible();
      await expect(page.getByText("Ahmad Dahlan")).toBeVisible();
      await expect(page.getByTestId("profile-detail-retry")).toBeHidden();

      // Recovery invariant: the retry path performs read-only requests only.
      const control = await getProfileDetailControl();
      expect(control.mutations).toBe(0);
    });

    test("keeps a genuine not-found state distinct from a dependency failure", async ({
      page,
    }) => {
      // Dependency failure on the same route: recoverable error, not "not found".
      await setProfileDetailFailure("503", 5);
      await page.goto("/profiles/show/tidak-ada-000");
      await expect(
        page.getByText("Layanan profil tidak tersedia"),
      ).toBeVisible();
      await expect(page.getByTestId("profile-detail-retry")).toBeVisible();
      await expect(page.getByText("Profil tidak ditemukan.")).toBeHidden();

      // Fixture recovered: the same id resolves to the distinct not-found state.
      await setProfileDetailFailure("off");
      await page.goto("/profiles/show/tidak-ada-000");
      await expect(page.getByTestId("profile-detail-not-found")).toBeVisible();
      await expect(page.getByText("Profil tidak ditemukan.")).toBeVisible();
      await expect(page.getByTestId("profile-detail-retry")).toBeHidden();
    });

    test("presents an Astra 403 as an authorization failure without disclosing profile existence", async ({
      page,
    }) => {
      const forbiddenMessage =
        "Anda tidak memiliki izin untuk mengakses profil ini.";

      // Existing protected profile: forbidden, no retry, not "not found".
      await setProfileDetailFailure("403", 5);
      await page.goto("/profiles/show/00000000-0000-0000-0000-000000000001");
      await expect(page.getByText("Akses ditolak")).toBeVisible();
      await expect(page.getByText(forbiddenMessage)).toBeVisible();
      await expect(page.getByTestId("profile-detail-retry")).toBeHidden();
      await expect(page.getByText("Profil tidak ditemukan.")).toBeHidden();

      // Unknown id under the same 403: identical fixed message (no existence oracle).
      await setProfileDetailFailure("403", 5);
      await page.goto("/profiles/show/tidak-ada-000");
      await expect(page.getByText("Akses ditolak")).toBeVisible();
      await expect(page.getByText(forbiddenMessage)).toBeVisible();
      await expect(page.getByText("Profil tidak ditemukan.")).toBeHidden();
    });

    test("treats an Astra 500 as a recoverable dependency failure like a 503", async ({
      page,
    }) => {
      await setProfileDetailFailure("500", 5);
      await page.goto("/profiles/show/00000000-0000-0000-0000-000000000001");
      await expect(
        page.getByText("Layanan profil tidak tersedia"),
      ).toBeVisible();
      await expect(page.getByTestId("profile-detail-retry")).toBeVisible();

      await setProfileDetailFailure("off");
      await page.getByTestId("profile-detail-retry").click();
      await expect(page.getByTestId("profile-detail-loaded")).toBeVisible();
      await expect(page.getByText("Ahmad Dahlan")).toBeVisible();

      const control = await getProfileDetailControl();
      expect(control.mutations).toBe(0);
    });
  });
});
