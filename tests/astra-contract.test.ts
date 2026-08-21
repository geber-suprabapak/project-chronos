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
});
