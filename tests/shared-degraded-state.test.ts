import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  LOGTO_OUTCOME_MESSAGES,
  classifyLogtoFailure,
  isDegradedLogtoOutcome,
} from "../src/lib/logto/outcome.ts";
import {
  DASHBOARD_DATA_MESSAGES,
  dashboardDataMessage,
  dashboardDataUiState,
  isRetryableDashboardDataUiState,
} from "../src/server/api/routers/dashboard-data-outcome.ts";
import { leaveDetailUiState } from "../src/server/api/routers/perizinan-detail.ts";

/**
 * Fixture factories mirroring the public error surface of the installed
 * Logto SDK (@logto/js 6.x / @logto/client 3.x, re-exported by @logto/next):
 *
 * - `LogtoRequestError` — non-OK response whose body matched the
 *   { code, message } request-error shape; the cloned Response rides on
 *   `cause` and carries the HTTP status
 *   (node_modules/.pnpm/@logto+js@6.1.2/.../lib/utils/errors.js;
 *   @logto/client lib/utils/requester.js).
 * - `LogtoError` — non-{code,message} body (`unexpected_response_error`,
 *   raw body in `data`) and local token problems (`id_token.invalid_*`).
 * - `LogtoClientError` — session-storage problems (`sign_in_session.*`,
 *   `not_authenticated`, `fetch_user_info_failed`).
 * - `OidcError` — OAuth2 error object (`error`/`errorDescription`).
 * - Raw fetch rejections (`TypeError`), caller aborts (`TimeoutError`,
 *   `AbortError`), and non-JSON bodies (`SyntaxError`).
 */
function namedError(
  name: string,
  extra: Record<string, unknown> = {},
  message = "upstream failure",
): Error {
  const error = new Error(message);
  error.name = name;
  Object.assign(error, extra);
  return error;
}

function logtoRequestError(status: number): Error {
  return namedError(
    "LogtoRequestError",
    {
      code: "mock_logto_failure",
      cause: { status, statusText: "Simulated" },
    },
    `Simulated Logto failure (${status})`,
  );
}

function oidcShapedLogtoError(oidcError: string): Error {
  return namedError(
    "LogtoError",
    {
      code: "unexpected_response_error",
      data: { error: oidcError, error_description: "simulated" },
    },
    "Unexpected response error from the server.",
  );
}

