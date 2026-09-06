import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  ASTRA_CONTRACT_VERSION,
  buildAstraContractHeaders,
  createAstraRequestId,
  getAstraResponseRequestId,
  resolveAstraEnvelopeRequestId,
} from "../src/lib/astra/request-id.ts";

describe("Astra request correlation", () => {
  it("preserves safe upstream request IDs", () => {
    const requestId = "chronos-018f6f0c-4f7f-7d8d-9c43-111111111111";
    assert.equal(createAstraRequestId(requestId), requestId);
  });

  it("replaces unsafe upstream request IDs", () => {
    const requestId = createAstraRequestId("unsafe request id with spaces");
    assert.match(requestId, /^[0-9a-f-]{36}$/);
    assert.doesNotMatch(requestId, /unsafe/);
  });

  it("replaces empty or undefined request IDs with UUID", () => {
    const emptyId = createAstraRequestId("");
    assert.match(emptyId, /^[0-9a-f-]{36}$/);

    const undefinedId = createAstraRequestId(undefined);
    assert.match(undefinedId, /^[0-9a-f-]{36}$/);
  });

  it("builds the mandatory contract and correlation headers", () => {
    const { headers, requestId } = buildAstraContractHeaders({
      Authorization: "Bearer test-token",
    });

    assert.equal(headers.get("Authorization"), "Bearer test-token");
    assert.equal(headers.get("Accept"), "application/json");
    assert.equal(headers.get("X-Request-ID"), requestId);
    assert.equal(
      headers.get("X-Astra-Contract-Version"),
      ASTRA_CONTRACT_VERSION,
    );
  });

  it("uses candidateRequestId when provided", () => {
    const customId = "req-test-12345";
    const { headers, requestId } = buildAstraContractHeaders({}, customId);
    assert.equal(requestId, customId);
    assert.equal(headers.get("X-Request-ID"), customId);
  });

  it("uses Astra's response request ID when it is safe", () => {
    const response = new Response(null, {
      headers: { "X-Request-ID": "astra-response-123" },
    });

    assert.equal(
      getAstraResponseRequestId(response, "chronos-fallback-123"),
      "astra-response-123",
    );
  });

  it("falls back to fallbackRequestId when Astra response request ID is missing or unsafe", () => {
    const missingResponse = new Response(null);
    assert.equal(
      getAstraResponseRequestId(missingResponse, "chronos-fallback-123"),
      "chronos-fallback-123",
    );

    const unsafeResponse = new Response(null, {
      headers: { "X-Request-ID": "invalid id!" },
    });
    assert.equal(
      getAstraResponseRequestId(unsafeResponse, "chronos-fallback-123"),
      "chronos-fallback-123",
    );
  });
});

describe("Astra envelope request ID resolver and client normalization", () => {
  it("preserves safe envelope request ID", () => {
    const safeId = "envelope-req-12345";
    assert.equal(
      resolveAstraEnvelopeRequestId(safeId, "fallback-resp-id"),
      safeId,
    );
  });

  it("trims whitespace from candidate request ID", () => {
    assert.equal(
      resolveAstraEnvelopeRequestId("  envelope-safe-id  ", "fallback-resp-id"),
      "envelope-safe-id",
    );
  });

  it("falls back to responseRequestId when candidate is missing, null, or empty", () => {
    assert.equal(
      resolveAstraEnvelopeRequestId(undefined, "fallback-resp-id"),
      "fallback-resp-id",
    );
    assert.equal(
      resolveAstraEnvelopeRequestId(null, "fallback-resp-id"),
      "fallback-resp-id",
    );
    assert.equal(
      resolveAstraEnvelopeRequestId("", "fallback-resp-id"),
      "fallback-resp-id",
    );
    assert.equal(
      resolveAstraEnvelopeRequestId("   \t  ", "fallback-resp-id"),
      "fallback-resp-id",
    );
  });

  it("falls back to responseRequestId when candidate contains unsafe characters", () => {
    assert.equal(
      resolveAstraEnvelopeRequestId(
        "unsafe id with spaces",
        "fallback-resp-id",
      ),
      "fallback-resp-id",
    );
    assert.equal(
      resolveAstraEnvelopeRequestId("unsafe/slashes", "fallback-resp-id"),
      "fallback-resp-id",
    );
    assert.equal(
      resolveAstraEnvelopeRequestId("unsafe<script>", "fallback-resp-id"),
      "fallback-resp-id",
    );
    assert.equal(
      resolveAstraEnvelopeRequestId("-starts-with-hyphen", "fallback-resp-id"),
      "fallback-resp-id",
    );
  });

  it("enforces length boundary of 128 characters", () => {
    const valid128 = "a" + "b".repeat(127);
    assert.equal(
      resolveAstraEnvelopeRequestId(valid128, "fallback-resp-id"),
      valid128,
    );

    const invalid129 = "a" + "b".repeat(128);
    assert.equal(
      resolveAstraEnvelopeRequestId(invalid129, "fallback-resp-id"),
      "fallback-resp-id",
    );
  });

  it("verifies client.ts imports and applies resolveAstraEnvelopeRequestId without duplicating SAFE_REQUEST_ID", () => {
    const clientPath = join(process.cwd(), "src/lib/astra/client.ts");
    const content = readFileSync(clientPath, "utf8");

    assert.ok(
      content.includes("resolveAstraEnvelopeRequestId"),
      "client.ts must import resolveAstraEnvelopeRequestId",
    );
    assert.ok(
      !content.includes("SAFE_REQUEST_ID"),
      "client.ts must not duplicate SAFE_REQUEST_ID",
    );
    assert.ok(
      content.includes(
        "const envelopeRequestId = resolveAstraEnvelopeRequestId(",
      ),
      "client.ts must resolve envelope request ID with fallback",
    );
    assert.ok(
      content.includes("envelope?.meta?.request_id") &&
        content.includes("responseRequestId"),
      "client.ts must pass envelope meta request_id and responseRequestId",
    );
    assert.ok(
      content.includes("requestId: envelopeRequestId"),
      "client.ts must expose normalized requestId",
    );
    assert.ok(
      content.includes("request_id: envelopeRequestId"),
      "client.ts must expose normalized meta request_id",
    );
  });
});
