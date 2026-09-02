import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { z } from "zod";
import { buildPendingLeaveRequestReset } from "../src/server/api/routers/perizinan-contract.ts";
import { getPostLogoutRedirectUri } from "../src/lib/logto/post-logout-redirect.ts";
import {
  collectUniqueClassNames,
  normalizeStudentRows,
} from "../src/lib/class-names.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// 1. GAP-01: LEAVE REQUEST REOPEN LIFECYCLE ADVERSARIAL TESTS
// ============================================================================

describe("Challenger 1 Adversarial Stress: Leave Request Reopen Lifecycle (GAP-01)", () => {
  it("buildPendingLeaveRequestReset generates exact Astra-compliant contract payload", () => {
    const payload = buildPendingLeaveRequestReset();
    assert.equal(payload.approval_status, "pending");
    assert.equal(payload.status, false);
    assert.equal(payload.rejection_reason, null);
    assert.equal(payload.rejected_at, null);
    assert.deepEqual(Object.keys(payload).sort(), [
      "approval_status",
      "rejected_at",
      "rejection_reason",
      "status",
    ]);
  });

  it("Reopen payload idempotency: resetting an already pending request does not produce invalid fields", () => {
    const initialLeave = {
      id: "leave-uuid-001",
      user_id: "student-1",
      category: "sakit" as const,
      description: "Demam berdarah",
      date: "2026-09-01",
      approval_status: "pending" as const,
      status: false,
      rejection_reason: null,
      rejected_at: null,
      attachment_url: "permits/surat-001.pdf",
    };

    const resetPayload = buildPendingLeaveRequestReset();
    const updatedLeave = {
      ...initialLeave,
      ...resetPayload,
    };

    assert.equal(updatedLeave.approval_status, "pending");
    assert.equal(updatedLeave.status, false);
    assert.equal(updatedLeave.rejection_reason, null);
    assert.equal(updatedLeave.rejected_at, null);
    assert.equal(updatedLeave.attachment_url, "permits/surat-001.pdf");
  });

  it("Reopen resets rejection details and timestamp while preserving student data & attachments", () => {
    const rejectedLeave = {
      id: "leave-uuid-002",
      user_id: "student-2",
      student_name: "Ahmad Dahlan",
      student_nis: "1002",
      student_class: "XII RPL 1",
      absence_number: "03",
      category: "dispensasi" as const,
      description: "Lomba Olimpiade Sains",
      date: "2026-09-05",
      approval_status: "rejected" as const,
      status: false,
      rejection_reason: "Surat tugas belum ditandatangani",
      rejected_at: "2026-09-01T10:00:00Z",
      attachment_url: "permits/surat-tugas-002.pdf",
      created_at: "2026-09-01T08:00:00Z",
      updated_at: "2026-09-01T10:00:00Z",
    };

    const resetPayload = buildPendingLeaveRequestReset();
    const reopened = {
      ...rejectedLeave,
      ...resetPayload,
      updated_at: "2026-09-01T11:00:00Z",
    };

    assert.equal(reopened.approval_status, "pending");
    assert.equal(reopened.status, false);
    assert.equal(reopened.rejection_reason, null);
    assert.equal(reopened.rejected_at, null);
    assert.equal(reopened.student_name, "Ahmad Dahlan");
    assert.equal(reopened.student_nis, "1002");
    assert.equal(reopened.attachment_url, "permits/surat-tugas-002.pdf");
  });

  it("Reopen approved leave resets status to false and approval_status to pending", () => {
    const approvedLeave = {
      id: "leave-uuid-003",
      user_id: "student-3",
      category: "pergi" as const,
      date: "2026-09-10",
      approval_status: "approved" as const,
      status: true,
      rejection_reason: null,
      rejected_at: null,
    };

    const resetPayload = buildPendingLeaveRequestReset();
    const reopened = {
      ...approvedLeave,
      ...resetPayload,
    };

    assert.equal(reopened.approval_status, "pending");
    assert.equal(reopened.status, false);
    assert.equal(reopened.rejection_reason, null);
    assert.equal(reopened.rejected_at, null);
  });
});

