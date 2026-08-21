import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

interface AstraContractHeaders {
  readonly Authorization: string;
  readonly "Content-Type": "application/json";
  readonly Accept: "application/json";
  readonly "X-Astra-Contract-Version": "v1";
}

interface UploadIntentPayload {
  readonly purpose: string;
  readonly content_type: string;
  readonly size_bytes: number;
  readonly filename: string;
}

interface UploadIntentEnvelope {
  readonly data?: {
    readonly file_id?: string;
    readonly upload_url?: string;
  };
}

function buildAstraHeaders(accessToken: string): AstraContractHeaders {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Astra-Contract-Version": "v1",
  };
}

function validateUploadIntentPayload(payload: UploadIntentPayload): boolean {
  if (!payload.purpose || !payload.content_type || !payload.filename) {
    return false;
  }
  if (payload.size_bytes <= 0 || payload.size_bytes > 5 * 1024 * 1024) {
    return false;
  }
  return true;
}

function parseUploadIntentResponse(
  envelope: UploadIntentEnvelope,
):
  | { readonly ok: true; readonly fileId: string; readonly uploadUrl: string }
  | { readonly ok: false; readonly error: string } {
  const fileId = envelope.data?.file_id;
  const uploadUrl = envelope.data?.upload_url;
  if (!fileId || !uploadUrl) {
    return { ok: false, error: "Upload contract returned an invalid intent." };
  }
  return { ok: true, fileId, uploadUrl };
}

interface AstraProfileEnvelope {
  readonly success: boolean;
  readonly data?: {
    readonly user_id?: string;
    readonly full_name?: string | null;
    readonly email?: string | null;
    readonly class_name?: string | null;
  };
}

function parseProfileResponse(envelope: AstraProfileEnvelope):
  | {
      readonly ok: true;
      readonly userId: string;
      readonly fullName: string | null;
      readonly className: string | null;
    }
  | { readonly ok: false; readonly error: string } {
  if (!envelope.success || !envelope.data || !envelope.data.user_id) {
    return { ok: false, error: "Invalid profile response envelope." };
  }
  return {
    ok: true,
    userId: envelope.data.user_id,
    fullName: envelope.data.full_name ?? null,
    className: envelope.data.class_name ?? null,
  };
}

interface AstraStudentRosterEnvelope {
  readonly success: boolean;
  readonly data?: ReadonlyArray<{
    readonly user_id: string;
    readonly full_name?: string | null;
    readonly nis?: string | null;
    readonly class_name?: string | null;
    readonly absence_number?: string | null;
    readonly gender?: string | null;
    readonly lifecycle_status?: string | null;
  }>;
}

function parseStudentRosterResponse(envelope: AstraStudentRosterEnvelope):
  | {
      readonly ok: true;
      readonly count: number;
      readonly students: ReadonlyArray<{
        readonly userId: string;
        readonly nis: string | null;
        readonly fullName: string | null;
        readonly className: string | null;
        readonly activated: boolean;
      }>;
    }
  | { readonly ok: false; readonly error: string } {
  if (!envelope.success || !Array.isArray(envelope.data)) {
    return { ok: false, error: "Invalid student roster response envelope." };
  }
  const students = envelope.data.map((s) => ({
    userId: s.user_id,
    nis: s.nis ?? null,
    fullName: s.full_name ?? null,
    className: s.class_name ?? null,
    activated: s.lifecycle_status === "approved",
  }));
  return {
    ok: true,
    count: students.length,
    students,
  };
}

interface AstraLeaveRequestEnvelope {
  readonly success: boolean;
  readonly data?: {
    readonly id?: string;
    readonly user_id?: string;
    readonly category?: string;
    readonly description?: string | null;
    readonly date?: string;
    readonly approval_status?: string;
    readonly status?: boolean;
    readonly attachment_url?: string | null;
    readonly student_name?: string | null;
    readonly student_nis?: string | null;
    readonly student_class?: string | null;
    readonly rejection_reason?: string | null;
  };
}

function parseLeaveRequestResponse(envelope: AstraLeaveRequestEnvelope):
  | {
      readonly ok: true;
      readonly id: string;
      readonly userId: string;
      readonly category: string;
      readonly approvalStatus: string;
      readonly date: string;
      readonly studentName: string | null;
      readonly studentNis: string | null;
      readonly attachmentUrl: string | null;
    }
  | { readonly ok: false; readonly error: string } {
  if (
    !envelope.success ||
    !envelope.data ||
    !envelope.data.id ||
    !envelope.data.user_id
  ) {
    return { ok: false, error: "Invalid leave request response envelope." };
  }
  return {
    ok: true,
    id: envelope.data.id,
    userId: envelope.data.user_id,
    category: envelope.data.category ?? "sakit",
    approvalStatus: envelope.data.approval_status ?? "pending",
    date: envelope.data.date ?? "",
    studentName: envelope.data.student_name ?? null,
    studentNis: envelope.data.student_nis ?? null,
    attachmentUrl: envelope.data.attachment_url ?? null,
  };
}

