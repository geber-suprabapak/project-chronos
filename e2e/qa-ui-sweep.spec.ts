import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, loginAs, test } from "./fixtures/auth.ts";

const SCREENSHOT_DIR =
  process.env.QA_SCREENSHOT_DIR ??
  path.join(process.cwd(), "test-results", "qa-screenshots");

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

interface RouteTarget {
  slug: string;
  path: string;
  role: "anonymous" | "platform_admin" | "must_change_password";
  waitForReady: (page: Page) => Promise<void>;
}

const ROUTES: RouteTarget[] = [
  {
    slug: "login",
    path: "/login",
    role: "anonymous",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("button", { name: /Masuk dengan Akun Skanida/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "auth-unavailable",
    path: "/auth/unavailable",
    role: "anonymous",
    waitForReady: async (page) => {
      await expect(
        page.getByText(/Layanan autentikasi tidak tersedia/i),
      ).toBeVisible();
    },
  },
  {
    slug: "ganti-password",
    path: "/ganti-password",
    role: "must_change_password",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Ganti Password Pertama/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "dashboard",
    path: "/dashboard",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Dashboard/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "absensi",
    path: "/absensi",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Daftar Absensi/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "absensi-perkelas",
    path: "/absensi/perkelas",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Absensi Per Kelas/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "absensi-rekap-bulanan",
    path: "/absensi/rekap-bulanan",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Rekap Absensi Bulanan/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "perizinan",
    path: "/perizinan",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.locator('[data-slot="card-title"]', {
          hasText: "Daftar Perizinan",
        }),
      ).toBeVisible();
    },
  },
  {
    slug: "perizinan-detail",
    path: "/perizinan/show/b0000000-0000-4000-8000-000000000001",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(page.getByTestId("perizinan-detail-loaded")).toBeVisible();
    },
  },
  {
    slug: "profiles",
    path: "/profiles",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Profil Pengguna/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "profiles-detail",
    path: "/profiles/show/00000000-0000-0000-0000-000000000001",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(page.getByTestId("profile-detail-loaded")).toBeVisible();
    },
  },
  {
    slug: "siswa",
    path: "/siswa",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Data Siswa/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "konfigurasi-lokasi",
    path: "/konfigurasi/lokasi",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Manajemen Lokasi Absensi/i }),
      ).toBeVisible();
    },
  },
  {
    slug: "konfigurasi-jadwal",
    path: "/konfigurasi/jadwal",
    role: "platform_admin",
    waitForReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Konfigurasi Jadwal Absensi/i }),
      ).toBeVisible();
    },
  },
];

const VIEWPORT_WIDTHS = [360, 768, 1440] as const;

async function routeExternalMediaCleanly(page: Page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const hostname = new URL(url).hostname;
    if (["localhost", "127.0.0.1", "::1"].includes(hostname)) {
      await route.continue();
      return;
    }
    const resourceType = route.request().resourceType();
    if (resourceType === "image" || /\.(png|jpg|jpeg|webp)$/i.test(url)) {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: TINY_PNG,
      });
      return;
    }
    await route.abort();
  });
}

