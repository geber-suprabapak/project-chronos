import { describe, it } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  APP_ROLES,
  toCanonicalRole,
  hasRequiredRole,
  canImportRoster,
  type AppRole,
} from "../src/server/auth/rbac.ts";
import {
  extractExtendedClaims,
  resolveLogtoRole,
} from "../src/lib/logto/claims.ts";
import { parseOfficialRosterWorkbook } from "../src/server/roster/parser.ts";

// The canonical `school_admin` allow-list used by `schoolAdminProcedure`
// (src/server/api/trpc.ts) and by the Siswa import-panel predicate
// (`canImportRoster`, src/app/(main)/siswa/page.tsx).
const ROSTER_IMPORT_ALLOWED: readonly AppRole[] = ["school_admin"];

const ALLOWED_ALIAS_ROLES: readonly AppRole[] = [
  "school_admin",
  "admin",
  "kepala_sekolah",
];

const DENIED_ROLES: readonly AppRole[] = APP_ROLES.filter(
  (role) => !ALLOWED_ALIAS_ROLES.includes(role),
);

async function validOfficialWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const first = workbook.addWorksheet("X PPLG 1");
  first.getCell("C3").value = "Kelas";
  first.getCell("E3").value = ": X   PPLG  1";
  first.getCell("N3").value = "Tahun Ajaran";
  first.getCell("S3").value = ": 2026/2027";
  first.getRow(7).values = ["No", "NIS", "Nama Siswa", "L/P"];
  first.getRow(8).values = [1, 18002, "Siti Aminah", "P"];

  const second = workbook.addWorksheet("X AKL 1");
  second.getCell("C2").value = "Kelas";
  second.getCell("E2").value = ": X AKL 1";
  second.getCell("N2").value = "Tahun Ajaran";
  second.getCell("S2").value = ": 2026/2027";
  second.getRow(4).values = ["No", "NIS", "Nama Siswa", "L/P"];
  second.getRow(5).values = [2, 18200, "Budi Santoso", "L"];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function invalidOfficialWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("X PPLG 1");
  worksheet.getCell("C3").value = "Kelas";
  worksheet.getCell("E3").value = ": X PPLG 1";
  worksheet.getCell("N3").value = "Tahun Ajaran";
  worksheet.getCell("S3").value = ": 2026/2027";
  worksheet.getRow(7).values = ["No", "NIS", "Nama Siswa", "L/P"];
  // Uncached formula NIS: rejected by the workbook parser.
  worksheet.getRow(8).values = [1, { formula: "18001+1" }, "Siti Aminah", "P"];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("roster import authorization for documented administrator aliases", () => {
  it("admits canonical school_admin and its documented aliases through the actual claims path", () => {
    for (const role of ALLOWED_ALIAS_ROLES) {
      const claims = extractExtendedClaims({
        sub: "user-1",
        roles: [role],
      } as Parameters<typeof extractExtendedClaims>[0]);
      const resolved = resolveLogtoRole(claims?.roles ?? []);

      assert.equal(
        resolved,
        role,
        `claims role ${role} must resolve unchanged`,
      );
      assert.equal(
        toCanonicalRole(resolved as AppRole),
        "school_admin",
        `role ${role} must normalize to school_admin`,
      );
      assert.equal(
        hasRequiredRole(resolved as AppRole, ROSTER_IMPORT_ALLOWED),
        true,
        `route guard must admit ${role}`,
      );
      assert.equal(
        canImportRoster(resolved),
        true,
        `import predicate must admit ${role}`,
      );
    }
  });

  it("denies every other documented role through the actual claims path", () => {
    for (const role of DENIED_ROLES) {
      const claims = extractExtendedClaims({
        sub: "user-1",
        roles: [role],
      } as Parameters<typeof extractExtendedClaims>[0]);
      const resolved = resolveLogtoRole(claims?.roles ?? []);

      assert.equal(
        resolved,
        role,
        `claims role ${role} must resolve unchanged`,
      );
      assert.equal(
        hasRequiredRole(resolved as AppRole, ROSTER_IMPORT_ALLOWED),
        false,
        `route guard must deny ${role}`,
      );
      assert.equal(
        canImportRoster(resolved),
        false,
        `import predicate must deny ${role}`,
      );
    }
  });

  it("denies unauthenticated and role-less claims", () => {
    assert.equal(resolveLogtoRole(null), null);
    assert.equal(resolveLogtoRole([]), null);
    assert.equal(canImportRoster(null), false);
    assert.equal(canImportRoster(undefined), false);

    const claims = extractExtendedClaims({
      sub: "user-1",
    } as Parameters<typeof extractExtendedClaims>[0]);
    const resolved = resolveLogtoRole(claims?.roles ?? []);
    assert.equal(resolved, null);
    assert.equal(canImportRoster(resolved), false);
  });

  it("uses role priority, not display labels, when claims carry several roles", () => {
    // Highest-priority administrator claim wins via the normal claims path.
    assert.equal(resolveLogtoRole(["teacher", "admin"]), "admin");
    assert.equal(canImportRoster(resolveLogtoRole(["teacher", "admin"])), true);
    assert.equal(
      canImportRoster(resolveLogtoRole(["student", "kepala_sekolah"])),
      true,
    );
    // Teacher-only claims stay denied even though a teacher may read /siswa.
    assert.equal(canImportRoster(resolveLogtoRole(["guru"])), false);
    assert.equal(
      canImportRoster(resolveLogtoRole(["guru", "wali_kelas", "siswa"])),
      false,
    );
  });

  it("lets each allowed alias proceed with a valid synthetic workbook and stops every denied role before it", async () => {
    const workbook = await validOfficialWorkbook();
    const report = await parseOfficialRosterWorkbook(workbook);
    assert.deepEqual(report.errors, []);
    assert.equal(report.totalRows, 2);

    for (const role of ALLOWED_ALIAS_ROLES) {
      assert.equal(
        canImportRoster(resolveLogtoRole([role])),
        true,
        `${role} must be able to import the valid workbook`,
      );
    }

    for (const role of DENIED_ROLES) {
      assert.equal(
        canImportRoster(resolveLogtoRole([role])),
        false,
        `${role} must be denied regardless of workbook validity`,
      );
    }
  });

  it("keeps invalid-workbook behavior unchanged and independent of the role gate", async () => {
    const invalid = await invalidOfficialWorkbook();
    const report = await parseOfficialRosterWorkbook(invalid);

    assert.equal(report.totalRows, 1);
    assert.ok(
      report.errors.some((error) => error.field === "nis"),
      "uncached formula NIS must still be rejected",
    );

    // Authorization stays workbook-independent: the same verdicts as with a
    // valid workbook, so no role gains or loses import access through an
    // invalid payload.
    for (const role of ALLOWED_ALIAS_ROLES) {
      assert.equal(canImportRoster(resolveLogtoRole([role])), true, role);
    }
    for (const role of DENIED_ROLES) {
      assert.equal(canImportRoster(resolveLogtoRole([role])), false, role);
    }
  });
});
