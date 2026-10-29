import {
  blockExternalBrowserRequests,
  test,
  expect,
  loginAs,
} from "./fixtures/auth.ts";
import AxeBuilder from "@axe-core/playwright";

const OWNED_ROUTES = [
  "/dashboard",
  "/absensi",
  "/absensi/perkelas",
  "/absensi/rekap-bulanan",
  "/perizinan",
  "/perizinan/show/b0000000-0000-4000-8000-000000000001",
  "/profiles",
  "/profiles/show/00000000-0000-0000-0000-000000000001",
  "/siswa",
  "/konfigurasi/jadwal",
  "/konfigurasi/lokasi",
];

test.describe("Responsive & Accessibility Quality Gates", () => {
  test.beforeEach(async ({ page }) => {
    await blockExternalBrowserRequests(page);
    await loginAs(page, "platform_admin");
  });

  for (const routePath of OWNED_ROUTES) {
    test.describe(`Route: ${routePath}`, () => {
      test(`verifies lang="id", horizontal containment & clipping, nested controls, axe, and keyboard focus`, async ({
        page,
      }, testInfo) => {
        await page.goto(routePath);
        await page.waitForLoadState("domcontentloaded");

        if (routePath === "/absensi/perkelas") {
          await expect(
            page.getByRole("heading", { name: /Per Kelas/i }),
          ).toBeVisible();
        } else if (routePath === "/absensi/rekap-bulanan") {
          await expect(page.getByRole("table").first()).toBeVisible();
        } else if (routePath.startsWith("/perizinan/show/")) {
          await expect(
            page.getByTestId("perizinan-detail-loaded"),
          ).toBeVisible();
        } else if (routePath.startsWith("/profiles/show/")) {
          await expect(page.getByTestId("profile-detail-loaded")).toBeVisible();
        }

        const statusLabelsByRoute: Record<string, RegExp> = {
          "/perizinan": /^(Disetujui|Ditolak|Menunggu)$/,
          "/siswa": /^(Aktif|Belum Aktif)$/,
          "/konfigurasi/jadwal": /^(Aktif|Nonaktif)$/,
          "/konfigurasi/lokasi": /^(Aktif|Nonaktif)$/,
        };
        const expectedStatusLabel = statusLabelsByRoute[routePath];
        if (expectedStatusLabel) {
          await expect(
            page.getByText(expectedStatusLabel).first(),
            `Status on ${routePath} must have a text label independent of color`,
          ).toBeVisible();
        }

        // 1. Validate document language
        const lang = await page.evaluate(() =>
          document.documentElement.getAttribute("lang"),
        );
        expect(lang).toBe("id");

        // 2. Validate horizontal overflow containment (no page-level horizontal scrolling)
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const innerWidth = window.innerWidth;
          return {
            docScrollWidth: docEl.scrollWidth,
            bodyScrollWidth: body.scrollWidth,
            innerWidth,
            hasDocOverflow: docEl.scrollWidth > innerWidth + 1,
            hasBodyOverflow: body.scrollWidth > innerWidth + 1,
          };
        });
        expect(
          overflow.hasDocOverflow,
          `Document horizontal overflow detected: docScrollWidth=${overflow.docScrollWidth}, innerWidth=${overflow.innerWidth}`,
        ).toBe(false);
        expect(
          overflow.hasBodyOverflow,
          `Body horizontal overflow detected: bodyScrollWidth=${overflow.bodyScrollWidth}, innerWidth=${overflow.innerWidth}`,
        ).toBe(false);

        // 3. Detect uncontained content clipping masked by overflow-x-hidden:
        // Visible owned content containers must not bleed past window.innerWidth unless within an intentional horizontal scroll container.
        const clippingViolations = await page.evaluate(() => {
          const innerWidth = window.innerWidth;
          const targets = document.querySelectorAll(
            "main, main > *, [role='region'], .card, [data-slot='card']",
          );
          const clipped: Array<{
            tag: string;
            id: string;
            className: string;
            right: number;
            innerWidth: number;
          }> = [];

          for (const el of targets) {
            if (!(el instanceof HTMLElement)) continue;
            if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;
            const style = window.getComputedStyle(el);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              style.opacity === "0"
            ) {
              continue;
            }

            // If the element itself is an intentional scroll container, check that the container itself fits
            const rect = el.getBoundingClientRect();
            // Allow 2px tolerance for subpixel antialiasing/scrollbar variance
            if (rect.right > innerWidth + 2) {
              clipped.push({
                tag: el.tagName,
                id: el.id,
                className: el.className.slice(0, 60),
                right: Math.round(rect.right),
                innerWidth,
              });
            }
          }
          return clipped;
        });

        expect(
          clippingViolations,
          `Visible owned content clipped beyond viewport on ${routePath}: ${JSON.stringify(clippingViolations, null, 2)}`,
        ).toEqual([]);

        // 4. Validate no nested interactive elements (WCAG 4.1.2)
        const nestedInteractiveCount = await page.evaluate(() => {
          const interactives = Array.from(
            document.querySelectorAll(
              "button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='link']",
            ),
          );
          let count = 0;
          for (const el of interactives) {
            const parentInteractive = el.parentElement?.closest(
              "button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='link']",
            );
            if (parentInteractive) {
              count++;
            }
          }
          return count;
        });
        expect(
          nestedInteractiveCount,
          `Found ${nestedInteractiveCount} nested interactive controls on ${routePath}`,
        ).toBe(0);

        const stableLayout = await page.addStyleTag({
          content:
            "*, *::before, *::after { animation: none !important; transition: none !important; }",
        });
        await page.locator("html").evaluate((element) => {
          element.classList.remove("dark");
        });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            ),
        );

        // 5. Automated WCAG Accessibility scan with Axe (failing on serious or critical only)
        const axeResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();

        const seriousOrCritical = axeResults.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        expect(
          seriousOrCritical,
          `Axe WCAG violations (serious/critical) on ${routePath}: ${JSON.stringify(seriousOrCritical, null, 2)}`,
        ).toEqual([]);

        await page
          .locator("html")
          .evaluate((element) => element.classList.add("dark"));
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            ),
        );
        const darkAxeResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          darkAxeResults.violations.filter(
            (violation) =>
              violation.impact === "serious" || violation.impact === "critical",
          ),
          `Dark theme axe violations on ${routePath}`,
        ).toEqual([]);
        await page
          .locator("html")
          .evaluate((element) => element.classList.remove("dark"));
        // 6. Keyboard tab navigation reachability
        await page.keyboard.press("Tab");
        const isFocusActive = await page.evaluate(() => {
          const active = document.activeElement;
          return (
            !!active &&
            active !== document.body &&
            active !== document.documentElement
          );
        });
        expect(isFocusActive).toBe(true);

        if (testInfo.project.name === "mobile") {
          await page.setViewportSize({ width: 640, height: 844 });
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              ),
          );
          const textZoomLayout = await page.evaluate(() => {
            const innerWidth = window.innerWidth;
            const clipped = Array.from(
              document.querySelectorAll<HTMLElement>(
                "main, main > *, [role='region'], [data-slot='card']",
              ),
            ).some((element) => {
              const style = getComputedStyle(element);
              if (
                element.offsetWidth === 0 ||
                element.offsetHeight === 0 ||
                style.display === "none" ||
                style.visibility === "hidden" ||
                style.opacity === "0"
              ) {
                return false;
              }
              const rect = element.getBoundingClientRect();
              return rect.left < -2 || rect.right > innerWidth + 2;
            });
            return {
              docScrollWidth: document.documentElement.scrollWidth,
              bodyScrollWidth: document.body.scrollWidth,
              innerWidth,
              clipped,
            };
          });
          expect(
            textZoomLayout.docScrollWidth,
            `Document overflows at 200% text on ${routePath}: ${JSON.stringify(textZoomLayout)}`,
          ).toBeLessThanOrEqual(textZoomLayout.innerWidth + 1);
          expect(
            textZoomLayout.bodyScrollWidth,
            `Body overflows at 200% text on ${routePath}: ${JSON.stringify(textZoomLayout)}`,
          ).toBeLessThanOrEqual(textZoomLayout.innerWidth + 1);
          expect(
            textZoomLayout.clipped,
            `Visible content is clipped at 200% text on ${routePath}`,
          ).toBe(false);
          await page.evaluate(() => {
            document.documentElement.style.removeProperty("font-size");
          });
          await page.setViewportSize({ width: 320, height: 844 });
          await page.evaluate(
            () =>
              new Promise<void>((resolve) =>
                requestAnimationFrame(() => resolve()),
              ),
          );
          const undersizedTargets = await page.evaluate(() =>
            Array.from(
              document.querySelectorAll<HTMLElement>(
                "main button:not(:disabled), main a[href], main input:not([type=hidden]), main select, main textarea, main [role=button], main [role=link]",
              ),
            )
              .filter((element) => {
                const style = getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                const after = getComputedStyle(element, "::after");
                const inset = (value: string) => Number.parseFloat(value) || 0;
                const hitWidth = Math.max(
                  rect.width,
                  rect.width - inset(after.left) - inset(after.right),
                );
                const hitHeight = Math.max(
                  rect.height,
                  rect.height - inset(after.top) - inset(after.bottom),
                );
                return (
                  rect.width > 0 &&
                  rect.height > 0 &&
                  style.display !== "none" &&
                  style.visibility !== "hidden" &&
                  (hitWidth < 44 || hitHeight < 44)
                );
              })
              .map((element) => ({
                text: element.innerText.trim().slice(0, 60),
                ariaLabel: element.getAttribute("aria-label"),
                width: Math.round(element.getBoundingClientRect().width),
                height: Math.round(element.getBoundingClientRect().height),
                minWidth: getComputedStyle(element).minWidth,
                minHeight: getComputedStyle(element).minHeight,
              })),
          );
          expect(
            undersizedTargets,
            `Visible primary touch targets are below 44×44 CSS px on ${routePath}`,
          ).toEqual([]);
          const narrowLayout = await page.evaluate(() => {
            const innerWidth = window.innerWidth;
            const clipped = Array.from(
              document.querySelectorAll<HTMLElement>(
                "main, main > *, [role='region'], .card, [data-slot='card']",
              ),
            )
              .filter((element) => {
                const style = window.getComputedStyle(element);
                if (
                  element.offsetWidth === 0 ||
                  element.offsetHeight === 0 ||
                  style.display === "none" ||
                  style.visibility === "hidden" ||
                  style.opacity === "0"
                ) {
                  return false;
                }
                const rect = element.getBoundingClientRect();
                return rect.left < -2 || rect.right > innerWidth + 2;
              })
              .map((element) => ({
                tag: element.tagName,
                id: element.id,
                className: element.className.toString().slice(0, 100),
                left: Math.round(element.getBoundingClientRect().left),
                right: Math.round(element.getBoundingClientRect().right),
              }));
            return {
              docScrollWidth: document.documentElement.scrollWidth,
              bodyScrollWidth: document.body.scrollWidth,
              innerWidth,
              clipped,
            };
          });
          expect(
            narrowLayout.docScrollWidth,
            `Document overflows at 320 CSS px on ${routePath}: ${JSON.stringify(narrowLayout)}`,
          ).toBeLessThanOrEqual(narrowLayout.innerWidth + 1);
          expect(
            narrowLayout.bodyScrollWidth,
            `Body overflows at 320 CSS px on ${routePath}: ${JSON.stringify(narrowLayout)}`,
          ).toBeLessThanOrEqual(narrowLayout.innerWidth + 1);
          expect(
            narrowLayout.clipped,
            `Visible content is clipped at 320 CSS px on ${routePath}`,
          ).toEqual([]);
        }
        await stableLayout.evaluate((style) =>
          style.parentNode?.removeChild(style),
        );
      });
    });
  }

  for (const role of ["teacher", "staff"] as const) {
    for (const routePath of ["/dashboard", "/absensi", "/perizinan"]) {
      test(`${role} accessibility on ${routePath}`, async ({
        page,
      }, testInfo) => {
        await loginAs(page, role);
        await page.goto(routePath);
        await expect(page).toHaveURL((url) =>
          url.pathname.startsWith(routePath),
        );
        if (routePath === "/absensi" || routePath === "/perizinan") {
          await expect(page.getByRole("table").first()).toBeVisible();
          await expect(
            page.getByRole("button", { name: "Unduh Excel" }),
          ).toBeEnabled();
        }
        await expect(page.locator("html")).toHaveAttribute("lang", "id");

        const axeResults = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          axeResults.violations.filter(
            (violation) =>
              violation.impact === "serious" || violation.impact === "critical",
          ),
        ).toEqual([]);

        await page.keyboard.press("Tab");
        expect(
          await page.evaluate(
            () =>
              !!document.activeElement &&
              document.activeElement !== document.body &&
              document.activeElement !== document.documentElement,
          ),
        ).toBe(true);

        if (testInfo.project.name === "mobile") {
          await page.setViewportSize({ width: 320, height: 844 });
          await expect
            .poll(() =>
              page.evaluate(() => document.documentElement.scrollWidth),
            )
            .toBeLessThanOrEqual(321);
        }
      });
    }
  }

  test.describe("Interactive Modals & Components A11y", () => {
    test("Izin manual dialog combobox, keyboard upload, and modal accessibility", async ({
      page,
    }) => {
      await page.goto("/perizinan");
      await page.waitForLoadState("domcontentloaded");

      // Open manual leave dialog
      const openButton = page.getByRole("button", {
        name: /Buat Izin Manual|Izin Manual/i,
      });
      await expect(openButton).toBeVisible();
      await openButton.click();

      // Verify dialog is open
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Check combobox input semantics and keyboard arrow/enter navigation
      const combobox = page.locator('input[role="combobox"]');
      await expect(combobox).toBeVisible();
      await expect(combobox).toHaveAttribute("aria-autocomplete", "list");

      // Type search query to trigger combobox dropdown
      await combobox.fill("Ahmad");
      const listbox = page.locator('[role="listbox"]');
      await expect(listbox).toBeVisible();

      // Navigate options using ArrowDown and select with Enter
      await expect(page.locator('[role="option"]').first()).toBeVisible();
      await combobox.press("ArrowDown");
      const firstOption = page.locator('[role="option"]').first();
      await expect(firstOption).toHaveAttribute("aria-selected", "true");

      await combobox.press("Enter");
      // Selected alert indicator confirms student chosen
      await expect(page.getByText(/NIS: 1001/i)).toBeVisible();

      // Check file upload trigger button matching actual UI ("Upload Foto")
      const uploadTrigger = page.getByRole("button", {
        name: /Upload Foto/i,
      });
      await expect(uploadTrigger).toBeVisible();

      // Run Axe on open modal dialog
      const axeDialogResults = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const modalViolations = axeDialogResults.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(modalViolations).toEqual([]);

      // Press Escape to dismiss dialog
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden({ timeout: 5000 });
      await expect(openButton).toBeFocused();
    });

    test("Konfigurasi Jadwal reset triggers AlertDialog instead of native confirm", async ({
      page,
    }) => {
      await page.goto("/konfigurasi/jadwal");
      await page.waitForLoadState("domcontentloaded");

      // Check that native window.confirm is not invoked
      page.on("dialog", (d) => {
        throw new Error(`Unexpected native dialog displayed: ${d.message()}`);
      });

      const resetButton = page.getByRole("button", {
        name: /Reset Semua|Reset/i,
      });
      await expect(resetButton).toBeVisible();
      await resetButton.click();

      // Expect Radix AlertDialogContent to open
      const alertModal = page.locator('[role="alertdialog"]');
      await expect(alertModal).toBeVisible();
      await expect(
        alertModal.getByRole("heading", { name: /Reset Jadwal ke Default/i }),
      ).toBeVisible();

      // Dismiss via cancel button
      const cancelButton = alertModal.getByRole("button", { name: /Batal/i });
      await cancelButton.click();
      await expect(alertModal).toBeHidden();
    });
  });
});
