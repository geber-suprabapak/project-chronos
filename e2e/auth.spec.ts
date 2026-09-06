import { test, expect, loginAs } from "./fixtures/auth.ts";

test.describe("Authentication, Session & Route Protection", () => {
  test.describe("Unauthenticated Access & Route Guards", () => {
    const protectedRoutes = [
      { path: "/dashboard", expectedRedirect: "/login?redirect=%2Fdashboard" },
      { path: "/siswa", expectedRedirect: "/login?redirect=%2Fsiswa" },
      { path: "/absensi", expectedRedirect: "/login?redirect=%2Fabsensi" },
      { path: "/perizinan", expectedRedirect: "/login?redirect=%2Fperizinan" },
      { path: "/profiles", expectedRedirect: "/login?redirect=%2Fprofiles" },
      {
        path: "/konfigurasi/lokasi",
        expectedRedirect: "/login?redirect=%2Fkonfigurasi%2Flokasi",
      },
      {
        path: "/konfigurasi/jadwal",
        expectedRedirect: "/login?redirect=%2Fkonfigurasi%2Fjadwal",
      },
    ];

    for (const { path, expectedRedirect } of protectedRoutes) {
      test(`redirects unauthenticated user from ${path} to login`, async ({
        page,
      }) => {
        await page.goto(path);
        await expect(page).toHaveURL(
          new RegExp(expectedRedirect.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        );
        await expect(
          page.getByRole("button", { name: /Masuk dengan Akun Skanida/i }),
        ).toBeVisible();
      });
    }
  });

  test.describe("Login Error Banners", () => {
    test("renders MFA required error banner on /login?error=mfa_required", async ({
      page,
    }) => {
      await page.goto("/login?error=mfa_required");
      const alert = page.locator('p[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(
        "Autentikasi Multi-Faktor (MFA) wajib untuk akun administrator",
      );
    });

    test("renders forbidden role error banner on /login?error=forbidden_role", async ({
      page,
    }) => {
      await page.goto("/login?error=forbidden_role");
      const alert = page.locator('p[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(
        "Akun Anda tidak memiliki hak akses istimewa untuk masuk ke portal Chronos.",
      );
    });

    test("renders unauthorized session error banner on /login?error=unauthorized", async ({
      page,
    }) => {
      await page.goto("/login?error=unauthorized");
      const alert = page.locator('p[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(
        "Sesi tidak valid atau telah berakhir. Silakan login kembali.",
      );
    });

    test("renders invalid credentials error banner on /login?error=invalid_credentials", async ({
      page,
    }) => {
      await page.goto("/login?error=invalid_credentials");
      const alert = page.locator('p[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("Email atau password tidak valid.");
    });
  });

  test.describe("Authenticated Session Persistence & Cross-Navigation", () => {
    test("authenticates as platform_admin and navigates across portal routes without session loss", async ({
      page,
    }) => {
      await loginAs(page, "platform_admin");

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(
        page.getByRole("heading", { name: "Dashboard Admin" }),
      ).toBeVisible();

      // Navigate to Siswa
      await page.goto("/siswa");
      await expect(page).toHaveURL(/\/siswa/);
      await expect(
        page.getByRole("heading", { name: "Data Siswa" }),
      ).toBeVisible();

      // Navigate to Absensi
      await page.goto("/absensi");
      await expect(page).toHaveURL(/\/absensi/);
      await expect(
        page.getByRole("heading", { name: /Absensi/i }),
      ).toBeVisible();

      // Navigate to Perizinan
      await page.goto("/perizinan");
      await expect(page).toHaveURL(/\/perizinan/);
      await expect(page.getByText("Daftar Perizinan")).toBeVisible();

      // Navigate to Profiles
      await page.goto("/profiles");
      await expect(page).toHaveURL(/\/profiles/);
      await expect(
        page.getByRole("heading", { name: /Profil Pengguna|User Profiles/i }),
      ).toBeVisible();

      // Navigate to Konfigurasi Lokasi
      await page.goto("/konfigurasi/lokasi");
      await expect(page).toHaveURL(/\/konfigurasi\/lokasi/);
      await expect(
        page.getByRole("heading", { name: /Lokasi/i }),
      ).toBeVisible();
    });

    test("authenticates as teacher and verifies access to allowed routes", async ({
      page,
    }) => {
      await loginAs(page, "teacher");

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(
        page.getByRole("heading", { name: /Dashboard/i }),
      ).toBeVisible();

      await page.goto("/absensi");
      await expect(page).toHaveURL(/\/absensi/);
      await expect(
        page.getByRole("heading", { name: /Absensi/i }),
      ).toBeVisible();
    });

    test("authenticates as staff and verifies access to operational routes", async ({
      page,
    }) => {
      await loginAs(page, "staff");

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(
        page.getByRole("heading", { name: /Dashboard/i }),
      ).toBeVisible();

      await page.goto("/absensi");
      await expect(page).toHaveURL(/\/absensi/);
      await expect(
        page.getByRole("heading", { name: /Absensi/i }),
      ).toBeVisible();
    });

    test("redirects teacher from admin-only routes (/konfigurasi/lokasi, /profiles) to /dashboard", async ({
      page,
    }) => {
      await loginAs(page, "teacher");

      await page.goto("/konfigurasi/lokasi");
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goto("/profiles");
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("enforces sidebar navigation visibility between teacher and admin", async ({
      page,
    }) => {
      // Teacher sidebar check
      await loginAs(page, "teacher");
      await page.goto("/dashboard");
      const sidebar = page.locator('[data-slot="sidebar"]');
      await expect(
        sidebar.getByText(/(?:Profil Pengguna|Profiles)/i),
      ).not.toBeVisible();
      await expect(sidebar.getByText("Konfigurasi")).not.toBeVisible();
      await expect(sidebar.getByText("Data Siswa")).toBeVisible();
      await expect(
        sidebar.getByRole("link", { name: "Absensi", exact: true }),
      ).toBeVisible();

      // Platform admin sidebar check
      await loginAs(page, "platform_admin");
      await page.goto("/dashboard");
      await expect(
        sidebar.getByText(/(?:Profil Pengguna|Profiles)/i),
      ).toBeVisible();
      await expect(sidebar.getByText("Konfigurasi")).toBeVisible();
    });

    test("verifies absensi page hides manual attendance and delete actions for teacher", async ({
      page,
    }) => {
      await loginAs(page, "teacher");
      await page.goto("/absensi");
      await expect(page).toHaveURL(/\/absensi/);

      // Manual attendance button should NOT be visible
      await expect(
        page.getByRole("button", { name: /Absen Manual/i }),
      ).not.toBeVisible();

      // Hapus column header should NOT be visible
      await expect(
        page.getByRole("columnheader", { name: /Aksi/i }),
      ).not.toBeVisible();
    });

    test("authenticates legacy admin role and grants access to admin routes", async ({
      page,
    }) => {
      await loginAs(page, "admin");
      await page.goto("/konfigurasi/lokasi");
      await expect(page).toHaveURL(/\/konfigurasi\/lokasi/);
      await expect(
        page.getByRole("heading", { name: /Lokasi/i }),
      ).toBeVisible();
    });
  });

  test.describe("Role Isolation & Forbidden Student Access", () => {
    test("redirects unprivileged student account to /login?error=forbidden_role", async ({
      page,
    }) => {
      await loginAs(page, "student");

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?error=forbidden_role/);
      const alert = page.locator('p[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(
        "Akun Anda tidak memiliki hak akses istimewa",
      );
    });

    test("redirects unprivileged legacy siswa account to /login?error=forbidden_role", async ({
      page,
    }) => {
      await loginAs(page, "siswa");

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?error=forbidden_role/);
      const alert = page.locator('p[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(
        "Akun Anda tidak memiliki hak akses istimewa",
      );
    });
  });

  test.describe("Password Change Workflow & Redirection", () => {
    test("forces users with must_change_password=true to /ganti-password", async ({
      page,
    }) => {
      await loginAs(page, "must_change_password");

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/ganti-password/);
      await expect(
        page.getByRole("heading", { name: "Ganti Password" }),
      ).toBeVisible();
    });

    test("validates password length and matching in /ganti-password form", async ({
      page,
    }) => {
      await loginAs(page, "must_change_password");
      await page.goto("/ganti-password");

      // Short password test
      await page.fill("#new-password", "short");
      await page.fill("#confirm-password", "short");
      await page.click(
        'button[type="submit"]:has-text("Simpan Password Baru")',
      );

      const alert = page.locator('p[role="alert"]');
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("Password minimal 8 karakter.");

      // Password mismatch test
      await page.fill("#new-password", "newpassword123");
      await page.fill("#confirm-password", "differentpassword123");
      await page.click(
        'button[type="submit"]:has-text("Simpan Password Baru")',
      );

      await expect(alert).toBeVisible();
      await expect(alert).toContainText("Konfirmasi password tidak cocok.");
    });

    test("submits valid password change and initiates sign-out flow", async ({
      page,
    }) => {
      await loginAs(page, "must_change_password");
      await page.goto("/ganti-password");

      await page.fill("#new-password", "newSecurePassword123!");
      await page.fill("#confirm-password", "newSecurePassword123!");
      await page.click(
        'button[type="submit"]:has-text("Simpan Password Baru")',
      );

      // Successful password change triggers sign-out redirect to /login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Sign-Out Flow", () => {
    test("signs out via /api/logto/sign-out and clears session", async ({
      page,
    }) => {
      await loginAs(page, "platform_admin");
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);

      // Navigate to sign-out endpoint
      await page.goto("/api/logto/sign-out");
      await expect(page).toHaveURL(/\/login/);

      // Verify protected route now bounces back to login
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
    });
  });
});
