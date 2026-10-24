import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDateOnly, schoolDate } from "../src/lib/date-utils.ts";

describe("date-only normalization", () => {
  it("keeps the calendar date when Astra returns an ISO timestamp", () => {
    assert.equal(normalizeDateOnly("2026-08-29T00:00:00.000Z"), "2026-08-29");
  });

  it("rejects malformed values instead of allowing an epoch fallback", () => {
    assert.equal(normalizeDateOnly("not-a-date"), null);
    assert.equal(normalizeDateOnly(""), null);
  });
});

describe("school date in Asia/Jakarta", () => {
  it("changes at midnight WIB, including the UTC early-morning window", () => {
    for (const [instant, date] of [
      ["2026-10-05T16:59:59.999Z", "2026-10-05"],
      ["2026-10-05T17:00:00.000Z", "2026-10-06"],
      // 01:00 WIB on 2026-10-06 must still be the 6th, not the prior UTC date.
      ["2026-10-05T18:00:00.000Z", "2026-10-06"],
      ["2026-10-06T00:00:00.000Z", "2026-10-06"],
      ["2026-10-06T16:59:59.999Z", "2026-10-06"],
    ] as const) {
      assert.equal(schoolDate(new Date(instant)), date);
    }
  });

  it("does not depend on the host timezone", () => {
    const original = process.env.TZ;
    try {
      for (const timezone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
        process.env.TZ = timezone;
        assert.equal(
          schoolDate(new Date("2026-10-05T17:30:00Z")),
          "2026-10-06",
        );
      }
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
