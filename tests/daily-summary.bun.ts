import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
// @ts-expect-error Bun provides its mock and clock utilities at runtime.
import { mock, setSystemTime } from "bun:test";

// These tests intercept every request and cannot inherit a production origin.
process.env.ASTRA_API_URL = "http://127.0.0.1:23590";
process.env.LOGTO_ENDPOINT = "http://127.0.0.1:23591";
process.env.LOGTO_BASE_URL = "http://localhost:3059";
process.env.LOGTO_POST_LOGOUT_REDIRECT_URI = "http://localhost:3059/login";
mock.module("@logto/next/server-actions", () => ({
  getLogtoContext: async () => ({
    isAuthenticated: true,
    claims: { sub: "admin-test", roles: ["school_admin"] },
  }),
  getAccessTokenRSC: async () => "fixture-token",
}));
const { absencesRouter } =
  await import("../src/server/api/routers/absences.ts");
const caller = absencesRouter.createCaller({
  headers: new Headers(),
  requestId: "daily-test",
});

const period = { id: "current", school_id: "school", is_active: true };
const student = (index: number) => ({
  student_id: `s-${index}`,
  user_id: `u-${index}`,
  lifecycle_status: "approved",
  full_name: `Student ${index}`,
  class_name: "X PPLG 1",
  nis: `24${index}`,
});
const enrollment = (index: number) => ({
  ...student(index),
  id: `e-${index}`,
  class_id: "class",
  academic_period_id: period.id,
  status: "active",
});
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  setSystemTime();
});

function response(data: unknown, pagination?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      meta: { request_id: "daily-test", ...(pagination ? { pagination } : {}) },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
      },
    },
  );
}

function rateLimitResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Rate limit exceeded. Please slow down.",
      },
      meta: { request_id: "daily-test" },
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
      },
    },
  );
}

function sources(
  overrides: Record<string, unknown[]> = {},
  options: {
    paged?: boolean;
    fail?: string;
    malformed?: boolean;
    rateLimited?: string;
  } = {},
) {
  const requests: URL[] = [];
  const data: Record<string, unknown[]> = {
    "academic-periods": [period],
    classes: [
      { id: "class", name: "X PPLG 1" },
      { id: "other", name: "X PPLG 10" },
    ],
    students: [student(0)],
    enrollments: [enrollment(0)],
    "attendance/export": [],
    "leave-requests": [],
    ...overrides,
  };
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "http://127.0.0.1:23590");
    requests.push(url);
    const resource = url.pathname.replace("/v1/admin/", "");
    assert.ok(resource in data, `Unexpected resource: ${resource}`);
    if (options.rateLimited === resource) return rateLimitResponse();
    if (options.fail === resource) throw new Error("fixture outage");
    const rows = data[resource]!;
    if (resource === "attendance/export")
      return response(rows, { limit: rows.length, offset: 0, has_more: false });
    if (!options.paged) return response(rows);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    return response(
      options.malformed && resource === "students"
        ? rows.slice(offset, offset + 1)
        : rows.slice(offset, offset + limit),
      {
        limit,
        offset,
        has_more:
          (options.malformed && resource === "students") ||
          offset + limit < rows.length,
      },
    );
  };
  return requests;
}

const arrival = (index: number, status = "Hadir") => ({
  id: `a-${index}`,
  user_id: `u-${index}`,
  date: "2026-10-06",
  status,
  action_type: "check_in",
});
const leave = (index: number, category = "pergi") => ({
  id: `l-${index}`,
  user_id: `u-${index}`,
  date: "2026-10-05",
  effective_end_date: "2026-10-07",
  category,
  approval_status: "approved",
  status: true,
});

