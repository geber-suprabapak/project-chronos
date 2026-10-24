import { test, expect, loginAs } from "./fixtures/auth.ts";

test.use({ timezoneId: "America/Los_Angeles" });

function summaryDate(url: string): string | undefined {
  const parsed = new URL(url);
  if (!parsed.pathname.includes("absences.getTodaySummary")) return;
  const input: Record<string, { json?: { date?: string } }> = JSON.parse(
    parsed.searchParams.get("input") ?? "{}",
  );
  return Object.values(input).find((item) => item.json?.date)?.json?.date;
}

test("dashboard uses WIB and requests a new date after midnight", async ({
  page,
}) => {
  await loginAs(page, "platform_admin");
  await page.clock.install({ time: new Date("2026-10-05T16:59:00Z") });
  const dates: string[] = [];
  page.on("request", (request) => {
    const date = summaryDate(request.url());
    if (date) dates.push(date);
  });
  await page.goto("/dashboard");
  await expect.poll(() => dates.includes("2026-10-05")).toBe(true);
  await expect(page.getByText("Absen Masuk", { exact: true })).toBeVisible();
  await page.clock.runFor(61_000);
  await expect.poll(() => dates.includes("2026-10-06")).toBe(true);
  await expect(page.getByText("Absen Masuk", { exact: true })).toBeVisible();
});

test("dashboard refreshes the date after a suspended tab wakes and on same-day focus", async ({
  page,
}) => {
  await loginAs(page, "platform_admin");
  await page.clock.install({ time: new Date("2026-10-05T16:00:00Z") });
  const dates: string[] = [];
  page.on("request", (request) => {
    const date = summaryDate(request.url());
    if (date) dates.push(date);
  });
  await page.goto("/dashboard");
  await expect.poll(() => dates.includes("2026-10-05")).toBe(true);
  await expect(page.getByText("Absen Masuk", { exact: true })).toBeVisible();

  // Jump the clock without running the midnight timer, as with a suspended tab.
  await page.clock.setSystemTime(new Date("2026-10-06T00:30:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => dates.includes("2026-10-06")).toBe(true);
  await expect(page.getByText("Absen Masuk", { exact: true })).toBeVisible();

  await page.clock.setSystemTime(new Date("2026-10-06T17:01:00Z"));
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => dates.includes("2026-10-07")).toBe(true);
  await expect(page.getByText("Absen Masuk", { exact: true })).toBeVisible();

  const count = dates.filter((date) => date === "2026-10-07").length;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect
    .poll(() => dates.filter((date) => date === "2026-10-07").length)
    .toBeGreaterThan(count);

  await page.goto("/profiles");
  await expect(page).toHaveURL(/\/profiles/);
  const countAfterUnmount = dates.length;
  await page.clock.setSystemTime(new Date("2026-10-07T17:01:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.clock.runFor(1000);
  expect(dates.length).toBe(countAfterUnmount);
});
