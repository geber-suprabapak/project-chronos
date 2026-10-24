/**
 * Pure outcome classification for the shared Logto (identity-provider)
 * boundary used by `src/proxy.ts`, `(main)/layout.tsx`, and the
 * `/api/logto/sign-in` + `/api/logto/callback` route handlers.
 *
 * C09 rule: a genuinely absent or expired session (including a session the
 * provider rejects with 401 / `invalid_grant`) keeps the existing
 * authentication route (`/login`, resp. `/login?error=forbidden_role` for a
 * forbidden account). Provider-side failures — other non-OK responses,
 * malformed responses, and timeout/network failures — must NOT collapse into
 * that login redirect: they surface the application-owned degraded state
 * (`/auth/unavailable`) so an identity-provider outage is never presented to
 * the user as "your session expired, log in again".
 *
 * This module is intentionally dependency-free so the classification matrix
 * can be verified with `node --test` without booting the Next.js/Logto stack.
 * It matches the public error surface of the installed Logto SDK
 * (`@logto/js` 6.x / `@logto/client` 3.x, re-exported by `@logto/next`):
 *
 * - `LogtoRequestError` (name `LogtoRequestError`, `code: string`, `cause`:
 *   the cloned HTTP `Response`) — thrown for non-OK responses whose body is
 *   the `{ code, message }` request-error shape; `cause.status` carries the
 *   HTTP status (401/403/5xx).
 * - `LogtoError` (name `LogtoError`, `code: string`, `data`) — thrown for
 *   non-OK responses whose body does NOT match the request-error shape
 *   (`unexpected_response_error`, with the raw body in `data`), and for
 *   locally detected token problems (`id_token.invalid_*`).
 * - `LogtoClientError` (name `LogtoClientError`, `code: string`) — thrown
 *   for session-storage problems (`sign_in_session.invalid`,
 *   `sign_in_session.not_found`, `not_authenticated`,
 *   `fetch_user_info_failed`).
 * - `OidcError` (name `OidcError`, `error: string`) — the OAuth2 error the
 *   provider returned (e.g. `invalid_grant` for an expired/revoked session).
 * - Network-level failures surface as raw `fetch` rejections
 *   (`TypeError`); a caller-supplied abort/timeout surfaces as
 *   `TimeoutError`/`AbortError`; a provider response with a non-JSON body
 *   surfaces as `SyntaxError` from `response.json()`.
 *
 * Privacy rule: the client-safe `message` is a fixed string per outcome
 * class and never echoes the upstream status, code, body, or endpoint.
 *
 * NEXT_REDIRECT rule: `redirect()` works by throwing; callers MUST rethrow
 * redirect errors before calling `classifyLogtoFailure` (this module never
 * sees and never classifies them).
 */

export type LogtoFailureKind =
  | "unauthorized"
  | "forbidden"
  | "provider_http"
  | "provider_malformed"
  | "provider_network"
  | "unknown";

/**
 * Recovery actions shared by every Logto seam:
 * - `login`: the existing authentication route (`/login`) — used only when
 *   the session is genuinely absent/expired or the account is unauthorized.
 * - `forbidden_role`: the existing forbidden-account route
 *   (`/login?error=forbidden_role`).
 * - `degraded`: the application-owned identity-degraded state
 *   (`/auth/unavailable`), never the login redirect.
 */
export type LogtoRecoveryAction = "login" | "forbidden_role" | "degraded";

export interface LogtoFailureOutcome {
  kind: LogtoFailureKind;
  action: LogtoRecoveryAction;
  /** True when the user can recover without re-entering credentials. */
  retryable: boolean;
  /** Client-safe message; never references upstream status or internals. */
  message: string;
}

export const LOGTO_OUTCOME_MESSAGES = {
  unauthorized: "Sesi tidak valid atau telah berakhir. Silakan login kembali.",
  forbidden:
    "Akun Anda tidak memiliki hak akses istimewa untuk masuk ke portal Chronos.",
  degraded:
    "Layanan autentikasi sedang tidak tersedia. Coba lagi beberapa saat.",
  unknown:
    "Terjadi kesalahan saat memverifikasi sesi. Coba lagi beberapa saat.",
} as const;

const SESSION_CLIENT_ERROR_CODES: ReadonlySet<string> = new Set([
  "sign_in_session.invalid",
  "sign_in_session.not_found",
  "not_authenticated",
  "fetch_user_info_failed",
]);

const SESSION_EXPIRED_OIDC_ERRORS: ReadonlySet<string> = new Set([
  "invalid_grant",
  "invalid_token",
  "invalid_request",
]);

/**
 * Structural shape of the Logto SDK errors this module classifies. Every
 * field is only ever compared against string/number literals, so a foreign
 * value simply fails the comparison and falls through to the safe default.
 */
interface LogtoLikeError {
  name?: string;
  code?: string;
  error?: string;
  data?: { error?: string };
  cause?: unknown;
}

