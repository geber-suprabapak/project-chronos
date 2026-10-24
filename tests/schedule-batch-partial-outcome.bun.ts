import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

const bunTest = await import(
  // @ts-expect-error dynamic import under Bun's test runner
  "bun:test"
);
let scheduleState: Record<string, unknown>[] = [];
let failOnWrite = 0;
let writeCount = 0;
let getCount = 0;
let commitThenFail = false;

bunTest.mock.module("@logto/next/server-actions", () => ({
  getAccessTokenRSC: async () => "local-test-token",
  getLogtoContext: async () => ({
    isAuthenticated: true,
    claims: { sub: "schedule-test", roles: ["school_admin"] },
    userInfo: { email: "schedule-test@example.invalid", name: "Test" },
  }),
}));

const { createCallerFactory } = await import("../src/server/api/trpc.ts");
const { jadwalRouter } = await import("../src/server/api/routers/jadwal.ts");

function resetFixture() {
  scheduleState = [
    "senin",
    "selasa",
    "rabu",
    "kamis",
    "jumat",
    "sabtu",
    "minggu",
  ].map((day, index) => ({
    id: String(index + 1),
    day_of_week: day,
    start_time: "05:30:00",
    end_time: "07:30:00",
    start_checkout: "15:00:00",
    end_checkout: "16:00:00",
    grace_period_minutes: 15,
    is_active: index < 5,
  }));
  failOnWrite = 2;
  writeCount = 0;
  getCount = 0;
  commitThenFail = false;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/v1/admin/schedules" && init?.method !== "PUT") {
      getCount += 1;
      return astraResponse(scheduleState);
    }
    if (path.startsWith("/v1/admin/schedules/") && init?.method === "PUT") {
      writeCount += 1;
      const id = path.split("/").at(-1);
      const row = scheduleState.find((item) => item.id === id);
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      if ((writeCount !== failOnWrite || commitThenFail) && row) {
        Object.assign(row, body);
      }
      if (writeCount === failOnWrite) {
        if (commitThenFail)
          throw new TypeError("fixture response lost after commit");
        return astraResponse({ code: "DEPENDENCY_UNAVAILABLE" }, 503, false);
      }
      return astraResponse(row, 200);
    }
    throw new Error(
      `Unexpected local fixture request: ${init?.method} ${path}`,
    );
  };
}

function astraResponse(data: unknown, status = 200, success = true) {
  return new Response(
    JSON.stringify({ success, data, meta: { request_id: "schedule-fixture" } }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
        "X-Request-ID": "schedule-fixture",
      },
    },
  );
}

function caller() {
  return createCallerFactory(jadwalRouter)({
    headers: new Headers(),
    requestId: "schedule-outcome-test",
  });
}

describe("schedule partial write outcomes", () => {
  it("reports committed, failed, and not-attempted days for a batch edit", async () => {
    resetFixture();
    await assert.rejects(
      caller().updateBatch([
        { id: 1, data: { mulaiMasuk: "06:45:00" } },
        { id: 2, data: { mulaiMasuk: "06:45:00" } },
        { id: 3, data: { mulaiMasuk: "06:45:00" } },
      ]),
      (error: unknown) => {
        assert.ok(error instanceof TRPCError);
        assert.match(error.message, /Senin.*tersimpan/i);
        assert.match(error.message, /Selasa.*gagal/i);
        assert.match(error.message, /Rabu.*belum dicoba/i);
        return true;
      },
    );
    assert.equal(scheduleState[0]?.start_time, "06:45:00");
    assert.equal(scheduleState[1]?.start_time, "05:30:00");
    assert.equal(writeCount, 2);
    assert.equal(
      getCount,
      2,
      "read before write and after failed/ambiguous write",
    );
  });

  it("reports partial reset outcomes and re-reads before a safe retry", async () => {
    resetFixture();
    await assert.rejects(caller().reset(), (error: unknown) => {
      assert.ok(error instanceof TRPCError);
      assert.match(error.message, /Senin.*tersimpan/i);
      assert.match(error.message, /Selasa.*gagal/i);
      assert.match(error.message, /Rabu.*belum dicoba/i);
      return true;
    });
    assert.equal(writeCount, 2);
    assert.equal(getCount, 2);

    failOnWrite = 0;
    const beforeRetry = writeCount;
    const result = await caller().reset();
    assert.equal(result.length, 7);
    assert.equal(
      writeCount - beforeRetry,
      6,
      "already-committed Monday is not replayed",
    );
    assert.equal(getCount, 3, "retry starts with a fresh schedule read");
  });

  it("re-reads an ambiguously timed-out write and skips it on retry", async () => {
    resetFixture();
    commitThenFail = true;
    await assert.rejects(
      caller().updateBatch([
        { id: 1, data: { mulaiMasuk: "06:45:00" } },
        { id: 2, data: { mulaiMasuk: "06:45:00" } },
        { id: 3, data: { mulaiMasuk: "06:45:00" } },
      ]),
      (error: unknown) => {
        assert.ok(error instanceof TRPCError);
        assert.match(error.message, /Senin.*tersimpan/i);
        assert.match(error.message, /Selasa.*tersimpan/i);
        assert.match(error.message, /Rabu.*belum dicoba/i);
        return true;
      },
    );
    assert.equal(
      getCount,
      2,
      "failed response is followed by an authoritative read",
    );
    assert.equal(scheduleState[1]?.start_time, "06:45:00");

    failOnWrite = 0;
    const beforeRetry = writeCount;
    const result = await caller().updateBatch([
      { id: 1, data: { mulaiMasuk: "06:45:00" } },
      { id: 2, data: { mulaiMasuk: "06:45:00" } },
      { id: 3, data: { mulaiMasuk: "06:45:00" } },
    ]);
    assert.equal(result.length, 3);
    assert.equal(
      writeCount - beforeRetry,
      1,
      "only the not-yet-applied day is written",
    );
  });
});
