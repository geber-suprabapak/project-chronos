import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Dynamic access to Bun test utilities if running under Bun
const bunTest = (globalThis as unknown as { Bun?: unknown }).Bun
  ? ((await import(
      // @ts-expect-error dynamic import under bun
      "bun:test"
    )) as {
      mock: {
        module: (
          moduleName: string,
          factory: () => Record<string, unknown>,
        ) => void;
      };
      expect: (actual: unknown) => {
        toBe: (expected: unknown) => void;
        toBeDefined: () => void;
        not: { toBeNull: () => void };
        toThrow: () => void;
      };
    })
  : null;

if (bunTest) {
  bunTest.mock.module("@logto/next/server-actions", () => ({
    getLogtoContext: async () => ({
      isAuthenticated: true,
      claims: {
        sub: "admin-1",
        roles: ["school_admin"],
        name: "Admin Skanida",
        email: "admin@skanida.sch.id",
      },
      userInfo: { email: "admin@skanida.sch.id", name: "Admin Skanida" },
    }),
    getAccessTokenRSC: async () => "mock-token",
  }));
}

const { createCallerFactory } = await import("../src/server/api/trpc.ts");
const { absencesRouter } =
  await import("../src/server/api/routers/absences.ts");
const { perizinanRouter, formatLeaveCategory } =
  await import("../src/server/api/routers/perizinan.ts");
const { collectAuthoritativeAttendanceRows } =
  await import("../src/server/export/collector.ts");

