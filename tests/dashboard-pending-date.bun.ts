import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Bun provides the isolated module/clock test seam.
const { mock, setSystemTime } = await import("bun:test");

const inputs: { tanggal: string }[] = [];
mock.module("~/trpc/server", () => ({
  api: {
    perizinan: {
      list: async (input: { tanggal: string }) => {
        inputs.push(input);
        return { rows: [] };
      },
    },
  },
}));
mock.module("~/components/pie-chart", () => ({
  StatistikPieChart: () => null,
}));
mock.module("~/components/dashboard-action-card", () => ({
  DashboardActionCard: () => null,
}));
mock.module("~/components/dashboard-data-error", () => ({
  DashboardDataError: () => null,
}));
const { default: DashboardPage } =
  await import("../src/app/(main)/dashboard/page.tsx");

test("dashboard pending query follows the WIB day across midnight and month/year rollover", async () => {
  try {
    for (const [instant, day] of [
      ["2026-10-27T16:59:59Z", "2026-10-27"],
      ["2026-10-27T17:00:00Z", "2026-10-28"],
      ["2026-10-31T17:00:00Z", "2026-11-01"],
      ["2026-12-31T17:00:00Z", "2027-01-01"],
    ]) {
      setSystemTime(new Date(instant!));
      const page = await DashboardPage();
      const content = page.props.children.find(
        (node: { type?: unknown }) => typeof node?.type === "function",
      );
      assert(content, "Expected dashboard data Server Component");
      await content.type(content.props);
      assert.equal(inputs.at(-1)?.tanggal, day);
    }
  } finally {
    setSystemTime();
  }
});
