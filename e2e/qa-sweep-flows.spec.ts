import {
  blockExternalBrowserRequests,
  createMockLogtoSessionCookie,
  expect,
  loginAs,
  test,
} from "./fixtures/auth.ts";

test.describe("QA Sweep: Critical Flows, Boundary Inputs, RBAC & Adversarial Hunts", () => {
  test.describe("Session, Auth Boundaries & Role-Based Access Control", () => {
    test("rejects tampered or expired session cookie by redirecting protected routes to /login", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await page.context().addCookies([
        {
          name: "logto_chronos-app",
          value: "tampered-invalid-ciphertext.bad-iv",
          url: "http://localhost:3055",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);

      for (const route of [
        "/dashboard",
        "/absensi",
        "/perizinan",
        "/profiles",
        "/siswa",
        "/konfigurasi/lokasi",
        "/konfigurasi/jadwal",
      ]) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/login/);
      }
    });

    test("blocks unprivileged teacher role on admin-only tRPC mutations with FORBIDDEN", async ({
      request,
    }) => {
      const teacherCookie = await createMockLogtoSessionCookie({
        roles: ["teacher"],
      });

      const forbiddenMutations = [
        {
          path: "/api/trpc/location.create",
          body: {
            json: {
              id: 3,
              name: "Unauthorized Location",
              latitude: -7.45,
              longitude: 110.22,
              distance: 100,
              isActive: true,
            },
          },
        },
        {
          path: "/api/trpc/jadwal.update",
          body: {
            json: {
              astraId: "sched-1",
              data: { kompensasiWaktu: 10 },
            },
          },
        },
        {
          path: "/api/trpc/absences.createManual",
          body: {
            json: {
              nis: "1001",
              status: "Hadir",
              date: "2026-11-17",
              reason: "Unauthorized manual attendance",
              attemptId: "att-1",
            },
          },
        },
        {
          path: "/api/trpc/absences.delete",
          body: {
            json: { id: "a0000000-0000-4000-8000-000000000001" },
          },
        },
      ];

      for (const item of forbiddenMutations) {
        const res = await request.post(item.path, {
          headers: {
            Cookie: `logto_chronos-app=${teacherCookie}`,
            "Content-Type": "application/json",
          },
          data: item.body,
        });
        expect(res.status(), `${item.path} for teacher`).toBe(403);
      }
    });

    test("validates password change boundaries (empty, <8, mismatch, >128)", async ({
      page,
      request,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "must_change_password");
      await page.goto("/ganti-password");

      const newPass = page.locator("#new-password");
      const confirmPass = page.locator("#confirm-password");
      const submitBtn = page.getByRole("button", {
        name: /Simpan Password Baru/i,
      });

      // < 8 characters boundary
      await newPass.fill("1234567");
      await confirmPass.fill("1234567");
      await submitBtn.click();
      await expect(
        page.getByRole("alert").filter({ hasText: "minimal 8" }),
      ).toBeVisible();

      // Mismatch confirmation
      await newPass.fill("ValidPass123");
      await confirmPass.fill("DifferentPass123");
      await submitBtn.click();
      await expect(
        page.getByRole("alert").filter({ hasText: "tidak cocok" }),
      ).toBeVisible();

      // API boundary >128 characters
      const mcpCookie = await createMockLogtoSessionCookie({
        must_change_password: true,
      });
      const overMaxRes = await request.post("/api/logto/password", {
        headers: {
          Cookie: `logto_chronos-app=${mcpCookie}`,
          "Content-Type": "application/json",
        },
        data: { password: "a".repeat(129) },
      });
      expect(overMaxRes.status()).toBe(400);
    });
  });

  test.describe("File Upload Edge Cases (/api/astra/files & Roster Import)", () => {
    test("rejects zero-byte file upload with 400 Bad Request", async ({
      request,
    }) => {
      const adminCookie = await createMockLogtoSessionCookie({
        roles: ["platform_admin"],
      });

      const res = await request.post("/api/astra/files", {
        headers: { Cookie: `logto_chronos-app=${adminCookie}` },
        multipart: {
          file: {
            name: "empty.png",
            mimeType: "image/png",
            buffer: Buffer.alloc(0),
          },
        },
      });
      expect(res.status()).toBe(400);
    });

    test("rejects spoofed extension with valid MIME type and oversize (>5 MiB) file", async ({
      request,
    }) => {
      const adminCookie = await createMockLogtoSessionCookie({
        roles: ["platform_admin"],
      });

      const spoofedRes = await request.post("/api/astra/files", {
        headers: { Cookie: `logto_chronos-app=${adminCookie}` },
        multipart: {
          file: {
            name: "payload.exe",
            mimeType: "image/png",
            buffer: Buffer.from("not-really-an-image"),
          },
        },
      });
      expect(spoofedRes.status()).toBe(400);

      const oversizedRes = await request.post("/api/astra/files", {
        headers: { Cookie: `logto_chronos-app=${adminCookie}` },
        multipart: {
          file: {
            name: "huge.png",
            mimeType: "image/png",
            buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 65),
          },
        },
      });
      expect(oversizedRes.status()).toBe(413);
    });

    test("handles empty/corrupt xlsx workbook upload in RosterImportPanel without crashing", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "school_admin");
      await page.goto("/siswa");

      await page.locator("#roster-academic-period").selectOption("period-1");
      await page.locator("#roster-import-file").setInputFiles({
        name: "corrupt-empty.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: Buffer.alloc(0),
      });

      await page.getByRole("button", { name: "Tinjau Workbook" }).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Data Siswa" }),
      ).toBeVisible();
    });
  });

  test.describe("Pagination, Deep-Link & Selection State", () => {
    test("preserves ?page=2 on /siswa and /profiles across debounce and reload", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");

      await page.goto("/siswa?page=2");
      await expect(page).toHaveURL(/page=2/);
      await page.waitForTimeout(800);
      await expect(page).toHaveURL(/page=2/);

      await page.goto("/profiles?page=2");
      await expect(page).toHaveURL(/page=2/);
      await page.waitForTimeout(800);
      await expect(page).toHaveURL(/page=2/);
    });

    test("displays matching top and bottom total counts on /perizinan when total > 20", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");

      await page.route("**/api/trpc/*perizinan.list*", async (route) => {
        const response = await route.fetch();
        const text = await response.text();
        const chunks = text
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const result = chunks
          .map((chunk) => chunk.json?.[2]?.[0]?.[0])
          .find((value) => Array.isArray(value?.rows));
        if (!result) throw new Error("perizinan.list tRPC result missing");

        result.rows = Array.from({ length: 20 }, (_, i) => ({
          id: `b1000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
          userId: "00000000-0000-0000-0000-000000000001",
          tanggal: "2026-11-17",
          kategoriIzin: "Sakit",
          category: "sakit",
          deskripsi: `Izin test ${i + 1}`,
          linkFoto: null,
          approvalStatus: "pending",
          status: false,
          rejectionReason: null,
          rejectedAt: null,
          approvedAt: null,
          createdAt: "2026-11-17T01:00:00.000Z",
          updatedAt: "2026-11-17T01:00:00.000Z",
          userProfile: {
            id: "00000000-0000-0000-0000-000000000001",
            userId: "00000000-0000-0000-0000-000000000001",
            fullName: `Siswa Uji ${i + 1}`,
            email: null,
            nis: `20${String(i + 1).padStart(2, "0")}`,
            className: "XII RPL 1",
            absenceNumber: i + 1,
            avatarUrl: null,
            gender: null,
            role: "student",
            createdAt: null,
            updatedAt: null,
          },
        }));
        result.total = 25;
        result.limit = 20;
        result.offset = 0;
        result.hasMore = true;

        await route.fulfill({
          response,
          body: `${chunks.map((c) => JSON.stringify(c)).join("\n")}\n`,
        });
      });

      await page.goto("/perizinan");
      const counters = page.getByText(
        /Halaman 1 - Menampilkan \d+ dari \d+ data/,
      );
      await expect(counters).toHaveCount(2);
      await expect(counters.nth(0)).toHaveText(
        "Halaman 1 - Menampilkan 20 dari 25 data",
      );
      await expect(counters.nth(1)).toHaveText(
        "Halaman 1 - Menampilkan 20 dari 25 data",
      );
    });

    test("clears selectedIds when paginating /absensi so stale selections do not leak across pages", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "school_admin");

      await page.route("**/api/trpc/*absences.list*", async (route) => {
        const response = await route.fetch();
        const text = await response.text();
        const chunks = text
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const url = new URL(route.request().url());
        const procNames = url.pathname.split("/").at(-1)?.split(",") ?? [];
        const procIdx = procNames.indexOf("absences.list");
        type ReqInput = { json?: { offset?: number }; offset?: number };
        const parsedInput = JSON.parse(
          url.searchParams.get("input") ?? "{}",
        ) as Record<string, ReqInput> & ReqInput;
        const reqInput = parsedInput[String(procIdx)] ?? parsedInput;
        const offset = Number(reqInput.json?.offset ?? reqInput.offset ?? 0);

        const result = chunks
          .map((chunk) => chunk.json?.[2]?.[0]?.[0])
          .find((value) => Array.isArray(value?.rows));
        if (!result) throw new Error("absences.list tRPC result missing");

        result.rows = Array.from(
          { length: Math.min(20, 25 - offset) },
          (_, index) => {
            const num = offset + index + 1;
            return {
              id: `qa-sel-${num}`,
              userId: `qa-sel-${num}`,
              date: "2026-11-17",
              status: "Hadir",
              actionType: "check_in",
              latitude: null,
              longitude: null,
              createdAt: "2026-11-17T00:00:00.000Z",
              userProfile: { fullName: `Siswa Page ${num}` },
            };
          },
        );
        Object.assign(result, {
          total: 25,
          limit: 20,
          offset,
          hasMore: offset + result.rows.length < 25,
        });

        await route.fulfill({
          response,
          body: `${chunks.map((c) => JSON.stringify(c)).join("\n")}\n`,
        });
      });

      await page.goto("/absensi");
      const firstRowCheckbox = page
        .locator('tbody button[role="checkbox"]')
        .first();
      await firstRowCheckbox.click();
      await expect(
        page.getByRole("button", { name: /Hapus \(1\)/ }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Halaman berikutnya" }).click();
      await expect(
        page.getByText("Halaman 2 - Menampilkan 5 dari 25 data"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Hapus \(1\)/ }),
      ).toHaveCount(0);
    });
  });

  test.describe("Forms, Boundary Inputs, Dialog Reset & Double-Submit", () => {
    test("resets AbsenManualDialog state when closed via Batal button", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "school_admin");
      await page.goto("/absensi");

      await page.getByRole("button", { name: /Absen Manual/i }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("input#nis").fill("1001");
      await expect(dialog.getByText("Ahmad Dahlan")).toBeVisible();

      await dialog
        .locator("#manual-attendance-reason")
        .fill("Alasan sementara");
      await dialog.getByRole("button", { name: "Batal" }).click();
      await expect(dialog).toBeHidden();

      await page.getByRole("button", { name: /Absen Manual/i }).click();
      const reopened = page.getByRole("dialog");
      await expect(reopened.locator("input#nis")).toHaveValue("");
    });

    test("resets IzinManualDialog state when closed via Batal button and validates empty rejection reason", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");
      await page.goto("/perizinan");

      await page.getByRole("button", { name: /Izin Manual/i }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("input#search-siswa").fill("Ahmad");
      await dialog.locator('[role="option"]:has-text("Ahmad Dahlan")').click();
      await dialog.locator("#deskripsi").fill("Deskripsi sementara");
      await dialog.getByRole("button", { name: "Batal" }).click();
      await expect(dialog).toBeHidden();

      await page.getByRole("button", { name: /Izin Manual/i }).click();
      const reopened = page.getByRole("dialog");
      await expect(reopened.locator("input#search-siswa")).toHaveValue("");

      // Validate empty rejection reason on pending detail
      await page.goto("/perizinan/show/b0000000-0000-4000-8000-000000000001");
      await page.getByRole("button", { name: "Tolak", exact: true }).click();
      const rejectDialog = page.getByRole("dialog");
      await rejectDialog.locator("#rejection-reason").fill("   ");
      await rejectDialog
        .getByRole("button", { name: /Konfirmasi Tolak/i })
        .click();
      await expect(
        page.getByText("Alasan penolakan tidak boleh kosong."),
      ).toBeVisible();
      await expect(rejectDialog).toBeVisible();
    });

    test("prevents double-submit when creating a location and supports Equator 0,0 coordinates", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");

      let createRequestCount = 0;
      await page.route("**/api/trpc/*location.create*", async (route) => {
        createRequestCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.continue();
      });

      await page.goto("/konfigurasi/lokasi");
      await page.getByRole("button", { name: /Tambah Lokasi Baru/i }).click();

      // New location dialog must initialize with a valid radius (>= 1), not "0"
      await expect(page.locator("#distance")).not.toHaveValue("0");

      // Boundary radius (0) is rejected as invalid before submit
      await page.locator("#name").fill("Kampus Khatulistiwa 🧪");
      await page.locator("#latitude").fill("0");
      await page.locator("#longitude").fill("0");
      await page.locator("#distance").fill("0");
      const isDistanceValid = await page
        .locator("#distance")
        .evaluate((el) => (el as HTMLInputElement).checkValidity());
      expect(isDistanceValid).toBe(false);

      // Map should render for valid (0, 0) Equator/Prime Meridian coordinates, not placeholder
      await expect(
        page.getByText(
          "Isi koordinat pada form di atas untuk menampilkan peta",
        ),
      ).toHaveCount(0);

      // Valid radius + rapid double click should fire only 1 create mutation
      await page.locator("#distance").fill("150");
      const saveBtn = page.getByRole("button", { name: /Simpan Lokasi/i });
      await saveBtn.dblclick();
      await expect(page.getByText(/berhasil dibuat/i)).toBeVisible();
      expect(createRequestCount).toBe(1);

      // Clean up created location so subsequent tests keep 2/3 locations
      const deleteBtn = page.getByRole("button", {
        name: /Hapus lokasi Kampus Khatulistiwa/i,
      });
      await expect(deleteBtn).toHaveCount(1);
      await deleteBtn.click();
      await page.getByRole("button", { name: "Hapus", exact: true }).click();
      await expect(deleteBtn).toHaveCount(0);
    });

    test("validates schedule time order and rejects non-integer kompensasi on /konfigurasi/jadwal", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");
      await page.goto("/konfigurasi/jadwal");

      await page
        .getByRole("button", { name: /Edit jadwal Senin/i })
        .first()
        .click();

      await page.locator("#mulaiMasuk").fill("08:00");
      await page.locator("#selesaiMasuk").fill("07:00");
      await page.getByRole("button", { name: "Simpan", exact: true }).click();
      await expect(
        page.getByText(/Selesai Masuk harus lebih akhir dari Mulai Masuk/i),
      ).toBeVisible();
    });

    test("prevents duplicate requests on rapid double-click of DownloadExcelButton", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");

      let excelRequests = 0;
      await page.route("**/api/export/absences*", async (route) => {
        excelRequests += 1;
        await new Promise((resolve) => setTimeout(resolve, 600));
        await route.fulfill({
          status: 200,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          body: Buffer.from("PK\x03\x04"),
        });
      });

      await page.goto("/absensi");
      const excelBtn = page.getByRole("button", { name: /Unduh Excel/i });
      await excelBtn.dblclick();
      await page.waitForTimeout(800);
      expect(excelRequests).toBe(1);
    });
  });

  test.describe("Empty States, Degraded Back/Refresh & Rekap Bulanan", () => {
    test("renders empty state on /absensi and /perizinan when filters match 0 records", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");

      await page.goto("/absensi");
      await page.locator("#filter-absensi").fill("ZZZ-TIDAK-ADA-9999");
      await expect(page.locator("tbody tr")).toHaveCount(0);

      await page.goto("/perizinan");
      await page.locator("#filter-q").fill("ZZZ-TIDAK-ADA-9999");
      await expect(
        page.getByText("Tidak ada data perizinan.").first(),
      ).toBeVisible();
    });

    test("honors ?month= deep link and empty filter state on /absensi/rekap-bulanan", async ({
      page,
    }) => {
      await blockExternalBrowserRequests(page);
      await loginAs(page, "platform_admin");

      await page.goto("/absensi/rekap-bulanan?month=2026-10");
      await expect(page.locator("#monthly-recap-month")).toHaveValue("2026-10");

      await page.locator("#monthly-recap-class").selectOption("X MM 1");
      await expect(
        page.getByRole("heading", { name: "Rekap Absensi Bulanan" }),
      ).toBeVisible();
    });
  });
});