describe("Shared Logto outcome classification (C09)", () => {
  describe("provider failure matrix — degraded, never the login redirect", () => {
    it("classifies a timeout (TimeoutError) as a degraded provider-network failure", () => {
      const outcome = classifyLogtoFailure(
        namedError("TimeoutError", {}, "The operation was timeout"),
      );
      assert.equal(outcome.kind, "provider_network");
      assert.equal(outcome.action, "degraded");
      assert.equal(outcome.retryable, true);
      assert.ok(isDegradedLogtoOutcome(outcome));
    });

    it("classifies an aborted provider request as a degraded provider-network failure", () => {
      const outcome = classifyLogtoFailure(namedError("AbortError"));
      assert.equal(outcome.kind, "provider_network");
      assert.equal(outcome.action, "degraded");
    });

    it("classifies a raw network failure (fetch TypeError) as a degraded provider-network failure", () => {
      const outcome = classifyLogtoFailure(
        namedError("TypeError", {}, "fetch failed"),
      );
      assert.equal(outcome.kind, "provider_network");
      assert.equal(outcome.action, "degraded");
    });

    it("classifies a non-JSON provider response (SyntaxError) as a degraded malformed-response failure", () => {
      const outcome = classifyLogtoFailure(
        namedError("SyntaxError", {}, "Unexpected token < in JSON"),
      );
      assert.equal(outcome.kind, "provider_malformed");
      assert.equal(outcome.action, "degraded");
      assert.ok(isDegradedLogtoOutcome(outcome));
    });

    it("classifies an upstream 5xx request error as a degraded provider-http failure", () => {
      for (const status of [500, 502, 503]) {
        const outcome = classifyLogtoFailure(logtoRequestError(status));
        assert.equal(outcome.kind, "provider_http");
        assert.equal(outcome.action, "degraded");
        assert.ok(isDegradedLogtoOutcome(outcome));
      }
    });

    it("classifies a non-{code,message} error body as a degraded malformed-response failure", () => {
      const outcome = classifyLogtoFailure(
        namedError(
          "LogtoError",
          { code: "unexpected_response_error", data: { foo: "bar" } },
          "Unexpected response error from the server.",
        ),
      );
      assert.equal(outcome.kind, "provider_malformed");
      assert.equal(outcome.action, "degraded");
    });

    it("classifies unknown OAuth2 token-endpoint errors as degraded provider-http failures", () => {
      const outcome = classifyLogtoFailure(
        oidcShapedLogtoError("server_error"),
      );
      assert.equal(outcome.kind, "provider_http");
      assert.equal(outcome.action, "degraded");
    });

    it("classifies a lost failure identity (null / non-error) as degraded unknown, never as an absent session", () => {
      for (const value of [null, undefined, "boom", 42]) {
        const outcome = classifyLogtoFailure(value);
        assert.equal(outcome.kind, "unknown");
        assert.equal(outcome.action, "degraded");
        assert.ok(isDegradedLogtoOutcome(outcome));
      }
    });

    it("never leaks upstream status, code, or endpoint detail in the degraded message", () => {
      const outcome = classifyLogtoFailure(logtoRequestError(503));
      assert.equal(outcome.message, LOGTO_OUTCOME_MESSAGES.degraded);
      assert.ok(!outcome.message.includes("503"));
      assert.ok(!outcome.message.includes("mock_logto_failure"));
      assert.ok(!/\/oidc/i.test(outcome.message));
    });
  });

  describe("session-outcome matrix — existing authentication route retained", () => {
    it("classifies an upstream 401 as an unauthorized outcome routed to login", () => {
      const outcome = classifyLogtoFailure(logtoRequestError(401));
      assert.equal(outcome.kind, "unauthorized");
      assert.equal(outcome.action, "login");
      assert.equal(outcome.retryable, false);
      assert.ok(!isDegradedLogtoOutcome(outcome));
    });

    it("classifies an upstream 403 as a forbidden outcome routed to the forbidden-role route", () => {
      const outcome = classifyLogtoFailure(logtoRequestError(403));
      assert.equal(outcome.kind, "forbidden");
      assert.equal(outcome.action, "forbidden_role");
      assert.ok(!isDegradedLogtoOutcome(outcome));
    });

    it("reads the status from a real fetch Response cause, not only plain records", () => {
      const response = new Response(null, { status: 403 });
      const outcome = classifyLogtoFailure(
        namedError(
          "LogtoRequestError",
          { code: "mock_logto_failure", cause: response },
          "Simulated Logto failure (403)",
        ),
      );
      assert.equal(outcome.kind, "forbidden");
      assert.equal(outcome.action, "forbidden_role");
    });

    it("classifies an expired/rejected session (OIDC invalid_grant body) as an unauthorized outcome routed to login", () => {
      for (const oidcError of ["invalid_grant", "invalid_token"]) {
        const outcome = classifyLogtoFailure(oidcShapedLogtoError(oidcError));
        assert.equal(outcome.kind, "unauthorized");
        assert.equal(outcome.action, "login");
      }
    });

    it("classifies OIDC access_denied as a forbidden outcome", () => {
      const outcome = classifyLogtoFailure(
        oidcShapedLogtoError("access_denied"),
      );
      assert.equal(outcome.kind, "forbidden");
      assert.equal(outcome.action, "forbidden_role");
    });

    it("classifies the OidcError object shape (invalid_grant) as unauthorized and access_denied as forbidden", () => {
      const expired = classifyLogtoFailure(
        namedError("OidcError", { error: "invalid_grant" }),
      );
      assert.equal(expired.action, "login");
      const denied = classifyLogtoFailure(
        namedError("OidcError", { error: "access_denied" }),
      );
      assert.equal(denied.action, "forbidden_role");
    });

    it("classifies session-storage failures (sign_in_session.*, not_authenticated) as unauthorized outcomes routed to login", () => {
      for (const code of [
        "sign_in_session.invalid",
        "sign_in_session.not_found",
        "not_authenticated",
      ]) {
        const outcome = classifyLogtoFailure(
          namedError("LogtoClientError", { code }),
        );
        assert.equal(outcome.kind, "unauthorized");
        assert.equal(outcome.action, "login");
      }
    });

    it("classifies an invalid id token as an unauthorized outcome", () => {
      const outcome = classifyLogtoFailure(
        namedError("LogtoError", { code: "id_token.invalid_token" }),
      );
      assert.equal(outcome.kind, "unauthorized");
      assert.equal(outcome.action, "login");
    });
  });
});