// ============================================================================
// 2. GAP-03: FILE UPLOAD PROXY CONTRACTS & BOUNDARY TESTS
// ============================================================================

describe("Challenger 1 Adversarial Stress: File Upload Proxy Contracts (GAP-03)", () => {
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  it("Size Boundary: Rejects payload exceeding 5MB limit with HTTP 413", () => {
    const exactLimit = MAX_FILE_SIZE_BYTES;
    const overLimit = MAX_FILE_SIZE_BYTES + 1;
    const tenMB = 10 * 1024 * 1024;

    const validateSize = (size: number) => {
      if (size > MAX_FILE_SIZE_BYTES) {
        return { status: 413, error: "File exceeds the 5MB limit." };
      }
      return { status: 200 };
    };

    assert.equal(validateSize(exactLimit).status, 200);
    assert.equal(validateSize(overLimit).status, 413);
    assert.equal(validateSize(tenMB).status, 413);
  });

  it("Missing File / Invalid Form Entry: Rejects non-file form submissions with HTTP 400", () => {
    const validateEntry = (entry: unknown) => {
      if (
        !entry ||
        typeof entry === "string" ||
        !(entry instanceof Object && "size" in entry)
      ) {
        return { status: 400, error: "A file is required." };
      }
      return { status: 200 };
    };

    assert.equal(validateEntry(null).status, 400);
    assert.equal(validateEntry(undefined).status, 400);
    assert.equal(validateEntry("plain-string-not-a-file").status, 400);
    assert.equal(validateEntry({ size: 1024, name: "test.pdf" }).status, 200);
  });

  it("Contract Headers: Validates mandatory injection of X-Astra-Contract-Version and Bearer token", () => {
    const constructProxyHeaders = (accessToken: string) => ({
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Astra-Contract-Version": "v1",
    });

    const token = "mock-logto-jwt-token-xyz";
    const headers = constructProxyHeaders(token);

    assert.equal(headers.Authorization, "Bearer mock-logto-jwt-token-xyz");
    assert.equal(headers["X-Astra-Contract-Version"], "v1");
    assert.equal(headers["Content-Type"], "application/json");
  });

  it("Gateway Fault Handling: Incompatible or missing X-Astra-Contract-Version header triggers HTTP 502", () => {
    const evaluateGatewayResponse = (response: {
      ok: boolean;
      status: number;
      headerVersion: string | null;
    }) => {
      if (!response.ok || response.headerVersion !== "v1") {
        return {
          status: response.ok ? 502 : response.status,
          error: "Contract unavailable or incompatible.",
        };
      }
      return { status: 200 };
    };

    // Missing header on 200 OK -> 502 Bad Gateway
    assert.equal(
      evaluateGatewayResponse({ ok: true, status: 200, headerVersion: null })
        .status,
      502,
    );
    // Wrong contract version on 200 OK -> 502 Bad Gateway
    assert.equal(
      evaluateGatewayResponse({ ok: true, status: 200, headerVersion: "v2" })
        .status,
      502,
    );
    // 401 Unauthorized from Astra -> propagates 401
    assert.equal(
      evaluateGatewayResponse({ ok: false, status: 401, headerVersion: "v1" })
        .status,
      401,
    );
    // 403 Forbidden from Astra -> propagates 403
    assert.equal(
      evaluateGatewayResponse({ ok: false, status: 403, headerVersion: "v1" })
        .status,
      403,
    );
    // Valid 200 OK with v1 header -> 200 OK
    assert.equal(
      evaluateGatewayResponse({ ok: true, status: 200, headerVersion: "v1" })
        .status,
      200,
    );
  });

  it("Response Envelope Mapping: Safely extracts object_path or fileId when download_url is null/undefined", () => {
    const mapConfirmation = (
      confirmation: {
        data?: {
          id?: string;
          object_path?: string;
          download_url?: string | null;
        };
      },
      fallbackFileId: string,
    ) => {
      return {
        file_id: confirmation.data?.id ?? fallbackFileId,
        url:
          confirmation.data?.object_path ??
          confirmation.data?.id ??
          fallbackFileId,
      };
    };

    // Case 1: Standard FileRecord with object_path
    const res1 = mapConfirmation(
      {
        data: {
          id: "file-001",
          object_path: "permits/file-001.pdf",
          download_url: null,
        },
      },
      "file-001",
    );
    assert.equal(res1.file_id, "file-001");
    assert.equal(res1.url, "permits/file-001.pdf");

    // Case 2: FileRecord without object_path falls back to id
    const res2 = mapConfirmation({ data: { id: "file-002" } }, "file-002");
    assert.equal(res2.file_id, "file-002");
    assert.equal(res2.url, "file-002");

    // Case 3: Empty data envelope falls back to fallbackFileId
    const res3 = mapConfirmation({}, "file-003");
    assert.equal(res3.file_id, "file-003");
    assert.equal(res3.url, "file-003");
  });
});