/** Reads the HTTP status off the response attached to a `LogtoRequestError`. */
function responseStatusOf(cause: unknown): number | undefined {
  // SAFETY: the SDK attaches the cloned fetch Response (not a plain record);
  // only its `status` field is read, and callers compare it against the
  // 401/403 literals, so a foreign shape simply yields no usable status.
  const status = (cause as { status?: number } | null | undefined)?.status;
  return status === undefined ? undefined : status;
}

function unauthorizedOutcome(): LogtoFailureOutcome {
  return {
    kind: "unauthorized",
    action: "login",
    retryable: false,
    message: LOGTO_OUTCOME_MESSAGES.unauthorized,
  };
}

function forbiddenOutcome(): LogtoFailureOutcome {
  return {
    kind: "forbidden",
    action: "forbidden_role",
    retryable: false,
    message: LOGTO_OUTCOME_MESSAGES.forbidden,
  };
}

function degradedOutcome(kind: LogtoFailureKind): LogtoFailureOutcome {
  return {
    kind,
    action: "degraded",
    retryable: true,
    message:
      kind === "unknown"
        ? LOGTO_OUTCOME_MESSAGES.unknown
        : LOGTO_OUTCOME_MESSAGES.degraded,
  };
}

/**
 * Classifies the OAuth2 error carried by an `OidcError` or wrapped in a
 * `LogtoError` body: expired/rejected sessions keep the login route,
 * `access_denied` keeps the forbidden route, everything else is a
 * provider-side failure.
 */
function outcomeFromOidcError(oidcError: string): LogtoFailureOutcome {
  if (oidcError === "access_denied") {
    return forbiddenOutcome();
  }
  if (SESSION_EXPIRED_OIDC_ERRORS.has(oidcError)) {
    return unauthorizedOutcome();
  }
  return degradedOutcome("provider_http");
}

/**
 * Classifies a thrown Logto-boundary failure into the shared outcome matrix.
 * The parameter is named `cause` per the error-cause convention: the value is
 * the untyped failure thrown across the SDK boundary, and every field read
 * here is only compared against string/number literals so an unrecognized
 * shape degrades to the safe `unknown` outcome instead of a wrong route.
 * `null`/`undefined`/non-error values mean the failure lost its identity
 * somewhere between the SDK and the seam; they are treated as an unknown
 * provider-side anomaly (degraded state), never as an absent session.
 */
export function classifyLogtoFailure(cause: unknown): LogtoFailureOutcome {
  // SAFETY: the value is narrowed structurally for field access only; every
  // field is compared against literals, so a mismatched shape cannot route
  // to a wrong outcome — it falls through to the degraded default.
  const like =
    cause instanceof Error ||
    Object.prototype.toString.call(cause) === "[object Object]"
      ? (cause as LogtoLikeError)
      : null;

  // Timeout / network failure class. TimeoutError/AbortError occur when a
  // caller aborts the provider request; TypeError is the raw fetch failure
  // (connection refused, DNS, socket destroyed).
  if (
    like?.name === "TimeoutError" ||
    like?.name === "AbortError" ||
    like?.name === "TypeError"
  ) {
    return degradedOutcome("provider_network");
  }

  // Malformed provider response (non-JSON body on an OK/non-OK response).
  if (like?.name === "SyntaxError") {
    return degradedOutcome("provider_malformed");
  }

  // OAuth2 error object from the token endpoint.
  if (like?.name === "OidcError") {
    if (like.error === undefined) {
      return degradedOutcome("provider_http");
    }
    return outcomeFromOidcError(like.error);
  }

  // Session-storage problems reported by the Logto SDK client.
  if (like?.name === "LogtoClientError") {
    if (like.code !== undefined && SESSION_CLIENT_ERROR_CODES.has(like.code)) {
      return unauthorizedOutcome();
    }
    return degradedOutcome("unknown");
  }

  // Non-OK provider response with the { code, message } request-error body;
  // the cloned Response on `cause` carries the HTTP status.
  if (like?.name === "LogtoRequestError") {
    const status = responseStatusOf(like.cause);
    if (status === 401) {
      return unauthorizedOutcome();
    }
    if (status === 403) {
      return forbiddenOutcome();
    }
    return degradedOutcome("provider_http");
  }

  // Non-OK provider response whose body is not the request-error shape, or a
  // locally detected token problem.
  if (like?.name === "LogtoError") {
    // The requester wraps every non-{code,message} body in
    // `unexpected_response_error`; an OIDC error body ({ error, ... }) means
    // the provider answered the token endpoint with an OAuth2 error.
    if (
      like.code === "unexpected_response_error" &&
      like.data?.error !== undefined
    ) {
      return outcomeFromOidcError(like.data.error);
    }
    if (like.code !== undefined && like.code.startsWith("id_token.")) {
      return unauthorizedOutcome();
    }
    return degradedOutcome("provider_malformed");
  }

  return degradedOutcome("unknown");
}

/** Whether an outcome routes to the application-owned degraded state. */
export function isDegradedLogtoOutcome(outcome: LogtoFailureOutcome): boolean {
  return outcome.action === "degraded";
}
