/**
 * Pure status-to-seam mapping for the profile detail dependency boundary
 * (`userProfiles.getById` and `/profiles/show/[id]`).
 *
 * This module is intentionally dependency-free so the classification matrix
 * (404 vs 403 vs timeout/network vs 5xx) can be verified with `node --test`
 * without booting the tRPC/Logto/Astra stack. Callers at the I/O boundary
 * (the router) narrow the thrown `unknown` to the named domain type
 * `AstraUpstreamFailure` via `instanceof AstraRequestError` — the public
 * fields of that class (`status: number`, optional `code: string`) are the
 * structural contract used here (see `src/lib/astra/client.ts:45-95`).
 *
 * Privacy rule: authorization failures (403) and dependency failures never
 * disclose whether a protected profile exists — the client-visible message is
 * fixed per outcome class and never echoes the upstream status, code, or
 * correlation identifiers (those stay internal to the established tRPC error
 * envelope via `TRPCError.cause`).
 */

/** Structural contract of an upstream (Astra) request failure. */
export interface AstraUpstreamFailure {
  status: number;
  code?: string;
}

export type ProfileDetailFailureKind =
  | "not_found"
  | "forbidden"
  | "timeout"
  | "network"
  | "upstream_failure"
  | "unknown";

export interface ProfileDetailFailure {
  kind: ProfileDetailFailureKind;
  /** True when the user can recover by retrying the same read-only query. */
  retryable: boolean;
  /** Client-safe message; never references upstream status or record existence. */
  message: string;
}

export const PROFILE_DETAIL_MESSAGES = {
  notFound: "Profil tidak ditemukan.",
  forbidden: "Anda tidak memiliki izin untuk mengakses profil ini.",
  dependency: "Layanan profil sedang tidak tersedia. Coba lagi beberapa saat.",
  unknown: "Terjadi kesalahan saat memuat profil. Coba lagi beberapa saat.",
} as const;

/**
 * Stands in for an upstream 404 when a collection answered successfully
 * without a payload, so the not-found outcome keeps a single representation.
 */
export const PROFILE_DETAIL_NOT_FOUND_SIGNAL: AstraUpstreamFailure = {
  status: 404,
  code: "RESOURCE_NOT_FOUND",
} as const;

const FORBIDDEN_STATUS = 403;
const FORBIDDEN_CODE = "FORBIDDEN";
const TIMEOUT_STATUS = 504;
const TIMEOUT_CODE = "TIMEOUT";
const NETWORK_STATUS = 503;
const NETWORK_CODES: ReadonlySet<string> = new Set([
  "NETWORK_ERROR",
  "DEPENDENCY_UNAVAILABLE",
]);
const NOT_FOUND_STATUS = 404;
const NOT_FOUND_CODE = "RESOURCE_NOT_FOUND";

/** Whether an upstream failure is a genuine not-found (the only "continue the lookup chain" outcome). */
export function isProfileDetailNotFound(
  failure: AstraUpstreamFailure | null,
): boolean {
  return (
    failure !== null &&
    (failure.status === NOT_FOUND_STATUS || failure.code === NOT_FOUND_CODE)
  );
}

/** Classifies a single upstream failure into the profile-detail outcome. */
export function classifyProfileDetailFailure(
  failure: AstraUpstreamFailure | null,
): ProfileDetailFailure {
  if (failure === null) {
    // Not an upstream contract failure (e.g. an unexpected internal error);
    // retrying the read-only query is safe.
    return {
      kind: "unknown",
      retryable: true,
      message: PROFILE_DETAIL_MESSAGES.unknown,
    };
  }
  if (isProfileDetailNotFound(failure)) {
    return {
      kind: "not_found",
      retryable: false,
      message: PROFILE_DETAIL_MESSAGES.notFound,
    };
  }
  if (failure.status === FORBIDDEN_STATUS || failure.code === FORBIDDEN_CODE) {
    return {
      kind: "forbidden",
      retryable: false,
      message: PROFILE_DETAIL_MESSAGES.forbidden,
    };
  }
  if (failure.status === TIMEOUT_STATUS || failure.code === TIMEOUT_CODE) {
    return {
      kind: "timeout",
      retryable: true,
      message: PROFILE_DETAIL_MESSAGES.dependency,
    };
  }
  if (
    failure.status === NETWORK_STATUS ||
    (failure.code !== undefined && NETWORK_CODES.has(failure.code))
  ) {
    return {
      kind: "network",
      retryable: true,
      message: PROFILE_DETAIL_MESSAGES.dependency,
    };
  }
  return {
    kind: "upstream_failure",
    retryable: true,
    message: PROFILE_DETAIL_MESSAGES.dependency,
  };
}

/**
 * Classifies the ordered failure list of the `getById` lookup chain. Only
 * genuine 404s allow the chain to continue (student, then staff), so any
 * non-404 failure found here decides the outcome; 404s alone mean the
 * profile genuinely does not exist in either protected collection.
 * `null` entries represent non-upstream internal failures and always decide
 * the outcome as "unknown".
 */
export function classifyProfileDetailFailures(
  failures: readonly (AstraUpstreamFailure | null)[],
): ProfileDetailFailure {
  for (const failure of failures) {
    if (isProfileDetailNotFound(failure)) continue;
    return classifyProfileDetailFailure(failure);
  }
  return {
    kind: "not_found",
    retryable: false,
    message: PROFILE_DETAIL_MESSAGES.notFound,
  };
}

/** tRPC error codes used at this seam. */
export type ProfileDetailSeamCode =
  "NOT_FOUND" | "FORBIDDEN" | "SERVICE_UNAVAILABLE" | "INTERNAL_SERVER_ERROR";

/** Maps a classified failure onto the tRPC code the client observes. */
export function profileDetailSeamCode(
  failure: ProfileDetailFailure,
): ProfileDetailSeamCode {
  switch (failure.kind) {
    case "not_found":
      return "NOT_FOUND";
    case "forbidden":
      return "FORBIDDEN";
    case "timeout":
    case "network":
    case "upstream_failure":
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

/** UI outcome classes for the profile detail screen. */
export type ProfileDetailUiState =
  "not_found" | "forbidden" | "dependency" | "unknown";

/**
 * Maps a tRPC error code (from `error.data.code` on the client) onto the UI
 * outcome class. An absent code means the query failed before a tRPC response
 * existed (client/network failure), which is treated as a recoverable
 * dependency failure.
 */
export function profileDetailUiState(
  code: string | null | undefined,
): ProfileDetailUiState {
  switch (code) {
    case "NOT_FOUND":
      return "not_found";
    case "FORBIDDEN":
      return "forbidden";
    case "SERVICE_UNAVAILABLE":
    case "INTERNAL_SERVER_ERROR":
    case "TIMEOUT":
    case "BAD_GATEWAY":
      return "dependency";
    case undefined:
      return "dependency";
    default:
      return "unknown";
  }
}

/** Whether a UI outcome class offers a retry control. */
export function isRetryableProfileDetailUiState(
  state: ProfileDetailUiState,
): boolean {
  return state === "dependency" || state === "unknown";
}
