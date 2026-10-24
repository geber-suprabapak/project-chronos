import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import {
  applyScheduleWrites,
  type ScheduleBatchClient,
  type ScheduleWrite,
} from "../src/server/api/routers/jadwal-batch.ts";

/**
 * Deterministic in-memory Astra schedule fixture (contract v1 envelope shape
 * is not needed here; the transport boundary is injected, see
 * `jadwal-batch.ts` ScheduleBatchClient).
 *
 * Write behavior is controlled by two knobs:
 * - `failOnWrite`: 1-based index of the write that fails with 503.
 * - `commitThenFail`: when true, the failing write applies the payload to the
 *   fixture state before throwing, modeling an ambiguous timeout where the
 *   commit status of the failed response is unknown.
 */
type FixtureSchedule = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  start_checkout: string;
  end_checkout: string;
  grace_period_minutes: number;
  is_active: boolean;
};

function createFixture() {
  const state: FixtureSchedule[] = [
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

  let failOnWrite = 2;
  let commitThenFail = false;
  let writeCount = 0;
  let listCount = 0;

  const client: ScheduleBatchClient & {
    arm: (options: { failOnWrite?: number; commitThenFail?: boolean }) => void;
    resetCounters: () => void;
    counts: () => { writeCount: number; listCount: number };
  } = {
    async listSchedules() {
      listCount += 1;
      return state.map((row) => ({ ...row }));
    },
    async updateSchedule(id, payload) {
      writeCount += 1;
      const row = state.find((item) => item.id === id);
      if (!row) throw new Error(`fixture: unknown schedule id ${id}`);
      if (writeCount === failOnWrite) {
        // commitThenFail models a lost response after a committed write.
        if (!commitThenFail) {
          throw Object.assign(new Error("upstream 503"), { status: 503 });
        }
      }
      Object.assign(row, payload);
      if (writeCount === failOnWrite) {
        throw Object.assign(new Error("upstream timeout"), { status: 504 });
      }
      return { ...row };
    },
    async createSchedule() {
      throw new Error("fixture: create not expected in these scenarios");
    },
    arm(options) {
      failOnWrite = options.failOnWrite ?? 2;
      commitThenFail = options.commitThenFail ?? false;
    },
    resetCounters() {
      writeCount = 0;
      listCount = 0;
    },
    counts: () => ({ writeCount, listCount }),
  };

  return { state, client };
}

const BATCH_EDIT_DAYS = ["senin", "selasa", "rabu"] as const;

function batchEditPlan(): ScheduleWrite[] {
  return BATCH_EDIT_DAYS.map((hari, index) => ({
    id: index + 1,
    hari,
    payload: { start_time: "06:45:00" },
  }));
}

function resetPlan(): ScheduleWrite[] {
  // Mirrors the router's `reset` mutation: every day is written back to the
  // documented defaults, sequentially, one PUT per day.
  return (
    [
      ["senin", true, "15:00:00"],
      ["selasa", true, "15:00:00"],
      ["rabu", true, "15:00:00"],
      ["kamis", true, "15:00:00"],
      ["jumat", true, "11:00:00"],
      ["sabtu", false, "12:00:00"],
      ["minggu", false, "15:00:00"],
    ] as const
  ).map(([hari, isActive, checkout], index) => ({
    id: index + 1,
    hari,
    payload: {
      day_of_week: hari,
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: checkout,
      grace_period_minutes: 15,
      is_active: isActive,
    },
  }));
}

async function assertPartialOutcome(
  run: () => Promise<unknown>,
  expected: string,
) {
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof TRPCError);
    assert.match(error.message, /Perubahan jadwal sebagian\./);
    assert.match(error.message, new RegExp(expected));
    return true;
  });
}