describe("daily summary membership and WIB defaults", () => {
  it("maps Astra rate limits to a safe retryable error for both summaries", async () => {
    for (const query of [
      () => caller.getTodaySummary({ date: "2026-10-06" }),
      () =>
        caller.getClassAttendanceSummary({
          className: "X PPLG 1",
          date: "2026-10-06",
        }),
    ]) {
      const requests = sources({}, { rateLimited: "academic-periods" });
      await assert.rejects(query(), (error: unknown) => {
        const caught = error as { code?: string; message?: string };
        assert.equal(caught.code, "SERVICE_UNAVAILABLE");
        assert.equal(
          caught.message,
          "Layanan absensi sedang sibuk. Coba lagi beberapa saat.",
        );
        assert.ok(!caught.message.includes("Rate limit exceeded"));
        return true;
      });
      assert.equal(requests.length, 1);
    }
  });

  it("rejects impossible class-summary dates before contacting sources", async () => {
    const requests = sources();
    await assert.rejects(
      caller.getClassAttendanceSummary({
        className: "X PPLG 1",
        date: "2026-02-30",
      }),
      { code: "BAD_REQUEST" },
    );
    assert.deepEqual(requests, []);
  });
  it("class summary shares canonical roster membership, preserves unbound students and inclusive effective leave", async () => {
    const unbound = (id: string) => ({
      student_id: id,
      user_id: null,
      full_name: id,
      class_name: "X PPLG 1",
    });
    sources({
      students: [
        student(0),
        student(1),
        unbound("roster-a"),
        unbound("roster-b"),
        { ...student(4), class_name: "X PPLG 10" },
        { ...student(5), lifecycle_status: "pending" },
      ],
      enrollments: [
        enrollment(0),
        enrollment(0),
        enrollment(1),
        ...["roster-a", "roster-b"].map((id) => ({
          ...enrollment(0),
          student_id: id,
          user_id: null,
        })),
        { ...enrollment(4), class_id: "other" },
        enrollment(5),
      ],
      "attendance/export": [
        arrival(0),
        { ...arrival(0), status: "Pulang", action_type: "check_out" },
        arrival(1),
        arrival(4),
        arrival(5),
      ],
      "leave-requests": [
        { ...leave(1, "sakit"), original_end_date: "2026-10-09" },
        { ...leave(0, "sakit"), approval_status: "pending", status: true },
      ],
    });
    const summary = await caller.getClassAttendanceSummary({
      className: "X PPLG 1",
      date: "2026-10-06",
    });
    assert.equal(summary.totalStudents, 4);
    assert.deepEqual(summary.summary, {
      hadir: 1,
      terlambat: 0,
      sakit: 1,
      izin: 0,
      tidakHadir: 2,
    });
    assert.deepEqual(
      summary.details.tidakHadir.map((row) => row.studentId).sort(),
      ["roster-a", "roster-b"],
    );
    assert.ok(summary.details.tidakHadir.every((row) => row.userId === null));
    assert.equal(
      (await caller.getTodaySummary({ date: "2026-10-06" })).totalUsers,
      5,
    );
    assert.equal(
      (
        await caller.getClassAttendanceSummary({
          className: "X PPLG 1",
          date: "2026-10-07",
        })
      ).summary.sakit,
      1,
    );
    assert.equal(
      (
        await caller.getClassAttendanceSummary({
          className: "X PPLG 1",
          date: "2026-10-08",
        })
      ).summary.sakit,
      0,
    );
    assert.equal(
      (
        await caller.getClassAttendanceSummary({
          className: "Missing",
          date: "2026-10-06",
        })
      ).totalStudents,
      0,
    );
  });

  it("counts the 956 snapshot roster once and uses it for every category", async () => {
    const current = Array.from({ length: 956 }, (_, index) => student(index));
    const students = [
      ...current,
      ...current.map((row) => ({ ...row, academic_period_id: "old" })),
      ...Array.from({ length: 346 }, (_, index) => student(index + 956)),
    ];
    const enrollments = [
      ...Array.from({ length: 956 }, (_, index) => enrollment(index)),
      enrollment(0),
      { ...enrollment(956), status: "graduated" },
      { ...enrollment(957), academic_period_id: "old" },
      { ...enrollment(958), class_id: null },
    ];
    const requests = sources(
      {
        students,
        enrollments,
        "attendance/export": [
          arrival(0),
          arrival(0),
          arrival(1, "Terlambat"),
          arrival(2),
          arrival(960),
          { ...arrival(0), status: "Pulang", action_type: "check_out" },
          { ...arrival(4), status: "Pulang", action_type: "check_out" },
        ],
        "leave-requests": [
          leave(2),
          leave(2),
          leave(2, "sakit"),
          leave(3),
          leave(960),
          { ...leave(5), approval_status: "rejected" },
        ],
      },
      { paged: true },
    );
    assert.deepEqual(await caller.getTodaySummary({ date: "2026-10-06" }), {
      date: "2026-10-06",
      totalUsers: 956,
      sudahAbsenMasuk: 2,
      belumAbsenMasuk: 952,
      sudahAbsenPulang: 1,
      belumAbsenPulang: 1,
      izin: 1,
      sakit: 1,
    });
    const query = requests.find((url) =>
      url.pathname.endsWith("/enrollments"),
    )!.searchParams;
    assert.equal(query.get("academic_period_id"), "current");
    assert.equal(query.get("status"), "active");
    const range = requests.find((url) =>
      url.pathname.endsWith("/leave-requests"),
    )!.searchParams;
    assert.equal(range.get("start_date"), "2026-10-06");
    assert.equal(range.get("end_date"), "2026-10-06");
    assert.ok(
      requests.some(
        (url) =>
          url.pathname.endsWith("/students") &&
          url.searchParams.get("offset") === "100",
      ),
    );
  });

  it("includes roster-only students and resolves legacy enrollment identity to canonical students", async () => {
    sources({
      students: [
        student(0),
        { student_id: "roster-only", user_id: null },
        { ...student(1), lifecycle_status: "pending" },
        { ...student(2), lifecycle_status: "disabled" },
      ],
      enrollments: [
        { ...enrollment(0), student_id: null },
        { ...enrollment(0), student_id: "roster-only", user_id: null },
        enrollment(1),
        enrollment(2),
      ],
      "attendance/export": [arrival(0), arrival(1), arrival(2)],
    });
    const summary = await caller.getTodaySummary({ date: "2026-10-06" });
    assert.equal(summary.totalUsers, 2);
    assert.equal(summary.sudahAbsenMasuk, 1);
    assert.equal(summary.belumAbsenMasuk, 1);
  });

  it("returns a real empty roster and rejects missing or ambiguous active periods", async () => {
    sources({ students: [], enrollments: [] });
    assert.equal(
      (await caller.getTodaySummary({ date: "2026-10-06" })).totalUsers,
      0,
    );
    sources({ "academic-periods": [] });
    await assert.rejects(caller.getTodaySummary(), { code: "NOT_FOUND" });
    sources({ "academic-periods": [period, { ...period, id: "second" }] });
    await assert.rejects(caller.getTodaySummary(), { code: "CONFLICT" });
  });

  it("fails on incomplete pages, missing students, malformed data and dependency outages", async () => {
    sources(
      { students: [student(0), student(1), student(2)] },
      { paged: true, malformed: true },
    );
    await assert.rejects(
      caller.getTodaySummary(),
      /invalid pagination metadata/,
    );
    sources({ students: [] });
    await assert.rejects(caller.getTodaySummary(), /missing student/);
    for (const resource of [
      "academic-periods",
      "students",
      "enrollments",
      "attendance/export",
      "leave-requests",
    ]) {
      sources({}, { fail: resource });
      await assert.rejects(caller.getTodaySummary(), {
        code: "INTERNAL_SERVER_ERROR",
      });
    }
    globalThis.fetch = async () => response({ wrong: "shape" });
    await assert.rejects(caller.getTodaySummary(), /non-list response/);
  });

  it("defaults to WIB before 07:00 and preserves an explicit historical date", async () => {
    sources();
    setSystemTime(new Date("2026-10-05T17:00:00Z"));
    assert.equal((await caller.getTodaySummary()).date, "2026-10-06");
    assert.equal(
      (await caller.getTodaySummary({ date: "2026-09-01" })).date,
      "2026-09-01",
    );
    await assert.rejects(caller.getTodaySummary({ date: "6 October" }), {
      code: "BAD_REQUEST",
    });
  });
});
