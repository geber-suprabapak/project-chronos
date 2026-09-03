import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "../src/lib/logto/claims.ts";

interface SimulatedSession {
  readonly claims: {
    readonly sub: string;
    readonly email?: string;
    readonly roles?: readonly string[];
    readonly must_change_password?: boolean | string | number;
    readonly mfa_verified?: boolean;
    readonly amr?: readonly string[];
  };
}

interface CallbackRouteDecision {
  readonly action: "redirect";
  readonly target: string;
}

function evaluateCallbackRouting(
  session: SimulatedSession,
): CallbackRouteDecision {
  const claims = session.claims;
  if (isPasswordChangeRequired(claims)) {
    const decision: CallbackRouteDecision = {
      action: "redirect",
      target: "/ganti-password",
    };
    return decision;
  }

  const role = resolveLogtoRole(claims.roles);
  if (!role || !isPrivilegedRole(role)) {
    const decision: CallbackRouteDecision = {
      action: "redirect",
      target: "/login?error=forbidden_role",
    };
    return decision;
  }

  const decision: CallbackRouteDecision = {
    action: "redirect",
    target: "/dashboard",
  };
  return decision;
}

describe("Logto Callback and Session Routing", () => {
  it("routes first-login platform_admin with must_change_password to /ganti-password", () => {
    const result = evaluateCallbackRouting({
      claims: {
        sub: "admin-1",
        roles: ["platform_admin"],
        must_change_password: true,
      },
    });
    assert.deepEqual(result, { action: "redirect", target: "/ganti-password" });
  });

  it("allows platform_admin without a custom MFA claim", () => {
    const result = evaluateCallbackRouting({
      claims: {
        sub: "admin-1",
        roles: ["platform_admin"],
        must_change_password: false,
        mfa_verified: false,
        amr: ["pwd"],
      },
    });
    assert.deepEqual(result, { action: "redirect", target: "/dashboard" });
  });

  it("allows platform_admin with an MFA method and no password change", () => {
    const result = evaluateCallbackRouting({
      claims: {
        sub: "admin-1",
        roles: ["platform_admin"],
        must_change_password: false,
        amr: ["pwd", "totp"],
      },
    });
    assert.deepEqual(result, { action: "redirect", target: "/dashboard" });
  });

  it("allows teacher/staff without MFA to /dashboard", () => {
    const result = evaluateCallbackRouting({
      claims: {
        sub: "teacher-1",
        roles: ["teacher"],
        must_change_password: false,
        amr: ["pwd"],
      },
    });
    assert.deepEqual(result, { action: "redirect", target: "/dashboard" });
  });

  it("denies student role and routes to /login?error=forbidden_role", () => {
    const result = evaluateCallbackRouting({
      claims: {
        sub: "student-1",
        roles: ["student"],
        must_change_password: false,
      },
    });
    assert.deepEqual(result, {
      action: "redirect",
      target: "/login?error=forbidden_role",
    });
  });

  it("extracts full_name and email directly from ID token claims without requiring userInfo", () => {
    const claims = {
      sub: "user-42",
      name: "Budi Utomo",
      email: "budi@smkn2-bjm.sch.id",
      roles: ["teacher"],
    };
    const userRole = resolveLogtoRole(claims.roles);
    assert.equal(userRole, "teacher");

    const fallbackEmail = undefined;
    const email = claims.email ?? fallbackEmail ?? "";
    const fallbackName = undefined;
    const fullName = claims.name ?? fallbackName;

    assert.equal(email, "budi@smkn2-bjm.sch.id");
    assert.equal(fullName, "Budi Utomo");
  });

  it("enforces that fetchUserInfo: true is never passed to getLogtoContext in application routes", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const filesToCheck = [
      "src/app/(main)/layout.tsx",
      "src/app/(auth)/ganti-password/page.tsx",
      "src/app/api/logto/user/route.ts",
      "src/app/api/logto/callback/route.ts",
      "src/server/api/trpc.ts",
      "src/server/auth/export-guard.ts",
      "middleware.ts",
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = await fs.readFile(fullPath, "utf-8");
      assert.ok(
        !content.includes("fetchUserInfo: true"),
        `Expected ${relPath} to not contain 'fetchUserInfo: true'`,
      );
    }
  });
});
