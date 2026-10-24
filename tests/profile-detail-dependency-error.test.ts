import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  PROFILE_DETAIL_MESSAGES,
  classifyProfileDetailFailure,
  classifyProfileDetailFailures,
  isRetryableProfileDetailUiState,
  profileDetailSeamCode,
  isProfileDetailNotFound,
  profileDetailUiState,
} from "../src/server/api/routers/user-profiles-detail.ts";

/**
 * Fixture factory mirroring the public shape of `AstraRequestError`
 * (`name`, `message`, `status: number`, optional `code: string`;
 * src/lib/astra/client.ts:45-95). The real class cannot be imported under
 * `node --test` because `src/lib/astra/client.ts` pulls in `~/env.js` path
 * aliases and the Logto server SDK; the router passes real instances into the
 * same duck-typed classifier verified here.
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

describe("Profile detail dependency-error mapping (C01b)", () => {
  describe("single-outcome classification matrix (404 vs 403 vs timeout/network vs 5xx)", () => {
    it("classifies HTTP 404 as a genuine not-found that is not retryable", () => {
      const failure = classifyProfileDetailFailure(
        astraLikeError(404, "RESOURCE_NOT_FOUND"),
      );
      assert.equal(failure.kind, "not_found");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.notFound);
    });

    it("classifies HTTP 403 as an authorization failure that is not retryable", () => {
      const failure = classifyProfileDetailFailure(
        astraLikeError(403, "FORBIDDEN"),
      );
      assert.equal(failure.kind, "forbidden");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.forbidden);
    });

    it("classifies an Astra timeout (504/TIMEOUT) as a recoverable dependency failure", () => {
      const failure = classifyProfileDetailFailure(
        astraLikeError(504, "TIMEOUT"),
      );
      assert.equal(failure.kind, "timeout");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.dependency);
    });

    it("classifies a network failure (503/NETWORK_ERROR) as a recoverable dependency failure", () => {
      const failure = classifyProfileDetailFailure(
        astraLikeError(503, "NETWORK_ERROR"),
      );
      assert.equal(failure.kind, "network");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.dependency);
    });

    it("classifies an upstream 5xx as a recoverable dependency failure", () => {
      for (const status of [500, 502]) {
        const failure = classifyProfileDetailFailure(
          astraLikeError(status, undefined),
        );
        assert.equal(failure.kind, "upstream_failure");
        assert.equal(failure.retryable, true);
        assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.dependency);
      }
      // 503 without an Astra code still matches AstraRequestError.isUnavailable
      // semantics (status-based), mapping to the network outcome class.
      const unavailable = classifyProfileDetailFailure(
        astraLikeError(503, undefined),
      );
      assert.equal(unavailable.kind, "network");
      assert.equal(unavailable.retryable, true);
      assert.equal(unavailable.message, PROFILE_DETAIL_MESSAGES.dependency);
    });

    it("classifies a non-upstream internal failure (null signal) as an unknown recoverable failure", () => {
      const failure = classifyProfileDetailFailure(null);
      assert.equal(failure.kind, "unknown");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.unknown);
    });

    it("never leaks upstream status, codes, or messages into client-visible messages", () => {
      for (const [status, code] of [
        [404, "RESOURCE_NOT_FOUND"],
        [403, "FORBIDDEN"],
        [504, "TIMEOUT"],
        [503, "NETWORK_ERROR"],
        [500, undefined],
      ] as const) {
        const failure = classifyProfileDetailFailure(
          astraLikeError(status, code, `Astra secret detail for ${status}`),
        );
        assert.ok(!failure.message.includes(String(status)));
        assert.ok(!failure.message.includes("Astra"));
        assert.ok(!failure.message.includes("secret"));
      }
    });

    it("gives unauthorized callers the same message whether or not the profile exists", () => {
      // A 403 from Astra must not become an existence oracle: the forbidden
      // message is fixed, regardless of any upstream detail.
      const forbiddenExisting = classifyProfileDetailFailure(
        astraLikeError(
          403,
          "FORBIDDEN",
          "Student record exists but is protected",
        ),
      );
      const forbiddenUnknown = classifyProfileDetailFailure(
        astraLikeError(403, "FORBIDDEN", "No such record"),
      );
      assert.equal(forbiddenExisting.kind, "forbidden");
      assert.equal(forbiddenExisting.message, forbiddenUnknown.message);
      assert.notEqual(
        forbiddenExisting.message,
        PROFILE_DETAIL_MESSAGES.notFound,
      );
    });
  });

  describe("getById lookup-chain classification", () => {
    it("maps student-404 then staff-404 to a distinct not-found outcome", () => {
      const failure = classifyProfileDetailFailures([
        astraLikeError(404, "RESOURCE_NOT_FOUND", "Student not found"),
        astraLikeError(404, "RESOURCE_NOT_FOUND", "Staff not found"),
      ]);
      assert.equal(failure.kind, "not_found");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.notFound);
    });

    it("maps a student 403 to the authorization outcome without probing existence", () => {
      const failure = classifyProfileDetailFailures([
        astraLikeError(403, "FORBIDDEN"),
      ]);
      assert.equal(failure.kind, "forbidden");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.forbidden);
    });

    it("maps a student timeout to a recoverable dependency outcome", () => {
      const failure = classifyProfileDetailFailures([
        astraLikeError(504, "TIMEOUT"),
      ]);
      assert.equal(failure.kind, "timeout");
      assert.equal(failure.retryable, true);
    });

    it("maps a student 503/network failure to a recoverable dependency outcome", () => {
      const failure = classifyProfileDetailFailures([
        astraLikeError(503, "NETWORK_ERROR"),
      ]);
      assert.equal(failure.kind, "network");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.dependency);
    });

    it("lets a later non-404 staff failure override an earlier student 404", () => {
      const forbidden = classifyProfileDetailFailures([
        astraLikeError(404, "RESOURCE_NOT_FOUND"),
        astraLikeError(403, "FORBIDDEN"),
      ]);
      assert.equal(forbidden.kind, "forbidden");

      const dependency = classifyProfileDetailFailures([
        astraLikeError(404, "RESOURCE_NOT_FOUND"),
        astraLikeError(500, undefined),
      ]);
      assert.equal(dependency.kind, "upstream_failure");
      assert.equal(dependency.retryable, true);
    });

    it("treats an empty failure list as not-found (both collections answered, no record)", () => {
      const failure = classifyProfileDetailFailures([]);
      assert.equal(failure.kind, "not_found");
      assert.equal(failure.message, PROFILE_DETAIL_MESSAGES.notFound);
    });
  });

  describe("seam code mapping", () => {
    it("maps not-found and authorization failures to distinct non-retryable tRPC codes", () => {
      assert.equal(
        profileDetailSeamCode(
          classifyProfileDetailFailure(
            astraLikeError(404, "RESOURCE_NOT_FOUND"),
          ),
        ),
        "NOT_FOUND",
      );
      assert.equal(
        profileDetailSeamCode(
          classifyProfileDetailFailure(astraLikeError(403, "FORBIDDEN")),
        ),
        "FORBIDDEN",
      );
    });

    it("maps recoverable dependency failures to SERVICE_UNAVAILABLE", () => {
      for (const error of [
        astraLikeError(504, "TIMEOUT"),
        astraLikeError(503, "NETWORK_ERROR"),
        astraLikeError(500, undefined),
      ]) {
        assert.equal(
          profileDetailSeamCode(classifyProfileDetailFailure(error)),
          "SERVICE_UNAVAILABLE",
        );
      }
    });
  });

  describe("client-side UI state mapping", () => {
    it("keeps the four fixture outcomes distinguishable at the API/UI seam", () => {
      assert.equal(profileDetailUiState("NOT_FOUND"), "not_found");
      assert.equal(profileDetailUiState("FORBIDDEN"), "forbidden");
      assert.equal(profileDetailUiState("SERVICE_UNAVAILABLE"), "dependency");
      assert.equal(profileDetailUiState("INTERNAL_SERVER_ERROR"), "dependency");
    });

    it("treats a missing tRPC code (client/network failure) as a recoverable dependency", () => {
      const state = profileDetailUiState(undefined);
      assert.equal(state, "dependency");
      assert.equal(isRetryableProfileDetailUiState(state), true);
    });

    it("offers a retry control only for recoverable outcomes, never for not-found or forbidden", () => {
      assert.equal(isRetryableProfileDetailUiState("dependency"), true);
      assert.equal(isRetryableProfileDetailUiState("unknown"), true);
      assert.equal(isRetryableProfileDetailUiState("not_found"), false);
      assert.equal(isRetryableProfileDetailUiState("forbidden"), false);
    });
  });

  describe("not-found signal detection", () => {
    it("recognises the Astra 404 contract by status or code", () => {
      assert.equal(
        isProfileDetailNotFound(astraLikeError(404, "RESOURCE_NOT_FOUND")),
        true,
      );
      assert.equal(isProfileDetailNotFound({ status: 404 }), true);
      assert.equal(
        isProfileDetailNotFound({ status: 200, code: "RESOURCE_NOT_FOUND" }),
        true,
      );
      assert.equal(
        isProfileDetailNotFound(astraLikeError(503, "NETWORK_ERROR")),
        false,
      );
      assert.equal(isProfileDetailNotFound(null), false);
    });
  });
});
