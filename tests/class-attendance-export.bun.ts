import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
// @ts-expect-error Bun provides module mocks at runtime.
import { mock } from "bun:test";
import ExcelJS from "exceljs";

process.env.ASTRA_API_URL = "http://127.0.0.1:23590";
process.env.LOGTO_POST_LOGOUT_REDIRECT_URI = "http://localhost:3059/login";
let authenticated = true;
let role = "school_admin";
mock.module("@logto/next/server-actions", () => ({
  getLogtoContext: async () => ({
    isAuthenticated: authenticated,
    claims: { sub: "fixture", roles: [role] },
  }),
  getAccessTokenRSC: async () => "fixture-token",
}));
const { GET } = await import("../src/app/api/export/class-attendance/route.ts");
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  authenticated = true;
  role = "school_admin";
});

function sources(fail = "") {
  const requests: string[] = [];
  const data: Record<string, unknown[]> = {
    "academic-periods": [{ id: "p", is_active: true }],
    classes: [{ id: "c", name: "X PPLG 1" }],
    students: [
      {
        student_id: "a",
        user_id: "u1",
        lifecycle_status: "approved",
        full_name: "Siswa Hadir",
        nis: "24002",
      },
      {
        student_id: "b",
        user_id: "u2",
        lifecycle_status: "approved",
        full_name: "Siswa Sakit",
        nis: "24005",
      },
      {
        student_id: "c",
        user_id: null,
        full_name: "Roster Only",
        nis: "29901",
      },
    ],
    enrollments: ["a", "b", "c"].map((student_id, i) => ({
      student_id,
      class_id: "c",
      academic_period_id: "p",
      status: "active",
      absence_number: String(i + 1),
    })),
    "attendance/export": [
      {
        id: "in",
        user_id: "u1",
        date: "2026-10-28",
        status: "Hadir",
        action_type: "check_in",
      },
      {
        id: "out",
        user_id: "u1",
        date: "2026-10-28",
        status: "Pulang",
        action_type: "check_out",
      },
    ],
    "leave-requests": [
      {
        user_id: "u2",
        date: "2026-10-27",
        effective_end_date: "2026-10-28",
        category: "sakit",
        approval_status: "approved",
      },
    ],
  };
  globalThis.fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "http://127.0.0.1:23590");
    const resource = url.pathname.replace("/v1/admin/", "");
    requests.push(resource);
    assert.ok(resource in data, resource);
    if (resource === fail) throw new Error("fixture outage");
    const rows = data[resource]!;
    return new Response(
      JSON.stringify({
        success: true,
        data: rows,
        meta: {
          request_id: "class-test",
          ...(resource === "attendance/export"
            ? { pagination: { limit: rows.length, offset: 0, has_more: false } }
            : {}),
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
        },
      },
    );
  };
  return requests;
}

function request(query = "") {
  return new Request(
    `http://localhost:3059/api/export/class-attendance?className=X+PPLG+1&date=2026-10-28${query}`,
  );
}

describe("authoritative per-class summary exports", () => {
  it("exports every student once with matching summary columns and effective leave", async () => {
    sources();
    const response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.match(response.headers.get("Content-Disposition") ?? "", /\.xlsx/);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    const rows: ExcelJS.CellValue[][] = [];
    workbook.worksheets[0]!.eachRow((row) => {
      const values = row.values;
      assert.ok(Array.isArray(values));
      rows.push(values.slice(1));
    });
    assert.deepEqual(rows, [
      ["No", "Nama", "NIS", "Kelas", "Status"],
      ["1", "Siswa Hadir", "24002", "X PPLG 1", "Hadir"],
      ["2", "Siswa Sakit", "24005", "X PPLG 1", "Sakit"],
      ["3", "Roster Only", "29901", "X PPLG 1", "Belum Presensi"],
    ]);
  });

  it("applies shared status/name/NIS/absence filters and supports header-only empty results", async () => {
    sources();
    for (const [query, expected] of [
      ["&status=Sakit&query=24005", 2],
      ["&query=3", 2],
      ["&status=Hadir&query=29901", 1],
    ] as const) {
      const result = await GET(request(query));
      assert.equal(result.status, 200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await result.arrayBuffer());
      assert.equal(workbook.worksheets[0]!.rowCount, expected);
    }
    const result = await GET(request("&format=pdf&status=Sakit&query=24005"));
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("Content-Type"), "application/pdf");
    const pdf = Buffer.from(await result.arrayBuffer()).toString("latin1");
    assert.ok(pdf.startsWith("%PDF-"));
    assert.match(pdf, /Siswa Sakit/);
    assert.doesNotMatch(pdf, /Siswa Hadir/);
  });

  it("rejects malformed inputs and denied roles before reading any source", async () => {
    const requests = sources();
    for (const suffix of [
      "&date=2026-02-30",
      "&status=Unknown",
      "&format=csv",
    ]) {
      const url = new URL(request().url);
      for (const [key, value] of new URLSearchParams(suffix.slice(1)))
        url.searchParams.set(key, value);
      assert.equal((await GET(new Request(url))).status, 400);
    }
    authenticated = false;
    assert.equal((await GET(request())).status, 401);
    authenticated = true;
    role = "student";
    assert.equal((await GET(request())).status, 403);
    assert.deepEqual(requests, []);
  });

  it("fails closed with JSON and no attachment for source outages", async () => {
    sources("enrollments");
    const result = await GET(request());
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("Content-Disposition"), null);
    assert.match(result.headers.get("Content-Type") ?? "", /application\/json/);
  });
});
