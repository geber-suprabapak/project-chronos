import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAdminRole,
  isMfaVerified,
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

  if (isAdminRole(role) && !isMfaVerified(claims.mfa_verified, claims.amr)) {
    const decision: CallbackRouteDecision = {
      action: "redirect",
      target: "/login?error=mfa_required",
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

  it("denies platform_admin missing MFA and routes to /login?error=mfa_required", () => {
    const result = evaluateCallbackRouting({
      claims: {
        sub: "admin-1",
        roles: ["platform_admin"],
        must_change_password: false,
        mfa_verified: false,
        amr: ["pwd"],
      },
    });
    assert.deepEqual(result, {
      action: "redirect",
      target: "/login?error=mfa_required",
    });
  });

  it("allows verified platform_admin with MFA and no password change to /dashboard", () => {
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
});
