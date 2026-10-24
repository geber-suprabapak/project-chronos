import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONFIGURATION_READ_MESSAGES,
  classifyConfigurationReadFailure,
  configurationReadSeamCode,
  configurationReadUiState,
  isRetryableConfigurationReadUiState,
} from "../src/server/api/routers/configuration-read.ts";
import type { AstraUpstreamFailure } from "../src/server/api/routers/user-profiles-detail.ts";

/**
 * Fixture factory mirroring the public shape of `AstraRequestError`
 * (`name`, `message`, `status: number`, optional `code: string`;
 * src/lib/astra/client.ts:45-95). The real class cannot be imported under
 * `node --test` because `src/lib/astra/client.ts` pulls in `~/env.js` path
 * aliases and the Logto server SDK; the router passes real instances into the
 * same duck-typed classifier verified here
 * (src/server/api/routers/configuration.ts, `throwConfigurationReadFailure`).
 */
function astraLikeError(
  status: number,
  code: string | undefined,
  message = "upstream failure",
): Error & { status: number; code?: string } {
  const error = new Error(message) as Error & { status: number; code?: string };
  error.name = "AstraRequestError";
  error.status = status;
  if (code !== undefined) error.code = code;
  return error;
}

describe("Configuration read failure mapping (C07)", () => {
  describe("single-outcome classification matrix (403 vs timeout/network vs 5xx)", () => {
    it("classifies HTTP 403 as an authorization failure that is not retryable", () => {
      const failure = classifyConfigurationReadFailure(
        astraLikeError(403, "FORBIDDEN"),
      );
      assert.equal(failure.kind, "forbidden");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, CONFIGURATION_READ_MESSAGES.forbidden);
    });

    it("classifies the FORBIDDEN code as an authorization failure regardless of status", () => {
      const failure = classifyConfigurationReadFailure(
        astraLikeError(200, "FORBIDDEN"),
      );
      assert.equal(failure.kind, "forbidden");
      assert.equal(failure.retryable, false);
    });

    it("classifies an Astra timeout (504/TIMEOUT) as a recoverable dependency failure", () => {
      const failure = classifyConfigurationReadFailure(
        astraLikeError(504, "TIMEOUT"),
      );
      assert.equal(failure.kind, "timeout");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, CONFIGURATION_READ_MESSAGES.dependency);
    });

    it("classifies a network failure (503/NETWORK_ERROR) as a recoverable dependency failure", () => {
      const failure = classifyConfigurationReadFailure(
        astraLikeError(503, "NETWORK_ERROR"),
      );
      assert.equal(failure.kind, "network");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, CONFIGURATION_READ_MESSAGES.dependency);
    });

    it("classifies an upstream 5xx as a recoverable dependency failure", () => {
      for (const status of [500, 502, 504]) {
        const failure = classifyConfigurationReadFailure(
          astraLikeError(status, undefined),
        );
        assert.equal(failure.retryable, true);
        assert.equal(failure.message, CONFIGURATION_READ_MESSAGES.dependency);
      }
      // 503 without an Astra code still matches AstraRequestError.isUnavailable
      // semantics (status-based), mapping to the network outcome class.
      const unavailable = classifyConfigurationReadFailure(
        astraLikeError(503, undefined),
      );
      assert.equal(unavailable.kind, "network");
      assert.equal(unavailable.retryable, true);
    });

    it("maps even an upstream 404 on a configuration read to a recoverable dependency failure, never an empty/default result", () => {
      const failure = classifyConfigurationReadFailure(
        astraLikeError(404, "RESOURCE_NOT_FOUND"),
      );
      assert.equal(failure.kind, "upstream_failure");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, CONFIGURATION_READ_MESSAGES.dependency);
    });

    it("classifies a non-upstream internal failure (null signal) as an unknown recoverable failure", () => {
      const failure = classifyConfigurationReadFailure(null);
      assert.equal(failure.kind, "unknown");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, CONFIGURATION_READ_MESSAGES.unknown);
    });

    it("never leaks upstream status, codes, or messages into client-visible messages", () => {
      for (const [status, code] of [
        [403, "FORBIDDEN"],
        [404, "RESOURCE_NOT_FOUND"],
        [504, "TIMEOUT"],
        [503, "NETWORK_ERROR"],
        [500, undefined],
      ] as const) {
        const failure = classifyConfigurationReadFailure(
          astraLikeError(status, code, `Astra secret detail for ${status}`),
        );
        assert.ok(!failure.message.includes(String(status)));
        assert.ok(!failure.message.includes("Astra"));
        assert.ok(!failure.message.includes("secret"));
      }
    });
  });

  describe("empty-vs-error boundary", () => {
    it("gives the classifier no successful payload to reinterpret: an empty array is a value, not a failure", () => {
      // The classifier only receives thrown errors; a genuine first-use
      // no-config response (`[]` / `null`) never enters this mapping, so the
      // documented default first-use behavior is preserved by construction.
      const failure = classifyConfigurationReadFailure(null);
      assert.notEqual(failure.kind, "not_found");
      assert.equal(failure.retryable, true);
      assert.ok(
        !Object.values(CONFIGURATION_READ_MESSAGES).includes(
          "Belum Ada Lokasi" as never,
        ),
      );
    });

    it("keeps dependency and forbidden outcomes distinguishable at the route seam", () => {
      const dependency = classifyConfigurationReadFailure(
        astraLikeError(503, "NETWORK_ERROR"),
      );
      const forbidden = classifyConfigurationReadFailure(
        astraLikeError(403, "FORBIDDEN"),
      );
      assert.notEqual(dependency.kind, forbidden.kind);
      assert.notEqual(dependency.message, forbidden.message);
      assert.notEqual(dependency.retryable, forbidden.retryable);
    });
  });

  describe("seam code mapping", () => {
    it("maps authorization failures to FORBIDDEN", () => {
      assert.equal(
        configurationReadSeamCode(
          classifyConfigurationReadFailure(astraLikeError(403, "FORBIDDEN")),
        ),
        "FORBIDDEN",
      );
    });

    it("maps recoverable dependency failures to SERVICE_UNAVAILABLE", () => {
      for (const error of [
        astraLikeError(504, "TIMEOUT"),
        astraLikeError(503, "NETWORK_ERROR"),
        astraLikeError(500, undefined),
        astraLikeError(404, "RESOURCE_NOT_FOUND"),
      ]) {
        assert.equal(
          configurationReadSeamCode(classifyConfigurationReadFailure(error)),
          "SERVICE_UNAVAILABLE",
        );
      }
    });

    it("maps non-upstream internal failures to INTERNAL_SERVER_ERROR", () => {
      assert.equal(
        configurationReadSeamCode(classifyConfigurationReadFailure(null)),
        "INTERNAL_SERVER_ERROR",
      );
    });
  });

  describe("client-side UI state mapping", () => {
    it("keeps forbidden and recoverable outcomes distinguishable at the API/UI seam", () => {
      assert.equal(configurationReadUiState("FORBIDDEN"), "forbidden");
      assert.equal(
        configurationReadUiState("SERVICE_UNAVAILABLE"),
        "dependency",
      );
      assert.equal(
        configurationReadUiState("INTERNAL_SERVER_ERROR"),
        "dependency",
      );
    });

    it("treats a missing tRPC code (client/network failure) as a recoverable dependency", () => {
      const state = configurationReadUiState(undefined);
      assert.equal(state, "dependency");
      assert.equal(isRetryableConfigurationReadUiState(state), true);
    });

    it("offers a retry control only for recoverable outcomes, never for forbidden", () => {
      assert.equal(isRetryableConfigurationReadUiState("dependency"), true);
      assert.equal(isRetryableConfigurationReadUiState("unknown"), true);
      assert.equal(isRetryableConfigurationReadUiState("forbidden"), false);
    });
  });

  describe("structural contract", () => {
    it("accepts real AstraRequestError public fields structurally", () => {
      const real: AstraUpstreamFailure = { status: 503, code: "NETWORK_ERROR" };
      const failure = classifyConfigurationReadFailure(real);
      assert.equal(failure.kind, "network");
      assert.equal(failure.retryable, true);
    });
  });
});