describe("schedule batch/reset partial write outcomes (C06)", () => {
  it("batch edit: first write commits, second fails, third is not attempted", async () => {
    const { state, client } = createFixture();
    client.arm({ failOnWrite: 2 });
    client.resetCounters();

    await assertPartialOutcome(
      () => applyScheduleWrites(batchEditPlan(), state, client),
      "Senin: tersimpan; Selasa: gagal; Rabu: belum dicoba",
    );

    assert.equal(state[0]?.start_time, "06:45:00", "Monday stays committed");
    assert.equal(state[1]?.start_time, "05:30:00", "Tuesday did not commit");
    assert.equal(state[2]?.start_time, "05:30:00", "Wednesday untouched");
    const { writeCount, listCount } = client.counts();
    assert.equal(writeCount, 2, "exactly two writes attempted");
    assert.equal(
      listCount,
      1,
      "failed write is re-read from the authoritative list",
    );
  });

  it("reset: failure after one success reports committed/failed/not-attempted days", async () => {
    const { state, client } = createFixture();
    client.arm({ failOnWrite: 2 });
    client.resetCounters();

    await assertPartialOutcome(
      () => applyScheduleWrites(resetPlan(), state, client),
      "Senin: tersimpan; Selasa: gagal; Rabu: belum dicoba",
    );

    assert.equal(state[0]?.start_time, "06:30:00");
    assert.equal(state[0]?.start_checkout, "15:00:00");
    assert.equal(state[1]?.start_time, "05:30:00", "Tuesday not reset");
    const { writeCount } = client.counts();
    assert.equal(writeCount, 2);
  });

  it("retry after a failed reset skips the committed day and finishes the rest", async () => {
    const { state, client } = createFixture();
    client.arm({ failOnWrite: 2 });
    await assert.rejects(() => applyScheduleWrites(resetPlan(), state, client));
    const writesBeforeRetry = client.counts().writeCount;

    client.arm({ failOnWrite: 0 });
    const results = await applyScheduleWrites(resetPlan(), state, client);
    assert.equal(results.length, 7);
    const after = client.counts();
    assert.equal(
      after.writeCount - writesBeforeRetry,
      6,
      "already-committed Monday is not replayed",
    );
    assert.equal(state[0]?.start_time, "06:30:00");
    assert.equal(state[5]?.is_active, false, "Saturday default applied");
    assert.equal(state[6]?.is_active, false, "Sunday default applied");
  });

  it("ambiguous timeout: committed write is re-read, classified tersimpan, and not replayed", async () => {
    const { state, client } = createFixture();
    client.arm({ failOnWrite: 2, commitThenFail: true });
    client.resetCounters();

    // The failed response lost the outcome, but the write actually committed.
    await assertPartialOutcome(
      () => applyScheduleWrites(batchEditPlan(), state, client),
      "Senin: tersimpan; Selasa: tersimpan; Rabu: belum dicoba",
    );
    assert.equal(
      state[1]?.start_time,
      "06:45:00",
      "Tuesday committed despite the failed response",
    );
    assert.equal(
      client.counts().listCount,
      1,
      "failed response is followed by an authoritative read",
    );

    client.arm({ failOnWrite: 0 });
    const writesBeforeRetry = client.counts().writeCount;
    const results = await applyScheduleWrites(batchEditPlan(), state, client);
    assert.equal(results.length, 3);
    assert.equal(
      client.counts().writeCount - writesBeforeRetry,
      1,
      "only the not-yet-applied day is written on retry",
    );
  });

  it("unverifiable failed write (re-read also fails) blocks retry with an explicit message", async () => {
    const { state, client } = createFixture();
    client.arm({ failOnWrite: 2 });
    const originalList = client.listSchedules.bind(client);
    let listFails = true;
    client.listSchedules = async () => {
      if (listFails) throw new Error("fixture: read unavailable");
      return originalList();
    };

    await assert.rejects(
      () => applyScheduleWrites(batchEditPlan(), state, client),
      (error: unknown) => {
        assert.ok(error instanceof TRPCError);
        assert.match(
          error.message,
          /Status perubahan Selasa belum dapat diverifikasi/,
        );
        return true;
      },
    );
  });
});
