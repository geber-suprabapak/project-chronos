import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isAdminRole,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "../src/lib/logto/claims.ts";
import { logtoConfig } from "../src/lib/logto/config.ts";

describe("Logto Claims & RBAC Resolution", () => {
  describe("resolveLogtoRole", () => {
    it("resolves platform_admin with highest priority", () => {
      const role = resolveLogtoRole(["teacher", "platform_admin", "student"]);
      assert.equal(role, "platform_admin");
    });

    it("resolves school_admin when platform_admin is not present", () => {
      const role = resolveLogtoRole(["teacher", "school_admin"]);
      assert.equal(role, "school_admin");
    });

    it("resolves legacy admin and kepala_sekolah roles", () => {
      assert.equal(resolveLogtoRole(["admin"]), "admin");
      assert.equal(resolveLogtoRole(["kepala_sekolah"]), "kepala_sekolah");
      assert.equal(resolveLogtoRole(["wali_kelas"]), "wali_kelas");
      assert.equal(resolveLogtoRole(["guru"]), "guru");
    });

    it("resolves teacher and staff roles", () => {
      assert.equal(resolveLogtoRole(["teacher"]), "teacher");
      assert.equal(resolveLogtoRole(["staff"]), "staff");
    });

    it("resolves student and siswa roles", () => {
      assert.equal(resolveLogtoRole(["student"]), "student");
      assert.equal(resolveLogtoRole(["siswa"]), "siswa");
    });

    it("returns null for empty or invalid roles", () => {
      assert.equal(resolveLogtoRole([]), null);
      assert.equal(resolveLogtoRole(null), null);
      assert.equal(resolveLogtoRole(undefined), null);
      assert.equal(resolveLogtoRole(["unknown_role"]), null);
    });
  });

  describe("isPrivilegedRole & isAdminRole", () => {
    it("identifies privileged roles correctly", () => {
      assert.equal(isPrivilegedRole("platform_admin"), true);
      assert.equal(isPrivilegedRole("school_admin"), true);
      assert.equal(isPrivilegedRole("teacher"), true);
      assert.equal(isPrivilegedRole("staff"), true);
      assert.equal(isPrivilegedRole("admin"), true);
      assert.equal(isPrivilegedRole("kepala_sekolah"), true);
      assert.equal(isPrivilegedRole("guru"), true);
      assert.equal(isPrivilegedRole("wali_kelas"), true);

      assert.equal(isPrivilegedRole("student"), false);
      assert.equal(isPrivilegedRole("siswa"), false);
      assert.equal(isPrivilegedRole(null), false);
      assert.equal(isPrivilegedRole(undefined), false);
    });

    it("identifies admin roles correctly", () => {
      assert.equal(isAdminRole("platform_admin"), true);
      assert.equal(isAdminRole("school_admin"), true);
      assert.equal(isAdminRole("admin"), true);
      assert.equal(isAdminRole("kepala_sekolah"), true);

      assert.equal(isAdminRole("teacher"), false);
      assert.equal(isAdminRole("guru"), false);
      assert.equal(isAdminRole("staff"), false);
      assert.equal(isAdminRole("student"), false);
    });
  });

  describe("isPasswordChangeRequired", () => {
    it("returns true for truthy must_change_password values", () => {
      assert.equal(
        isPasswordChangeRequired({ must_change_password: true }),
        true,
      );
      assert.equal(isPasswordChangeRequired({ must_change_password: 1 }), true);
      assert.equal(
        isPasswordChangeRequired({ must_change_password: "true" }),
        true,
      );
      assert.equal(
        isPasswordChangeRequired({ must_change_password: "1" }),
        true,
      );
      assert.equal(
        isPasswordChangeRequired({ must_change_password: "yes" }),
        true,
      );
    });

    it("returns false for falsy or absent must_change_password", () => {
      assert.equal(
        isPasswordChangeRequired({ must_change_password: false }),
        false,
      );
      assert.equal(
        isPasswordChangeRequired({ must_change_password: 0 }),
        false,
      );
      assert.equal(
        isPasswordChangeRequired({ must_change_password: "false" }),
        false,
      );
      assert.equal(isPasswordChangeRequired({}), false);
      assert.equal(isPasswordChangeRequired(null), false);
      assert.equal(isPasswordChangeRequired(undefined), false);
    });
  });

  describe("logtoConfig", () => {
    it("exports valid LogtoNextConfig with required scopes", () => {
      assert.ok(logtoConfig.endpoint);
      assert.ok(logtoConfig.appId);
      assert.ok(logtoConfig.appSecret);
      assert.ok(logtoConfig.baseUrl);
      assert.ok(logtoConfig.cookieSecret);
      assert.ok(Array.isArray(logtoConfig.scopes));
      assert.ok(logtoConfig.scopes.includes("roles"));
      assert.ok(logtoConfig.scopes.includes("profile"));
      assert.ok(logtoConfig.scopes.includes("mobile:access"));
      assert.ok(logtoConfig.scopes.includes("admin:read"));
    });
  });
});
