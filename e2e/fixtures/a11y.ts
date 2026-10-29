import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect } from "./auth.ts";

export async function holdTrpcQuery(
  page: Page,
  procedure: string,
): Promise<{ requestStarted: Promise<void>; release: () => void }> {
  let release = () => {};
  let signalStarted = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });

  await page.route("**/api/trpc/**", async (route) => {
    if (!route.request().url().includes(procedure)) {
      await route.continue();
      return;
    }
    signalStarted();
    await gate;
    await route.abort();
  });

  return { requestStarted, release };
}

export async function expectAxeCleanInBothThemes(
  page: Page,
  context: string,
): Promise<void> {
  const root = page.locator("html");
  const startedDark = await root.evaluate((element) =>
    element.classList.contains("dark"),
  );
  const stableLayout = await page.addStyleTag({
    content:
      "*, *::before, *::after { animation: none !important; transition: none !important; }",
  });

  try {
    for (const dark of [false, true]) {
      await root.evaluate((element, useDark) => {
        element.classList.toggle("dark", useDark);
      }, dark);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const seriousOrCritical = results.violations.filter(
        (violation) =>
          violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        seriousOrCritical,
        `${context} (${dark ? "dark" : "light"}): ${JSON.stringify(seriousOrCritical, null, 2)}`,
      ).toEqual([]);
    }
  } finally {
    await root.evaluate((element, useDark) => {
      element.classList.toggle("dark", useDark);
    }, startedDark);
    await stableLayout.evaluate((style) =>
      style.parentNode?.removeChild(style),
    );
  }
}