test.describe("QA UI Sweep Across Main Routes & Breakpoints (360, 768, 1440)", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const width of VIEWPORT_WIDTHS) {
    for (const target of ROUTES) {
      test(`UI sweep ${target.path} at ${width}px`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        const failedSameOriginResponses: string[] = [];

        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text());
          }
        });
        page.on("pageerror", (err) => {
          pageErrors.push(err.message);
        });
        page.on("response", (res) => {
          const url = res.url();
          if (
            (url.startsWith("http://localhost:") ||
              url.startsWith("http://127.0.0.1:")) &&
            res.status() >= 400
          ) {
            failedSameOriginResponses.push(`${res.status()} ${url}`);
          }
        });

        await routeExternalMediaCleanly(page);
        await page.setViewportSize({
          width,
          height: width === 1440 ? 900 : width === 768 ? 1024 : 800,
        });

        if (target.role !== "anonymous") {
          await loginAs(page, target.role);
        }

        await page.goto(target.path, { waitUntil: "domcontentloaded" });
        await target.waitForReady(page);

        await page.addStyleTag({
          content:
            "*, *::before, *::after { animation: none !important; transition: none !important; }",
        });
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );

        const screenshotPath = path.join(
          SCREENSHOT_DIR,
          `qa-ui-${target.slug}-${width}px.png`,
        );
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // 1. Check horizontal overflow and clipping
        const layoutAudit = await page.evaluate(() => {
          const innerWidth = window.innerWidth;
          const docScrollWidth = document.documentElement.scrollWidth;
          const bodyScrollWidth = document.body.scrollWidth;

          // Broken images
          const brokenImages = Array.from(document.querySelectorAll("img"))
            .filter((img) => {
              const style = getComputedStyle(img);
              return style.display !== "none" && style.visibility !== "hidden";
            })
            .filter((img) => !img.complete || img.naturalWidth === 0)
            .map((img) => ({
              alt: img.alt,
              src: img.currentSrc || img.src,
            }));

          // Overlapping interactive elements in visible viewport
          const interactives = Array.from(
            document.querySelectorAll<HTMLElement>(
              "button, a[href], input:not([type='hidden']), select, textarea, [role='switch']",
            ),
          ).filter((el) => {
            if (el.closest(".sr-only") || el.classList.contains("sr-only")) {
              return false;
            }
            const style = getComputedStyle(el);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              style.opacity === "0"
            ) {
              return false;
            }
            const rect = el.getBoundingClientRect();
            return rect.width > 2 && rect.height > 2;
          });

          const overlaps: Array<{ a: string; b: string }> = [];
          for (let i = 0; i < interactives.length; i++) {
            const elA = interactives[i]!;
            const rA = elA.getBoundingClientRect();
            for (let j = i + 1; j < interactives.length; j++) {
              const elB = interactives[j]!;
              if (elA.contains(elB) || elB.contains(elA)) continue;
              // FilterBar intentionally positions a 24px calendar trigger inside #filter-date
              const isFilterDateTrigger =
                (elA.id === "filter-date" &&
                  (elB.innerText || "").includes("Pilih tanggal")) ||
                (elB.id === "filter-date" &&
                  (elA.innerText || "").includes("Pilih tanggal"));
              if (isFilterDateTrigger) continue;
              const rB = elB.getBoundingClientRect();
              const overlapW =
                Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left);
              const overlapH =
                Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top);
              if (overlapW > 4 && overlapH > 4) {
                overlaps.push({
                  a: (
                    elA.innerText ||
                    elA.getAttribute("aria-label") ||
                    elA.tagName
                  ).slice(0, 40),
                  b: (
                    elB.innerText ||
                    elB.getAttribute("aria-label") ||
                    elB.tagName
                  ).slice(0, 40),
                });
              }
            }
          }

          // Contrast check on primary text headings/paragraphs/cells
          const colorCanvas = document.createElement("canvas");
          colorCanvas.width = 1;
          colorCanvas.height = 1;
          const colorCtx = colorCanvas.getContext("2d", {
            willReadFrequently: true,
          });
          function parseRgba(
            str: string,
          ): [number, number, number, number] | null {
            if (!str || str === "transparent" || str === "rgba(0, 0, 0, 0)") {
              return [0, 0, 0, 0];
            }
            if (colorCtx) {
              colorCtx.clearRect(0, 0, 1, 1);
              colorCtx.fillStyle = "rgba(0, 0, 0, 0)";
              colorCtx.fillStyle = str;
              colorCtx.fillRect(0, 0, 1, 1);
              const data = colorCtx.getImageData(0, 0, 1, 1).data;
              return [data[0]!, data[1]!, data[2]!, data[3]! / 255];
            }
            const m =
              /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/i.exec(
                str,
              );
            if (!m) return null;
            return [
              Number(m[1]),
              Number(m[2]),
              Number(m[3]),
              m[4] === undefined ? 1 : Number(m[4]),
            ];
          }
          function luminance(r: number, g: number, b: number) {
            const [rs, gs, bs] = [r, g, b].map((c) => {
              const v = c / 255;
              return v <= 0.03928
                ? v / 12.92
                : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
          }
          function contrast(
            fg: [number, number, number],
            bg: [number, number, number],
          ) {
            const l1 = luminance(fg[0], fg[1], fg[2]);
            const l2 = luminance(bg[0], bg[1], bg[2]);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          }
          function effectiveBg(el: Element): [number, number, number] {
            let cur: Element | null = el;
            while (cur) {
              const c = parseRgba(getComputedStyle(cur).backgroundColor);
              if (c && c[3] > 0.85) return [c[0], c[1], c[2]];
              cur = cur.parentElement;
            }
            return [255, 255, 255];
          }

          const contrastFailures: Array<{
            text: string;
            ratio: number;
            required: number;
          }> = [];
          const textEls = document.querySelectorAll<HTMLElement>(
            "h1, h2, h3, p, label, button, th, td",
          );
          for (const el of textEls) {
            if (el.closest(".sr-only") || el.classList.contains("sr-only")) {
              continue;
            }
            if (
              el.hasAttribute("disabled") ||
              el.getAttribute("aria-disabled") === "true"
            ) {
              continue;
            }
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) continue;
            const text = (el.innerText || "").trim();
            if (!text) continue;
            const st = getComputedStyle(el);
            if (
              st.display === "none" ||
              st.visibility === "hidden" ||
              Number(st.opacity) < 0.8
            ) {
              continue;
            }
            const fg = parseRgba(st.color);
            if (!fg) continue;
            const bg = effectiveBg(el);
            const ratio = contrast([fg[0], fg[1], fg[2]], bg);
            const fontSize = parseFloat(st.fontSize);
            const fontWeight = parseInt(st.fontWeight, 10) || 400;
            const isLarge =
              fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
            const required = isLarge ? 3.0 : 4.5;
            if (ratio < required) {
              contrastFailures.push({
                text: text.slice(0, 50),
                ratio: Number(ratio.toFixed(2)),
                required,
              });
            }
          }

          return {
            innerWidth,
            docScrollWidth,
            bodyScrollWidth,
            hasOverflow:
              docScrollWidth > innerWidth + 1 ||
              bodyScrollWidth > innerWidth + 1,
            brokenImages,
            overlaps,
            contrastFailures,
          };
        });

        // 2. Focus state check via Tab
        await page.keyboard.press("Tab");
        const focusAudit = await page.evaluate(() => {
          const active = document.activeElement as HTMLElement | null;
          if (
            !active ||
            active === document.body ||
            active === document.documentElement
          ) {
            return { focused: false, hasFocusIndicator: false };
          }
          const st = getComputedStyle(active);
          const hasOutline =
            st.outlineStyle !== "none" && parseFloat(st.outlineWidth) > 0;
          const hasShadow = st.boxShadow !== "none" && st.boxShadow !== "";
          return {
            focused: true,
            tag: active.tagName,
            hasFocusIndicator: hasOutline || hasShadow,
            outline: `${st.outlineWidth} ${st.outlineStyle}`,
            boxShadow: st.boxShadow,
          };
        });

        expect(
          pageErrors,
          `Uncaught pageerrors on ${target.path} (${width}px)`,
        ).toEqual([]);
        expect(
          failedSameOriginResponses,
          `Same-origin HTTP >=400 errors on ${target.path} (${width}px)`,
        ).toEqual([]);
        expect(
          consoleErrors,
          `Console errors on ${target.path} (${width}px)`,
        ).toEqual([]);
        expect(
          layoutAudit.hasOverflow,
          `Horizontal overflow on ${target.path} (${width}px): doc=${layoutAudit.docScrollWidth} body=${layoutAudit.bodyScrollWidth} inner=${layoutAudit.innerWidth}`,
        ).toBe(false);
        expect(
          layoutAudit.brokenImages,
          `Broken images on ${target.path} (${width}px)`,
        ).toEqual([]);
        expect(
          layoutAudit.overlaps,
          `Overlapping interactive controls on ${target.path} (${width}px)`,
        ).toEqual([]);
        expect(
          focusAudit.focused,
          `Expected Tab to focus an element on ${target.path} (${width}px)`,
        ).toBe(true);
        // Report contrast findings clearly in assertion message if any
        expect(
          layoutAudit.contrastFailures,
          `Contrast failures on ${target.path} (${width}px): ${JSON.stringify(layoutAudit.contrastFailures)}`,
        ).toEqual([]);
      });
    }
  }
});
