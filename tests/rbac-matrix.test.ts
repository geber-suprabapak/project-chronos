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
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_FILE_MIME_TYPES,
  ALLOWED_FILE_EXTENSIONS,
  ALLOWED_MIME_TO_EXTENSIONS,
  validateUploadedFile,
} from "../src/server/auth/file-guard.ts";
import { createAstraRequestId } from "../src/lib/astra/request-id.ts";

describe("Issue 04 Role & Action Enforcement Matrix", () => {
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

  describe("Role Taxonomy and Aliases", () => {
    it("recognizes all defined application roles", () => {
      for (const role of APP_ROLES) {
        assert.equal(isAppRole(role), true);
      }
      assert.equal(isAppRole("unknown_role"), false);
      assert.equal(isAppRole(null), false);
      assert.equal(isAppRole(undefined), false);
    });

    it("maps legacy aliases to canonical roles", () => {
      assert.equal(toCanonicalRole("admin"), "school_admin");
      assert.equal(toCanonicalRole("kepala_sekolah"), "school_admin");
      assert.equal(toCanonicalRole("guru"), "teacher");
      assert.equal(toCanonicalRole("wali_kelas"), "teacher");
      assert.equal(toCanonicalRole("siswa"), "student");

      // Canonical roles map to themselves
      for (const canonical of CANONICAL_APP_ROLES) {
        assert.equal(toCanonicalRole(canonical), canonical);
      }
    });

    it("defines sunset mappings for all legacy aliases", () => {
      assert.equal(ROLE_ALIAS_MAP.admin, "school_admin");
      assert.equal(ROLE_ALIAS_MAP.kepala_sekolah, "school_admin");
      assert.equal(ROLE_ALIAS_MAP.guru, "teacher");
      assert.equal(ROLE_ALIAS_MAP.wali_kelas, "teacher");
      assert.equal(ROLE_ALIAS_MAP.siswa, "student");
    });
  });

  describe("Policy: Whole App Denied to Unauthenticated, Student & Siswa", () => {
    it("denies dashboard access to student and siswa roles", () => {
      assert.equal(canAccessDashboard("student"), false);
      assert.equal(canAccessDashboard("siswa"), false);
      assert.equal(canAccessDashboard(null), false);
      assert.equal(canAccessDashboard(undefined), false);
    });

    it("denies operational surfaces to student and siswa roles", () => {
      for (const role of studentRoles) {
        assert.equal(canAccessSiswa(role), false);
        assert.equal(canAccessAbsensi(role), false);
        assert.equal(canAccessPerizinan(role), false);
        assert.equal(canAccessConfiguration(role), false);
        assert.equal(canAccessProfiles(role), false);
        assert.equal(canUploadFiles(role), false);
      }
    });
  });

  describe("Policy: Admin-Only Surfaces (Configuration, Profiles, Manual Attendance, Attendance Delete, Monthly Backup)", () => {
    it("restricts Configuration to admin roles only", () => {
      for (const role of adminRoles) {
        assert.equal(
          canAccessConfiguration(role),
          true,
          `Expected ${role} to access configuration`,
        );
      }
      for (const role of teacherStaffRoles) {
        assert.equal(
          canAccessConfiguration(role),
          false,
          `Expected ${role} NOT to access configuration`,
        );
      }
      for (const role of studentRoles) {
        assert.equal(canAccessConfiguration(role), false);
      }
      assert.equal(canAccessConfiguration(null), false);
    });

    it("restricts Profiles to admin roles only", () => {
      for (const role of adminRoles) {
        assert.equal(
          canAccessProfiles(role),
          true,
          `Expected ${role} to access profiles`,
        );
      }
      for (const role of teacherStaffRoles) {
        assert.equal(
          canAccessProfiles(role),
          false,
          `Expected ${role} NOT to access profiles`,
        );
      }
      for (const role of studentRoles) {
        assert.equal(canAccessProfiles(role), false);
      }
      assert.equal(canAccessProfiles(null), false);
    });

    it("restricts Manual Attendance to admin roles only", () => {
      for (const role of adminRoles) {
        assert.equal(canManageManualAttendance(role), true);
      }
      for (const role of teacherStaffRoles) {
        assert.equal(canManageManualAttendance(role), false);
      }
      for (const role of studentRoles) {
        assert.equal(canManageManualAttendance(role), false);
      }
      assert.equal(canManageManualAttendance(null), false);
    });

    it("restricts Attendance Delete/Bulk to admin roles only", () => {
      for (const role of adminRoles) {
        assert.equal(canDeleteAttendance(role), true);
      }
      for (const role of teacherStaffRoles) {
        assert.equal(canDeleteAttendance(role), false);
      }
      for (const role of studentRoles) {
        assert.equal(canDeleteAttendance(role), false);
      }
      assert.equal(canDeleteAttendance(null), false);
    });

    it("restricts Monthly Backup to admin roles only", () => {
      for (const role of adminRoles) {
        assert.equal(canPerformMonthlyBackup(role), true);
      }
      for (const role of teacherStaffRoles) {
        assert.equal(canPerformMonthlyBackup(role), false);
      }
      for (const role of studentRoles) {
        assert.equal(canPerformMonthlyBackup(role), false);
      }
      assert.equal(canPerformMonthlyBackup(null), false);
    });
  });

  describe("Policy: Operational Read Surfaces Kept for Teacher/Staff", () => {
    it("allows teacher and staff roles to access operational read surfaces", () => {
      for (const role of [...adminRoles, ...teacherStaffRoles]) {
        assert.equal(
          canAccessDashboard(role),
          true,
          `Expected ${role} to access dashboard`,
        );
        assert.equal(
          canAccessSiswa(role),
          true,
          `Expected ${role} to access /siswa (pending D1)`,
        );
        assert.equal(
          canAccessAbsensi(role),
          true,
          `Expected ${role} to access /absensi`,
        );
        assert.equal(
          canAccessPerizinan(role),
          true,
          `Expected ${role} to access /perizinan`,
        );
      }
    });
  });

  describe("Policy: Export Controls (Profiles Admin Only; Siswa/Absences/Perizinan Privileged)", () => {
    it("allows only admin roles to export profiles", () => {
      for (const role of adminRoles) {
        assert.equal(canExportResource(role, "profiles"), true);
      }
      for (const role of teacherStaffRoles) {
        assert.equal(canExportResource(role, "profiles"), false);
      }
      for (const role of studentRoles) {
        assert.equal(canExportResource(role, "profiles"), false);
      }
      assert.equal(canExportResource(null, "profiles"), false);
    });

    it("restricts monthly attendance recap export to admin roles", () => {
      for (const role of adminRoles) {
        assert.equal(canExportResource(role, "monthlyAttendance"), true);
      }
      for (const role of [...teacherStaffRoles, ...studentRoles]) {
        assert.equal(canExportResource(role, "monthlyAttendance"), false);
      }
      assert.equal(canExportResource(null, "monthlyAttendance"), false);
    });

    it("allows all privileged roles (admin, teacher, staff) to export siswa, absences and perizinan", () => {
      for (const role of [...adminRoles, ...teacherStaffRoles]) {
        assert.equal(canExportResource(role, "siswa"), true);
        assert.equal(canExportResource(role, "absences"), true);
        assert.equal(canExportResource(role, "perizinan"), true);
      }
      for (const role of studentRoles) {
        assert.equal(canExportResource(role, "siswa"), false);
        assert.equal(canExportResource(role, "absences"), false);
        assert.equal(canExportResource(role, "perizinan"), false);
      }
      assert.equal(canExportResource(null, "siswa"), false);
      assert.equal(canExportResource(null, "absences"), false);
    });
  });

  describe("Policy: File Proxy Authorization & Validation", () => {
    it("allows privileged roles to upload files", () => {
      for (const role of [...adminRoles, ...teacherStaffRoles]) {
        assert.equal(canUploadFiles(role), true);
      }
      for (const role of studentRoles) {
        assert.equal(canUploadFiles(role), false);
      }
      assert.equal(canUploadFiles(null), false);
    });

    it("verifies MAX_FILE_SIZE_BYTES equals 5MiB", () => {
      assert.equal(MAX_FILE_SIZE_BYTES, 5 * 1024 * 1024);
    });

    it("allows JPEG, PNG, and PDF mime types and extensions", () => {
      assert.ok(ALLOWED_FILE_MIME_TYPES.has("image/jpeg"));
      assert.ok(ALLOWED_FILE_MIME_TYPES.has("image/png"));
      assert.ok(ALLOWED_FILE_MIME_TYPES.has("application/pdf"));

      assert.ok(ALLOWED_FILE_EXTENSIONS.has(".jpg"));
      assert.ok(ALLOWED_FILE_EXTENSIONS.has(".jpeg"));
      assert.ok(ALLOWED_FILE_EXTENSIONS.has(".png"));
      assert.ok(ALLOWED_FILE_EXTENSIONS.has(".pdf"));
    });

    it("rejects non-File inputs with HTTP 400", () => {
      const result = validateUploadedFile(null, "req-1");
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.response.status, 400);
      }

      const stringResult = validateUploadedFile(
        "not-a-file" as unknown as FormDataEntryValue,
        "req-1",
      );
      assert.equal(stringResult.ok, false);
      if (!stringResult.ok) {
        assert.equal(stringResult.response.status, 400);
      }
    });

    it("rejects file exceeding 5MB with HTTP 413", () => {
      const oversizedBuffer = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);
      const oversizedFile = new File([oversizedBuffer], "large.jpg", {
        type: "image/jpeg",
      });

      const result = validateUploadedFile(oversizedFile, "req-2");
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.response.status, 413);
      }
    });

    it("accepts file exactly at or below 5MB", () => {
      const validBuffer = new Uint8Array(1024);
      const validFile = new File([validBuffer], "surat.pdf", {
        type: "application/pdf",
      });

      const result = validateUploadedFile(validFile, "req-3");
      assert.equal(result.ok, true);
    });

    it("rejects disallowed MIME types with HTTP 400", () => {
      const textFile = new File(["hello world"], "notes.txt", {
        type: "text/plain",
      });
      const result = validateUploadedFile(textFile, "req-4");
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.response.status, 400);
      }

      const exeFile = new File(["MZ..."], "program.exe", {
        type: "application/x-msdownload",
      });
      const exeResult = validateUploadedFile(exeFile, "req-5");
      assert.equal(exeResult.ok, false);
      if (!exeResult.ok) {
        assert.equal(exeResult.response.status, 400);
      }
    });

    it("accepts JPEG, PNG, and PDF files", () => {
      const jpegFile = new File([new Uint8Array(100)], "foto.jpg", {
        type: "image/jpeg",
      });
      assert.equal(validateUploadedFile(jpegFile, "req-jpeg").ok, true);

      const pngFile = new File([new Uint8Array(100)], "scan.png", {
        type: "image/png",
      });
      assert.equal(validateUploadedFile(pngFile, "req-png").ok, true);

      const pdfFile = new File([new Uint8Array(100)], "surat_dokter.pdf", {
        type: "application/pdf",
      });
      assert.equal(validateUploadedFile(pdfFile, "req-pdf").ok, true);
    });

    it("rejects empty MIME and application/octet-stream with HTTP 400", () => {
      const emptyMimeFile = new File([new Uint8Array(100)], "foto.jpg", {
        type: "",
      });
      const emptyResult = validateUploadedFile(emptyMimeFile, "req-empty");
      assert.equal(emptyResult.ok, false);
      if (!emptyResult.ok) {
        assert.equal(emptyResult.response.status, 400);
      }

      const octetStreamFile = new File([new Uint8Array(100)], "foto.jpg", {
        type: "application/octet-stream",
      });
      const octetResult = validateUploadedFile(octetStreamFile, "req-octet");
      assert.equal(octetResult.ok, false);
      if (!octetResult.ok) {
        assert.equal(octetResult.response.status, 400);
      }
    });

    it("rejects allowed MIME with .exe extension with HTTP 400", () => {
      const spoofedExe = new File([new Uint8Array(100)], "malware.exe", {
        type: "image/jpeg",
      });
      const result = validateUploadedFile(spoofedExe, "req-exe");
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.response.status, 400);
      }

      const doubleExtExe = new File([new Uint8Array(100)], "document.pdf.exe", {
        type: "application/pdf",
      });
      const doubleResult = validateUploadedFile(doubleExtExe, "req-double");
      assert.equal(doubleResult.ok, false);
      if (!doubleResult.ok) {
        assert.equal(doubleResult.response.status, 400);
      }
    });

    it("rejects MIME and extension mismatches with HTTP 400", () => {
      // JPEG mime with .png extension
      const jpegPng = new File([new Uint8Array(100)], "image.png", {
        type: "image/jpeg",
      });
      const jpegPngResult = validateUploadedFile(jpegPng, "req-mismatch-1");
      assert.equal(jpegPngResult.ok, false);
      if (!jpegPngResult.ok) {
        assert.equal(jpegPngResult.response.status, 400);
      }

      // PNG mime with .pdf extension
      const pngPdf = new File([new Uint8Array(100)], "document.pdf", {
        type: "image/png",
      });
      const pngPdfResult = validateUploadedFile(pngPdf, "req-mismatch-2");
      assert.equal(pngPdfResult.ok, false);
      if (!pngPdfResult.ok) {
        assert.equal(pngPdfResult.response.status, 400);
      }

      // PDF mime with .jpg extension
      const pdfJpg = new File([new Uint8Array(100)], "photo.jpg", {
        type: "application/pdf",
      });
      const pdfJpgResult = validateUploadedFile(pdfJpg, "req-mismatch-3");
      assert.equal(pdfJpgResult.ok, false);
      if (!pdfJpgResult.ok) {
        assert.equal(pdfJpgResult.response.status, 400);
      }
    });

    it("accepts intentional image/jpg alias with compatible extensions", () => {
      const jpgFile = new File([new Uint8Array(100)], "foto.jpg", {
        type: "image/jpg",
      });
      assert.equal(validateUploadedFile(jpgFile, "req-jpg-1").ok, true);

      const jpegFile = new File([new Uint8Array(100)], "foto.jpeg", {
        type: "image/jpg",
      });
      assert.equal(validateUploadedFile(jpegFile, "req-jpg-2").ok, true);
    });

    it("verifies ALLOWED_MIME_TO_EXTENSIONS mapping structure", () => {
      assert.deepEqual(ALLOWED_MIME_TO_EXTENSIONS["image/jpeg"], [
        ".jpg",
        ".jpeg",
      ]);
      assert.deepEqual(ALLOWED_MIME_TO_EXTENSIONS["image/jpg"], [
        ".jpg",
        ".jpeg",
      ]);
      assert.deepEqual(ALLOWED_MIME_TO_EXTENSIONS["image/png"], [".png"]);
      assert.deepEqual(ALLOWED_MIME_TO_EXTENSIONS["application/pdf"], [".pdf"]);
    });
  });

  describe("Request ID Contract Invariants", () => {
    it("preserves valid request ID if provided", () => {
      assert.equal(createAstraRequestId("test-req-123"), "test-req-123");
      assert.equal(
        createAstraRequestId("chronos:trace.id_01"),
        "chronos:trace.id_01",
      );
    });

    it("generates random UUID when candidate is absent or empty", () => {
      const id1 = createAstraRequestId();
      assert.ok(id1.length > 10);
      const id2 = createAstraRequestId("");
      assert.ok(id2.length > 10);
      const id3 = createAstraRequestId(null);
      assert.ok(id3.length > 10);
    });

    it("sanitizes unsafe request IDs with generated UUID", () => {
      const unsafe = createAstraRequestId("bad\nheader\rvalue");
      assert.notEqual(unsafe, "bad\nheader\rvalue");
      assert.ok(/^[0-9a-f-]+$/.test(unsafe));
    });
  });
});