describe("Empirical Challenge M0 Iteration 2: Chronos Attendance Taxonomy & Invariants", () => {
  describe("Task 1: Legacy 'Datang' Normalization in Chronos", () => {
    it("collector.ts normalizes 'Datang' with null action_type to status 'Hadir' and actionType 'check_in'", async () => {
      const rows = await collectAuthoritativeAttendanceRows(
        {},
        {
          fetchAttendance: async () => [
            {
              id: "leg-1",
              user_id: "u-1",
              date: "2026-09-01",
              status: "Datang",
              action_type: null,
            },
            {
              id: "leg-2",
              user_id: "u-2",
              date: "2026-09-01",
              status: "Datang",
              action_type: "check_in",
            },
          ],
          fetchStudents: async () => [
            {
              user_id: "u-1",
              full_name: "Student 1",
              nis: "1001",
              class_name: "X",
            },
            {
              user_id: "u-2",
              full_name: "Student 2",
              nis: "1002",
              class_name: "X",
            },
          ],
        },
      );

      assert.equal(rows.length, 2);
      const row0 = rows[0]!;
      const row1 = rows[1]!;
      assert.equal(row0.status, "Hadir");
      assert.equal(row0.displayStatus, "Hadir");
      assert.equal(row0.actionType, "check_in");

      assert.equal(row1.status, "Hadir");
      assert.equal(row1.displayStatus, "Hadir");
      assert.equal(row1.actionType, "check_in");
    });

    it("absencesRouter.list normalizes legacy 'Datang' and filter status='Hadir' matches both", async () => {
      const mockAttendances = [
        {
          id: "att-leg",
          user_id: "u-1",
          date: "2026-09-05",
          status: "Datang",
          action_type: null,
          created_at: "2026-09-05T07:10:00Z",
        },
        {
          id: "att-can",
          user_id: "u-2",
          date: "2026-09-05",
          status: "Hadir",
          action_type: "check_in",
          created_at: "2026-09-05T07:15:00Z",
        },
        {
          id: "att-late",
          user_id: "u-3",
          date: "2026-09-05",
          status: "Terlambat",
          action_type: "check_in",
          created_at: "2026-09-05T07:40:00Z",
        },
      ];
      const mockStudents = [
        {
          user_id: "u-1",
          full_name: "Student 1",
          nis: "1001",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-2",
          full_name: "Student 2",
          nis: "1002",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-3",
          full_name: "Student 3",
          nis: "1003",
          class_name: "XII RPL 1",
        },
      ];

      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        const headers = {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
          "X-Request-ID": "req-1",
        };
        if (urlStr.includes("/v1/admin/students")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: mockStudents,
              meta: { request_id: "req-1" },
            }),
            { status: 200, headers },
          );
        }
        if (urlStr.includes("/v1/admin/attendance")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: mockAttendances,
              meta: {
                request_id: "req-1",
                pagination: { limit: 100, offset: 0, has_more: false },
              },
            }),
            { status: 200, headers },
          );
        }
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers,
        });
      };

      const createCaller = createCallerFactory(absencesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "req-1",
      });

      // Unfiltered list
      const allResult = await caller.list({ limit: 10 });
      const legacyRow = allResult.rows.find((r) => r.id === "att-leg");
      assert.ok(legacyRow);
      assert.equal(legacyRow.status, "Hadir");
      assert.equal(legacyRow.actionType, "check_in");

      // Filter by status: "Hadir"
      const hadirResult = await caller.list({ status: "Hadir", limit: 10 });
      assert.equal(hadirResult.rows.length, 2);
      assert.equal(
        hadirResult.rows.some((r) => r.id === "att-leg"),
        true,
      );
      assert.equal(
        hadirResult.rows.some((r) => r.id === "att-can"),
        true,
      );

      // Filter by status: "Datang"
      const datangResult = await caller.list({ status: "Datang", limit: 10 });
      assert.equal(datangResult.rows.length, 2);
      assert.equal(
        datangResult.rows.some((r) => r.id === "att-leg"),
        true,
      );
      assert.equal(
        datangResult.rows.some((r) => r.id === "att-can"),
        true,
      );
    });

    it("absencesRouter.getById normalizes legacy 'Datang' to 'Hadir' with actionType 'check_in'", async () => {
      const mockRecord = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        user_id: "u-1",
        date: "2026-09-05",
        status: "Datang",
        action_type: null,
        created_at: "2026-09-05T07:10:00Z",
      };

      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        const headers = {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
          "X-Request-ID": "req-2",
        };
        if (urlStr.includes("/v1/admin/students")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: [{ user_id: "u-1", full_name: "Student 1", nis: "1001" }],
              meta: { request_id: "req-2" },
            }),
            { status: 200, headers },
          );
        }
        if (urlStr.includes("/v1/admin/attendance/")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: mockRecord,
              meta: { request_id: "req-2" },
            }),
            { status: 200, headers },
          );
        }
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers,
        });
      };

      const createCaller = createCallerFactory(absencesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "req-2",
      });

      const record = await caller.getById({
        id: "123e4567-e89b-12d3-a456-426614174000",
      });
      assert.notEqual(record, null);
      assert.equal(record?.status, "Hadir");
      assert.equal(record?.actionType, "check_in");
    });
  });

  describe("Task 2: Mathematical Invariant & Disjointness in getClassAttendanceSummary", () => {
    it("satisfies invariant Total = Hadir + Terlambat + Sakit + Izin + TidakHadir with leave precedence", async () => {
      // 7 registered students in class "XII RPL 1":
      // 1. u-h1: on-time Hadir
      // 2. u-h2: on-time Datang (maps to Hadir)
      // 3. u-late: Terlambat
      // 4. u-sakit: approved medical leave (sakit)
      // 5. u-izin: approved permit leave (pergi)
      // 6. u-alpha: unexcused absent (no scan, no leave)
      // 7. u-both: approved leave (dispensasi) AND physical scan (Hadir)
      const students = [
        {
          user_id: "u-h1",
          full_name: "Student H1",
          nis: "1001",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-h2",
          full_name: "Student H2",
          nis: "1002",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-late",
          full_name: "Student Late",
          nis: "1003",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-sakit",
          full_name: "Student Sakit",
          nis: "1004",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-izin",
          full_name: "Student Izin",
          nis: "1005",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-alpha",
          full_name: "Student Alpha",
          nis: "1006",
          class_name: "XII RPL 1",
        },
        {
          user_id: "u-both",
          full_name: "Student Both",
          nis: "1007",
          class_name: "XII RPL 1",
        },
      ];

      const attendances = [
        {
          id: "att-1",
          user_id: "u-h1",
          date: "2026-09-05",
          status: "Hadir",
          action_type: "check_in",
        },
        {
          id: "att-2",
          user_id: "u-h2",
          date: "2026-09-05",
          status: "Datang",
          action_type: null,
        },
        {
          id: "att-3",
          user_id: "u-late",
          date: "2026-09-05",
          status: "Terlambat",
          action_type: "check_in",
        },
        {
          id: "att-7",
          user_id: "u-both",
          date: "2026-09-05",
          status: "Hadir",
          action_type: "check_in",
        },
      ];

      const leaveRequests = [
        {
          id: "lr-1",
          user_id: "u-sakit",
          category: "sakit",
          approval_status: "approved",
          date: "2026-09-05",
        },
        {
          id: "lr-2",
          user_id: "u-izin",
          category: "pergi",
          approval_status: "approved",
          date: "2026-09-05",
        },
        {
          id: "lr-7",
          user_id: "u-both",
          category: "dispensasi",
          approval_status: "approved",
          date: "2026-09-05",
        },
      ];

      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        const headers = {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
          "X-Request-ID": "req-3",
        };
        if (urlStr.includes("/v1/admin/students")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: students,
              meta: { request_id: "req-3" },
            }),
            { status: 200, headers },
          );
        }
        if (urlStr.includes("/v1/admin/attendance")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: attendances,
              meta: {
                request_id: "req-3",
                pagination: { limit: 100, offset: 0, has_more: false },
              },
            }),
            { status: 200, headers },
          );
        }
        if (urlStr.includes("/v1/admin/leave-requests")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: leaveRequests,
              meta: { request_id: "req-3" },
            }),
            { status: 200, headers },
          );
        }
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers,
        });
      };

      const createCaller = createCallerFactory(absencesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "req-3",
      });

      const result = await caller.getClassAttendanceSummary({
        className: "XII RPL 1",
        date: "2026-09-05",
      });

      const totalStudents = students.length;
      const sumCounts =
        result.summary.hadir +
        result.summary.terlambat +
        result.summary.sakit +
        result.summary.izin +
        result.summary.tidakHadir;

      // Mathematical invariant: Sum of counts must exactly equal registered students in class
      assert.equal(sumCounts, totalStudents);
      assert.equal(result.summary.hadir, 2);
      assert.equal(result.summary.terlambat, 1);
      assert.equal(result.summary.sakit, 1);
      assert.equal(result.summary.izin, 2);
      assert.equal(result.summary.tidakHadir, 1);

      // Precedence verification: u-both must only appear in izin, not hadir or terlambat
      const hadirUserIds = result.details.hadir.map((s) => s.userId);
      const terlambatUserIds = result.details.terlambat.map((s) => s.userId);
      const izinUserIds = result.details.izin.map((s) => s.userId);

      assert.equal(hadirUserIds.includes("u-both"), false);
      assert.equal(terlambatUserIds.includes("u-both"), false);
      assert.equal(izinUserIds.includes("u-both"), true);

      // Disjointness check across all detail lists
      const allDetailUserIds = [
        ...hadirUserIds,
        ...terlambatUserIds,
        ...result.details.sakit.map((s) => s.userId),
        ...izinUserIds,
        ...result.details.tidakHadir.map((s) => s.userId),
      ];
      assert.equal(allDetailUserIds.length, totalStudents);
      assert.equal(new Set(allDetailUserIds).size, totalStudents);
    });
  });

  describe("Task 3: getAttendanceStats Sanity & Exclusions", () => {
    it("excludes Pulang and Alpha from hadir, avoids Terlambat double-count, and enforces leave precedence", async () => {
      const targetDate = new Date().toISOString().slice(0, 10);

      const students = [
        { user_id: "u-hadir", full_name: "Hadir", nis: "1001" },
        { user_id: "u-datang", full_name: "Datang", nis: "1002" },
        { user_id: "u-late", full_name: "Late", nis: "1003" },
        { user_id: "u-pulang", full_name: "Pulang", nis: "1004" },
        { user_id: "u-alpha", full_name: "Alpha", nis: "1005" },
        { user_id: "u-leave", full_name: "Leave", nis: "1006" },
      ];

      const attendances = [
        {
          id: "a-1",
          user_id: "u-hadir",
          date: targetDate,
          status: "Hadir",
          action_type: "check_in",
        },
        {
          id: "a-2",
          user_id: "u-datang",
          date: targetDate,
          status: "Datang",
          action_type: null,
        },
        {
          id: "a-3",
          user_id: "u-late",
          date: targetDate,
          status: "Terlambat",
          action_type: "check_in",
        },
        {
          id: "a-4",
          user_id: "u-pulang",
          date: targetDate,
          status: "Pulang",
          action_type: "check_out",
        },
        {
          id: "a-5",
          user_id: "u-alpha",
          date: targetDate,
          status: "Alpha",
          action_type: null,
        },
        {
          id: "a-6",
          user_id: "u-leave",
          date: targetDate,
          status: "Hadir",
          action_type: "check_in",
        },
      ];

      const leaveRequests = [
        {
          id: "l-1",
          user_id: "u-leave",
          category: "sakit",
          approval_status: "approved",
          date: targetDate,
        },
      ];

      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        const headers = {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
          "X-Request-ID": "req-4",
        };
        if (urlStr.includes("/v1/admin/students")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: students,
              meta: { request_id: "req-4" },
            }),
            { status: 200, headers },
          );
        }
        if (urlStr.includes("/v1/admin/attendance")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: attendances,
              meta: {
                request_id: "req-4",
                pagination: { limit: 100, offset: 0, has_more: false },
              },
            }),
            { status: 200, headers },
          );
        }
        if (urlStr.includes("/v1/admin/leave-requests")) {
          return new Response(
            JSON.stringify({
              success: true,
              data: leaveRequests,
              meta: { request_id: "req-4" },
            }),
            { status: 200, headers },
          );
        }
        return new Response(JSON.stringify({ success: true, data: [] }), {
          status: 200,
          headers,
        });
      };

      const createCaller = createCallerFactory(absencesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "req-4",
      });

      const stats = await caller.getAttendanceStats({ days: 7 });
      const todayStat = stats.find((s) => s.date === targetDate);
      assert.ok(todayStat);

      // hadir: u-hadir, u-datang (2)
      // u-pulang is NOT in hadir
      // u-alpha is NOT in hadir
      // u-late is in terlambat, NOT in hadir
      // u-leave is in izin, NOT in hadir
      assert.equal(todayStat.hadir, 2);
      assert.equal(todayStat.terlambat, 1);
      assert.equal(todayStat.izin, 1);
    });
  });

  describe("Task 4: perizinan.ts Category Normalization & Schema Validation", () => {
    it("formatLeaveCategory correctly maps all four categories to canonical Indonesian labels", () => {
      assert.equal(formatLeaveCategory("sakit"), "Sakit");
      assert.equal(formatLeaveCategory("pergi"), "Izin (Pergi)");
      assert.equal(formatLeaveCategory("dispensasi"), "Dispensasi");
      assert.equal(formatLeaveCategory("lainnya"), "Izin (Lainnya)");

      // Case-insensitivity
      assert.equal(formatLeaveCategory("SAKIT"), "Sakit");
      assert.equal(formatLeaveCategory("PERGI"), "Izin (Pergi)");
      assert.equal(formatLeaveCategory("Dispensasi"), "Dispensasi");
      assert.equal(formatLeaveCategory("LAINNYA"), "Izin (Lainnya)");

      // Fallbacks
      assert.equal(formatLeaveCategory(null), "-");
      assert.equal(formatLeaveCategory(undefined), "-");
      assert.equal(formatLeaveCategory(""), "-");
    });

    it("perizinanRouter input schemas accept all four categories and reject invalid categories", () => {
      const listInputSchema = (
        perizinanRouter._def.procedures.list._def as unknown as {
          inputs: [{ parse: (val: unknown) => { kategoriIzin?: string } }];
        }
      ).inputs[0]!;
      const createManualInputSchema = (
        perizinanRouter._def.procedures.createManual._def as unknown as {
          inputs: [{ parse: (val: unknown) => { kategoriIzin?: string } }];
        }
      ).inputs[0]!;

      for (const cat of ["sakit", "pergi", "dispensasi", "lainnya"]) {
        assert.equal(
          listInputSchema.parse({ kategoriIzin: cat }).kategoriIzin,
          cat,
        );
        assert.equal(
          createManualInputSchema.parse({
            nis: "1001",
            kategoriIzin: cat,
            tanggal: "2026-09-05",
          }).kategoriIzin,
          cat,
        );
      }

      assert.throws(() => listInputSchema.parse({ kategoriIzin: "liburan" }));
      assert.throws(() =>
        createManualInputSchema.parse({
          nis: "1001",
          kategoriIzin: "liburan",
          tanggal: "2026-09-05",
        }),
      );
    });
  });
});
