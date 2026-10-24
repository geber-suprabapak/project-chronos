import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LEAVE_DETAIL_MESSAGES,
  classifyLeaveDetailFailure,
  classifyLeaveListFailure,
  isRetryableLeaveDetailUiState,
  leaveDetailSeamCode,
  isLeaveDetailNotFound,
  leaveDetailUiState,
} from "../src/server/api/routers/perizinan-detail.ts";

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

describe("Leave detail/list dependency-error mapping (C05)", () => {
  describe("detail classification matrix (404 vs 403 vs timeout/network vs 5xx)", () => {
    it("classifies HTTP 404 as a genuine not-found that is not retryable", () => {
      const failure = classifyLeaveDetailFailure(
        astraLikeError(404, "RESOURCE_NOT_FOUND"),
      );
      assert.equal(failure.kind, "not_found");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.notFound);
    });

    it("classifies HTTP 403 as an authorization failure that is not retryable", () => {
      const failure = classifyLeaveDetailFailure(
        astraLikeError(403, "FORBIDDEN"),
      );
      assert.equal(failure.kind, "forbidden");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.forbidden);
    });

    it("classifies an Astra timeout (504/TIMEOUT) as a recoverable dependency failure", () => {
      const failure = classifyLeaveDetailFailure(
        astraLikeError(504, "TIMEOUT"),
      );
      assert.equal(failure.kind, "timeout");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.dependency);
    });

    it("classifies a network failure (503/NETWORK_ERROR) as a recoverable dependency failure", () => {
      const failure = classifyLeaveDetailFailure(
        astraLikeError(503, "NETWORK_ERROR"),
      );
      assert.equal(failure.kind, "network");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.dependency);
    });

    it("classifies an upstream 5xx as a recoverable dependency failure", () => {
      for (const status of [500, 502]) {
        const failure = classifyLeaveDetailFailure(
          astraLikeError(status, undefined),
        );
        assert.equal(failure.kind, "upstream_failure");
        assert.equal(failure.retryable, true);
        assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.dependency);
      }
      // 503 without an Astra code still matches AstraRequestError.isUnavailable
      // semantics (status-based), mapping to the network outcome class.
      const unavailable = classifyLeaveDetailFailure(
        astraLikeError(503, undefined),
      );
      assert.equal(unavailable.kind, "network");
      assert.equal(unavailable.retryable, true);
      assert.equal(unavailable.message, LEAVE_DETAIL_MESSAGES.dependency);
    });

    it("classifies a non-upstream internal failure (null signal) as an unknown recoverable failure", () => {
      const failure = classifyLeaveDetailFailure(null);
      assert.equal(failure.kind, "unknown");
      assert.equal(failure.retryable, true);
      assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.unknown);
    });

    it("never leaks upstream status, codes, or messages into client-visible messages", () => {
      for (const [status, code] of [
        [404, "RESOURCE_NOT_FOUND"],
        [403, "FORBIDDEN"],
        [504, "TIMEOUT"],
        [503, "NETWORK_ERROR"],
        [500, undefined],
      ] as const) {
        const failure = classifyLeaveDetailFailure(
          astraLikeError(status, code, `Astra secret detail for ${status}`),
        );
        assert.ok(!failure.message.includes(String(status)));
        assert.ok(!failure.message.includes("Astra"));
        assert.ok(!failure.message.includes("secret"));
      }
    });

    it("gives unauthorized callers the same message whether or not the leave request exists", () => {
      // A 403 from Astra must not become an existence oracle: the forbidden
      // message is fixed, regardless of any upstream detail.
      const forbiddenExisting = classifyLeaveDetailFailure(
        astraLikeError(403, "FORBIDDEN", "Leave request exists but protected"),
      );
      const forbiddenUnknown = classifyLeaveDetailFailure(
        astraLikeError(403, "FORBIDDEN", "No such record"),
      );
      assert.equal(forbiddenExisting.kind, "forbidden");
      assert.equal(forbiddenExisting.message, forbiddenUnknown.message);
      assert.notEqual(
        forbiddenExisting.message,
        LEAVE_DETAIL_MESSAGES.notFound,
      );
    });

    it("keeps the four outcome classes distinguishable (no collapse into not-found)", () => {
      const messages = new Set(
        [
          classifyLeaveDetailFailure(astraLikeError(404, "RESOURCE_NOT_FOUND")),
          classifyLeaveDetailFailure(astraLikeError(403, "FORBIDDEN")),
          classifyLeaveDetailFailure(astraLikeError(504, "TIMEOUT")),
          classifyLeaveDetailFailure(astraLikeError(500, undefined)),
        ].map((failure) => `${failure.kind}:${failure.retryable}`),
      );
      assert.equal(messages.size, 4);
    });
  });

  describe("list classification (collection failures never become 'no data')", () => {
    it("treats an upstream 404 on the collection path as a recoverable dependency failure, not an empty list", () => {
      const failure = classifyLeaveListFailure(
        astraLikeError(404, "RESOURCE_NOT_FOUND"),
      );
      assert.equal(failure.retryable, true);
      assert.notEqual(failure.kind, "not_found");
      assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.dependency);
    });

    it("keeps 403 on the collection path a non-retryable authorization failure", () => {
      const failure = classifyLeaveListFailure(
        astraLikeError(403, "FORBIDDEN"),
      );
      assert.equal(failure.kind, "forbidden");
      assert.equal(failure.retryable, false);
      assert.equal(failure.message, LEAVE_DETAIL_MESSAGES.forbidden);
    });

    it("keeps timeout, network, 5xx, and internal failures recoverable on the collection path", () => {
      for (const error of [
        astraLikeError(504, "TIMEOUT"),
        astraLikeError(503, "NETWORK_ERROR"),
        astraLikeError(500, undefined),
        astraLikeError(502, "INVALID_ENVELOPE"),
        null,
      ]) {
        const failure = classifyLeaveListFailure(error);
        assert.equal(failure.retryable, true);
      }
    });
  });

  describe("seam code mapping", () => {
    it("maps not-found and authorization failures to distinct non-retryable tRPC codes", () => {
      assert.equal(
        leaveDetailSeamCode(
          classifyLeaveDetailFailure(astraLikeError(404, "RESOURCE_NOT_FOUND")),
        ),
        "NOT_FOUND",
      );
      assert.equal(
        leaveDetailSeamCode(
          classifyLeaveDetailFailure(astraLikeError(403, "FORBIDDEN")),
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
          leaveDetailSeamCode(classifyLeaveDetailFailure(error)),
          "SERVICE_UNAVAILABLE",
        );
      }
    });

    it("maps list 404 to SERVICE_UNAVAILABLE (never NOT_FOUND)", () => {
      assert.equal(
        leaveDetailSeamCode(
          classifyLeaveListFailure(astraLikeError(404, "RESOURCE_NOT_FOUND")),
        ),
        "SERVICE_UNAVAILABLE",
      );
    });
  });

  describe("client-side UI state mapping", () => {
    it("keeps the four fixture outcomes distinguishable at the API/UI seam", () => {
      assert.equal(leaveDetailUiState("NOT_FOUND"), "not_found");
      assert.equal(leaveDetailUiState("FORBIDDEN"), "forbidden");
      assert.equal(leaveDetailUiState("SERVICE_UNAVAILABLE"), "dependency");
      assert.equal(leaveDetailUiState("INTERNAL_SERVER_ERROR"), "dependency");
    });

    it("treats a missing tRPC code (client/network failure) as a recoverable dependency", () => {
      const state = leaveDetailUiState(undefined);
      assert.equal(state, "dependency");
      assert.equal(isRetryableLeaveDetailUiState(state), true);
    });

    it("offers a retry control only for recoverable outcomes, never for not-found or forbidden", () => {
      assert.equal(isRetryableLeaveDetailUiState("dependency"), true);
      assert.equal(isRetryableLeaveDetailUiState("unknown"), true);
      assert.equal(isRetryableLeaveDetailUiState("not_found"), false);
      assert.equal(isRetryableLeaveDetailUiState("forbidden"), false);
    });
  });

  describe("not-found signal detection", () => {
    it("recognises the Astra 404 contract by status or code", () => {
      assert.equal(
        isLeaveDetailNotFound(astraLikeError(404, "RESOURCE_NOT_FOUND")),
        true,
      );
      assert.equal(isLeaveDetailNotFound({ status: 404 }), true);
      assert.equal(
        isLeaveDetailNotFound({ status: 200, code: "RESOURCE_NOT_FOUND" }),
        true,
      );
      assert.equal(
        isLeaveDetailNotFound(astraLikeError(503, "NETWORK_ERROR")),
        false,
      );
      assert.equal(isLeaveDetailNotFound(null), false);
    });
  });
});