interface AstraLocationEnvelope {
  readonly success: boolean;
  readonly data?: {
    readonly id?: string;
    readonly school_id?: string | null;
    readonly name?: string;
    readonly latitude?: number;
    readonly longitude?: number;
    readonly radius_meters?: number;
    readonly is_active?: boolean;
  };
}

function parseLocationResponse(envelope: AstraLocationEnvelope):
  | {
      readonly ok: true;
      readonly id: string;
      readonly name: string;
      readonly latitude: number;
      readonly longitude: number;
      readonly radiusMeters: number;
      readonly isActive: boolean;
    }
  | { readonly ok: false; readonly error: string } {
  if (!envelope.success || !envelope.data || !envelope.data.id) {
    return { ok: false, error: "Invalid location response envelope." };
  }
  const latitude = envelope.data.latitude;
  const longitude = envelope.data.longitude;
  if (
    latitude === undefined ||
    longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return { ok: false, error: "Invalid location response envelope." };
  }
  return {
    ok: true,
    id: envelope.data.id,
    name: envelope.data.name ?? "Unnamed Location",
    latitude,
    longitude,
    radiusMeters: envelope.data.radius_meters ?? 100,
    isActive: envelope.data.is_active ?? true,
  };
}

interface AstraAttendanceEnvelope {
  readonly success: boolean;
  readonly data?: {
    readonly id?: string;
    readonly user_id?: string;
    readonly date?: string;
    readonly status?: string;
    readonly action_type?: string | null;
    readonly latitude?: number | null;
    readonly longitude?: number | null;
    readonly created_at?: string;
  };
}

function parseAttendanceResponse(envelope: AstraAttendanceEnvelope):
  | {
      readonly ok: true;
      readonly id: string;
      readonly userId: string;
      readonly date: string;
      readonly status: string;
      readonly actionType: string | null;
    }
  | { readonly ok: false; readonly error: string } {
  if (
    !envelope.success ||
    !envelope.data ||
    !envelope.data.id ||
    !envelope.data.user_id
  ) {
    return { ok: false, error: "Invalid attendance response envelope." };
  }
  return {
    ok: true,
    id: envelope.data.id,
    userId: envelope.data.user_id,
    date: envelope.data.date ?? "",
    status: envelope.data.status ?? "Hadir",
    actionType: envelope.data.action_type ?? null,
  };
}

