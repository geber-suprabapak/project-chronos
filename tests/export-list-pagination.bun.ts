import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import http from "node:http";
import ExcelJS from "exceljs";

let authenticatedRole = "school_admin";

const bunTest = (globalThis as unknown as { Bun?: unknown }).Bun
  ? ((await import(
      // @ts-expect-error Bun-only module mocking for the local route seam.
      "bun:test"
    )) as {
      mock: {
        module: (
          moduleName: string,
          factory: () => Record<string, unknown>,
        ) => void;
      };
    })
  : null;

if (!bunTest) {
  throw new Error("This route-boundary test requires Bun module mocking.");
}

bunTest.mock.module("@logto/next/server-actions", () => ({
  getAccessTokenRSC: async () => "synthetic-local-test-token",
  getLogtoContext: async () => ({
    isAuthenticated: true,
    claims: {
      sub: "synthetic-export-admin",
      roles: [authenticatedRole],
      name: "Synthetic Export Admin",
      email: "synthetic-admin@example.invalid",
      must_change_password: false,
    },
    userInfo: {
      name: "Synthetic Export Admin",
      email: "synthetic-admin@example.invalid",
    },
  }),
}));

type FixtureRow = Record<string, string | boolean | null | string[]>;
interface CollectionFixture {
  rows: FixtureRow[];
  failAtOffset?: number;
  malformedAtOffset?: number;
  omitPaginationAtOffset?: number;
}

const collections = new Map<string, CollectionFixture>();
let serverPort = 0;

const mockAstraServer = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const collection = collections.get(url.pathname) ?? { rows: [] };
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Astra-Contract-Version", "v1");
  res.setHeader("X-Request-ID", req.headers["x-request-id"] ?? "local-astra");

  if (collection.failAtOffset === offset) {
    res.writeHead(503);
    res.end(
      JSON.stringify({
        success: false,
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Synthetic later-page failure",
        },
        meta: { request_id: "synthetic-later-page-failure" },
      }),
    );
    return;
  }

  const data = collection.rows.slice(offset, offset + limit);
  res.writeHead(200);
  const meta: Record<string, unknown> = {
    request_id: `synthetic-${url.pathname}-${offset}`,
  };
  if (collection.omitPaginationAtOffset !== offset) {
    meta.pagination = {
      limit,
      offset: collection.malformedAtOffset === offset ? offset + 1 : offset,
      has_more: offset + data.length < collection.rows.length,
    };
  }
  res.end(JSON.stringify({ success: true, data, meta }));
});

await new Promise<void>((resolve) => {
  mockAstraServer.listen(0, "127.0.0.1", () => {
    const address = mockAstraServer.address();
    if (typeof address === "object" && address !== null) {
      serverPort = address.port;
      process.env.ASTRA_API_URL = `http://127.0.0.1:${serverPort}`;
    }
    process.env.LOGTO_POST_LOGOUT_REDIRECT_URI = "http://localhost:3000/login";
    resolve();
  });
});

const { GET: getSiswa } = await import("../src/app/api/export/siswa/route.ts");
const { GET: getProfiles } =
  await import("../src/app/api/export/profiles/route.ts");
const { GET: getPerizinan } =
  await import("../src/app/api/export/perizinan/route.ts");

after(async () => {
  await new Promise<void>((resolve, reject) => {
    mockAstraServer.close((error) => (error ? reject(error) : resolve()));
  });
});

function studentRows(count: number): FixtureRow[] {
  return Array.from({ length: count }, (_, index) => ({
    user_id: `student-${index + 1}`,
    full_name: `Synthetic Student ${String(index + 1).padStart(3, "0")}`,
    email: `student-${index + 1}@example.invalid`,
    nis: String(10000 + index),
    class_name: "Synthetic Class",
    absence_number: String(index + 1),
    role: "student",
    lifecycle_status: "approved",
    gender: "L",
  }));
}

function staffRows(count: number): FixtureRow[] {
  return Array.from({ length: count }, (_, index) => ({
    user_id: `staff-${index + 1}`,
    full_name: `Synthetic Staff ${String(index + 1).padStart(3, "0")}`,
    email: `staff-${index + 1}@example.invalid`,
    role: "teacher",
    roles: ["teacher"],
    lifecycle_status: "approved",
  }));
}

function leaveRows(count: number): FixtureRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `leave-${index + 1}`,
    user_id: `student-${index + 1}`,
    student_name: `Synthetic Student ${String(index + 1).padStart(3, "0")}`,
    student_nis: String(10000 + index),
    student_class: "Synthetic Class",
    category: "sakit",
    description: `Synthetic leave ${index + 1}`,
    status: true,
    date: "2026-09-01",
    approval_status: "approved",
  }));
}

