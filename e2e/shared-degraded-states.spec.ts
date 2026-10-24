import { test, expect, loginAs } from "./fixtures/auth.ts";

/**
 * Shared degraded-state journeys (C09): identity-provider failures must be
 * distinguishable from a missing session, and the dashboard's Astra-backed
 * reads must own their error/retry state. Every fault is injected through the
 * local fixture controls (`/__control/logto`, `/__control/leave-requests`);
 * no live identity provider or Astra is contacted.
 */

const LOGTO_CONTROL = `http://127.0.0.1:${process.env.MOCK_LOGTO_PORT ?? "23501"}/__control/logto`;
const LEAVE_CONTROL = `http://127.0.0.1:${process.env.MOCK_ASTRA_PORT ?? "23500"}/__control/leave-requests`;

type LogtoFaultMode = "401" | "403" | "503" | "malformed" | "network";
type LogtoFaultTarget = "discovery" | "token";

async function armLogtoFault(
  mode: LogtoFaultMode | "off",
  target: LogtoFaultTarget = "token",
  failNext = 1,
): Promise<void> {
  const response = await fetch(LOGTO_CONTROL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, target, failNext }),
  });
  expect(response.ok).toBe(true);
}

async function armLeaveFault(mode: string, failNext = 1): Promise<void> {
  const response = await fetch(LEAVE_CONTROL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, failNext }),
  });
  expect(response.ok).toBe(true);
}

async function disarmFaults(): Promise<void> {
  await armLogtoFault("off");
  await armLeaveFault("off");
}

const SIGN_IN_BUTTON = /Masuk dengan Akun Skanida/i;
const DEGRADED_AUTH_ALERT =
  "Layanan autentikasi sedang tidak tersedia. Coba lagi beberapa saat.";

test.describe("Shared degraded states (C09)", () => {
  test.afterEach(async () => {
    await disarmFaults();
  });

  test.describe("identity outcomes through the real sign-in flow", () => {
    test("keeps the existing unauthorized route for a provider-rejected session (token 401)", async ({
      page,
    }) => {
      await armLogtoFault("401", "token", 1);
      await page.goto("/login");
      await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
      await expect(page).toHaveURL(/\/login\?error=unauthorized$/);
      await expect(page.locator('p[role="alert"]')).toContainText(
        "Sesi tidak valid atau telah berakhir. Silakan login kembali.",
      );

      // Recovery: with the fault disarmed, the existing sign-in flow completes.
      await armLogtoFault("off");
      await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("keeps the existing forbidden route for a forbidden account (token 403)", async ({
      page,
    }) => {
      await armLogtoFault("403", "token", 1);
      await page.goto("/login");
      await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
      await expect(page).toHaveURL(/\/login\?error=forbidden_role$/);
      await expect(page.locator('p[role="alert"]')).toContainText(
        "Akun Anda tidak memiliki hak akses istimewa untuk masuk ke portal Chronos.",
      );
    });

    test("routes a provider 5xx to the identity-degraded state, never the login redirect", async ({
      page,
    }) => {
      await armLogtoFault("503", "token", 1);
      await page.goto("/login");
      await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
      await expect(page).toHaveURL(/\/auth\/unavailable/);
      const alert = page.locator('p[role="alert"]');
      await expect(alert).toContainText(DEGRADED_AUTH_ALERT);
      // The degraded state must not be presented as an expired session.
      await expect(page.locator('p[role="alert"]')).not.toContainText(
        "Sesi tidak valid",
      );

      // Recovery: retry returns to the existing authentication route and the
      // un-faulted sign-in flow completes into the portal.
      await armLogtoFault("off");
      await page
        .getByRole("link", { name: "Kembali ke halaman masuk" })
        .click();
      await expect(page).toHaveURL(/\/login$/);
      await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test("routes a malformed provider response to the identity-degraded state", async ({
      page,
    }) => {
      await armLogtoFault("malformed", "token", 1);
      await page.goto("/login");
      await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
      await expect(page).toHaveURL(/\/auth\/unavailable/);
      await expect(page.locator('p[role="alert"]')).toContainText(
        DEGRADED_AUTH_ALERT,
      );
    });

    test("routes a provider network failure to the identity-degraded state", async ({
      page,
    }) => {
      await armLogtoFault("network", "discovery", 1);
      await page.goto("/login");
      await page.getByRole("button", { name: SIGN_IN_BUTTON }).click();
      await expect(page).toHaveURL(/\/auth\/unavailable/);
      await expect(page.locator('p[role="alert"]')).toContainText(
        DEGRADED_AUTH_ALERT,
      );
    });

    test("an absent session keeps the existing login redirect while the provider is faulted", async ({
      page,
    }) => {
      // A genuinely absent session never reaches the provider during the
      // middleware/context check, so the existing authentication route holds.
      await armLogtoFault("network", "discovery", 1);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard$/);
    });
  });

  test.describe("dashboard dependency outcomes", () => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
      { width: 390, height: 844 },
    ]) {
      test.describe(`${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport });

        test("renders the responsive dashboard shell unchanged without faults", async ({
          page,
        }) => {
          await loginAs(page, "platform_admin");
          await page.goto("/dashboard");
          await expect(
            page.getByRole("heading", { name: "Dashboard Admin" }),
          ).toBeVisible();
          await expect(page.getByText("Perizinan Tertunda")).toBeVisible();
          await expect(page.getByText("Statistik Kehadiran")).toBeVisible();
        });

        test("shows the application-owned dependency error and recovers on retry", async ({
          page,
        }) => {
          await loginAs(page, "platform_admin");
          // The dashboard issues several Leave collection reads per render
          // (pending-perizinan table and attendance summary); fail all reads
          // in the faulted window so the table's read cannot race ahead.
          await armLeaveFault("503", 4);
          await page.goto("/dashboard");
          const alert = page.locator('p[role="alert"]');
          await expect(alert).toContainText(
            "Data dashboard sedang tidak tersedia. Coba lagi beberapa saat.",
          );
          // The failure must not be presented as an empty success.
          await expect(page.getByText("Perizinan Tertunda")).toHaveCount(0);
          await expect(
            page.getByText("Tidak ada perizinan yang menunggu persetujuan"),
          ).toHaveCount(0);

          // Recovery: the retry control re-runs the RSC data boundary once the
          // dependency is available again. The dashboard card's retry carries
          // its own accessible name; the attendance chart's separate retry
          // control must not be confused with it.
          await armLeaveFault("off");
          await page
            .getByRole("button", { name: "Muat ulang data dashboard" })
            .click();
          await expect(page.getByText("Perizinan Tertunda")).toBeVisible();
        });

        test("renders the authorization outcome without a retry control on 403", async ({
          page,
        }) => {
          await loginAs(page, "platform_admin");
          await armLeaveFault("403", 4);
          await page.goto("/dashboard");
          await expect(
            page.getByText(
              "Anda tidak memiliki izin untuk memuat data dashboard.",
            ),
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: "Muat ulang data dashboard" }),
          ).toHaveCount(0);
          await expect(page.getByText("Perizinan Tertunda")).toHaveCount(0);
        });
      });
    }
  });
});