describe("Astra API Contract Boundary", () => {
  describe("buildAstraHeaders", () => {
    it("includes versioned contract header v1 and authorization token", () => {
      const headers = buildAstraHeaders("test-access-token-123");
      assert.equal(headers["X-Astra-Contract-Version"], "v1");
      assert.equal(headers.Authorization, "Bearer test-access-token-123");
      assert.equal(headers["Content-Type"], "application/json");
      assert.equal(headers.Accept, "application/json");
    });
  });

  describe("validateUploadIntentPayload", () => {
    it("accepts valid permit attachment within 5MB limit", () => {
      const valid = validateUploadIntentPayload({
        purpose: "permit_attachment",
        content_type: "image/jpeg",
        size_bytes: 1024 * 1024,
        filename: "surat_dokter.jpg",
      });
      assert.equal(valid, true);
    });

    it("rejects files exceeding 5MB limit", () => {
      const invalid = validateUploadIntentPayload({
        purpose: "permit_attachment",
        content_type: "image/jpeg",
        size_bytes: 6 * 1024 * 1024,
        filename: "large_file.jpg",
      });
      assert.equal(invalid, false);
    });

    it("rejects missing required attributes", () => {
      const invalid = validateUploadIntentPayload({
        purpose: "",
        content_type: "image/jpeg",
        size_bytes: 1024,
        filename: "file.jpg",
      });
      assert.equal(invalid, false);
    });
  });

  describe("parseUploadIntentResponse", () => {
    it("extracts file_id and upload_url from valid contract envelope", () => {
      const result = parseUploadIntentResponse({
        data: {
          file_id: "file-abc-123",
          upload_url: "https://storage.local/upload/file-abc-123",
        },
      });
      assert.deepEqual(result, {
        ok: true,
        fileId: "file-abc-123",
        uploadUrl: "https://storage.local/upload/file-abc-123",
      });
    });

    it("returns error on missing data envelope", () => {
      const result = parseUploadIntentResponse({});
      assert.equal(result.ok, false);
    });

    it("returns error on partial data envelope", () => {
      const result = parseUploadIntentResponse({
        data: {
          file_id: "file-abc-123",
        },
      });

      assert.equal(result.ok, false);
    });
  });

  describe("parseProfileResponse", () => {
    it("extracts profile details from valid contract envelope", () => {
      const result = parseProfileResponse({
        success: true,
        data: {
          user_id: "user-stu-001",
          full_name: "Ahmad Dahlan",
          class_name: "XII RPL 1",
          email: "ahmad@skanida.sch.id",
        },
      });
      assert.deepEqual(result, {
        ok: true,
        userId: "user-stu-001",
        fullName: "Ahmad Dahlan",
        className: "XII RPL 1",
      });
    });

    it("returns error when success is false or data is missing", () => {
      const result = parseProfileResponse({
        success: false,
      });
      assert.equal(result.ok, false);
    });
  });

  describe("parseStudentRosterResponse", () => {
    it("extracts student roster records and activation status from valid contract envelope", () => {
      const result = parseStudentRosterResponse({
        success: true,
        data: [
          {
            user_id: "user-stu-001",
            full_name: "Ahmad Dahlan",
            nis: "1001",
            class_name: "XII RPL 1",
            absence_number: "01",
            gender: "L",
            lifecycle_status: "approved",
          },
          {
            user_id: "user-stu-002",
            full_name: "Siti Rahma",
            nis: "1002",
            class_name: "XII RPL 1",
            absence_number: "02",
            gender: "P",
            lifecycle_status: "pending",
          },
        ],
      });
      assert.deepEqual(result, {
        ok: true,
        count: 2,
        students: [
          {
            userId: "user-stu-001",
            nis: "1001",
            fullName: "Ahmad Dahlan",
            className: "XII RPL 1",
            activated: true,
          },
          {
            userId: "user-stu-002",
            nis: "1002",
            fullName: "Siti Rahma",
            className: "XII RPL 1",
            activated: false,
          },
        ],
      });
    });

    it("returns error when success is false or data is not an array", () => {
      const result = parseStudentRosterResponse({
        success: false,
      });
      assert.equal(result.ok, false);
    });
  });

  describe("parseLeaveRequestResponse", () => {
    it("extracts leave request details and student info from valid contract envelope", () => {
      const result = parseLeaveRequestResponse({
        success: true,
        data: {
          id: "leave-req-123",
          user_id: "user-stu-001",
          category: "sakit",
          description: "Sakit demam tinggi",
          date: "2026-08-22",
          approval_status: "approved",
          status: true,
          student_name: "Ahmad Dahlan",
          student_nis: "1001",
          student_class: "XII RPL 1",
          attachment_url: "https://storage.local/signed/surat_dokter.jpg",
        },
      });
      assert.deepEqual(result, {
        ok: true,
        id: "leave-req-123",
        userId: "user-stu-001",
        category: "sakit",
        approvalStatus: "approved",
        date: "2026-08-22",
        studentName: "Ahmad Dahlan",
        studentNis: "1001",
        attachmentUrl: "https://storage.local/signed/surat_dokter.jpg",
      });
    });

    it("returns error when success is false or data is missing", () => {
      const result = parseLeaveRequestResponse({
        success: false,
      });
      assert.equal(result.ok, false);
    });
  });

  describe("parseLocationResponse", () => {
    it("extracts location details and radius from valid contract envelope", () => {
      const result = parseLocationResponse({
        success: true,
        data: {
          id: "loc-kantor-pusat",
          name: "Kantor Pusat",
          latitude: -7.4503,
          longitude: 110.2241,
          radius_meters: 500,
          is_active: true,
        },
      });
      assert.deepEqual(result, {
        ok: true,
        id: "loc-kantor-pusat",
        name: "Kantor Pusat",
        latitude: -7.4503,
        longitude: 110.2241,
        radiusMeters: 500,
        isActive: true,
      });
    });

    it("returns error when success is false or data is missing", () => {
      const result = parseLocationResponse({
        success: false,
      });
      assert.equal(result.ok, false);
    });

    it("returns error when coordinates are invalid or missing", () => {
      const result = parseLocationResponse({
        success: true,
        data: {
          id: "loc-invalid",
          name: "Invalid Loc",
        },
      });
      assert.equal(result.ok, false);
    });
  });

  describe("parseAttendanceResponse", () => {
    it("extracts attendance details from valid contract envelope", () => {
      const result = parseAttendanceResponse({
        success: true,
        data: {
          id: "att-rec-123",
          user_id: "user-stu-001",
          date: "2026-08-21",
          status: "Hadir",
          action_type: "check_in",
          latitude: -7.45,
          longitude: 110.22,
          created_at: "2026-08-21T07:00:00Z",
        },
      });
      assert.deepEqual(result, {
        ok: true,
        id: "att-rec-123",
        userId: "user-stu-001",
        date: "2026-08-21",
        status: "Hadir",
        actionType: "check_in",
      });
    });

    it("returns error when success is false or data is missing", () => {
      const result = parseAttendanceResponse({
        success: false,
      });
      assert.equal(result.ok, false);
    });

    it("returns error when id or user_id is missing", () => {
      const result = parseAttendanceResponse({
        success: true,
        data: {
          date: "2026-08-21",
          status: "Hadir",
        },
      });
      assert.equal(result.ok, false);
    });
  });
});
describe("Published Astra artifact", () => {
  it("pins the same v1 contract consumed by Chronos", () => {
    // SAFETY: The checked-in artifact is a JSON contract file owned by this repository.
    const artifact = JSON.parse(
      readFileSync(
        new URL("../contracts/astra-v1.json", import.meta.url),
        "utf8",
      ),
    ) as {
      version?: string;
      response?: { contract_header?: { value?: string } };
    };
    assert.equal(artifact.version, "v1");
    assert.equal(artifact.response?.contract_header?.value, "v1");
  });
});