function resetCollections() {
  collections.clear();
  collections.set("/v1/admin/students", { rows: [] });
  collections.set("/v1/admin/staff", { rows: [] });
  collections.set("/v1/admin/leave-requests", { rows: [] });
  authenticatedRole = "school_admin";
}

async function getWorksheet(
  route: (request: Request) => Promise<Response>,
  path: string,
  worksheetName: string,
) {
  const response = await route(
    new Request(`http://localhost/api/export/${path}?format=xlsx`, {
      headers: { "X-Request-ID": `synthetic-${path}-export` },
    }),
  );
  assert.equal(response.status, 200);
  const workbook = new ExcelJS.Workbook();
  // @ts-expect-error ExcelJS accepts the Node buffer at runtime; its declaration uses a narrower Buffer generic.
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  const worksheet = workbook.getWorksheet(worksheetName);
  assert.ok(worksheet, `Expected worksheet ${worksheetName}`);
  return worksheet;
}

async function assertFailsClosed(
  route: (request: Request) => Promise<Response>,
  path: string,
) {
  const response = await route(
    new Request(`http://localhost/api/export/${path}?format=xlsx`, {
      headers: { "X-Request-ID": `synthetic-${path}-failure` },
    }),
  );
  assert.ok(
    response.status >= 500,
    `Expected fail-closed status, got ${response.status}`,
  );
  assert.match(
    response.headers.get("Content-Type") ?? "",
    /application\/json/i,
    "A partial workbook must not be returned on failure",
  );
  assert.ok(await response.json());
}

describe("paginated authoritative list exports", () => {
  it("exports all 101 roster rows when Astra reports has_more on page one", async () => {
    resetCollections();
    collections.set("/v1/admin/students", { rows: studentRows(101) });

    const worksheet = await getWorksheet(getSiswa, "siswa", "Data Siswa");
    assert.equal(worksheet.rowCount, 102);
    assert.equal(worksheet.getRow(102).getCell(1).value, "10100");
  });

  it("exports all 101 profile rows across paginated Astra lists", async () => {
    resetCollections();
    collections.set("/v1/admin/students", { rows: studentRows(101) });

    const worksheet = await getWorksheet(
      getProfiles,
      "profiles",
      "Profil Pengguna",
    );
    assert.equal(worksheet.rowCount, 102);
    assert.equal(worksheet.getRow(102).getCell(1).value, "student-101");
  });

  it("exports all 101 staff rows when the profile staff list is paginated", async () => {
    resetCollections();
    collections.set("/v1/admin/staff", { rows: staffRows(101) });

    const worksheet = await getWorksheet(
      getProfiles,
      "profiles",
      "Profil Pengguna",
    );
    assert.equal(worksheet.rowCount, 102);
    assert.equal(worksheet.getRow(102).getCell(1).value, "staff-101");
  });

  it("exports all 101 Leave rows when Astra reports has_more on page one", async () => {
    resetCollections();
    collections.set("/v1/admin/leave-requests", { rows: leaveRows(101) });

    const worksheet = await getWorksheet(
      getPerizinan,
      "perizinan",
      "Perizinan",
    );
    assert.equal(worksheet.rowCount, 102);
    assert.equal(worksheet.getRow(102).getCell(2).value, "10100");
  });

  it("fails the roster export closed when its later Astra page fails", async () => {
    resetCollections();
    collections.set("/v1/admin/students", {
      rows: studentRows(101),
      failAtOffset: 100,
    });

    await assertFailsClosed(getSiswa, "siswa");
  });

  it("fails the profile export closed when its later Astra page fails", async () => {
    resetCollections();
    collections.set("/v1/admin/students", {
      rows: studentRows(101),
      failAtOffset: 100,
    });

    await assertFailsClosed(getProfiles, "profiles");
  });

  it("fails the Leave export closed when its later Astra page fails", async () => {
    resetCollections();
    collections.set("/v1/admin/leave-requests", {
      rows: leaveRows(101),
      failAtOffset: 100,
    });

    await assertFailsClosed(getPerizinan, "perizinan");
  });

  it("fails an export closed when Astra pagination metadata is inconsistent", async () => {
    resetCollections();
    collections.set("/v1/admin/students", {
      rows: studentRows(101),
      malformedAtOffset: 0,
    });

    await assertFailsClosed(getSiswa, "siswa");
  });

  it("fails closed when a full-sized list page omits pagination metadata", async () => {
    resetCollections();
    collections.set("/v1/admin/students", {
      rows: studentRows(101),
      omitPaginationAtOffset: 0,
    });

    await assertFailsClosed(getSiswa, "siswa");
  });
});
