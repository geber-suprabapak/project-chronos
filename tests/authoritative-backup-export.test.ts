import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import ExcelJS from "exceljs";

import {
  isValidYearMonth,
  getAsiaJakartaMonthBounds,
  hasOrderedDateBounds,
  sortAttendanceRows,
  calculateSha256,
  generateAttendanceXlsx,
  generateAttendancePdf,
  buildAttendanceArtifact,
  performMonthlyBackup,
  collectAuthoritativeAttendanceRows,
  sanitizeFilenameSegment,
  validateAstraBackupStatusResponse,
  type OrderedAttendanceRow,
  type AstraAttendanceRecord,
  type AstraStudentProfile,
  type AstraBackupAuditPayload,
} from "../src/server/export/index.ts";

import { isDateOnlyValue } from "../src/lib/date-utils.ts";

import {
  canPerformMonthlyBackup,
  canExportResource,
  type AppRole,
} from "../src/server/auth/rbac.ts";

test("Authoritative Backup & Absences Export Suite", async (t) => {
  // --------------------------------------------------------------------------
  // 1. Month Bounds Validation
  // --------------------------------------------------------------------------
  await t.test(
    "Month bounds: validates real YYYY-MM and full Asia/Jakarta range",
    () => {
      // Valid cases
      assert.equal(isValidYearMonth("2026-09"), true);
      assert.equal(isValidYearMonth("2026-02"), true);
      assert.equal(isValidYearMonth("2024-02"), true);
      assert.equal(isValidYearMonth("2025-12"), true);

      // Invalid cases
      assert.equal(isValidYearMonth("0000-01"), false);
      assert.equal(isValidYearMonth("0999-12"), false);
      assert.equal(isValidYearMonth("2026-13"), false);
      assert.equal(isValidYearMonth("2026-00"), false);
      assert.equal(isValidYearMonth("2026-9"), false);
      assert.equal(isValidYearMonth("2026/09"), false);
      assert.equal(isValidYearMonth("September 2026"), false);
      assert.equal(isValidYearMonth(""), false);
      assert.equal(isValidYearMonth(null), false);
      assert.equal(isValidYearMonth(undefined), false);

      // Bound edge cases
      assert.equal(isValidYearMonth("1000-01"), true);
      assert.equal(isValidYearMonth("9999-12"), true);

      // 30-day month (September 2026)
      const sep = getAsiaJakartaMonthBounds("2026-09");
      assert.equal(sep.month, "2026-09");
      assert.equal(sep.startDate, "2026-09-01");
      assert.equal(sep.endDate, "2026-09-30");
      assert.equal(sep.daysInMonth, 30);
      assert.equal(sep.timezone, "Asia/Jakarta");

      // 28-day month non-leap year (February 2026)
      const feb2026 = getAsiaJakartaMonthBounds("2026-02");
      assert.equal(feb2026.startDate, "2026-02-01");
      assert.equal(feb2026.endDate, "2026-02-28");
      assert.equal(feb2026.daysInMonth, 28);

      // 29-day month leap year (February 2024)
      const feb2024 = getAsiaJakartaMonthBounds("2024-02");
      assert.equal(feb2024.startDate, "2024-02-01");
      assert.equal(feb2024.endDate, "2024-02-29");
      assert.equal(feb2024.daysInMonth, 29);

      // Throws on invalid format
      assert.throws(() => getAsiaJakartaMonthBounds("invalid-month"));
    },
  );

  // --------------------------------------------------------------------------
  // 2. Deterministic Stable Ordering
  // --------------------------------------------------------------------------
  await t.test(
    "Order: sorts strictly by date ASC, class ASC, nis ASC, id ASC tie-breaker",
    () => {
      const raw: OrderedAttendanceRow[] = [
        {
          id: "rec-03",
          userId: "u-3",
          date: "2026-09-02",
          nis: "1002",
          className: "XII RPL 1",
          name: "Charlie",
          status: "Hadir",
          displayStatus: "Hadir",
          lokasi: "-",
          actionType: "check_in",
          createdAt: null,
        },
        {
          id: "rec-01",
          userId: "u-1",
          date: "2026-09-01",
          nis: "1001",
          className: "XII RPL 1",
          name: "Alice",
          status: "Hadir",
          displayStatus: "Hadir",
          lokasi: "-",
          actionType: "check_in",
          createdAt: null,
        },
        {
          id: "rec-04-b",
          userId: "u-4",
          date: "2026-09-02",
          nis: "1002",
          className: "XII RPL 1",
          name: "Charlie",
          status: "Pulang",
          displayStatus: "Pulang",
          lokasi: "-",
          actionType: "check_out",
          createdAt: null,
        },
        {
          id: "rec-02",
          userId: "u-2",
          date: "2026-09-01",
          nis: "1005",
          className: "X RPL 1",
          name: "Bob",
          status: "Terlambat",
          displayStatus: "Terlambat",
          lokasi: "-",
          actionType: "check_in",
          createdAt: null,
        },
      ];

      const sorted = sortAttendanceRows(raw);

      // On 2026-09-01: 'X RPL 1' comes before 'XII RPL 1'
      assert.equal(sorted[0]?.id, "rec-02");
      assert.equal(sorted[0]?.className, "X RPL 1");

      // On 2026-09-01: 'XII RPL 1' comes second
      assert.equal(sorted[1]?.id, "rec-01");

      // On 2026-09-02: id tie-breaker between rec-03 and rec-04-b
      assert.equal(sorted[2]?.id, "rec-03");
      assert.equal(sorted[3]?.id, "rec-04-b");
    },
  );

  // --------------------------------------------------------------------------
  // 3. Artifact Generation & Checksum
  // --------------------------------------------------------------------------
  await t.test(
    "Checksum & Both Artifacts: generates valid XLSX, PDF and cryptographic SHA-256",
    async () => {
      const sampleRows: OrderedAttendanceRow[] = [
        {
          id: "a-001",
          userId: "u-001",
          date: "2026-09-01",
          nis: "202601",
          className: "XII RPL 1",
          name: "Budi Santoso",
          status: "Hadir",
          displayStatus: "Hadir",
          lokasi: "-7.4503, 110.2241",
          actionType: "check_in",
          createdAt: "2026-09-01T07:00:00Z",
        },
      ];

      // Build XLSX
      const xlsxArtifact = await buildAttendanceArtifact(sampleRows, {
        format: "xlsx",
        title: "Test Excel Export",
      });

      assert.equal(xlsxArtifact.format, "xlsx");
      assert.ok(xlsxArtifact.buffer.length > 0);
      assert.equal(
        xlsxArtifact.sha256,
        crypto.createHash("sha256").update(xlsxArtifact.buffer).digest("hex"),
      );
      assert.equal(xlsxArtifact.rowCount, 1);

      // Verify XLSX parseability with ExcelJS
      const WorkbookClass =
        ExcelJS.Workbook ??
        (
          ExcelJS as unknown as {
            default: { Workbook: typeof ExcelJS.Workbook };
          }
        ).default?.Workbook;
      const wb = new WorkbookClass();
      await wb.xlsx.load(xlsxArtifact.buffer as any);
      const ws = wb.getWorksheet("Absensi");
      assert.ok(ws);
      assert.equal(ws.columns.length, 6);

      // Build PDF
      const pdfArtifact = await buildAttendanceArtifact(sampleRows, {
        format: "pdf",
        title: "Test PDF Export",
      });

      assert.equal(pdfArtifact.format, "pdf");
      assert.ok(pdfArtifact.buffer.length > 0);
      assert.equal(
        pdfArtifact.sha256,
        crypto.createHash("sha256").update(pdfArtifact.buffer).digest("hex"),
      );
      assert.equal(pdfArtifact.rowCount, 1);

      // Verify PDF header magic bytes %PDF-
      const pdfHeader = pdfArtifact.buffer.subarray(0, 5).toString("ascii");
      assert.equal(pdfHeader, "%PDF-");
    },
  );

  // --------------------------------------------------------------------------
  // 4. Boundary Testing: 0 rows
  // --------------------------------------------------------------------------
  await t.test(
    "Boundary: 0 rows generates valid, empty artifacts without crash",
    async () => {
      const emptyRows: OrderedAttendanceRow[] = [];

      const xlsx = await buildAttendanceArtifact(emptyRows, { format: "xlsx" });
      assert.equal(xlsx.rowCount, 0);
      assert.ok(xlsx.buffer.length > 0);
      assert.equal(xlsx.sha256, calculateSha256(xlsx.buffer));

      const pdf = await buildAttendanceArtifact(emptyRows, { format: "pdf" });
      assert.equal(pdf.rowCount, 0);
      assert.ok(pdf.buffer.length > 0);
      assert.equal(pdf.sha256, calculateSha256(pdf.buffer));
      assert.equal(pdf.buffer.subarray(0, 5).toString("ascii"), "%PDF-");
    },
  );

  // --------------------------------------------------------------------------
  // 5. Boundary Testing: 101 rows across pagination limit
  // --------------------------------------------------------------------------
  await t.test(
    "Boundary: 101 rows spanning 100-row page boundary",
    async () => {
      const rows101: OrderedAttendanceRow[] = Array.from(
        { length: 101 },
        (_, i) => ({
          id: `id-${String(i + 1).padStart(4, "0")}`,
          userId: `u-${String(i + 1).padStart(4, "0")}`,
          date: `2026-09-${String(Math.floor(i / 10) + 1).padStart(2, "0")}`,
          nis: `NIS-${String(i + 1).padStart(4, "0")}`,
          className: `XII RPL ${(i % 3) + 1}`,
          name: `Siswa Ke-${i + 1}`,
          status: i % 5 === 0 ? "Terlambat" : "Hadir",
          displayStatus: i % 5 === 0 ? "Terlambat" : "Hadir",
          lokasi: "-7.4503, 110.2241",
          actionType: "check_in",
          createdAt: null,
        }),
      );

      const sorted101 = sortAttendanceRows(rows101);
      assert.equal(sorted101.length, 101);

      const xlsx = await buildAttendanceArtifact(sorted101, { format: "xlsx" });
      assert.equal(xlsx.rowCount, 101);
      assert.ok(xlsx.buffer.length > 0);

      const pdf = await buildAttendanceArtifact(sorted101, { format: "pdf" });
      assert.equal(pdf.rowCount, 101);
      assert.ok(pdf.buffer.length > 0);
    },
  );

  // --------------------------------------------------------------------------
  // 6. Scalability Testing: Over 1500 rows (e.g. 1505 rows)
  // --------------------------------------------------------------------------
  await t.test(
    "Boundary: Over 1500 rows (1505 records) completes reliably without truncation",
    async () => {
      const rows1505: OrderedAttendanceRow[] = Array.from(
        { length: 1505 },
        (_, i) => ({
          id: `id-${String(i + 1).padStart(5, "0")}`,
          userId: `u-${String(i + 1).padStart(5, "0")}`,
          date: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
          nis: `NIS-${String((i % 500) + 1).padStart(4, "0")}`,
          className: `XII RPL ${(i % 4) + 1}`,
          name: `Nama Siswa ${i + 1}`,
          status: "Hadir",
          displayStatus: "Hadir",
          lokasi: "-",
          actionType: "check_in",
          createdAt: null,
        }),
      );

      const sorted = sortAttendanceRows(rows1505);
      assert.equal(sorted.length, 1505);

      const xlsx = await buildAttendanceArtifact(sorted, { format: "xlsx" });
      assert.equal(xlsx.rowCount, 1505);
      assert.ok(xlsx.buffer.length > 10000);

      const pdf = await buildAttendanceArtifact(sorted, { format: "pdf" });
      assert.equal(pdf.rowCount, 1505);
      assert.ok(pdf.buffer.length > 10000);
    },
  );

  // --------------------------------------------------------------------------
  // 7. Role Denial Matrix
  // --------------------------------------------------------------------------
  await t.test(
    "Role denial: enforces admin-only monthly backup and privileged export",
    () => {
      // canPerformMonthlyBackup
      assert.equal(canPerformMonthlyBackup("platform_admin"), true);
      assert.equal(canPerformMonthlyBackup("school_admin"), true);
      assert.equal(canPerformMonthlyBackup("teacher"), false);
      assert.equal(canPerformMonthlyBackup("staff"), false);
      assert.equal(canPerformMonthlyBackup("student"), false);
      assert.equal(canPerformMonthlyBackup(null), false);
      assert.equal(canPerformMonthlyBackup(undefined), false);

      // canExportResource("backup") -> admin only
      assert.equal(canExportResource("platform_admin", "backup"), true);
      assert.equal(canExportResource("school_admin", "backup"), true);
      assert.equal(canExportResource("teacher", "backup"), false);
      assert.equal(canExportResource("staff", "backup"), false);
      assert.equal(canExportResource("student", "backup"), false);

      // canExportResource("absences") -> privileged (admin, teacher, staff)
      assert.equal(canExportResource("platform_admin", "absences"), true);
      assert.equal(canExportResource("school_admin", "absences"), true);
      assert.equal(canExportResource("teacher", "absences"), true);
      assert.equal(canExportResource("staff", "absences"), true);
      assert.equal(canExportResource("student", "absences"), false);
      assert.equal(canExportResource(null, "absences"), false);
    },
  );

  // --------------------------------------------------------------------------
  // 8. Table Independence
  // --------------------------------------------------------------------------
  await t.test(
    "Table independence: export runs in Node without DOM document or window",
    async () => {
      assert.equal(typeof (globalThis as any).window, "undefined");
      assert.equal(typeof (globalThis as any).document, "undefined");

      const rows: OrderedAttendanceRow[] = [
        {
          id: "headless-1",
          userId: "user-headless",
          date: "2026-09-05",
          nis: "9999",
          className: "Headless Class",
          name: "Headless Worker",
          status: "Hadir",
          displayStatus: "Hadir",
          lokasi: "-",
          actionType: null,
          createdAt: null,
        },
      ];

      // PDF generation succeeds with 0 DOM lookups
      const pdfBuf = await generateAttendancePdf(rows, {
        title: "Headless Test",
      });
      assert.ok(pdfBuf.length > 0);
      assert.equal(pdfBuf.subarray(0, 5).toString("ascii"), "%PDF-");

      // XLSX generation succeeds with 0 DOM lookups
      const xlsxBuf = await generateAttendanceXlsx(rows, {
        title: "Headless Test",
      });
      assert.ok(xlsxBuf.length > 0);
    },
  );

  // --------------------------------------------------------------------------
  // 9. Persistence of Completed Audit
  // --------------------------------------------------------------------------
  await t.test(
    "Persistence: persists completed audit to Astra before returning file",
    async () => {
      const persistedAudits: AstraBackupAuditPayload[] = [];

      const mockAttendance: AstraAttendanceRecord[] = [
        {
          id: "att-001",
          user_id: "stu-001",
          date: "2026-09-10",
          status: "Hadir",
          latitude: -7.45,
          longitude: 110.22,
          action_type: "check_in",
          created_at: "2026-09-10T07:00:00Z",
        },
      ];

      const mockStudents: AstraStudentProfile[] = [
        {
          user_id: "stu-001",
          full_name: "Budi Santoso",
          nis: "1001",
          class_name: "XII RPL 1",
        },
      ];

      const result = await performMonthlyBackup(
        {
          month: "2026-09",
          format: "xlsx",
        },
        {
          fetchAttendance: async () => mockAttendance,
          fetchStudents: async () => mockStudents,
          persistBackupAudit: async (audit) => {
            persistedAudits.push(audit);
            return {
              id: "backup-audit-123",
              ...audit,
              created_at: new Date().toISOString(),
              performed_by: "system_server",
            };
          },
        },
      );

      // Verify artifact
      assert.ok(result.artifact);
      assert.equal(result.artifact.format, "xlsx");
      assert.equal(result.artifact.rowCount, 1);
      assert.ok(result.artifact.buffer.length > 0);

      // Verify persisted audit payload matches canonical Astra schema exactly
      const persistedAudit = persistedAudits[0];
      if (!persistedAudit) {
        throw new Error("Expected persistedAudit to be non-null");
      }
      assert.equal(persistedAudit.year_month, "2026-09");
      assert.equal(persistedAudit.scope, "absences");
      assert.equal(persistedAudit.format, "xlsx");
      assert.equal(persistedAudit.start_date, "2026-09-01");
      assert.equal(persistedAudit.end_date, "2026-09-30");
      assert.equal(persistedAudit.checksum, result.artifact.sha256);
      assert.equal(persistedAudit.record_count, 1);
      assert.equal(persistedAudit.byte_length, result.artifact.buffer.length);
      assert.equal(persistedAudit.result, "completed");
      // Actor is server-derived and must not be sent
      assert.equal("actor" in persistedAudit, false);
    },
  );

  // --------------------------------------------------------------------------
  // 10. Audit Failure: Fail Closed
  // --------------------------------------------------------------------------
  await t.test(
    "Audit failure: fails closed and does not return file if audit persistence fails",
    async () => {
      let attemptedPersistence = false;

      await assert.rejects(
        async () => {
          await performMonthlyBackup(
            {
              month: "2026-09",
              format: "pdf",
            },
            {
              fetchAttendance: async () => [],
              fetchStudents: async () => [],
              persistBackupAudit: async () => {
                attemptedPersistence = true;
                throw new Error(
                  "Astra POST /v1/admin/backups returned HTTP 500 Internal Server Error",
                );
              },
            },
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.match(
            err.message,
            /Gagal menyimpan audit log backup bulanan ke Astra/,
          );
          assert.match(err.message, /Backup dibatalkan/);
          return true;
        },
      );

      assert.equal(attemptedPersistence, true);
    },
  );

  // --------------------------------------------------------------------------
  // 11. Complete Authoritative Collection: 1505 Records + Profiles
  // --------------------------------------------------------------------------
  await t.test(
    "Authoritative collection: 1505 Astra attendance records + profiles survive mapping/sorting and audit record_count=1505",
    async () => {
      const studentCount = 50;
      const mockStudents: AstraStudentProfile[] = Array.from(
        { length: studentCount },
        (_, i) => ({
          user_id: `user-${String(i + 1).padStart(4, "0")}`,
          nis: `10${String(i + 1).padStart(2, "0")}`,
          full_name: `Siswa Ke-${i + 1}`,
          class_name: `XII RPL ${(i % 3) + 1}`,
          lifecycle_status: "approved",
        }),
      );

      const mockAttendances: AstraAttendanceRecord[] = Array.from(
        { length: 1505 },
        (_, i) => {
          const stu = mockStudents[i % studentCount]!;
          const day = String((i % 28) + 1).padStart(2, "0");
          return {
            id: `att-${String(i + 1).padStart(6, "0")}`,
            user_id: stu.user_id,
            date: `2026-09-${day}`,
            status: i % 4 === 0 ? "Terlambat" : "Hadir",
            action_type: "check_in",
            latitude: -7.4503,
            longitude: 110.2241,
            created_at: `2026-09-${day}T07:00:00Z`,
          };
        },
      );

      // 1. Verify collectAuthoritativeAttendanceRows preserves all 1505 rows
      const collected = await collectAuthoritativeAttendanceRows(
        { startDate: "2026-09-01", endDate: "2026-09-30" },
        {
          fetchAttendance: async () => mockAttendances,
          fetchStudents: async () => mockStudents,
        },
      );

      assert.equal(collected.length, 1505);
      // Verify profile enrichment is present on each row
      for (const row of collected) {
        assert.notEqual(row.nis, "-");
        assert.notEqual(row.className, "-");
        assert.ok(row.name.startsWith("Siswa Ke-"));
      }

      // 2. Verify performMonthlyBackup preserves all 1505 rows and records correct audit
      const recordedAudits: AstraBackupAuditPayload[] = [];
      const backupResult = await performMonthlyBackup(
        {
          month: "2026-09",
          format: "xlsx",
        },
        {
          fetchAttendance: async () => mockAttendances,
          fetchStudents: async () => mockStudents,
          persistBackupAudit: async (audit) => {
            recordedAudits.push(audit);
            return {
              id: "audit-1505",
              ...audit,
            };
          },
        },
      );

      assert.equal(backupResult.artifact.rowCount, 1505);
      assert.ok(backupResult.artifact.buffer.length > 10000);
      const auditRecord = recordedAudits[0];
      if (!auditRecord) {
        throw new Error("Expected auditRecord to be non-null");
      }
      assert.equal(auditRecord.record_count, 1505);
      assert.equal(auditRecord.year_month, "2026-09");
      assert.equal(auditRecord.scope, "absences");
      assert.equal(
        auditRecord.byte_length,
        backupResult.artifact.buffer.length,
      );
      assert.equal(auditRecord.checksum, backupResult.artifact.sha256);
      assert.equal(auditRecord.result, "completed");
    },
  );

  // --------------------------------------------------------------------------
  // 12. Student Profile Fetch Failure: Fail Closed Regression
  // --------------------------------------------------------------------------
  await t.test(
    "Regression: student profile lookup failure aborts export/backup and persists no audit",
    async () => {
      let auditAttempted = false;

      await assert.rejects(
        async () => {
          await performMonthlyBackup(
            {
              month: "2026-09",
              format: "xlsx",
            },
            {
              fetchAttendance: async () => [
                {
                  id: "att-001",
                  user_id: "u-1",
                  date: "2026-09-05",
                  status: "Hadir",
                },
              ],
              fetchStudents: async () => {
                throw new Error(
                  "Astra /v1/admin/students 503 Service Unavailable",
                );
              },
              persistBackupAudit: async (audit) => {
                auditAttempted = true;
                return { id: "audit-err", ...audit };
              },
            },
          );
        },
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.match(err.message, /503 Service Unavailable/);
          return true;
        },
      );

      // Audit persistence must never be reached if student fetch fails
      assert.equal(auditAttempted, false);
    },
  );

  // --------------------------------------------------------------------------
  // 13. Ordinary Absences Export Date Validation & Reversed Bounds Check
  // --------------------------------------------------------------------------
  await t.test(
    "Ordinary absences export: validates real YYYY-MM-DD and rejects reversed bounds",
    () => {
      // Valid date-only values
      assert.equal(isDateOnlyValue("2026-09-01"), true);
      assert.equal(isDateOnlyValue("2026-09-30"), true);
      assert.equal(isDateOnlyValue("2024-02-29"), true); // leap year
      assert.equal(isDateOnlyValue("2026-02-28"), true);

      // Invalid date-only values
      assert.equal(isDateOnlyValue("2026-02-29"), false); // 2026 is non-leap
      assert.equal(isDateOnlyValue("2026-09-31"), false); // Sept has 30 days
      assert.equal(isDateOnlyValue("2026-13-01"), false);
      assert.equal(isDateOnlyValue("2026-00-01"), false);
      assert.equal(isDateOnlyValue("invalid-date"), false);
      assert.equal(isDateOnlyValue("2026/09/01"), false);
      assert.equal(isDateOnlyValue(""), false);
      assert.equal(isDateOnlyValue(null), false);
      assert.equal(isDateOnlyValue(undefined), false);

      // Reversed bounds logic
      assert.equal(hasOrderedDateBounds("2026-09-01", "2026-09-30"), true);
      assert.equal(hasOrderedDateBounds("2026-09-30", "2026-09-01"), false);
      assert.equal(hasOrderedDateBounds(null, "2026-09-30"), true);
      assert.equal(hasOrderedDateBounds("2026-09-01", null), true);
    },
  );

  // --------------------------------------------------------------------------
  // 14. Class Name Filename Sanitization
  // --------------------------------------------------------------------------
  await t.test(
    "Filename sanitization: safely sanitizes class-derived segments for Content-Disposition",
    () => {
      assert.equal(sanitizeFilenameSegment("XII RPL 1"), "XII-RPL-1");
      assert.equal(sanitizeFilenameSegment("X/TKJ/2"), "X-TKJ-2");
      assert.equal(sanitizeFilenameSegment("../../etc/passwd"), "etc-passwd");
      assert.equal(
        sanitizeFilenameSegment('Class; with "quotes"'),
        "Class-with-quotes",
      );
      assert.equal(sanitizeFilenameSegment("10-RPL"), "10-RPL");
      assert.equal(sanitizeFilenameSegment("---test---"), "test");
    },
  );

  // --------------------------------------------------------------------------
  // 15. Astra Backup Status Response Contract Validation
  // --------------------------------------------------------------------------
  await t.test(
    "Status validation: strictly enforces { completed, record } data contract parity",
    () => {
      // 1. Missing or undefined payload -> 502
      const missingPayload = validateAstraBackupStatusResponse(null, "2026-09");
      assert.equal(missingPayload.ok, false);
      if (!missingPayload.ok) {
        assert.equal(missingPayload.statusCode, 502);
      }

      // 2. Non-boolean completed field must not be coerced with Boolean() -> 502
      // SAFETY: Intentionally testing malformed input from external Astra service
      const nonBooleanTruthy = validateAstraBackupStatusResponse(
        { completed: "true" as any, record: null },
        "2026-09",
      );
      assert.equal(nonBooleanTruthy.ok, false);
      if (!nonBooleanTruthy.ok) {
        assert.equal(nonBooleanTruthy.statusCode, 502);
      }

      // SAFETY: Intentionally testing malformed input from external Astra service
      const nonBooleanFalsy = validateAstraBackupStatusResponse(
        { completed: 0 as any, record: null },
        "2026-09",
      );
      assert.equal(nonBooleanFalsy.ok, false);
      if (!nonBooleanFalsy.ok) {
        assert.equal(nonBooleanFalsy.statusCode, 502);
      }

      const omittedCompleted = validateAstraBackupStatusResponse(
        { record: null },
        "2026-09",
      );
      assert.equal(omittedCompleted.ok, false);
      if (!omittedCompleted.ok) {
        assert.equal(omittedCompleted.statusCode, 502);
      }

      // 3. completed=false with non-null record -> 502 inconsistency
      const inconsistentFalseWithRecord = validateAstraBackupStatusResponse(
        {
          completed: false,
          record: {
            year_month: "2026-09",
            scope: "absences",
            format: "xlsx",
            result: "completed",
          },
        },
        "2026-09",
      );
      assert.equal(inconsistentFalseWithRecord.ok, false);
      if (!inconsistentFalseWithRecord.ok) {
        assert.equal(inconsistentFalseWithRecord.statusCode, 502);
      }

      // 4. completed=false with omitted record -> 502
      const falseWithOmittedRecord = validateAstraBackupStatusResponse(
        { completed: false },
        "2026-09",
      );
      assert.equal(falseWithOmittedRecord.ok, false);
      if (!falseWithOmittedRecord.ok) {
        assert.equal(falseWithOmittedRecord.statusCode, 502);
      }

      // 5. completed=true with null record -> 502 inconsistency
      const inconsistentTrueWithNull = validateAstraBackupStatusResponse(
        { completed: true, record: null },
        "2026-09",
      );
      assert.equal(inconsistentTrueWithNull.ok, false);
      if (!inconsistentTrueWithNull.ok) {
        assert.equal(inconsistentTrueWithNull.statusCode, 502);
      }

      // 6. completed=true with mismatched month in record -> 502
      const monthMismatch = validateAstraBackupStatusResponse(
        {
          completed: true,
          record: {
            year_month: "2026-08",
            scope: "absences",
            format: "xlsx",
            result: "completed",
          },
        },
        "2026-09",
      );
      assert.equal(monthMismatch.ok, false);
      if (!monthMismatch.ok) {
        assert.equal(monthMismatch.statusCode, 502);
      }

      // 7. completed=true with invalid scope in record -> 502
      const scopeMismatch = validateAstraBackupStatusResponse(
        {
          completed: true,
          record: {
            year_month: "2026-09",
            scope: "audit_logs",
            format: "xlsx",
            result: "completed",
          },
        },
        "2026-09",
      );
      assert.equal(scopeMismatch.ok, false);
      if (!scopeMismatch.ok) {
        assert.equal(scopeMismatch.statusCode, 502);
      }

      // 8. completed=true with invalid format in record -> 502
      const formatMismatch = validateAstraBackupStatusResponse(
        {
          completed: true,
          record: {
            year_month: "2026-09",
            scope: "absences",
            format: "csv",
            result: "completed",
          },
        },
        "2026-09",
      );
      assert.equal(formatMismatch.ok, false);
      if (!formatMismatch.ok) {
        assert.equal(formatMismatch.statusCode, 502);
      }

      // 9. completed=true with non-completed result -> 502
      const resultMismatch = validateAstraBackupStatusResponse(
        {
          completed: true,
          record: {
            year_month: "2026-09",
            scope: "absences",
            format: "xlsx",
            result: "pending",
          },
        },
        "2026-09",
      );
      assert.equal(resultMismatch.ok, false);
      if (!resultMismatch.ok) {
        assert.equal(resultMismatch.statusCode, 502);
      }

      // 10. completed records never receive fabricated canonical fields
      const missingCanonicalFields = validateAstraBackupStatusResponse(
        {
          completed: true,
          record: {
            id: "bk-incomplete",
            year_month: "2026-09",
            scope: "absences",
            format: "xlsx",
            result: "completed",
          },
        },
        "2026-09",
      );
      assert.equal(missingCanonicalFields.ok, false);
      if (!missingCanonicalFields.ok) {
        assert.equal(missingCanonicalFields.statusCode, 502);
      }

      const invalidChecksum = validateAstraBackupStatusResponse(
        {
          completed: true,
          record: {
            id: "bk-invalid-checksum",
            year_month: "2026-09",
            scope: "absences",
            format: "xlsx",
            start_date: "2026-09-01",
            end_date: "2026-09-30",
            checksum: "not-a-sha256",
            record_count: 50,
            byte_length: 12345,
            result: "completed",
          },
        },
        "2026-09",
      );
      assert.equal(invalidChecksum.ok, false);
      if (!invalidChecksum.ok) {
        assert.equal(invalidChecksum.statusCode, 502);
      }

      // 11. Genuine uncompleted: completed=false and record=null -> ok: true (200)
      const genuineUncompleted = validateAstraBackupStatusResponse(
        { completed: false, record: null },
        "2026-09",
      );
      assert.equal(genuineUncompleted.ok, true);
      if (genuineUncompleted.ok) {
        assert.equal(genuineUncompleted.data.completed, false);
        assert.equal(genuineUncompleted.data.record, null);
      }

      // 12. Genuine completed: completed=true and valid matching record -> ok: true (200)
      const genuineCompleted = validateAstraBackupStatusResponse(
        {
          completed: true,
          record: {
            id: "bk-01",
            year_month: "2026-09",
            scope: "absences",
            format: "xlsx",
            start_date: "2026-09-01",
            end_date: "2026-09-30",
            checksum: "a".repeat(64),
            record_count: 50,
            byte_length: 12345,
            result: "completed",
          },
        },
        "2026-09",
      );
      assert.equal(genuineCompleted.ok, true);
      if (genuineCompleted.ok) {
        assert.equal(genuineCompleted.data.completed, true);
        assert.ok(genuineCompleted.data.record);
        assert.equal(genuineCompleted.data.record?.year_month, "2026-09");
        assert.equal(genuineCompleted.data.record?.format, "xlsx");
        assert.equal(genuineCompleted.data.record?.record_count, 50);
      }
    },
  );
});
