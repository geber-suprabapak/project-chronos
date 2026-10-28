import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapAstraSchedule } from "../src/server/api/routers/jadwal-mapping.ts";

describe("Astra schedule mapping", () => {
  it("uses the weekday as the stable UI id when Astra ids are not numeric day ids", () => {
    const mapped = mapAstraSchedule({
      id: "2026-08-29-schedule-jumat",
      day_of_week: "jumat",
      start_time: "06:30:00",
      end_time: "07:30:00",
      start_checkout: "11:00:00",
      end_checkout: "12:00:00",
      is_active: true,
    });

    assert.equal(mapped.id, 5);
    assert.equal(mapped.astraId, "2026-08-29-schedule-jumat");
    assert.equal(mapped.hari, "jumat");
    assert.equal(mapped.mulaiPulang, "11:00:00");
  });

  it("keeps duplicate weekday schedules separately addressable", () => {
    const first = mapAstraSchedule({
      id: "schedule-monday-first",
      day_of_week: "senin",
      start_time: "00:00:00",
      end_time: "11:59:00",
      is_active: true,
    });
    const second = mapAstraSchedule({
      id: "schedule-monday-second",
      day_of_week: "senin",
      start_time: "06:00:00",
      end_time: "07:15:00",
      is_active: true,
    });

    assert.equal(first.id, second.id);
    assert.notEqual(first.astraId, second.astraId);
  });
});
