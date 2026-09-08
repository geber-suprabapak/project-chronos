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

function response(data: unknown, pagination?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: {
        request_id: "monthly-export-request",
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

function notFoundResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      message: "Not found",
      error: { code: "RESOURCE_NOT_FOUND", message: "Not found" },
      meta: { request_id: "monthly-export-request" },
    }),
    {
      status: 404,
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

  it("collects paged sources before applying class filters to the workbook", async () => {
    const students = Array.from({ length: 102 }, (_, index) => ({
      student_id: `student-${index + 1}`,
      user_id: `user-${index + 1}`,
      full_name: `Student ${index + 1}`,
      nis: String(1001 + index),
    }));
    const enrollments = students.map((student, index) => ({
      id: `enrollment-${index + 1}`,
      student_id: student.student_id,
      user_id: student.user_id,
      class_id: index === 101 ? "class-2" : "class-1",
      academic_period_id: "period-1",
      absence_number: String(index + 1),
      status: "active",
    }));
    const attendances = students.map((student, index) => ({
      id: `attendance-${index + 1}`,
      user_id: student.user_id,
      date: "2026-09-07",
      status: "Hadir",
      action_type: "check_in",
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      const query = parsedUrl.searchParams;

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
        return response([
          { id: "class-1", name: "X RPL 2", grade: 10 },
          { id: "class-2", name: "XI TKJ 1", grade: 11 },
        ]);
      }
      if (path === "/v1/admin/students") {
        const offset = Number(query.get("offset") ?? "0");
        const limit = Number(query.get("limit") ?? "100");
        const page = students.slice(offset, offset + limit);
        return response(page, {
          limit,
          offset,
          has_more: offset + page.length < students.length,
        });
      }
      if (path === "/v1/admin/enrollments") {
        const offset = Number(query.get("offset") ?? "0");
        const limit = Number(query.get("limit") ?? "100");
        const page = enrollments.slice(offset, offset + limit);
        return response(page, {
          limit,
          offset,
          has_more: offset + page.length < enrollments.length,
        });
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
        return response(
          ["2026-09-14", "2026-09-21", "2026-09-28"].map((date) => ({
            academic_period_id: "period-1",
            date,
            is_holiday: true,
          })),
        );
      }
      if (path === "/v1/admin/leave-requests") return response([]);
      if (
        path === "/v1/admin/attendance/export" ||
        path === "/v1/admin/attendances/export"
      ) {
        return notFoundResponse();
      }
      if (path === "/v1/admin/attendance") {
        const offset = Number(query.get("offset") ?? "0");
        const limit = Number(query.get("limit") ?? "100");
        const page = attendances.slice(offset, offset + limit);
        return response(page, {
          limit,
          offset,
          has_more: offset + page.length < attendances.length,
        });
      }
      throw new Error(`Unexpected source request: ${url}`);
    };

    try {
      const result = await GET(
        new Request(
          "http://localhost:3000/api/export/monthly-attendance?month=2026-09&className=X%20RPL%202",
        ) as never,
      );
      assert.equal(result.status, 200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await result.arrayBuffer()) as any);
      assert.deepEqual(
        workbook.worksheets.map((sheet) => sheet.name),
        ["X RPL 2"],
      );
      const sheet = workbook.getWorksheet("X RPL 2");
      assert.ok(sheet);
      assert.equal(sheet.rowCount, 102);
      assert.deepEqual(sheet.getRow(1).values, [
        ,
        "No. (absen)",
        "Nama",
        "2026-09-07",
        "✓",
        "S",
        "I",
        "A",
        "T",
      ]);
      assert.deepEqual(sheet.getRow(2).values, [
        ,
        "1",
        "Student 1",
        "✓",
        1,
        0,
        0,
        0,
        0,
      ]);
      assert.deepEqual(sheet.getRow(102).values, [
        ,
        "101",
        "Student 101",
        "✓",
        1,
        0,
        0,
        0,
        0,
      ]);
      assert.deepEqual(
        sheet.getColumn(2).values.slice(2),
        students.slice(0, 101).map((student) => student.full_name),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