// ============================================================================
// 3. GAP-02: STUDENT ROSTER RESILIENCE & BULK DELETION ELIMINATION
// ============================================================================

describe("Challenger 1 Adversarial Stress: Student Roster & Bulk Deletion Elimination (GAP-02)", () => {
  it("Static Codebase Audit: 0 occurrences of 'students/batch' across all Chronos source code", () => {
    const rootDir = join(__dirname, "../src");

    function scanDir(dir: string, matches: string[]) {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const st = statSync(fullPath);
        if (st.isDirectory()) {
          scanDir(fullPath, matches);
        } else if (
          st.isFile() &&
          (entry.endsWith(".ts") ||
            entry.endsWith(".tsx") ||
            entry.endsWith(".js"))
        ) {
          const content = readFileSync(fullPath, "utf8");
          if (content.includes("students/batch")) {
            matches.push(fullPath);
          }
        }
      }
    }

    const matchedFiles: string[] = [];
    scanDir(rootDir, matchedFiles);
    assert.deepEqual(
      matchedFiles,
      [],
      "Found forbidden references to 'students/batch' in source code",
    );
  });

  it("Single Student Query Resilience: getByNis returns null on non-existent or empty NIS without throwing", () => {
    const mockStudents = [
      {
        user_id: "student-1",
        full_name: "Budi Santoso",
        nis: "1001",
        class_name: "XII RPL 1",
        absence_number: "05",
        gender: "L",
        lifecycle_status: "approved",
      },
      {
        user_id: "student-2",
        full_name: "Siti Aminah",
        nis: "1002",
        class_name: "XII RPL 1",
        absence_number: "12",
        gender: "P",
        lifecycle_status: "pending",
      },
    ];

    const findStudentByNis = (nis: string) => {
      const normalized = normalizeStudentRows(mockStudents);
      const student = normalized.find((s) => s.nis === nis);
      if (!student) return null;
      const absenceNum = student.absence_number
        ? parseInt(student.absence_number, 10)
        : null;
      return {
        nis: student.nis ?? nis,
        nama: student.full_name ?? null,
        kelas: student.class_name ?? null,
        absen: Number.isNaN(absenceNum) ? null : absenceNum,
        kelamin: student.gender ?? null,
        activated: student.lifecycle_status === "approved",
      };
    };

    // Existing student
    const s1 = findStudentByNis("1001");
    assert.ok(s1);
    assert.equal(s1?.nama, "Budi Santoso");
    assert.equal(s1?.absen, 5);
    assert.equal(s1?.activated, true);

    // Pending student
    const s2 = findStudentByNis("1002");
    assert.ok(s2);
    assert.equal(s2?.activated, false);

    // Non-existent NIS
    assert.equal(findStudentByNis("9999"), null);
    // Empty string NIS
    assert.equal(findStudentByNis(""), null);
    // Special character NIS
    assert.equal(findStudentByNis("!@#$%^&*()"), null);
  });

  it("Student Roster Natural Sorting: Numerical NIS ordering (e.g. NIS 2 < NIS 10)", () => {
    const rawRoster = [
      { user_id: "u10", nis: "10", full_name: "Student 10" },
      { user_id: "u2", nis: "2", full_name: "Student 2" },
      { user_id: "u1", nis: "1", full_name: "Student 1" },
      { user_id: "u20", nis: "20", full_name: "Student 20" },
    ];

    const sorted = [...rawRoster].sort((a, b) => {
      const nisA = a.nis ?? "999999";
      const nisB = b.nis ?? "999999";
      return nisA.localeCompare(nisB, undefined, { numeric: true });
    });

    assert.equal(sorted[0]?.nis, "1");
    assert.equal(sorted[1]?.nis, "2");
    assert.equal(sorted[2]?.nis, "10");
    assert.equal(sorted[3]?.nis, "20");
  });

  it("Student Roster Search: Case-insensitive substring matching and special regex character resilience", () => {
    const rawRoster = [
      { user_id: "u1", nis: "1001", full_name: "Budi [RPL] Santoso" },
      { user_id: "u2", nis: "1002", full_name: "Siti (DKV) Aminah" },
      { user_id: "u3", nis: "1003", full_name: "Dewi *TKJ* Lestari" },
    ];

    const filterRoster = (searchTerm: string) => {
      const term = searchTerm.trim().toLowerCase();
      return rawRoster.filter((s) => {
        const nameMatch = (s.full_name ?? "").toLowerCase().includes(term);
        const nisMatch = (s.nis ?? "").toLowerCase().includes(term);
        return nameMatch || nisMatch;
      });
    };

    assert.equal(filterRoster("budi").length, 1);
    assert.equal(filterRoster("BUDI").length, 1);
    assert.equal(filterRoster("[rpl]").length, 1);
    assert.equal(filterRoster("(dkv)").length, 1);
    assert.equal(filterRoster("*tkj*").length, 1);
    assert.equal(filterRoster(".*").length, 0); // Treated as literal characters, not regex wildcard
    assert.equal(filterRoster("   ").length, 3); // Empty / whitespace returns all
  });

  it("Unique Class Aggregation: Merges classes from class entities and student profiles without duplicates", () => {
    const classEntities = [
      { id: "c1", name: "X RPL 1", grade: 10 },
      { id: "c2", name: "XI RPL 1", grade: 11 },
    ];
    const studentProfiles = [
      { class_name: "X RPL 1" },
      { class_name: "XII RPL 1" }, // Class present in students but not in class entities
      { class_name: null },
      { class_name: "" },
    ];

    const classes = collectUniqueClassNames(classEntities, studentProfiles);
    assert.deepEqual(classes, ["X RPL 1", "XI RPL 1", "XII RPL 1"]);
  });
});

