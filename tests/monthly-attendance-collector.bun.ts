import assert from "node:assert/strict";
import { describe, it } from "node:test";

const bunTest = (await import(
  // @ts-expect-error Bun provides this module at runtime; Node typecheck excludes Bun globals.
  "bun:test"
)) as {
  mock: {
    module: (
      moduleName: string,
      factory: () => Record<string, unknown>,
    ) => void;
  };
};

process.env.LOGTO_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000/login";
bunTest.mock.module("@logto/next/server-actions", () => ({
  getLogtoContext: async () => ({
    isAuthenticated: true,
    claims: { sub: "admin-1", roles: ["school_admin"] },
    userInfo: { email: "admin@skanida.sch.id", name: "Admin Skanida" },
  }),
  getAccessTokenRSC: async () => "monthly-recap-test-token",
}));

const { fetchMonthlyRecapSources } =
  await import("../src/server/api/routers/monthly-attendance.ts");

const period = {
  id: "period-1",
  name: "2026/2027 Ganjil",
  start_date: "2026-07-01",
  end_date: "2026-12-31",
};

function response(data: unknown, pagination?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        request_id: "monthly-recap-test-request",
        ...(pagination ? { pagination } : {}),
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
      },
    },
  );
}

describe("Monthly recap source collection", () => {
  it("collects every class page and rejects an incomplete non-final page", async () => {
    const originalFetch = globalThis.fetch;
    let incomplete = false;

    globalThis.fetch = async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;
      const query = new URL(url).searchParams;

      if (path === "/v1/admin/academic-periods") return response([period]);
      if (path === "/v1/admin/classes") {
        const offset = Number(query.get("offset") ?? "0");
        if (offset === 0) {
          return response(
            incomplete
              ? [{ id: "class-1", name: "X RPL 1" }]
              : [
                  { id: "class-1", name: "X RPL 1" },
                  { id: "class-2", name: "X RPL 2" },
                ],
            { limit: 2, offset: 0, has_more: true },
          );
        }
        return response(
          [
            { id: "class-3", name: "XI TKJ 1" },
            { id: "class-4", name: "XII RPL 1" },
          ],
          { limit: 2, offset, has_more: false },
        );
      }
      if (path === "/v1/admin/attendance/export") {
        return response([], { limit: 0, offset: 0, has_more: false });
      }
      if (path === "/v1/admin/students") return response([]);
      if (path === "/v1/admin/enrollments") return response([]);
      if (path === "/v1/admin/schedules") return response([]);
      if (path === "/v1/admin/calendar-exceptions") return response([]);
      if (path === "/v1/admin/leave-requests") return response([]);
      throw new Error(`Unexpected source request: ${url}`);
    };

    try {
      const sources = await fetchMonthlyRecapSources("2026-09");
      assert.deepEqual(
        sources.classes.map((item) => item.name),
        ["X RPL 1", "X RPL 2", "XI TKJ 1", "XII RPL 1"],
      );

      incomplete = true;
      await assert.rejects(
        fetchMonthlyRecapSources("2026-09"),
        /invalid pagination metadata/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
