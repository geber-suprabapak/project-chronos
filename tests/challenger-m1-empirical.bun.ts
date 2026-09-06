import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { TRPCError } from "@trpc/server";

// Dynamic test context state for Logto mock
let currentRole = "school_admin";
let isAuthenticated = true;
let isPasswordChangeReq = false;

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
    })
  : null;

if (bunTest) {
  bunTest.mock.module("@logto/next/server-actions", () => ({
    getAccessTokenRSC: async () => "mock-bearer-token-12345",
    getLogtoContext: async () => {
      if (!isAuthenticated) {
        return { isAuthenticated: false, claims: null };
      }
      return {
        isAuthenticated: true,
        claims: {
          sub: "user-challenger-1",
          roles: [currentRole],
          name: "Test User",
          email: `${currentRole}@skanida.sch.id`,
          must_change_password: isPasswordChangeReq,
        },
        userInfo: {
          email: `${currentRole}@skanida.sch.id`,
          name: "Test User",
        },
      };
    },
  }));
}

// Import Astra Client & TRPC Routers after mocking Logto
const {
  astraRequestEnvelope,
  astraRequest,
  AstraRequestError,
  DEFAULT_ASTRA_TIMEOUT_MS,
} = await import("../src/lib/astra/client.ts");

const { createCallerFactory } = await import("../src/server/api/trpc.ts");
const { userProfilesRouter } =
  await import("../src/server/api/routers/user-profiles.ts");
const { biodataSiswaRouter } =
  await import("../src/server/api/routers/biodata-siswa.ts");
const { jadwalRouter } = await import("../src/server/api/routers/jadwal.ts");
const { absencesRouter } =
  await import("../src/server/api/routers/absences.ts");
const { locationRouter } =
  await import("../src/server/api/routers/configuration.ts");
const { requireExportAccess } =
  await import("../src/server/auth/export-guard.ts");
const { collectAstraPages, AstraPaginationError } =
  await import("../src/lib/astra/pagination.ts");

