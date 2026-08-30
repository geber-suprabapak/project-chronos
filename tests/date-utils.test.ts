import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeDateOnly } from "../src/lib/date-utils.ts";

describe("date-only normalization", () => {
  it("keeps the calendar date when Astra returns an ISO timestamp", () => {
    assert.equal(normalizeDateOnly("2026-08-29T00:00:00.000Z"), "2026-08-29");
  });

  it("rejects malformed values instead of allowing an epoch fallback", () => {
    assert.equal(normalizeDateOnly("not-a-date"), null);
    assert.equal(normalizeDateOnly(""), null);
  });
});
