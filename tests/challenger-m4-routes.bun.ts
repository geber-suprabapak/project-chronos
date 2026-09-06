import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GET as geocodingHandler } from "../src/app/api/geocoding/route.ts";
import { GET as geocodeAliasHandler } from "../src/app/api/geocode/route.ts";

describe("Empirical Challenger M4 Route Handler Tests", () => {
  it("returns 400 for short queries via Route Handler GET", async () => {
    const req = new Request("http://localhost:3055/api/geocoding?q=a", {
      headers: { "X-Request-ID": "test-req-123" },
    });

    const res = await geocodingHandler(req);
    assert.equal(res.status, 400);
    assert.equal(res.headers.get("X-Request-ID"), "test-req-123");

    const body = (await res.json()) as { success: boolean; code: string };
    assert.equal(body.success, false);
    assert.equal(body.code, "INVALID_QUERY");
  });

  it("/api/geocode alias exports the exact same handler", () => {
    assert.equal(geocodingHandler, geocodeAliasHandler);
  });
});
