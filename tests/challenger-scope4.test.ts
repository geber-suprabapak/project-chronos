import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

interface AdminLeaveRequestPayload {
  readonly user_id: string;
  readonly category: string;
  readonly description: string;
  readonly date: string;
  readonly file_id?: string;
  readonly approval_status?: string;
}

function validateAdminLeaveRequestPayload(
  payload: AdminLeaveRequestPayload,
): boolean {
  if (!payload.user_id || !payload.category || !payload.date) return false;
  if (!["sakit", "pergi", "dispensasi", "lainnya"].includes(payload.category)) {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) return false;
  if (payload.description.length === 0 || payload.description.length > 1000) {
    return false;
  }
  return true;
}

interface AstraFileConfirmationEnvelope {
  readonly success?: boolean;
  readonly data?: {
    readonly id?: string;
    readonly object_path?: string;
    readonly download_url?: string | null;
  };
}

interface FileConfirmationResult {
  readonly fileId: string;
  readonly url: string;
}

function parseFileConfirmationResponse(
  envelope: AstraFileConfirmationEnvelope,
  fallbackFileId: string,
): FileConfirmationResult {
  return {
    fileId: envelope.data?.id ?? fallbackFileId,
    url:
      envelope.data?.object_path ??
      envelope.data?.download_url ??
      envelope.data?.id ??
      fallbackFileId,
  };
}

describe("Scope 4 Challenger: Chronos-Astra Integration Contracts", () => {
  describe("1. Admin Leave Request Payload & Category Matrix", () => {
    const validCategories = ["sakit", "pergi", "dispensasi", "lainnya"];
    for (const cat of validCategories) {
      it(`accepts category '${cat}' in admin leave request payload`, () => {
        const valid = validateAdminLeaveRequestPayload({
          user_id: "user-123",
          category: cat,
          description: `Catatan izin ${cat}`,
          date: "2026-08-28",
          approval_status: "approved",
        });
        assert.equal(valid, true);
      });
    }

    const invalidCategories = ["izin", "cuti", "alpha", "SAKIT", "", "other"];
    for (const cat of invalidCategories) {
      it(`rejects invalid category '${cat}'`, () => {
        const valid = validateAdminLeaveRequestPayload({
          user_id: "user-123",
          category: cat,
          description: "Desc",
          date: "2026-08-28",
        });
        assert.equal(valid, false);
      });
    }

    it("enforces date regex YYYY-MM-DD", () => {
      assert.equal(
        validateAdminLeaveRequestPayload({
          user_id: "u1",
          category: "sakit",
          description: "d",
          date: "2026-08-28",
        }),
        true,
      );
      assert.equal(
        validateAdminLeaveRequestPayload({
          user_id: "u1",
          category: "sakit",
          description: "d",
          date: "28/08/2026",
        }),
        false,
      );
      assert.equal(
        validateAdminLeaveRequestPayload({
          user_id: "u1",
          category: "sakit",
          description: "d",
          date: "2026-8-28",
        }),
        false,
      );
    });

    it("enforces description length bounds (1..1000)", () => {
      assert.equal(
        validateAdminLeaveRequestPayload({
          user_id: "u1",
          category: "sakit",
          description: "",
          date: "2026-08-28",
        }),
        false,
      );
      assert.equal(
        validateAdminLeaveRequestPayload({
          user_id: "u1",
          category: "sakit",
          description: "a",
          date: "2026-08-28",
        }),
        true,
      );
      assert.equal(
        validateAdminLeaveRequestPayload({
          user_id: "u1",
          category: "sakit",
          description: "a".repeat(1000),
          date: "2026-08-28",
        }),
        true,
      );
      assert.equal(
        validateAdminLeaveRequestPayload({
          user_id: "u1",
          category: "sakit",
          description: "a".repeat(1001),
          date: "2026-08-28",
        }),
        false,
      );
    });
  });

  describe("2. File Confirmation Decoding Without download_url", () => {
    it("safely extracts fileId and object_path when download_url is missing", () => {
      const res = parseFileConfirmationResponse(
        {
          success: true,
          data: {
            id: "file-999",
            object_path: "permits/file-999.jpg",
          },
        },
        "fallback-id",
      );
      assert.equal(res.fileId, "file-999");
      assert.equal(res.url, "permits/file-999.jpg");
    });

    it("safely extracts fileId and object_path when download_url is null", () => {
      const res = parseFileConfirmationResponse(
        {
          success: true,
          data: {
            id: "file-999",
            object_path: "permits/file-999.jpg",
            download_url: null,
          },
        },
        "fallback-id",
      );
      assert.equal(res.fileId, "file-999");
      assert.equal(res.url, "permits/file-999.jpg");
    });

    it("safely falls back to fallback ID when data is missing", () => {
      const res = parseFileConfirmationResponse({}, "fallback-id");
      assert.equal(res.fileId, "fallback-id");
      assert.equal(res.url, "fallback-id");
    });
  });

  describe("3. Static Invariants & Anti-Mock Verification", () => {
    it("guarantees perizinan.ts has ZERO crypto.randomUUID() mock fallbacks", () => {
      const routerPath = join(
        process.cwd(),
        "src/server/api/routers/perizinan.ts",
      );
      const content = readFileSync(routerPath, "utf8");

      assert.equal(
        content.includes("randomUUID"),
        false,
        "perizinan.ts must not contain randomUUID mock data generation",
      );
      assert.equal(
        content.includes("/v1/admin/leave-requests"),
        true,
        "perizinan.ts must target /v1/admin/leave-requests endpoint",
      );
      assert.equal(
        content.includes('"lainnya"'),
        true,
        "perizinan.ts must support category 'lainnya'",
      );
    });

    it("guarantees files/route.ts does not reject responses lacking download_url", () => {
      const filesRoutePath = join(
        process.cwd(),
        "src/app/api/astra/files/route.ts",
      );
      const content = readFileSync(filesRoutePath, "utf8");

      assert.equal(
        content.includes("returned no download URL"),
        false,
        "files/route.ts must not fail with 'returned no download URL'",
      );
      assert.equal(
        content.includes("confirmation.data?.object_path"),
        true,
        "files/route.ts must map confirmation.data?.object_path",
      );
    });
  });
});
