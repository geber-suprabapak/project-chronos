import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

let mockAuthenticated = true;
let mockRole = "school_admin";
let mockMustChangePassword = false;

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
    getLogtoContext: async () => {
      if (!mockAuthenticated) {
        return { isAuthenticated: false, claims: null };
      }
      return {
        isAuthenticated: true,
        claims: {
          sub: "user-admin-m4",
          roles: [mockRole],
          must_change_password: mockMustChangePassword,
        },
      };
    },
  }));
}

const { GET: geocodingHandler } =
  await import("../src/app/api/geocoding/route.ts");
const { GET: geocodeAliasHandler } =
  await import("../src/app/api/geocode/route.ts");

describe("Empirical Challenger M4 Route Handler Tests", () => {
  beforeEach(() => {
    mockAuthenticated = true;
    mockRole = "school_admin";
    mockMustChangePassword = false;
  });

  it("rejects unauthenticated callers with 401 before querying upstream", async () => {
    mockAuthenticated = false;
    const req = new Request("http://localhost:3055/api/geocoding?q=a", {
      headers: { "X-Request-ID": "test-unauth-401" },
    });

    const res = await geocodingHandler(req);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("X-Request-ID"), "test-unauth-401");
    assert.equal(res.headers.get("Cache-Control"), "no-store");
  });

  it("rejects non-admin roles and pending password changes with 403", async () => {
    mockRole = "teacher";
    const teacherRes = await geocodingHandler(
      new Request("http://localhost:3055/api/geocoding?q=smkn2"),
    );
    assert.equal(teacherRes.status, 403);

    mockRole = "school_admin";
    mockMustChangePassword = true;
    const pwdRes = await geocodingHandler(
      new Request("http://localhost:3055/api/geocoding?q=smkn2"),
    );
    assert.equal(pwdRes.status, 403);
  });

  it("returns 400 for short queries for authenticated admins via Route Handler GET", async () => {
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
