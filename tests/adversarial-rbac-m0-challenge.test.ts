import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APP_ROLES,
  CANONICAL_APP_ROLES,
  ROLE_ALIAS_MAP,
  toCanonicalRole,
  isAppRole,
  isPrivilegedRole,
  isAdminRole,
  canAccessConfiguration,
  canAccessProfiles,
  canManageManualAttendance,
  canDeleteAttendance,
  canPerformMonthlyBackup,
  canExportResource,
  canUploadFiles,
  canAccessSiswa,
  canAccessAbsensi,
  canAccessPerizinan,
  canAccessDashboard,
  type AppRole,
} from "../src/server/auth/rbac.ts";
import { resolveLogtoRole } from "../src/lib/logto/claims.ts";

describe("Adversarial Challenge M0: Chronos Authorization & Export Boundaries", () => {
  const adminRoles: readonly AppRole[] = [
    "platform_admin",
    "school_admin",
    "admin",
    "kepala_sekolah",
  ];

  const teacherStaffRoles: readonly AppRole[] = [
    "teacher",
    "staff",
    "guru",
    "wali_kelas",
  ];

  const studentRoles: readonly AppRole[] = ["student", "siswa"];

  const maliciousInputs = [
    null,
    undefined,
    "",
    "   ",
    "teacher ",
    "TEACHER",
    "admin ",
    "ADMIN",
    "school_admin\0",
    "root",
    "superadmin",
    "__proto__",
    "constructor",
    "toString",
    "valueOf",
  ];

  describe("1. canExportResource Boundaries", () => {
    it("allows teacher, staff, and admins to export 'siswa' operational roster", () => {
      for (const role of [...adminRoles, ...teacherStaffRoles]) {
        assert.equal(
          canExportResource(role, "siswa"),
          true,
          `Expected ${role} to be permitted to export 'siswa'`,
        );
      }
    });

    it("strictly rejects student, siswa, and adversarial inputs from exporting 'siswa'", () => {
      for (const role of studentRoles) {
        assert.equal(
          canExportResource(role, "siswa"),
          false,
          `Expected student role ${role} to be rejected from exporting 'siswa'`,
        );
      }

      for (const input of maliciousInputs) {
        assert.equal(
          canExportResource(input as any, "siswa"),
          false,
          `Expected malicious input '${String(input)}' to be rejected from exporting 'siswa'`,
        );
      }
    });

    it("strictly rejects teacher and staff from exporting 'profiles' (Account Lifecycle is admin-only)", () => {
      for (const role of teacherStaffRoles) {
        assert.equal(
          canExportResource(role, "profiles"),
          false,
          `Expected teacher/staff role ${role} to be rejected from exporting 'profiles'`,
        );
      }

      for (const role of studentRoles) {
        assert.equal(
          canExportResource(role, "profiles"),
          false,
          `Expected student role ${role} to be rejected from exporting 'profiles'`,
        );
      }

      for (const input of maliciousInputs) {
        assert.equal(
          canExportResource(input as any, "profiles"),
          false,
          `Expected malicious input '${String(input)}' to be rejected from exporting 'profiles'`,
        );
      }

      // Admin roles must be permitted
      for (const role of adminRoles) {
        assert.equal(
          canExportResource(role, "profiles"),
          true,
          `Expected admin role ${role} to be permitted to export 'profiles'`,
        );
      }
    });

    it("strictly rejects teacher and staff from exporting 'backup' (Database Backup is admin-only)", () => {
      for (const role of teacherStaffRoles) {
        assert.equal(
          canExportResource(role, "backup"),
          false,
          `Expected teacher/staff role ${role} to be rejected from exporting 'backup'`,
        );
      }

      for (const role of adminRoles) {
        assert.equal(
          canExportResource(role, "backup"),
          true,
          `Expected admin role ${role} to be permitted to export 'backup'`,
        );
      }
    });
  });

  describe("2. Surface Access Boundaries (/siswa vs /profiles)", () => {
    it("permits teacher and staff on /siswa (operational roster) but denies on /profiles (admin directory)", () => {
      for (const role of teacherStaffRoles) {
        assert.equal(
          canAccessSiswa(role),
          true,
          `Expected ${role} to access /siswa`,
        );
        assert.equal(
          canAccessProfiles(role),
          false,
          `Expected ${role} to NOT access /profiles`,
        );
      }
    });

    it("restricts manual attendance, deletion, and monthly backup strictly to admin roles", () => {
      for (const role of teacherStaffRoles) {
        assert.equal(canManageManualAttendance(role), false);
        assert.equal(canDeleteAttendance(role), false);
        assert.equal(canPerformMonthlyBackup(role), false);
      }

      for (const role of adminRoles) {
        assert.equal(canManageManualAttendance(role), true);
        assert.equal(canDeleteAttendance(role), true);
        assert.equal(canPerformMonthlyBackup(role), true);
      }
    });
  });

  describe("3. Privilege Escalation & Role Resolution Stress Test", () => {
    it("prevents role spoofing via case variation or whitespace injection", () => {
      for (const input of maliciousInputs) {
        assert.equal(isPrivilegedRole(input), false);
        assert.equal(isAdminRole(input), false);
        assert.equal(isAppRole(input), false);
      }
    });

    it("resolves roles with strict priority without privilege leakage", () => {
      // If a user has both 'student' and 'teacher', highest priority is chosen
      assert.equal(resolveLogtoRole(["student", "teacher"]), "teacher");
      // If a user has both 'teacher' and 'school_admin', school_admin takes precedence
      assert.equal(
        resolveLogtoRole(["teacher", "school_admin"]),
        "school_admin",
      );
      // If a user has 'platform_admin' with any other role, platform_admin wins
      assert.equal(
        resolveLogtoRole(["student", "teacher", "platform_admin"]),
        "platform_admin",
      );
      // If empty or invalid, returns null
      assert.equal(resolveLogtoRole([]), null);
      assert.equal(resolveLogtoRole(null), null);
      assert.equal(resolveLogtoRole(["unknown_role"]), null);
    });

    it("correctly maps legacy aliases without elevating unprivileged roles", () => {
      assert.equal(toCanonicalRole("guru"), "teacher");
      assert.equal(toCanonicalRole("wali_kelas"), "teacher");
      assert.equal(toCanonicalRole("admin"), "school_admin");
      assert.equal(toCanonicalRole("kepala_sekolah"), "school_admin");
      assert.equal(toCanonicalRole("siswa"), "student");

      assert.equal(isPrivilegedRole(toCanonicalRole("siswa")), false);
      assert.equal(isAdminRole(toCanonicalRole("siswa")), false);
      assert.equal(isAdminRole(toCanonicalRole("guru")), false);
      assert.equal(isAdminRole(toCanonicalRole("wali_kelas")), false);
      assert.equal(isAdminRole(toCanonicalRole("admin")), true);
      assert.equal(isAdminRole(toCanonicalRole("kepala_sekolah")), true);
    });
  });
});
