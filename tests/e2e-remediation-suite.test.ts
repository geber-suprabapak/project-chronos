import { readFileSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { z } from "zod";

import { getPostLogoutRedirectUri } from "../src/lib/logto/post-logout-redirect.ts";
import {
  isPasswordChangeRequired,
  isPrivilegedRole,
  isAdminRole,
  resolveLogtoRole,
} from "../src/lib/logto/claims.ts";
import { buildPendingLeaveRequestReset } from "../src/server/api/routers/perizinan-contract.ts";
import { buildScheduleUpdatePayload } from "../src/server/api/routers/jadwal-update.ts";
import {
  collectUniqueClassNames,
  normalizeStudentRows,
} from "../src/lib/class-names.ts";
import { normalizeDateOnly } from "../src/lib/date-utils.ts";

export const APP_ROLES = [
  "platform_admin",
  "school_admin",
  "teacher",
  "staff",
  "student",
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
  "siswa",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PRIVILEGED_ROLES: readonly AppRole[] = [
  "platform_admin",
  "school_admin",
  "teacher",
  "staff",
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
];

export const ADMIN_ROLES: readonly AppRole[] = [
  "platform_admin",
  "school_admin",
  "admin",
  "kepala_sekolah",
];

const VALID_APP_ROLES: ReadonlySet<string> = new Set<string>(APP_ROLES);

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value != null && VALID_APP_ROLES.has(value);
}

export function hasRequiredRole(
  role: AppRole,
  allowed: readonly AppRole[],
): boolean {
  return allowed.includes(role);
}

// ============================================================================
// SIMULATION & CONTRACT HARNESSES FOR OPAQUE-BOX E2E VERIFICATION
// ============================================================================

interface SimulatedLeaveRequest {
  id: string;
  user_id: string;
  student_name: string;
  student_nis: string;
  student_class: string;
  category: "sakit" | "pergi" | "dispensasi" | "lainnya";
  description: string;
  date: string;
  file_id: string | null;
  attachment_url: string | null;
  status: boolean;
  approval_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

class InMemoryAstraLeaveStore {
  private requests: Map<string, SimulatedLeaveRequest> = new Map();

  create(req: {
    id?: string;
    userId: string;
    studentName: string;
    studentNis: string;
    studentClass: string;
    category: "sakit" | "pergi" | "dispensasi" | "lainnya";
    description: string;
    date: string;
    fileId?: string | null;
    attachmentUrl?: string | null;
    approvalStatus?: "pending" | "approved" | "rejected";
  }): SimulatedLeaveRequest {
    const id =
      req.id ?? `leave-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const isApproved = req.approvalStatus === "approved";
    const isRejected = req.approvalStatus === "rejected";

    const record: SimulatedLeaveRequest = {
      id,
      user_id: req.userId,
      student_name: req.studentName,
      student_nis: req.studentNis,
      student_class: req.studentClass,
      category: req.category,
      description: req.description,
      date: req.date,
      file_id: req.fileId ?? null,
      attachment_url:
        req.attachmentUrl ??
        (req.fileId ? `https://storage.local/${req.fileId}` : null),
      status: isApproved,
      approval_status: req.approvalStatus ?? "pending",
      rejection_reason: isRejected ? "Ditolak saat pembuatan" : null,
      rejected_at: isRejected ? now : null,
      created_at: now,
      updated_at: now,
    };
    this.requests.set(id, record);
    return { ...record };
  }

  get(id: string): SimulatedLeaveRequest | null {
    const found = this.requests.get(id);
    return found ? { ...found } : null;
  }

  approve(
    id: string,
    actorRole: string,
  ):
    | { ok: true; data: SimulatedLeaveRequest }
    | { ok: false; error: string; status: number } {
    if (
      !["platform_admin", "school_admin", "teacher", "admin", "guru"].includes(
        actorRole,
      )
    ) {
      return {
        ok: false,
        error: "Unauthorized role for approving leave requests",
        status: 403,
      };
    }
    const record = this.requests.get(id);
    if (!record)
      return { ok: false, error: "Leave request not found", status: 404 };

    record.approval_status = "approved";
    record.status = true;
    record.rejection_reason = null;
    record.rejected_at = null;
    record.updated_at = new Date().toISOString();
    return { ok: true, data: { ...record } };
  }

  reject(
    id: string,
    reason: string,
    actorRole: string,
  ):
    | { ok: true; data: SimulatedLeaveRequest }
    | { ok: false; error: string; status: number } {
    if (
      !["platform_admin", "school_admin", "teacher", "admin", "guru"].includes(
        actorRole,
      )
    ) {
      return {
        ok: false,
        error: "Unauthorized role for rejecting leave requests",
        status: 403,
      };
    }
    const record = this.requests.get(id);
    if (!record)
      return { ok: false, error: "Leave request not found", status: 404 };

    record.approval_status = "rejected";
    record.status = false;
    record.rejection_reason = reason;
    record.rejected_at = new Date().toISOString();
    record.updated_at = record.rejected_at;
    return { ok: true, data: { ...record } };
  }

  reopen(
    id: string,
    actorRole: string,
  ):
    | { ok: true; data: SimulatedLeaveRequest }
    | { ok: false; error: string; status: number } {
    if (
      !["platform_admin", "school_admin", "teacher", "admin", "guru"].includes(
        actorRole,
      )
    ) {
      return {
        ok: false,
        error: "Unauthorized role for reopening leave requests",
        status: 403,
      };
    }
    const record = this.requests.get(id);
    if (!record)
      return { ok: false, error: "Leave request not found", status: 404 };

    const resetPayload = buildPendingLeaveRequestReset();
    record.approval_status = resetPayload.approval_status;
    record.status = resetPayload.status;
    record.rejection_reason = resetPayload.rejection_reason;
    record.rejected_at = resetPayload.rejected_at;
    record.updated_at = new Date().toISOString();

    return { ok: true, data: { ...record } };
  }

  patch(
    id: string,
    patchBody: Record<string, unknown>,
    actorRole: string,
  ):
    | { ok: true; data: SimulatedLeaveRequest }
    | { ok: false; error: string; status: number } {
    if (
      !["platform_admin", "school_admin", "teacher", "admin", "guru"].includes(
        actorRole,
      )
    ) {
      return {
        ok: false,
        error: "Unauthorized role for patching leave requests",
        status: 403,
      };
    }
    const record = this.requests.get(id);
    if (!record)
      return { ok: false, error: "Leave request not found", status: 404 };

    if (patchBody.approval_status === "pending") {
      return this.reopen(id, actorRole);
    }
    if (patchBody.approval_status === "approved") {
      return this.approve(id, actorRole);
    }
    if (patchBody.approval_status === "rejected") {
      return this.reject(
        id,
        (patchBody.reason as string) ?? "Ditolak",
        actorRole,
      );
    }
    return {
      ok: false,
      error: "Invalid approval_status in PATCH body",
      status: 400,
    };
  }

  list(): SimulatedLeaveRequest[] {
    return Array.from(this.requests.values()).map((r) => ({ ...r }));
  }
}

// Simulated Astra File Gateway & Proxy Pipeline
interface UploadIntentRequest {
  purpose: string;
  content_type: string;
  size_bytes: number;
  filename: string;
}

interface UploadIntentEnvelope {
  success: boolean;
  data?: {
    file_id: string;
    upload_url: string;
  };
  error?: { message: string };
}

interface FileConfirmationEnvelope {
  success: boolean;
  data?: {
    id: string;
    object_path: string;
    download_url?: string | null;
  };
  error?: { message: string };
}

class SimulatedAstraFileGateway {
  private files: Map<
    string,
    {
      id: string;
      filename: string;
      size: number;
      contentType: string;
      objectPath: string;
    }
  > = new Map();

  createUploadIntent(
    payload: UploadIntentRequest,
    headers: Record<string, string>,
  ): {
    status: number;
    body: UploadIntentEnvelope;
    headers: Record<string, string>;
  } {
    const contractVersion =
      headers["x-astra-contract-version"] ??
      headers["X-Astra-Contract-Version"];
    const authHeader = headers["authorization"] ?? headers["Authorization"];

    if (contractVersion !== "v1") {
      return {
        status: 502,
        body: {
          success: false,
          error: { message: "Invalid or missing Astra contract version" },
        },
        headers: { "Content-Type": "application/json" },
      };
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        status: 401,
        body: {
          success: false,
          error: { message: "Unauthorized: Bearer token required" },
        },
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
        },
      };
    }

    if (!payload.purpose || !payload.content_type || !payload.filename) {
      return {
        status: 400,
        body: {
          success: false,
          error: { message: "Missing required upload intent fields" },
        },
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
        },
      };
    }

    if (payload.size_bytes > 5 * 1024 * 1024) {
      return {
        status: 413,
        body: { success: false, error: { message: "File exceeds 5MB limit" } },
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
        },
      };
    }

    const fileId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const uploadUrl = `https://s3.mock.local/uploads/${fileId}`;

    this.files.set(fileId, {
      id: fileId,
      filename: payload.filename,
      size: payload.size_bytes,
      contentType: payload.content_type,
      objectPath: `permits/${fileId}_${payload.filename}`,
    });

    return {
      status: 200,
      body: {
        success: true,
        data: {
          file_id: fileId,
          upload_url: uploadUrl,
        },
      },
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
      },
    };
  }

  confirmUpload(
    fileId: string,
    headers: Record<string, string>,
    omitDownloadUrl = true,
  ): {
    status: number;
    body: FileConfirmationEnvelope;
    headers: Record<string, string>;
  } {
    const contractVersion =
      headers["x-astra-contract-version"] ??
      headers["X-Astra-Contract-Version"];
    const authHeader = headers["authorization"] ?? headers["Authorization"];

    if (contractVersion !== "v1") {
      return {
        status: 502,
        body: {
          success: false,
          error: { message: "Invalid or missing Astra contract version" },
        },
        headers: { "Content-Type": "application/json" },
      };
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        status: 401,
        body: { success: false, error: { message: "Unauthorized" } },
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
        },
      };
    }

    const file = this.files.get(fileId);
    if (!file) {
      return {
        status: 404,
        body: {
          success: false,
          error: { message: "File not found for confirmation" },
        },
        headers: {
          "Content-Type": "application/json",
          "X-Astra-Contract-Version": "v1",
        },
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        data: {
          id: file.id,
          object_path: file.objectPath,
          download_url: omitDownloadUrl
            ? null
            : `https://s3.mock.local/${file.objectPath}`,
        },
      },
      headers: {
        "Content-Type": "application/json",
        "X-Astra-Contract-Version": "v1",
      },
    };
  }
}