describe("Dashboard data outcome mapping (C09)", () => {
  describe("tRPC code → UI outcome matrix", () => {
    it("maps FORBIDDEN to a non-retryable authorization failure", () => {
      const state = dashboardDataUiState("FORBIDDEN");
      assert.equal(state, "forbidden");
      assert.equal(isRetryableDashboardDataUiState(state), false);
      assert.equal(
        dashboardDataMessage(state),
        DASHBOARD_DATA_MESSAGES.forbidden,
      );
    });

    it("maps dependency failures (SERVICE_UNAVAILABLE, TIMEOUT, BAD_GATEWAY) to retryable states", () => {
      for (const code of ["SERVICE_UNAVAILABLE", "TIMEOUT", "BAD_GATEWAY"]) {
        const state = dashboardDataUiState(code);
        assert.equal(state, "dependency");
        assert.equal(isRetryableDashboardDataUiState(state), true);
        assert.equal(
          dashboardDataMessage(state),
          DASHBOARD_DATA_MESSAGES.dependency,
        );
      }
    });

    it("maps INTERNAL_SERVER_ERROR to a retryable dependency state, never an empty-data success", () => {
      const state = dashboardDataUiState("INTERNAL_SERVER_ERROR");
      assert.equal(state, "dependency");
      assert.equal(isRetryableDashboardDataUiState(state), true);
    });

    it("maps an absent code (failure before a tRPC response) to a retryable dependency state", () => {
      const state = dashboardDataUiState(undefined);
      assert.equal(state, "dependency");
      assert.equal(isRetryableDashboardDataUiState(state), true);
    });

    it("maps a NOT_FOUND code on a collection read to a retryable dependency state, never an empty table", () => {
      const state = dashboardDataUiState("NOT_FOUND");
      assert.equal(state, "dependency");
      assert.equal(isRetryableDashboardDataUiState(state), true);
    });

    it("maps unexpected codes to the retryable unknown state", () => {
      const state = dashboardDataUiState("PARSE_ERROR");
      assert.equal(state, "unknown");
      assert.equal(isRetryableDashboardDataUiState(state), true);
      assert.equal(
        dashboardDataMessage(state),
        DASHBOARD_DATA_MESSAGES.unknown,
      );
    });

    it("reuses the existing Leave collection mapping (C05) instead of a new abstraction", () => {
      for (const code of [
        "FORBIDDEN",
        "SERVICE_UNAVAILABLE",
        "INTERNAL_SERVER_ERROR",
        "TIMEOUT",
        "BAD_GATEWAY",
        "NOT_FOUND",
        "PARSE_ERROR",
        undefined,
      ]) {
        const expected = leaveDetailUiState(code);
        assert.equal(
          dashboardDataUiState(code),
          expected === "not_found" ? "dependency" : expected,
        );
      }
    });
  });

  describe("message privacy", () => {
    it("keeps client-safe messages fixed per outcome class", () => {
      assert.equal(
        dashboardDataMessage("forbidden"),
        DASHBOARD_DATA_MESSAGES.forbidden,
      );
      assert.equal(
        dashboardDataMessage("dependency"),
        DASHBOARD_DATA_MESSAGES.dependency,
      );
      assert.equal(
        dashboardDataMessage("unknown"),
        DASHBOARD_DATA_MESSAGES.unknown,
      );
    });
  });
});