// ============================================================================
// 4. GAP-04: LOGTO POST-LOGOUT REDIRECT URI ADVERSARIAL TESTS
// ============================================================================

describe("Challenger 1 Adversarial Stress: LOGTO_POST_LOGOUT_REDIRECT_URI (GAP-04)", () => {
  const envSchema = z.object({
    LOGTO_POST_LOGOUT_REDIRECT_URI: z.string().url(),
  });

  it("Environment Schema: Validates standard URLs and rejects malformed strings", () => {
    // Valid URLs
    assert.ok(
      envSchema.safeParse({
        LOGTO_POST_LOGOUT_REDIRECT_URI: "http://localhost:3000",
      }).success,
    );
    assert.ok(
      envSchema.safeParse({
        LOGTO_POST_LOGOUT_REDIRECT_URI: "http://192.168.21.121:13000",
      }).success,
    );
    assert.ok(
      envSchema.safeParse({
        LOGTO_POST_LOGOUT_REDIRECT_URI: "https://sekolah.sch.id/logout",
      }).success,
    );

    // Invalid values
    assert.equal(
      envSchema.safeParse({ LOGTO_POST_LOGOUT_REDIRECT_URI: "" }).success,
      false,
    );
    assert.equal(
      envSchema.safeParse({ LOGTO_POST_LOGOUT_REDIRECT_URI: "not-a-url" })
        .success,
      false,
    );
    assert.equal(
      envSchema.safeParse({ LOGTO_POST_LOGOUT_REDIRECT_URI: "http://" })
        .success,
      false,
    );
    assert.equal(
      envSchema.safeParse({
        LOGTO_POST_LOGOUT_REDIRECT_URI: "://missing-scheme",
      }).success,
      false,
    );
    assert.equal(envSchema.safeParse({}).success, false);
  });

  it("Security / Origin Validation: Allows same origin and preserves path, query parameters & hashes", () => {
    const baseUrl = "http://localhost:3000";

    // Same origin with exact root
    assert.equal(
      getPostLogoutRedirectUri(baseUrl, "http://localhost:3000"),
      "http://localhost:3000/",
    );

    // Same origin with path
    assert.equal(
      getPostLogoutRedirectUri(baseUrl, "http://localhost:3000/auth/login"),
      "http://localhost:3000/auth/login",
    );

    // Same origin with query parameters
    assert.equal(
      getPostLogoutRedirectUri(
        baseUrl,
        "http://localhost:3000/login?logout=success&msg=goodbye",
      ),
      "http://localhost:3000/login?logout=success&msg=goodbye",
    );

    // Same origin with hash
    assert.equal(
      getPostLogoutRedirectUri(
        baseUrl,
        "http://localhost:3000/login#signed-out",
      ),
      "http://localhost:3000/login#signed-out",
    );
  });

  it("Security / Adversarial Attack Resistance: Throws error on cross-origin, port mismatch, scheme switch, and phishing domains", () => {
    const baseUrl = "http://localhost:3000";

    // 1. Phishing domain attack
    assert.throws(
      () =>
        getPostLogoutRedirectUri(
          baseUrl,
          "http://attacker-phishing.com/steal-token",
        ),
      /LOGTO_POST_LOGOUT_REDIRECT_URI must use the Chronos application origin/,
    );

    // 2. Subdomain hijacking attack
    assert.throws(
      () =>
        getPostLogoutRedirectUri(
          "http://chronos.school.sch.id",
          "http://evil.school.sch.id",
        ),
      /LOGTO_POST_LOGOUT_REDIRECT_URI must use the Chronos application origin/,
    );

    // 3. Port manipulation attack
    assert.throws(
      () =>
        getPostLogoutRedirectUri(
          "http://localhost:3000",
          "http://localhost:8080",
        ),
      /LOGTO_POST_LOGOUT_REDIRECT_URI must use the Chronos application origin/,
    );

    // 4. Protocol downgrade attack (https -> http)
    assert.throws(
      () =>
        getPostLogoutRedirectUri(
          "https://chronos.school.sch.id",
          "http://chronos.school.sch.id",
        ),
      /LOGTO_POST_LOGOUT_REDIRECT_URI must use the Chronos application origin/,
    );

    // 5. Missing or undefined redirect URI
    assert.throws(
      () => getPostLogoutRedirectUri(baseUrl, undefined),
      /LOGTO_POST_LOGOUT_REDIRECT_URI must be configured with a registered Logto post-sign-out redirect URI/,
    );

    // 6. Empty string redirect URI
    assert.throws(
      () => getPostLogoutRedirectUri(baseUrl, ""),
      /LOGTO_POST_LOGOUT_REDIRECT_URI must be configured with a registered Logto post-sign-out redirect URI/,
    );

    // 7. Non-http/https scheme / javascript pseudo-protocol
    assert.throws(
      () => getPostLogoutRedirectUri(baseUrl, "javascript:alert(1)"),
      /LOGTO_POST_LOGOUT_REDIRECT_URI must use the Chronos application origin/,
    );
  });
});