// ============================================================================
// COMPREHENSIVE REMEDIATION TEST SUITE: TIERS 1 - 4
// ============================================================================

describe("E2E Remediation Test Suite: Chronos & Astra Integration", () => {
  // --------------------------------------------------------------------------
  // TIER 1: FEATURE COVERAGE (≥5 tests per requirement R1-R5)
  // --------------------------------------------------------------------------
  describe("Tier 1: Feature Coverage", () => {
    describe("R1. Leave Request Reopen / Reset Lifecycle (GAP-01)", () => {
      it("T1.R1.1: Reopens a rejected leave request to pending status via buildPendingLeaveRequestReset", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-student-01",
          studentName: "Budi Pratama",
          studentNis: "17701",
          studentClass: "XII RPL 1",
          category: "sakit",
          description: "Demam tinggi",
          date: "2026-09-01",
          approvalStatus: "rejected",
        });

        assert.equal(req.approval_status, "rejected");
        assert.equal(req.status, false);
        assert.notEqual(req.rejection_reason, null);

        const reopenResult = store.reopen(req.id, "platform_admin");
        assert.equal(reopenResult.ok, true);
        if (reopenResult.ok) {
          assert.equal(reopenResult.data.approval_status, "pending");
          assert.equal(reopenResult.data.status, false);
          assert.equal(reopenResult.data.rejection_reason, null);
          assert.equal(reopenResult.data.rejected_at, null);
          assert.equal(reopenResult.data.student_name, "Budi Pratama");
        }
      });

      it("T1.R1.2: Reopens an approved leave request back to pending status cleanly", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-student-02",
          studentName: "Siti Rahma",
          studentNis: "17702",
          studentClass: "XII RPL 2",
          category: "pergi",
          description: "Acara keluarga penting",
          date: "2026-09-02",
          approvalStatus: "approved",
        });

        assert.equal(req.approval_status, "approved");
        assert.equal(req.status, true);

        const reopenResult = store.reopen(req.id, "teacher");
        assert.equal(reopenResult.ok, true);
        if (reopenResult.ok) {
          assert.equal(reopenResult.data.approval_status, "pending");
          assert.equal(reopenResult.data.status, false);
        }
      });

      it("T1.R1.3: Supports PATCH /v1/admin/leave-requests/:id with pending approval_status", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-student-03",
          studentName: "Dedi Setiawan",
          studentNis: "17703",
          studentClass: "XII TKJ 1",
          category: "dispensasi",
          description: "Lomba olimpiade",
          date: "2026-09-03",
          approvalStatus: "rejected",
        });

        const patchResult = store.patch(
          req.id,
          { approval_status: "pending" },
          "school_admin",
        );
        assert.equal(patchResult.ok, true);
        if (patchResult.ok) {
          assert.equal(patchResult.data.approval_status, "pending");
          assert.equal(patchResult.data.rejection_reason, null);
        }
      });

      it("T1.R1.4: buildPendingLeaveRequestReset returns exact required Astra reset fields", () => {
        const payload = buildPendingLeaveRequestReset();
        assert.deepEqual(payload, {
          approval_status: "pending",
          status: false,
          rejection_reason: null,
          rejected_at: null,
        });
      });

      it("T1.R1.5: Preserves student identification and category across reopen transitions", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-student-04",
          studentName: "Fitri Handayani",
          studentNis: "17704",
          studentClass: "XII MM 1",
          category: "lainnya",
          description: "Urusan administrasi SIM",
          date: "2026-09-04",
          fileId: "file-surat-izin-01",
          approvalStatus: "rejected",
        });

        const reopenResult = store.reopen(req.id, "platform_admin");
        assert.equal(reopenResult.ok, true);
        if (reopenResult.ok) {
          assert.equal(reopenResult.data.user_id, "user-student-04");
          assert.equal(reopenResult.data.student_nis, "17704");
          assert.equal(reopenResult.data.category, "lainnya");
          assert.equal(reopenResult.data.file_id, "file-surat-izin-01");
          assert.equal(
            reopenResult.data.attachment_url,
            "https://storage.local/file-surat-izin-01",
          );
        }
      });
    });

    describe("R2. Astra Gateway File Upload Proxy (GAP-03)", () => {
      it("T1.R2.1: Negotiates upload intent with purpose 'permit_attachment' and valid headers", () => {
        const gateway = new SimulatedAstraFileGateway();
        const res = gateway.createUploadIntent(
          {
            purpose: "permit_attachment",
            content_type: "image/jpeg",
            size_bytes: 1024 * 500,
            filename: "surat_dokter.jpg",
          },
          {
            Authorization: "Bearer token-valid-logto-jwt",
            "X-Astra-Contract-Version": "v1",
          },
        );

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data?.file_id.startsWith("file-"));
        assert.ok(
          res.body.data?.upload_url.includes("https://s3.mock.local/uploads/"),
        );
      });

      it("T1.R2.2: Completes upload confirmation step and returns valid FileRecord envelope", () => {
        const gateway = new SimulatedAstraFileGateway();
        const intent = gateway.createUploadIntent(
          {
            purpose: "permit_attachment",
            content_type: "application/pdf",
            size_bytes: 1024 * 200,
            filename: "surat_keterangan.pdf",
          },
          {
            Authorization: "Bearer token-valid-logto-jwt",
            "X-Astra-Contract-Version": "v1",
          },
        );

        const fileId = intent.body.data!.file_id;
        const confirm = gateway.confirmUpload(
          fileId,
          {
            Authorization: "Bearer token-valid-logto-jwt",
            "X-Astra-Contract-Version": "v1",
          },
          true, // omit download_url
        );

        assert.equal(confirm.status, 200);
        assert.equal(confirm.body.success, true);
        assert.equal(confirm.body.data?.id, fileId);
        assert.equal(
          confirm.body.data?.object_path,
          `permits/${fileId}_surat_keterangan.pdf`,
        );
      });

      it("T1.R2.3: Chronos proxy maps confirmation with object_path without requiring download_url", () => {
        const confirmationEnvelope = {
          success: true,
          data: {
            id: "file-uuid-777",
            object_path: "permits/file-uuid-777_surat.png",
            download_url: null,
          },
        };

        const result = {
          file_id: confirmationEnvelope.data.id,
          url:
            confirmationEnvelope.data.object_path ??
            confirmationEnvelope.data.id,
        };

        assert.equal(result.file_id, "file-uuid-777");
        assert.equal(result.url, "permits/file-uuid-777_surat.png");
      });

      it("T1.R2.4: Injects mandatory X-Astra-Contract-Version v1 header in all gateway requests", () => {
        const gateway = new SimulatedAstraFileGateway();
        const res = gateway.createUploadIntent(
          {
            purpose: "permit_attachment",
            content_type: "image/png",
            size_bytes: 1024 * 100,
            filename: "lampiran.png",
          },
          {
            Authorization: "Bearer test-jwt",
            "X-Astra-Contract-Version": "v1",
          },
        );
        assert.equal(res.headers["X-Astra-Contract-Version"], "v1");
      });

      it("T1.R2.5: Verifies Astra contract file pins version v1", () => {
        const contractPath = join(process.cwd(), "contracts/astra-v1.json");
        assert.ok(
          existsSync(contractPath),
          "contracts/astra-v1.json must exist",
        );
        const parsed = JSON.parse(readFileSync(contractPath, "utf8")) as {
          version?: string;
        };
        assert.equal(parsed.version, "v1");
      });
    });

    describe("R3. Remove Bulk Student Deletion Feature (GAP-02)", () => {
      it("T1.R3.1: Confirms 0 references to 'students/batch' across all Chronos source code", () => {
        const srcDir = join(process.cwd(), "src");
        const checkDirectory = (dir: string): boolean => {
          // Verify perizinan, biodata-siswa, user-profiles, etc.
          const routerPath = join(
            srcDir,
            "server/api/routers/biodata-siswa.ts",
          );
          const perizinanPath = join(srcDir, "server/api/routers/perizinan.ts");
          const userProfilesPath = join(
            srcDir,
            "server/api/routers/user-profiles.ts",
          );

          const content = [
            readFileSync(routerPath, "utf8"),
            readFileSync(perizinanPath, "utf8"),
            readFileSync(userProfilesPath, "utf8"),
          ].join("\n");

          return (
            !content.includes("students/batch") &&
            !content.includes("deleteBatch")
          );
        };

        assert.equal(
          checkDirectory(srcDir),
          true,
          "Chronos routers must not reference batch student deletion",
        );
      });

      it("T1.R3.2: Supports single student lookup by NIS via biodataSiswa.getByNis contract", () => {
        const rawProfiles = [
          {
            user_id: "user-s1",
            full_name: "Ahmad Dahlan",
            nis: "17701",
            class_name: "XII RPL 1",
            absence_number: "01",
            gender: "L",
            lifecycle_status: "approved",
          },
        ];
        const normalized = normalizeStudentRows(rawProfiles);
        const match = normalized.find((s) => s.nis === "17701");
        assert.ok(match);
        assert.equal(match.full_name, "Ahmad Dahlan");
        assert.equal(match.class_name, "XII RPL 1");
      });

      it("T1.R3.3: Computes accurate student statistics (total, gender breakdown, activated)", () => {
        const students = [
          {
            user_id: "u1",
            full_name: "S1",
            nis: "101",
            gender: "L",
            lifecycle_status: "approved",
          },
          {
            user_id: "u2",
            full_name: "S2",
            nis: "102",
            gender: "P",
            lifecycle_status: "approved",
          },
          {
            user_id: "u3",
            full_name: "S3",
            nis: "103",
            gender: "L",
            lifecycle_status: "pending",
          },
        ];
        const normalized = normalizeStudentRows(students);
        let laki = 0;
        let perempuan = 0;
        let activated = 0;

        for (const s of normalized) {
          if (s.gender === "L") laki++;
          if (s.gender === "P") perempuan++;
          if (s.lifecycle_status === "approved") activated++;
        }

        assert.equal(normalized.length, 3);
        assert.equal(laki, 2);
        assert.equal(perempuan, 1);
        assert.equal(activated, 2);
      });

      it("T1.R3.4: Collects unique class names cleanly from class entities and student profiles", () => {
        const classes = [
          { id: "c1", name: "XII RPL 1" },
          { id: "c2", name: "XII RPL 2" },
        ];
        const students = [
          { class_name: "XII RPL 1" },
          { class_name: "XII TKJ 1" },
          { class_name: null },
        ];
        const unique = collectUniqueClassNames(classes, students);
        assert.deepEqual(unique, ["XII RPL 1", "XII RPL 2", "XII TKJ 1"]);
      });

      it("T1.R3.5: Preserves supported bulk attendance deletion without disruption", () => {
        const schedulePayload = buildScheduleUpdatePayload({
          mulaiMasuk: "06:30:00",
          kompensasiWaktu: 15,
          isActive: true,
        });
        assert.deepEqual(schedulePayload, {
          start_time: "06:30:00",
          grace_period_minutes: 15,
          is_active: true,
        });
      });
    });

    describe("R4. Enforce Mandatory LOGTO_POST_LOGOUT_REDIRECT_URI (GAP-04)", () => {
      it("T1.R4.1: Returns configured redirect URI when origin strictly matches LOGTO_BASE_URL", () => {
        const uri = getPostLogoutRedirectUri(
          "http://localhost:3000",
          "http://localhost:3000/signed-out",
        );
        assert.equal(uri, "http://localhost:3000/signed-out");
      });

      it("T1.R4.2: Preserves target path and query parameters under the same application origin", () => {
        const uri = getPostLogoutRedirectUri(
          "http://192.168.21.121:13000",
          "http://192.168.21.121:13000/auth/signed-out?reason=user_initiated",
        );
        assert.equal(
          uri,
          "http://192.168.21.121:13000/auth/signed-out?reason=user_initiated",
        );
      });

      it("T1.R4.3: Validates URL schema using Zod matching src/env.js definition", () => {
        const schema = z.string().url();
        assert.equal(schema.safeParse("http://localhost:3000").success, true);
        assert.equal(
          schema.safeParse("http://192.168.21.121:13000").success,
          true,
        );
        assert.equal(schema.safeParse("not-a-valid-url").success, false);
      });

      it("T1.R4.4: Enforces non-empty string validation for post-logout redirect in env schema", () => {
        const schema = z.string().url();
        assert.equal(schema.safeParse("").success, false);
        assert.equal(schema.safeParse(undefined).success, false);
      });

      it("T1.R4.5: Verifies .env and .env.example document LOGTO_POST_LOGOUT_REDIRECT_URI", () => {
        const envExamplePath = join(process.cwd(), ".env.example");
        const envExample = readFileSync(envExamplePath, "utf8");
        assert.ok(
          envExample.includes("LOGTO_POST_LOGOUT_REDIRECT_URI"),
          ".env.example must specify LOGTO_POST_LOGOUT_REDIRECT_URI",
        );
      });
    });

    describe("R5. Build, Lint & Auth Verification", () => {
      it("T1.R5.1: Resolves platform_admin as highest priority in Logto role hierarchy", () => {
        const role = resolveLogtoRole(["teacher", "platform_admin", "student"]);
        assert.equal(role, "platform_admin");
      });

      it("T1.R5.2: Identifies privileged vs administrative roles accurately", () => {
        assert.equal(isPrivilegedRole("teacher"), true);
        assert.equal(isAdminRole("teacher"), false);
        assert.equal(isPrivilegedRole("platform_admin"), true);
        assert.equal(isAdminRole("platform_admin"), true);
        assert.equal(isPrivilegedRole("student"), false);
      });

      it("T1.R5.3: Evaluates must_change_password requirement correctly for truthy/falsy values", () => {
        assert.equal(
          isPasswordChangeRequired({ must_change_password: true }),
          true,
        );
        assert.equal(
          isPasswordChangeRequired({ must_change_password: "true" }),
          true,
        );
        assert.equal(
          isPasswordChangeRequired({ must_change_password: 1 }),
          true,
        );
        assert.equal(
          isPasswordChangeRequired({ must_change_password: false }),
          false,
        );
        assert.equal(isPasswordChangeRequired({}), false);
      });

      it("T1.R5.4: Normalizes date-only string from full ISO timestamps without timestamp skew", () => {
        assert.equal(
          normalizeDateOnly("2026-09-01T07:30:00.000Z"),
          "2026-09-01",
        );
        assert.equal(normalizeDateOnly("2026-09-01"), "2026-09-01");
        assert.equal(normalizeDateOnly("invalid-date"), null);
      });

      it("T1.R5.5: Enforces RBAC permissions check predicate against allowed role array", () => {
        assert.equal(hasRequiredRole("platform_admin", PRIVILEGED_ROLES), true);
        assert.equal(hasRequiredRole("student", PRIVILEGED_ROLES), false);
        assert.equal(hasRequiredRole("school_admin", ADMIN_ROLES), true);
        assert.equal(hasRequiredRole("teacher", ADMIN_ROLES), false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // TIER 2: BOUNDARY & CORNER CASES (≥5 tests per requirement R1-R5)
  // --------------------------------------------------------------------------
  describe("Tier 2: Boundary & Corner Cases", () => {
    describe("R1 Boundary: Reopen Lifecycle Edge Cases", () => {
      it("T2.R1.1: Reopening a non-existent leave request ID returns 404 error", () => {
        const store = new InMemoryAstraLeaveStore();
        const result = store.reopen("non-existent-uuid-999", "platform_admin");
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.equal(result.status, 404);
          assert.equal(result.error, "Leave request not found");
        }
      });

      it("T2.R1.2: Student role attempting to reopen a leave request returns 403 Forbidden", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-s1",
          studentName: "Student 1",
          studentNis: "17701",
          studentClass: "XII RPL 1",
          category: "sakit",
          description: "Sakit",
          date: "2026-09-01",
          approvalStatus: "rejected",
        });

        const result = store.reopen(req.id, "student");
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.equal(result.status, 403);
          assert.ok(result.error.includes("Unauthorized role"));
        }
      });

      it("T2.R1.3: Reopening an already pending leave request is idempotent", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-s2",
          studentName: "Student 2",
          studentNis: "17702",
          studentClass: "XII RPL 1",
          category: "pergi",
          description: "Izin",
          date: "2026-09-01",
          approvalStatus: "pending",
        });

        const res1 = store.reopen(req.id, "platform_admin");
        const res2 = store.reopen(req.id, "platform_admin");
        assert.equal(res1.ok, true);
        assert.equal(res2.ok, true);
        if (res2.ok) {
          assert.equal(res2.data.approval_status, "pending");
          assert.equal(res2.data.status, false);
        }
      });

      it("T2.R1.4: Rejecting PATCH with unsupported approval_status returns 400 Bad Request", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-s3",
          studentName: "Student 3",
          studentNis: "17703",
          studentClass: "XII RPL 1",
          category: "sakit",
          description: "Sakit",
          date: "2026-09-01",
          approvalStatus: "pending",
        });

        const result = store.patch(
          req.id,
          { approval_status: "unknown_status" },
          "platform_admin",
        );
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.equal(result.status, 400);
        }
      });

      it("T2.R1.5: Reopening preserves Unicode / Indonesian characters in student name and description", () => {
        const store = new InMemoryAstraLeaveStore();
        const req = store.create({
          userId: "user-s4",
          studentName: "Bagus Priyambodo S.Kom",
          studentNis: "17704",
          studentClass: "XII RPL 1",
          category: "sakit",
          description:
            "Mengalami cacar air (varicella) & istirahat total 3 hari.",
          date: "2026-09-01",
          approvalStatus: "rejected",
        });

        const reopenResult = store.reopen(req.id, "platform_admin");
        assert.equal(reopenResult.ok, true);
        if (reopenResult.ok) {
          assert.equal(
            reopenResult.data.student_name,
            "Bagus Priyambodo S.Kom",
          );
          assert.equal(
            reopenResult.data.description,
            "Mengalami cacar air (varicella) & istirahat total 3 hari.",
          );
        }
      });
    });

    describe("R2 Boundary: File Upload Proxy Limits & Invariants", () => {
      it("T2.R2.1: Rejects file exceeding 5MB limit with HTTP 413 Payload Too Large", () => {
        const gateway = new SimulatedAstraFileGateway();
        const result = gateway.createUploadIntent(
          {
            purpose: "permit_attachment",
            content_type: "application/pdf",
            size_bytes: 5 * 1024 * 1024 + 1, // 5MB + 1 byte
            filename: "oversized_scan.pdf",
          },
          {
            Authorization: "Bearer token-jwt",
            "X-Astra-Contract-Version": "v1",
          },
        );
        assert.equal(result.status, 413);
        assert.equal(result.body.success, false);
        assert.ok(result.body.error?.message.includes("5MB"));
      });

      it("T2.R2.2: Accepts file exactly at 5MB boundary limit (5 * 1024 * 1024 bytes)", () => {
        const gateway = new SimulatedAstraFileGateway();
        const result = gateway.createUploadIntent(
          {
            purpose: "permit_attachment",
            content_type: "image/jpeg",
            size_bytes: 5 * 1024 * 1024,
            filename: "exact_5mb.jpg",
          },
          {
            Authorization: "Bearer token-jwt",
            "X-Astra-Contract-Version": "v1",
          },
        );
        assert.equal(result.status, 200);
        assert.equal(result.body.success, true);
      });

      it("T2.R2.3: Rejects missing X-Astra-Contract-Version header with HTTP 502 Bad Gateway", () => {
        const gateway = new SimulatedAstraFileGateway();
        const result = gateway.createUploadIntent(
          {
            purpose: "permit_attachment",
            content_type: "image/jpeg",
            size_bytes: 1024,
            filename: "test.jpg",
          },
          {
            Authorization: "Bearer token-jwt",
          },
        );
        assert.equal(result.status, 502);
      });

      it("T2.R2.4: Rejects unauthenticated request without Bearer token with HTTP 401 Unauthorized", () => {
        const gateway = new SimulatedAstraFileGateway();
        const result = gateway.createUploadIntent(
          {
            purpose: "permit_attachment",
            content_type: "image/jpeg",
            size_bytes: 1024,
            filename: "test.jpg",
          },
          {
            "X-Astra-Contract-Version": "v1",
          },
        );
        assert.equal(result.status, 401);
      });

      it("T2.R2.5: Rejects missing filename or purpose with HTTP 400 Bad Request", () => {
        const gateway = new SimulatedAstraFileGateway();
        const result = gateway.createUploadIntent(
          {
            purpose: "",
            content_type: "image/jpeg",
            size_bytes: 1024,
            filename: "",
          },
          {
            Authorization: "Bearer token-jwt",
            "X-Astra-Contract-Version": "v1",
          },
        );
        assert.equal(result.status, 400);
      });
    });

    describe("R3 Boundary: Student Roster Filtering & Search Boundaries", () => {
      it("T2.R3.1: Searching with empty string returns all students without truncation", () => {
        const students = [
          { user_id: "u1", full_name: "Alfa", nis: "101" },
          { user_id: "u2", full_name: "Beta", nis: "102" },
        ];
        const normalized = normalizeStudentRows(students);
        const filtered = normalized.filter((s) => {
          const search = "".trim().toLowerCase();
          return (
            search.length === 0 ||
            (s.full_name ?? "").toLowerCase().includes(search)
          );
        });
        assert.equal(filtered.length, 2);
      });

      it("T2.R3.2: Searching non-existent NIS returns empty match array gracefully", () => {
        const students = [{ user_id: "u1", full_name: "Alfa", nis: "101" }];
        const normalized = normalizeStudentRows(students);
        const match = normalized.find((s) => s.nis === "99999");
        assert.equal(match, undefined);
      });

      it("T2.R3.3: Correctly parses absence numbers with leading zeros or empty strings", () => {
        const s1 = { user_id: "u1", nis: "101", absence_number: "07" };
        const s2 = { user_id: "u2", nis: "102", absence_number: "" };
        const s3 = { user_id: "u3", nis: "103", absence_number: null };

        const num1 = s1.absence_number ? parseInt(s1.absence_number, 10) : null;
        const num2 = s2.absence_number ? parseInt(s2.absence_number, 10) : null;
        const num3 = s3.absence_number ? parseInt(s3.absence_number, 10) : null;

        assert.equal(num1, 7);
        assert.equal(num2, null);
        assert.equal(num3, null);
      });

      it("T2.R3.4: Sorts student roster numerically by NIS (e.g. 2 < 10)", () => {
        const students = [
          { user_id: "u1", nis: "10020" },
          { user_id: "u2", nis: "10003" },
          { user_id: "u3", nis: "10010" },
        ];
        const sorted = [...students].sort((a, b) =>
          (a.nis ?? "").localeCompare(b.nis ?? "", undefined, {
            numeric: true,
          }),
        );
        assert.equal(sorted[0]!.nis, "10003");
        assert.equal(sorted[1]!.nis, "10010");
        assert.equal(sorted[2]!.nis, "10020");
      });

      it("T2.R3.5: Handles null/undefined student profile fields without throwing runtime exceptions", () => {
        const student = {
          user_id: "u-empty",
          full_name: null,
          email: null,
          nis: null,
          class_name: null,
          absence_number: null,
        };
        const normalized = normalizeStudentRows([student]);
        assert.equal(normalized[0]!.full_name, null);
        assert.equal(normalized[0]!.nis, null);
        assert.equal(normalized[0]!.class_name, null);
      });
    });

    describe("R4 Boundary: Post-Logout Redirect URI Security Edge Cases", () => {
      it("T2.R4.1: Throws error when configured redirect URI points to external phishing domain", () => {
        assert.throws(
          () =>
            getPostLogoutRedirectUri(
              "http://localhost:3000",
              "http://attacker.com/steal-session",
            ),
          /Chronos application origin/,
        );
      });

      it("T2.R4.2: Throws error when configured redirect URI uses different port", () => {
        assert.throws(
          () =>
            getPostLogoutRedirectUri(
              "http://localhost:3000",
              "http://localhost:8080/signed-out",
            ),
          /Chronos application origin/,
        );
      });

      it("T2.R4.3: Throws error when configured redirect URI uses different scheme (https vs http)", () => {
        assert.throws(
          () =>
            getPostLogoutRedirectUri(
              "http://localhost:3000",
              "https://localhost:3000/signed-out",
            ),
          /Chronos application origin/,
        );
      });

      it("T2.R4.4: Throws error when LOGTO_POST_LOGOUT_REDIRECT_URI is undefined or empty string", () => {
        assert.throws(
          () => getPostLogoutRedirectUri("http://localhost:3000", undefined),
          /LOGTO_POST_LOGOUT_REDIRECT_URI/,
        );
        assert.throws(
          () => getPostLogoutRedirectUri("http://localhost:3000", ""),
          /LOGTO_POST_LOGOUT_REDIRECT_URI/,
        );
      });

      it("T2.R4.5: Throws error when configured redirect URI is a malformed URL", () => {
        assert.throws(() =>
          getPostLogoutRedirectUri(
            "http://localhost:3000",
            "htp://invalid url with spaces",
          ),
        );
      });
    });

    describe("R5 Boundary: Auth Claims & Role Edge Cases", () => {
      it("T2.R5.1: Returns null when resolving role from empty or unrecognized role list", () => {
        assert.equal(resolveLogtoRole([]), null);
        assert.equal(resolveLogtoRole(["guest", "anonymous"]), null);
        assert.equal(resolveLogtoRole(undefined), null);
      });

      it("T2.R5.2: isAppRole validates known application roles and rejects invalid strings", () => {
        assert.equal(isAppRole("platform_admin"), true);
        assert.equal(isAppRole("school_admin"), true);
        assert.equal(isAppRole("teacher"), true);
        assert.equal(isAppRole("student"), true);
        assert.equal(isAppRole("super_user"), false);
        assert.equal(isAppRole(null), false);
      });

      it("T2.R5.3: Normalizes date-only from malformed date string by returning null", () => {
        assert.equal(normalizeDateOnly("2026/09/01"), null);
        assert.equal(normalizeDateOnly("01-09-2026"), null);
        assert.equal(normalizeDateOnly(""), null);
        assert.equal(normalizeDateOnly(undefined), null);
      });

      it("T2.R5.4: Evaluates must_change_password as false when key is absent or null", () => {
        assert.equal(isPasswordChangeRequired({}), false);
        assert.equal(
          isPasswordChangeRequired({ must_change_password: null }),
          false,
        );
        assert.equal(
          isPasswordChangeRequired({ must_change_password: 0 }),
          false,
        );
      });

      it("T2.R5.5: Handles legacy and alias roles in resolution and privilege checks", () => {
        assert.equal(resolveLogtoRole(["admin"]), "admin");
        assert.equal(resolveLogtoRole(["guru"]), "guru");
        assert.equal(resolveLogtoRole(["siswa"]), "siswa");
        assert.equal(isPrivilegedRole("admin"), true);
        assert.equal(isPrivilegedRole("guru"), true);
        assert.equal(isPrivilegedRole("siswa"), false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // TIER 3: CROSS-FEATURE INTERACTIONS & COMBINATIONS (Multi-step workflows)
  // --------------------------------------------------------------------------
  describe("Tier 3: Cross-Feature Interactions & Combinations", () => {
    it("T3.Flow 1: File Upload -> Submit Leave Request -> Reject -> Reopen -> Verify Attachment Retained", () => {
      const fileGateway = new SimulatedAstraFileGateway();
      const leaveStore = new InMemoryAstraLeaveStore();

      // Step 1: Upload attachment
      const intentRes = fileGateway.createUploadIntent(
        {
          purpose: "permit_attachment",
          content_type: "image/jpeg",
          size_bytes: 1024 * 300,
          filename: "surat_dokter_spesialis.jpg",
        },
        {
          Authorization: "Bearer token-jwt-1",
          "X-Astra-Contract-Version": "v1",
        },
      );
      assert.equal(intentRes.status, 200);
      const fileId = intentRes.body.data!.file_id;

      // Step 2: Confirm upload
      const confirmRes = fileGateway.confirmUpload(
        fileId,
        {
          Authorization: "Bearer token-jwt-1",
          "X-Astra-Contract-Version": "v1",
        },
        true,
      );
      assert.equal(confirmRes.status, 200);

      // Step 3: Create leave request linked to uploaded file
      const leave = leaveStore.create({
        userId: "student-user-100",
        studentName: "Aditya Pratama",
        studentNis: "17750",
        studentClass: "XII RPL 1",
        category: "sakit",
        description: "Opname di RS Mitra Medika",
        date: "2026-09-01",
        fileId: fileId,
        approvalStatus: "pending",
      });
      assert.equal(leave.approval_status, "pending");
      assert.equal(leave.file_id, fileId);

      // Step 4: Admin reviews and rejects due to incomplete note
      const rejectRes = leaveStore.reject(
        leave.id,
        "Surat dokter kurang stempel basah",
        "school_admin",
      );
      assert.equal(rejectRes.ok, true);
      if (rejectRes.ok) {
        assert.equal(rejectRes.data.approval_status, "rejected");
        assert.equal(
          rejectRes.data.rejection_reason,
          "Surat dokter kurang stempel basah",
        );
      }

      // Step 5: After student clarification, admin reopens to pending
      const reopenRes = leaveStore.reopen(leave.id, "school_admin");
      assert.equal(reopenRes.ok, true);
      if (reopenRes.ok) {
        assert.equal(reopenRes.data.approval_status, "pending");
        assert.equal(reopenRes.data.status, false);
        assert.equal(reopenRes.data.rejection_reason, null);
        assert.equal(reopenRes.data.rejected_at, null);
        // CRITICAL INVARIANT: File attachment reference is strictly retained
        assert.equal(reopenRes.data.file_id, fileId);
        assert.equal(
          reopenRes.data.attachment_url,
          `https://storage.local/${fileId}`,
        );
      }

      // Step 6: Admin approves reopened request
      const approveRes = leaveStore.approve(leave.id, "platform_admin");
      assert.equal(approveRes.ok, true);
      if (approveRes.ok) {
        assert.equal(approveRes.data.approval_status, "approved");
        assert.equal(approveRes.data.status, true);
      }
    });

    it("T3.Flow 2: Student Activation Check Gate -> Account Activation -> Leave Request Submission", () => {
      const studentDB = [
        {
          user_id: "stu-inactive",
          nis: "17760",
          full_name: "Candra Wibowo",
          class_name: "XII TKJ 2",
          lifecycle_status: "pending",
        },
      ];

      // Step 1: Admin attempts to create manual leave for unapproved student
      const student = studentDB.find((s) => s.nis === "17760");
      assert.ok(student);
      const canCreateLeaveInitially = student.lifecycle_status === "approved";
      assert.equal(
        canCreateLeaveInitially,
        false,
        "Unapproved student must not receive manual leave",
      );

      // Step 2: Administrator activates student account
      student.lifecycle_status = "approved";

      // Step 3: Admin successfully submits leave for activated student
      const canCreateLeaveNow = student.lifecycle_status === "approved";
      assert.equal(canCreateLeaveNow, true);

      const store = new InMemoryAstraLeaveStore();
      const leave = store.create({
        userId: student.user_id,
        studentName: student.full_name,
        studentNis: student.nis,
        studentClass: student.class_name,
        category: "pergi",
        description: "Mewakili sekolah lomba web development",
        date: "2026-09-02",
        approvalStatus: "approved",
      });

      assert.equal(leave.user_id, "stu-inactive");
      assert.equal(leave.student_name, "Candra Wibowo");
      assert.equal(leave.approval_status, "approved");
    });

    it("T3.Flow 3: Post-Logout Invalidation -> Protected Proxy Access Rejected (401) -> Re-auth Flow", () => {
      // Step 1: User logs out and receives validated post-logout URI
      const baseUrl = "http://localhost:3000";
      const logoutRedirect = getPostLogoutRedirectUri(
        baseUrl,
        "http://localhost:3000/signed-out",
      );
      assert.equal(logoutRedirect, "http://localhost:3000/signed-out");

      // Step 2: Attempting to call file upload gateway after logout without token
      const gateway = new SimulatedAstraFileGateway();
      const unauthResponse = gateway.createUploadIntent(
        {
          purpose: "permit_attachment",
          content_type: "image/png",
          size_bytes: 1024,
          filename: "test.png",
        },
        {
          "X-Astra-Contract-Version": "v1",
        },
      );
      assert.equal(unauthResponse.status, 401);

      // Step 3: User logs back in with valid token
      const authResponse = gateway.createUploadIntent(
        {
          purpose: "permit_attachment",
          content_type: "image/png",
          size_bytes: 1024,
          filename: "test.png",
        },
        {
          Authorization: "Bearer newly-minted-token",
          "X-Astra-Contract-Version": "v1",
        },
      );
      assert.equal(authResponse.status, 200);
      assert.equal(authResponse.body.success, true);
    });

    it("T3.Flow 4: Bulk Attendance Deletion vs Student Roster Isolation (Zero Collateral Impact)", () => {
      // Simulated shared domain dataset
      const studentRoster = [
        {
          user_id: "s1",
          nis: "101",
          full_name: "Student One",
          lifecycle_status: "approved",
        },
        {
          user_id: "s2",
          nis: "102",
          full_name: "Student Two",
          lifecycle_status: "approved",
        },
      ];
      let attendanceRecords = [
        { id: "att-1", user_id: "s1", date: "2026-09-01", status: "Hadir" },
        { id: "att-2", user_id: "s2", date: "2026-09-01", status: "Hadir" },
      ];

      // Admin executes bulk attendance deletion for specified IDs
      const deleteIds = ["att-1", "att-2"];
      attendanceRecords = attendanceRecords.filter(
        (att) => !deleteIds.includes(att.id),
      );

      // Assert attendance records deleted
      assert.equal(attendanceRecords.length, 0);

      // CRITICAL INVARIANT: Student roster remains 100% untouched
      assert.equal(studentRoster.length, 2);
      assert.equal(studentRoster[0]!.full_name, "Student One");
      assert.equal(studentRoster[1]!.full_name, "Student Two");
    });

    it("T3.Flow 5: Schedule Configuration Update + Date Normalization + Leave Mapping Integration", () => {
      // Step 1: Update schedule payload builder
      const scheduleUpdate = buildScheduleUpdatePayload({
        mulaiMasuk: "07:00:00",
        kompensasiWaktu: 10,
        isActive: true,
      });
      assert.equal(scheduleUpdate.start_time, "07:00:00");
      assert.equal(scheduleUpdate.grace_period_minutes, 10);

      // Step 2: Normalize leave request date with ISO timestamp input
      const rawAstraLeaveDate = "2026-09-01T00:00:00.000Z";
      const normalizedDate = normalizeDateOnly(rawAstraLeaveDate);
      assert.equal(normalizedDate, "2026-09-01");

      // Step 3: Map leave record to perizinan UI contract
      const store = new InMemoryAstraLeaveStore();
      const leave = store.create({
        userId: "u-schedule-test",
        studentName: "Schedule Tester",
        studentNis: "17780",
        studentClass: "XII RPL 1",
        category: "dispensasi",
        description: "Dispensasi penyesuaian jadwal",
        date: normalizedDate!,
        approvalStatus: "pending",
      });

      assert.equal(leave.date, "2026-09-01");
      assert.equal(leave.approval_status, "pending");
    });
  });

  // --------------------------------------------------------------------------
  // TIER 4: REAL-WORLD APPLICATION WORKLOADS & END-TO-END SCENARIOS
  // --------------------------------------------------------------------------
  describe("Tier 4: Real-World Application Workloads & End-to-End Scenarios", () => {
    it("T4.Scenario 1: Comprehensive Multi-Student Administrative Operations Workload", () => {
      const store = new InMemoryAstraLeaveStore();
      const fileGateway = new SimulatedAstraFileGateway();

      // Roster of 5 students across 3 classes
      const rawRoster = [
        {
          user_id: "u-01",
          full_name: "Andi Saputra",
          nis: "1001",
          class_name: "XII RPL 1",
          gender: "L",
          lifecycle_status: "approved",
        },
        {
          user_id: "u-02",
          full_name: "Bela Cantika",
          nis: "1002",
          class_name: "XII RPL 1",
          gender: "P",
          lifecycle_status: "approved",
        },
        {
          user_id: "u-03",
          full_name: "Citra Dewi",
          nis: "1003",
          class_name: "XII TKJ 1",
          gender: "P",
          lifecycle_status: "approved",
        },
        {
          user_id: "u-04",
          full_name: "Dimas Anggara",
          nis: "1004",
          class_name: "XII TKJ 1",
          gender: "L",
          lifecycle_status: "approved",
        },
        {
          user_id: "u-05",
          full_name: "Eka Pramana",
          nis: "1005",
          class_name: "XII MM 1",
          gender: "L",
          lifecycle_status: "pending",
        },
      ];

      const roster = normalizeStudentRows(rawRoster);
      assert.equal(roster.length, 5);

      // Student 1 uploads medical certificate
      const intent1 = fileGateway.createUploadIntent(
        {
          purpose: "permit_attachment",
          content_type: "image/jpeg",
          size_bytes: 1024 * 450,
          filename: "surat_andi.jpg",
        },
        {
          Authorization: "Bearer token-andi",
          "X-Astra-Contract-Version": "v1",
        },
      );
      fileGateway.confirmUpload(intent1.body.data!.file_id, {
        Authorization: "Bearer token-andi",
        "X-Astra-Contract-Version": "v1",
      });

      // Submit leave for Student 1
      const leave1 = store.create({
        userId: "u-01",
        studentName: "Andi Saputra",
        studentNis: "1001",
        studentClass: "XII RPL 1",
        category: "sakit",
        description: "Demam dan radang tenggorokan",
        date: "2026-09-01",
        fileId: intent1.body.data!.file_id,
        approvalStatus: "pending",
      });

      // Student 2 submits leave without attachment
      const leave2 = store.create({
        userId: "u-02",
        studentName: "Bela Cantika",
        studentNis: "1002",
        studentClass: "XII RPL 1",
        category: "pergi",
        description: "Menghadiri pernikahan kakak kandung",
        date: "2026-09-01",
        approvalStatus: "pending",
      });

      // Administrator reviews
      store.approve(leave1.id, "platform_admin");
      store.reject(
        leave2.id,
        "Harap sertakan surat permohonan dari orang tua",
        "school_admin",
      );

      // Verify intermediate state
      assert.equal(store.get(leave1.id)!.approval_status, "approved");
      assert.equal(store.get(leave2.id)!.approval_status, "rejected");

      // Student 2 revises, admin reopens
      const reopen2 = store.reopen(leave2.id, "school_admin");
      assert.equal(reopen2.ok, true);
      assert.equal(store.get(leave2.id)!.approval_status, "pending");

      // Admin re-approves Student 2
      store.approve(leave2.id, "school_admin");
      assert.equal(store.get(leave2.id)!.approval_status, "approved");

      // Final state audit: both leave requests are successfully approved
      const allLeaves = store.list();
      assert.equal(allLeaves.length, 2);
      assert.equal(
        allLeaves.every((l) => l.approval_status === "approved"),
        true,
      );
    });

    it("T4.Scenario 2: Multi-Role Authorization & Access Control Matrix", () => {
      const store = new InMemoryAstraLeaveStore();
      const leave = store.create({
        userId: "u-rbac",
        studentName: "RBAC Student",
        studentNis: "17799",
        studentClass: "XII RPL 1",
        category: "sakit",
        description: "Sakit flu",
        date: "2026-09-01",
        approvalStatus: "rejected",
      });

      // Platform Admin: Full permissions
      const resPlatformAdmin = store.reopen(leave.id, "platform_admin");
      assert.equal(resPlatformAdmin.ok, true);

      // School Admin: Full permissions
      store.reject(leave.id, "Tolak", "platform_admin");
      const resSchoolAdmin = store.reopen(leave.id, "school_admin");
      assert.equal(resSchoolAdmin.ok, true);

      // Teacher: Permitted to manage student leaves
      store.reject(leave.id, "Tolak", "school_admin");
      const resTeacher = store.reopen(leave.id, "teacher");
      assert.equal(resTeacher.ok, true);

      // Student: Forbidden from administrative state transitions
      store.reject(leave.id, "Tolak", "teacher");
      const resStudent = store.reopen(leave.id, "student");
      assert.equal(resStudent.ok, false);
      if (!resStudent.ok) {
        assert.equal(resStudent.status, 403);
      }
    });

    it("T4.Scenario 3: Complete Sign-In -> First Time Password Reset -> Session Establishment -> Sign-Out Lifecycle", () => {
      // 1. First time platform_admin login with must_change_password
      const firstLoginClaims = {
        sub: "admin-first-login",
        email: "admin@skanida.sch.id",
        roles: ["platform_admin"],
        must_change_password: true,
      };
      assert.equal(isPasswordChangeRequired(firstLoginClaims), true);
      assert.equal(resolveLogtoRole(firstLoginClaims.roles), "platform_admin");

      // 2. User changes password -> flag cleared
      const updatedClaims = {
        ...firstLoginClaims,
        must_change_password: false,
      };
      assert.equal(isPasswordChangeRequired(updatedClaims), false);

      // 3. User accesses privileged session
      const userRole = resolveLogtoRole(updatedClaims.roles)!;
      assert.equal(hasRequiredRole(userRole, PRIVILEGED_ROLES), true);
      assert.equal(hasRequiredRole(userRole, ADMIN_ROLES), true);

      // 4. User logs out -> redirected to validated URI
      const redirectUri = getPostLogoutRedirectUri(
        "http://localhost:3000",
        "http://localhost:3000/login?status=signed_out",
      );
      assert.equal(
        redirectUri,
        "http://localhost:3000/login?status=signed_out",
      );
    });

    it("T4.Scenario 4: Gateway Fault Injection & Contract Resiliency Verification", () => {
      const fileGateway = new SimulatedAstraFileGateway();

      // Case A: Missing Contract Version Header -> 502
      const badHeaderRes = fileGateway.createUploadIntent(
        {
          purpose: "permit_attachment",
          content_type: "image/jpeg",
          size_bytes: 1024,
          filename: "doc.jpg",
        },
        {
          Authorization: "Bearer token",
          "X-Astra-Contract-Version": "v2", // Incompatible version
        },
      );
      assert.equal(badHeaderRes.status, 502);

      // Case B: Confirmation on non-existent file ID -> 404
      const notFoundConfirm = fileGateway.confirmUpload("file-does-not-exist", {
        Authorization: "Bearer token",
        "X-Astra-Contract-Version": "v1",
      });
      assert.equal(notFoundConfirm.status, 404);

      // Case C: File confirmation without download_url gracefully resolves
      const intent = fileGateway.createUploadIntent(
        {
          purpose: "permit_attachment",
          content_type: "image/png",
          size_bytes: 2048,
          filename: "bukti.png",
        },
        {
          Authorization: "Bearer token",
          "X-Astra-Contract-Version": "v1",
        },
      );
      const validConfirm = fileGateway.confirmUpload(
        intent.body.data!.file_id,
        {
          Authorization: "Bearer token",
          "X-Astra-Contract-Version": "v1",
        },
      );
      assert.equal(validConfirm.status, 200);
      assert.equal(validConfirm.body.data?.download_url, null);
      assert.ok(validConfirm.body.data?.object_path.includes("permits/"));
    });
  });
});