describe("Milestone M1 Empirical Stress-Test & Adversarial Challenge", () => {
  let server: http.Server;
  let serverPort = 3000;
  let serverPostCalls: { path: string; body: unknown }[] = [];
  let serverMode: "normal" | "outage" = "normal";

  before(async () => {
    server = http.createServer((req, res) => {
      const url = req.url ?? "";

      // 1. Hanging endpoints for Task 1
      if (url === "/hanging-15s") {
        // Deliberately wait 15 seconds before responding
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "X-Astra-Contract-Version": "v1",
              "X-Request-ID": req.headers["x-request-id"] || "server-req-1",
            });
            res.end(
              JSON.stringify({
                success: true,
                data: { status: "slow_ok" },
                meta: { request_id: "server-req-1" },
              }),
            );
          }
        }, 15000);
        return;
      }

      if (url === "/hanging-300ms") {
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, {
              "Content-Type": "application/json",
              "X-Astra-Contract-Version": "v1",
              "X-Request-ID": req.headers["x-request-id"] || "server-req-fast",
            });
            res.end(
              JSON.stringify({
                success: true,
                data: { status: "fast_slow_ok" },
                meta: { request_id: "server-req-fast" },
              }),
            );
          }
        }, 300);
        return;
      }

      // If simulated Astra outage
      if (serverMode === "outage") {
        res.writeHead(503, {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
          "X-Request-ID": req.headers["x-request-id"] || "outage-req-id",
        });
        res.end(
          JSON.stringify({
            success: false,
            error: {
              code: "DEPENDENCY_UNAVAILABLE",
              message: "Simulated Astra service outage",
            },
            meta: { request_id: "outage-req-id" },
          }),
        );
        return;
      }

      // Track POST schedule creations
      if (req.method === "POST" && url === "/v1/admin/schedules") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          serverPostCalls.push({
            path: url,
            body: body ? JSON.parse(body) : null,
          });
          res.writeHead(201, {
            "Content-Type": "application/json",
            "X-Astra-Contract-Version": "v1",
            "X-Request-ID": req.headers["x-request-id"] || "post-sched-id",
          });
          res.end(
            JSON.stringify({
              success: true,
              data: { id: "sched-new", ...JSON.parse(body || "{}") },
              meta: { request_id: "post-sched-id" },
            }),
          );
        });
        return;
      }

      // Normal endpoints
      res.writeHead(200, {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
        "X-Request-ID": req.headers["x-request-id"] || "normal-req-id",
      });

      if (url.startsWith("/v1/admin/schedules")) {
        res.end(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "1",
                day_of_week: "senin",
                start_time: "06:30:00",
                end_time: "07:30:00",
                start_checkout: "15:00:00",
                end_checkout: "16:00:00",
                grace_period_minutes: 15,
                is_active: true,
              },
            ],
            meta: { request_id: "normal-req-id" },
          }),
        );
        return;
      }

      if (url.startsWith("/v1/admin/students")) {
        res.end(
          JSON.stringify({
            success: true,
            data: [
              {
                user_id: "student-1",
                full_name: "Ahmad Santoso",
                email: "ahmad@skanida.sch.id",
                nis: "1001",
                class_name: "XII RPL 1",
                absence_number: "1",
                lifecycle_status: "approved",
                gender: "L",
              },
            ],
            meta: { request_id: "normal-req-id" },
          }),
        );
        return;
      }

      if (url.startsWith("/v1/admin/attendance")) {
        res.end(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "att-1",
                user_id: "student-1",
                date: "2026-09-05",
                status: "Hadir",
                action_type: "check_in",
              },
            ],
            meta: {
              request_id: "normal-req-id",
              pagination: { limit: 100, offset: 0, has_more: false },
            },
          }),
        );
        return;
      }

      if (url.startsWith("/v1/admin/leave-requests")) {
        res.end(
          JSON.stringify({
            success: true,
            data: [],
            meta: { request_id: "normal-req-id" },
          }),
        );
        return;
      }

      if (url.startsWith("/v1/admin/locations")) {
        res.end(
          JSON.stringify({
            success: true,
            data: [
              {
                id: "loc-1",
                name: "Kampus Utama",
                latitude: -7.123,
                longitude: 110.123,
                radius_meters: 100,
                is_active: true,
              },
            ],
            meta: { request_id: "normal-req-id" },
          }),
        );
        return;
      }

      res.end(
        JSON.stringify({
          success: true,
          data: [],
          meta: { request_id: "normal-req-id" },
        }),
      );
    });

    await new Promise<void>((resolve) => {
      server.listen(serverPort, "127.0.0.1", () => {
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // ==========================================================================
  // Task 1: Client Timeout & Cancellation (Issue 07)
  // ==========================================================================
  describe("Task 1: Client Timeout & Cancellation (Issue 07)", () => {
    it(
      "1.1 Hanging endpoint with default timeout (~10s): aborts at ~10s with status 504, code TIMEOUT, and preserves requestId",
      { timeout: 16000 },
      async () => {
        const customReqId = "custom-timeout-req-12345";
        const started = performance.now();

        let caughtError: unknown = null;
        try {
          await astraRequestEnvelope("/hanging-15s", {
            headers: { "X-Request-ID": customReqId },
          });
        } catch (err) {
          caughtError = err;
        }

        const elapsed = performance.now() - started;

        assert.ok(
          caughtError instanceof AstraRequestError,
          `Expected AstraRequestError, got: ${caughtError}`,
        );
        assert.equal(caughtError.status, 504, "Expected HTTP status 504");
        assert.equal(caughtError.code, "TIMEOUT", "Expected code TIMEOUT");
        assert.equal(
          caughtError.requestId,
          customReqId,
          "Expected preserved requestId",
        );
        assert.equal(
          caughtError.isTimeout(),
          true,
          "Expected isTimeout() === true",
        );

        // Verify elapsed time is close to 10 seconds (between 9,800ms and 11,500ms)
        assert.ok(
          elapsed >= 9800 && elapsed <= 11500,
          `Expected elapsed time ~10,000ms, actually took ${elapsed.toFixed(1)}ms`,
        );
      },
    );

    it("1.2 Hanging endpoint with custom timeoutMs option: aborts at configured timeout", async () => {
      const customReqId = "custom-short-timeout-req";
      const started = performance.now();

      let caughtError: unknown = null;
      try {
        await astraRequestEnvelope(
          "/hanging-300ms",
          {
            headers: { "X-Request-ID": customReqId },
          },
          { timeoutMs: 50 },
        );
      } catch (err) {
        caughtError = err;
      }

      const elapsed = performance.now() - started;

      assert.ok(caughtError instanceof AstraRequestError);
      assert.equal(caughtError.status, 504);
      assert.equal(caughtError.code, "TIMEOUT");
      assert.equal(caughtError.requestId, customReqId);
      assert.equal(caughtError.isTimeout(), true);
      assert.ok(
        elapsed >= 45 && elapsed <= 250,
        `Expected ~50ms timeout, took ${elapsed.toFixed(1)}ms`,
      );
    });

    it("1.3 Custom caller cancellation signal: aborts early with status 499 and code CANCELLED", async () => {
      const customReqId = "caller-cancel-req";
      const ac = new AbortController();

      setTimeout(() => ac.abort(), 25);

      let caughtError: unknown = null;
      try {
        await astraRequestEnvelope("/hanging-15s", {
          signal: ac.signal,
          headers: { "X-Request-ID": customReqId },
        });
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError instanceof AstraRequestError);
      assert.equal(caughtError.status, 499);
      assert.equal(caughtError.code, "CANCELLED");
      assert.equal(caughtError.requestId, customReqId);
    });

    it("1.4 Network failure (unreachable host): wraps failure into status 503, code NETWORK_ERROR, and preserves requestId", async () => {
      const customReqId = "unreachable-net-req";
      // Intercept fetch temporarily to simulate connection failure (ECONNREFUSED)
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new TypeError(
          "fetch failed: connect ECONNREFUSED 127.0.0.1:59999",
        );
      };

      let caughtError: unknown = null;
      try {
        await astraRequestEnvelope("/v1/admin/students", {
          headers: { "X-Request-ID": customReqId },
        });
      } catch (err) {
        caughtError = err;
      } finally {
        globalThis.fetch = originalFetch;
      }

      assert.ok(caughtError instanceof AstraRequestError);
      assert.equal(caughtError.status, 503);
      assert.equal(caughtError.code, "NETWORK_ERROR");
      assert.equal(caughtError.requestId, customReqId);
      assert.equal(caughtError.isUnavailable(), true);
    });

    it("1.5 Predicate helpers on AstraRequestError: validates all taxonomy categories", () => {
      // isTimeout()
      const t1 = new AstraRequestError("Timeout", 504, "req-1", "TIMEOUT");
      const t2 = new AstraRequestError("Timeout status only", 504, "req-1");
      const t3 = new AstraRequestError(
        "Timeout code only",
        500,
        "req-1",
        "TIMEOUT",
      );
      const t4 = new AstraRequestError(
        "Other error",
        500,
        "req-1",
        "INTERNAL_ERROR",
      );
      assert.equal(t1.isTimeout(), true);
      assert.equal(t2.isTimeout(), true);
      assert.equal(t3.isTimeout(), true);
      assert.equal(t4.isTimeout(), false);

      // isUnavailable()
      const u1 = new AstraRequestError(
        "Net error",
        503,
        "req-1",
        "NETWORK_ERROR",
      );
      const u2 = new AstraRequestError(
        "Dep unavail",
        503,
        "req-1",
        "DEPENDENCY_UNAVAILABLE",
      );
      const u3 = new AstraRequestError("Status 503 only", 503, "req-1");
      const u4 = new AstraRequestError("Other error", 500, "req-1", "OTHER");
      assert.equal(u1.isUnavailable(), true);
      assert.equal(u2.isUnavailable(), true);
      assert.equal(u3.isUnavailable(), true);
      assert.equal(u4.isUnavailable(), false);

      // isForbidden()
      const f1 = new AstraRequestError("Forbidden", 403, "req-1", "FORBIDDEN");
      const f2 = new AstraRequestError("Status 403 only", 403, "req-1");
      const f3 = new AstraRequestError(
        "Not forbidden",
        401,
        "req-1",
        "AUTH_REQUIRED",
      );
      assert.equal(f1.isForbidden(), true);
      assert.equal(f2.isForbidden(), true);
      assert.equal(f3.isForbidden(), false);

      // isNotFound()
      const n1 = new AstraRequestError(
        "Not found",
        404,
        "req-1",
        "RESOURCE_NOT_FOUND",
      );
      const n2 = new AstraRequestError("Status 404 only", 404, "req-1");
      const n3 = new AstraRequestError("Found", 200, "req-1");
      assert.equal(n1.isNotFound(), true);
      assert.equal(n2.isNotFound(), true);
      assert.equal(n3.isNotFound(), false);

      // isContractMismatch()
      const c1 = new AstraRequestError(
        "Mismatch",
        502,
        "req-1",
        "CONTRACT_VERSION_MISMATCH",
      );
      const c2 = new AstraRequestError(
        "Invalid envelope",
        502,
        "req-1",
        "INVALID_ENVELOPE",
      );
      const c3 = new AstraRequestError(
        "Unsupported",
        502,
        "req-1",
        "CONTRACT_VERSION_UNSUPPORTED",
      );
      const c4 = new AstraRequestError(
        "Invalid resp",
        502,
        "req-1",
        "CONTRACT_RESPONSE_INVALID",
      );
      const c5 = new AstraRequestError("Status 502 only", 502, "req-1");
      const c6 = new AstraRequestError(
        "Other 500",
        500,
        "req-1",
        "INTERNAL_ERROR",
      );
      assert.equal(c1.isContractMismatch(), true);
      assert.equal(c2.isContractMismatch(), true);
      assert.equal(c3.isContractMismatch(), true);
      assert.equal(c4.isContractMismatch(), true);
      assert.equal(c5.isContractMismatch(), true);
      assert.equal(c6.isContractMismatch(), false);
    });
  });

  // ==========================================================================
  // Task 2: Router Fail-Safe Behavior
  // ==========================================================================
  describe("Task 2: Router Fail-Safe Behavior", () => {
    it("2.1 jadwal.reset during Astra outage: throws TRPCError and DOES NOT create duplicate schedules", async () => {
      serverMode = "outage";
      serverPostCalls = [];
      currentRole = "school_admin";
      isAuthenticated = true;

      const createCaller = createCallerFactory(jadwalRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "sched-outage-req",
      });

      let caughtError: unknown = null;
      try {
        await caller.reset();
      } catch (err) {
        caughtError = err;
      }

      serverMode = "normal";

      assert.ok(
        caughtError instanceof TRPCError,
        `Expected TRPCError, got: ${caughtError}`,
      );
      assert.equal(caughtError.code, "INTERNAL_SERVER_ERROR");
      assert.ok(
        caughtError.message.includes("Gagal memuat jadwal dari Astra"),
        `Unexpected error message: ${caughtError.message}`,
      );

      // Crucial invariant: 0 POST requests were sent! Zero duplicate schedules created!
      assert.equal(
        serverPostCalls.length,
        0,
        `Expected 0 POST schedule creation calls during outage, but received ${serverPostCalls.length}!`,
      );
    });

    it("2.2 absences.getAttendanceStats during Astra outage: throws TRPCError instead of returning misleading '0 Siswa'", async () => {
      serverMode = "outage";
      currentRole = "school_admin";
      isAuthenticated = true;

      const createCaller = createCallerFactory(absencesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "stats-outage-req",
      });

      let caughtError: unknown = null;
      let result: unknown = null;
      try {
        result = await caller.getAttendanceStats({ days: 7 });
      } catch (err) {
        caughtError = err;
      }

      serverMode = "normal";

      assert.equal(result, null, "Should not return result on Astra outage");
      assert.ok(
        caughtError instanceof TRPCError,
        `Expected TRPCError, got: ${caughtError}`,
      );
      assert.equal(caughtError.code, "INTERNAL_SERVER_ERROR");
      assert.ok(
        caughtError.message.includes("Gagal memuat statistik kehadiran"),
      );
    });

    it("2.3 absences.getTodaySummary during Astra outage: throws TRPCError instead of dummy 0 summary", async () => {
      serverMode = "outage";
      currentRole = "teacher";
      isAuthenticated = true;

      const createCaller = createCallerFactory(absencesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "today-outage-req",
      });

      let caughtError: unknown = null;
      try {
        await caller.getTodaySummary({ date: "2026-09-05" });
      } catch (err) {
        caughtError = err;
      }

      serverMode = "normal";

      assert.ok(caughtError instanceof TRPCError);
      assert.equal(caughtError.code, "INTERNAL_SERVER_ERROR");
    });

    it("2.4 absences.getClassAttendanceSummary during Astra outage: throws TRPCError instead of empty roster", async () => {
      serverMode = "outage";
      currentRole = "teacher";
      isAuthenticated = true;

      const createCaller = createCallerFactory(absencesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "class-outage-req",
      });

      let caughtError: unknown = null;
      try {
        await caller.getClassAttendanceSummary({
          className: "XII RPL 1",
          date: "2026-09-05",
        });
      } catch (err) {
        caughtError = err;
      }

      serverMode = "normal";

      assert.ok(caughtError instanceof TRPCError);
      assert.equal(caughtError.code, "INTERNAL_SERVER_ERROR");
    });

    it("2.5 configuration.getAll and getActive during Astra outage: throws TRPCError instead of empty arrays", async () => {
      serverMode = "outage";
      currentRole = "school_admin";
      isAuthenticated = true;

      const createCaller = createCallerFactory(locationRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "config-outage-req",
      });

      let caughtErrorGetAll: unknown = null;
      try {
        await caller.getAll();
      } catch (err) {
        caughtErrorGetAll = err;
      }

      let caughtErrorGetActive: unknown = null;
      try {
        await caller.getActive();
      } catch (err) {
        caughtErrorGetActive = err;
      }

      serverMode = "normal";

      assert.ok(caughtErrorGetAll instanceof TRPCError);
      assert.equal(caughtErrorGetAll.code, "INTERNAL_SERVER_ERROR");
      assert.ok(caughtErrorGetActive instanceof TRPCError);
      assert.equal(caughtErrorGetActive.code, "INTERNAL_SERVER_ERROR");
    });
  });

  // ==========================================================================
  // Task 3: Role Surface & Authorization (Issue 04)
  // ==========================================================================
  describe("Task 3: Role Surface & Authorization (Issue 04)", () => {
    it("3.1 userProfiles.list, getById, and listRaw: REJECT teacher role with FORBIDDEN", async () => {
      currentRole = "teacher";
      isAuthenticated = true;

      const createCaller = createCallerFactory(userProfilesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "teacher-profiles-req",
      });

      // list
      await assert.rejects(
        caller.list({ limit: 10, offset: 0 }),
        (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN",
        "userProfiles.list must reject teacher with FORBIDDEN",
      );

      // getById
      await assert.rejects(
        caller.getById({ id: "student-1" }),
        (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN",
        "userProfiles.getById must reject teacher with FORBIDDEN",
      );

      // listRaw
      await assert.rejects(
        caller.listRaw(),
        (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN",
        "userProfiles.listRaw must reject teacher with FORBIDDEN",
      );
    });

    it("3.2 userProfiles.list, getById, and listRaw: REJECT staff role with FORBIDDEN", async () => {
      currentRole = "staff";
      isAuthenticated = true;

      const createCaller = createCallerFactory(userProfilesRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "staff-profiles-req",
      });

      await assert.rejects(
        caller.list({ limit: 10, offset: 0 }),
        (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN",
        "userProfiles.list must reject staff with FORBIDDEN",
      );

      await assert.rejects(
        caller.getById({ id: "student-1" }),
        (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN",
        "userProfiles.getById must reject staff with FORBIDDEN",
      );

      await assert.rejects(
        caller.listRaw(),
        (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN",
        "userProfiles.listRaw must reject staff with FORBIDDEN",
      );
    });

    it("3.3 userProfiles.list: ALLOWS school_admin and platform_admin", async () => {
      for (const adminRole of ["school_admin", "platform_admin"]) {
        currentRole = adminRole;
        isAuthenticated = true;

        const createCaller = createCallerFactory(userProfilesRouter);
        const caller = createCaller({
          headers: new Headers(),
          requestId: `${adminRole}-req`,
        });

        const listRes = await caller.list({ limit: 10, offset: 0 });
        assert.ok(listRes);
        assert.equal(Array.isArray(listRes.data), true);
      }
    });

    it("3.4 biodataSiswa.list and getByNis: PERMITS teacher and staff per D1", async () => {
      for (const role of [
        "teacher",
        "staff",
        "school_admin",
        "platform_admin",
      ]) {
        currentRole = role;
        isAuthenticated = true;

        const createCaller = createCallerFactory(biodataSiswaRouter);
        const caller = createCaller({
          headers: new Headers(),
          requestId: `${role}-siswa-req`,
        });

        const siswaList = await caller.list({ limit: 10, offset: 0 });
        assert.ok(siswaList);
        assert.equal(siswaList.data.length, 1);
        assert.equal(siswaList.data[0]?.nis, "1001");

        const byNis = await caller.getByNis({ nis: "1001" });
        assert.ok(byNis);
        assert.equal(byNis?.nama, "Ahmad Santoso");
      }
    });

    it("3.5 biodataSiswa.list: REJECTS student role with FORBIDDEN", async () => {
      currentRole = "student";
      isAuthenticated = true;

      const createCaller = createCallerFactory(biodataSiswaRouter);
      const caller = createCaller({
        headers: new Headers(),
        requestId: "student-siswa-req",
      });

      await assert.rejects(
        caller.list({ limit: 10, offset: 0 }),
        (err: unknown) => err instanceof TRPCError && err.code === "FORBIDDEN",
        "biodataSiswa.list must reject student with FORBIDDEN",
      );
    });

    it("3.6 /api/export/siswa: PERMITS teacher and staff with ok=true; /api/export/profiles REJECTS teacher and staff with 403", async () => {
      for (const role of ["teacher", "staff"]) {
        currentRole = role;
        isAuthenticated = true;

        // /api/export/siswa should succeed
        const siswaExport = await requireExportAccess("siswa");
        assert.equal(
          siswaExport.ok,
          true,
          `Expected ${role} to be permitted to export siswa per D1`,
        );

        // /api/export/profiles must fail with 403
        const profilesExport = await requireExportAccess("profiles");
        assert.equal(
          profilesExport.ok,
          false,
          `Expected ${role} to be forbidden from exporting profiles`,
        );
        if (!profilesExport.ok) {
          assert.equal(profilesExport.response.status, 403);
        }
      }
    });

    it("3.7 /api/export/siswa: REJECTS student role with 403 and unauthenticated with 401", async () => {
      // Student role
      currentRole = "student";
      isAuthenticated = true;
      const studentExport = await requireExportAccess("siswa");
      assert.equal(studentExport.ok, false);
      if (!studentExport.ok) {
        assert.equal(studentExport.response.status, 403);
      }

      // Unauthenticated
      isAuthenticated = false;
      const unauthExport = await requireExportAccess("siswa");
      assert.equal(unauthExport.ok, false);
      if (!unauthExport.ok) {
        assert.equal(unauthExport.response.status, 401);
      }
    });
  });

  // ==========================================================================
  // Task 4: Contract Synchronization (Issue 03)
  // ==========================================================================
  describe("Task 4: Contract Synchronization (Issue 03)", () => {
    it("4.1 Chronos and Astra contracts are structurally identical", () => {
      const chronosContract = JSON.parse(
        readFileSync("contracts/astra-v1.json", "utf8"),
      ) as unknown;
      const astraContract = JSON.parse(
        readFileSync("../project-astra/contracts/astra-v1.json", "utf8"),
      ) as unknown;

      assert.deepEqual(chronosContract, astraContract);
    });

    it("4.2 contract check script (scripts/check-astra-contract.mjs) passes cleanly", () => {
      const output = execSync("node scripts/check-astra-contract.mjs", {
        encoding: "utf8",
      });
      assert.ok(
        output.includes("matches the canonical Astra contract"),
        `Unexpected script output: ${output}`,
      );
    });

    it("4.3 published contract contains PUT routes and all 6 student lifecycle mutation routes", () => {
      const contract = JSON.parse(
        readFileSync("contracts/astra-v1.json", "utf8"),
      ) as { admin_routes: string[] };

      // PUT routes
      assert.ok(
        contract.admin_routes.includes("PUT /v1/admin/locations/{id}"),
        "Missing PUT /v1/admin/locations/{id}",
      );
      assert.ok(
        contract.admin_routes.includes("PUT /v1/admin/schedules/{id}"),
        "Missing PUT /v1/admin/schedules/{id}",
      );

      // 6 student lifecycle mutation routes (using camelCase {userId} as in Astra routes)
      const expectedStudentMutations = [
        "POST /v1/admin/students/{userId}/approve",
        "POST /v1/admin/students/{userId}/reject",
        "POST /v1/admin/students/{userId}/disable",
        "POST /v1/admin/students/{userId}/reset-code",
        "PATCH /v1/admin/students/{userId}/email",
        "DELETE /v1/admin/students/{userId}/face-enrollment",
      ];

      for (const r of expectedStudentMutations) {
        assert.ok(
          contract.admin_routes.includes(r),
          `Missing student lifecycle route: ${r}`,
        );
      }
    });

    it("4.4 Astra integration manifest test verifies all 61 published routes", () => {
      const output = execSync(
        "bun test tests/integration/contract-manifest.test.ts 2>&1",
        {
          cwd: "../project-astra",
          encoding: "utf8",
        },
      );
      assert.ok(
        output.includes("1 pass"),
        `Astra manifest test failed:\n${output}`,
      );
      assert.ok(
        output.includes("61 expect() calls"),
        `Expected 61 expect() calls in manifest test, got:\n${output}`,
      );
    });
  });

  // ==========================================================================
  // Task 5: Complete Data Paging (Issue 01)
  // ==========================================================================
  describe("Task 5: Complete Data Paging (Issue 01)", () => {
    // Synthetic pagination boundary testing: 0, 99, 100, 101, 1500, 1501, 2000
    for (const count of [0, 99, 100, 101, 1500, 1501, 2000]) {
      it(`collects all ${count} records with stable ordering and correct offsets`, async () => {
        const mockSource = Array.from({ length: count }, (_, i) => ({
          id: `item-${i}`,
          index: i,
          timestamp: `2026-09-05T08:${String(i % 60).padStart(2, "0")}:00Z`,
        }));

        const recordedOffsets: number[] = [];

        const collected = await collectAstraPages(async ({ limit, offset }) => {
          recordedOffsets.push(offset);
          const pageData = mockSource.slice(offset, offset + limit);
          const hasMore = offset + pageData.length < mockSource.length;

          return {
            data: pageData,
            meta: {
              request_id: `page-req-${offset}`,
              pagination: {
                limit,
                offset,
                has_more: hasMore,
              },
            },
            requestId: `page-req-${offset}`,
          };
        });

        // 1. Completeness: exactly count records
        assert.equal(collected.length, count);

        // 2. Ordering stability: strictly monotonic 0..count-1
        for (let i = 0; i < count; i++) {
          assert.equal(collected[i]?.index, i);
          assert.equal(collected[i]?.id, `item-${i}`);
        }

        // 3. Offset progression check
        const expectedPages = Math.max(1, Math.ceil(count / 100));
        assert.equal(recordedOffsets.length, expectedPages);
        for (let p = 0; p < expectedPages; p++) {
          assert.equal(recordedOffsets[p], p * 100);
        }
      });
    }

    it("rejects invalid pagination metadata with AstraPaginationError", async () => {
      // Bad limit
      await assert.rejects(
        collectAstraPages(async () => ({
          data: [{ id: 1 }],
          meta: {
            request_id: "bad-limit",
            pagination: { limit: 50, offset: 0, has_more: false }, // requested 100, returned 50
          },
          requestId: "bad-limit",
        })),
        AstraPaginationError,
      );

      // Incomplete non-final page
      await assert.rejects(
        collectAstraPages(async () => ({
          data: [{ id: 1 }], // only 1 row, but has_more=true
          meta: {
            request_id: "incomplete",
            pagination: { limit: 100, offset: 0, has_more: true },
          },
          requestId: "incomplete",
        })),
        AstraPaginationError,
      );

      // Oversized page
      await assert.rejects(
        collectAstraPages(async () => ({
          data: Array.from({ length: 105 }, (_, i) => ({ id: i })), // 105 rows for limit 100
          meta: {
            request_id: "oversized",
            pagination: { limit: 100, offset: 0, has_more: false },
          },
          requestId: "oversized",
        })),
        AstraPaginationError,
      );
    });
  });
});
