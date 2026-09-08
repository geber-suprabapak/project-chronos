import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";

process.env.LOGTO_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000/login";
process.env.ASTRA_API_URL = "http://astra.test";

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

bunTest.mock.module("@logto/next/server-actions", () => ({
  getAccessTokenRSC: async () => "monthly-export-test-token",
  getLogtoContext: async () => ({
    isAuthenticated: true,
    claims: { sub: "admin-1", roles: ["school_admin"] },
    userInfo: { email: "admin@skanida.sch.id", name: "Admin Skanida" },
  }),
}));

const { GET } =
  await import("../src/app/api/export/monthly-attendance/route.ts");

function response(data: unknown) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: { request_id: "monthly-export-request" },
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

describe("Monthly attendance workbook export route", () => {
  it("rejects invalid month input before querying Astra", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("Astra must not be queried for invalid input");
    };
    try {
      const result = await GET(
        new Request(
          "http://localhost:3000/api/export/monthly-attendance?month=2026-13",
        ) as never,
      );
      assert.equal(result.status, 400);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns a filtered, parseable workbook with download headers", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const path = new URL(url).pathname;
      if (path === "/v1/admin/academic-periods") {
        return response([
          {
            id: "period-1",
            name: "2026/2027 Ganjil",
            start_date: "2026-07-01",
            end_date: "2026-12-31",
          },
        ]);
      }
      if (path === "/v1/admin/classes") {
        return response([{ id: "class-1", name: "X RPL 2", grade: 10 }]);
      }
      if (path === "/v1/admin/students") {
        return response([
          {
            student_id: "student-1",
            user_id: "user-1",
            full_name: "Budi Santoso",
            nis: "1001",
          },
        ]);
      }
      if (path === "/v1/admin/enrollments") {
        return response([
          {
            id: "enrollment-1",
            student_id: "student-1",
            user_id: "user-1",
            class_id: "class-1",
            academic_period_id: "period-1",
            absence_number: "1",
          },
        ]);
      }
      if (path === "/v1/admin/schedules") {
        return response([
          {
            academic_period_id: "period-1",
            day_of_week: "senin",
            start_time: "06:30:00",
            end_time: "07:30:00",
            is_active: true,
          },
        ]);
      }
      if (path === "/v1/admin/calendar-exceptions") {
        return response([]);
      }
      if (path === "/v1/admin/leave-requests") {
        return response([]);
      }
      if (
        path === "/v1/admin/attendance/export" ||
        path === "/v1/admin/attendances/export"
      ) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "attendance-1",
                user_id: "user-1",
                date: "2026-09-07",
                status: "Hadir",
                action_type: "check_in",
              },
            ],
            meta: {
              request_id: "monthly-export-request",
              pagination: { limit: 1, offset: 0, has_more: false },
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
      throw new Error(`Unexpected source request: ${url}`);
    };

    try {
      const request = new Request(
        "http://localhost:3000/api/export/monthly-attendance?month=2026-09&className=X%20RPL%202&nis=1001",
        { headers: { "X-Request-ID": "monthly-export-route-1" } },
      );
      const result = await GET(request as never);
      assert.equal(result.status, 200);
      assert.equal(
        result.headers.get("Content-Type"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      assert.equal(
        result.headers.get("Content-Disposition"),
        'attachment; filename="rekap-absensi-bulanan-2026-09.xlsx"',
      );
      assert.equal(
        result.headers.get("X-Request-ID"),
        "monthly-export-route-1",
      );

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await result.arrayBuffer()) as any);
      assert.deepEqual(
        workbook.worksheets.map((sheet) => sheet.name),
        ["X RPL 2"],
      );
      assert.equal(
        workbook.getWorksheet("X RPL 2")?.getRow(2).getCell(2).value,
        "Budi Santoso",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
