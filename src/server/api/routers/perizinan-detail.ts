/**
 * Pure status-to-seam mapping for the Leave (perizinan) dependency boundary
 * (`perizinan.getById`, `perizinan.list`, `perizinan.listRaw`, and the
 * `/perizinan` + `/perizinan/show/[id]` pages).
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
 * disclose whether a protected Leave Request exists — the client-visible
 * message is fixed per outcome class and never echoes the upstream status,
 * code, or correlation identifiers (those stay internal to the established
 * tRPC error envelope via `TRPCError.cause`).
 *
 * List rule (C05): a failing Leave *collection* is never "no data". Only the
 * detail lookup treats 404 as a genuine not-found; list/listRaw failures
 * (including an upstream 404 on the collection path) stay recoverable
 * dependency failures so an empty result cannot be fabricated.
 */

/** Structural contract of an upstream (Astra) request failure. */
export interface AstraUpstreamFailure {
  status: number;
  code?: string;
}

export type LeaveDetailFailureKind =
  | "not_found"
  | "forbidden"
  | "timeout"
  | "network"
  | "upstream_failure"
  | "unknown";

export interface LeaveDetailFailure {
  kind: LeaveDetailFailureKind;
  /** True when the user can recover by retrying the same read-only query. */
  retryable: boolean;
  /** Client-safe message; never references upstream status or record existence. */
  message: string;
}

export const LEAVE_DETAIL_MESSAGES = {
  notFound: "Data perizinan tidak ditemukan.",
  forbidden: "Anda tidak memiliki izin untuk mengakses perizinan ini.",
  dependency:
    "Layanan perizinan sedang tidak tersedia. Coba lagi beberapa saat.",
  unknown: "Terjadi kesalahan saat memuat perizinan. Coba lagi beberapa saat.",
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

/** Whether an upstream failure is a genuine not-found (detail lookups only). */
export function isLeaveDetailNotFound(
  failure: AstraUpstreamFailure | null,
): boolean {
  return (
    failure !== null &&
    (failure.status === NOT_FOUND_STATUS || failure.code === NOT_FOUND_CODE)
  );
}

/** Classifies a single upstream failure into the Leave detail outcome. */
export function classifyLeaveDetailFailure(
  failure: AstraUpstreamFailure | null,
): LeaveDetailFailure {
  if (failure === null) {
    // Not an upstream contract failure (e.g. an unexpected internal error);
    // retrying the read-only query is safe.
    return {
      kind: "unknown",
      retryable: true,
      message: LEAVE_DETAIL_MESSAGES.unknown,
    };
  }
  if (isLeaveDetailNotFound(failure)) {
    return {
      kind: "not_found",
      retryable: false,
      message: LEAVE_DETAIL_MESSAGES.notFound,
    };
  }
  if (failure.status === FORBIDDEN_STATUS || failure.code === FORBIDDEN_CODE) {
    return {
      kind: "forbidden",
      retryable: false,
      message: LEAVE_DETAIL_MESSAGES.forbidden,
    };
  }
  if (failure.status === TIMEOUT_STATUS || failure.code === TIMEOUT_CODE) {
    return {
      kind: "timeout",
      retryable: true,
      message: LEAVE_DETAIL_MESSAGES.dependency,
    };
  }
  if (
    failure.status === NETWORK_STATUS ||
    (failure.code !== undefined && NETWORK_CODES.has(failure.code))
  ) {
    return {
      kind: "network",
      retryable: true,
      message: LEAVE_DETAIL_MESSAGES.dependency,
    };
  }
  return {
    kind: "upstream_failure",
    retryable: true,
    message: LEAVE_DETAIL_MESSAGES.dependency,
  };
}

/**
 * Classifies a failure of a Leave *collection* read (`list` / `listRaw`).
 * Unlike the detail lookup, no upstream status here means "no records": a
 * failed collection (404 included) must surface as a recoverable dependency
 * failure instead of an empty list, while 403 stays a non-retryable
 * authorization failure. `null` represents a non-upstream internal failure.
 */
export function classifyLeaveListFailure(
  failure: AstraUpstreamFailure | null,
): LeaveDetailFailure {
  if (failure !== null) {
    if (
      failure.status === FORBIDDEN_STATUS ||
      failure.code === FORBIDDEN_CODE
    ) {
      return {
        kind: "forbidden",
        retryable: false,
        message: LEAVE_DETAIL_MESSAGES.forbidden,
      };
    }
    if (failure.status === TIMEOUT_STATUS || failure.code === TIMEOUT_CODE) {
      return {
        kind: "timeout",
        retryable: true,
        message: LEAVE_DETAIL_MESSAGES.dependency,
      };
    }
    if (
      failure.status === NETWORK_STATUS ||
      (failure.code !== undefined && NETWORK_CODES.has(failure.code))
    ) {
      return {
        kind: "network",
        retryable: true,
        message: LEAVE_DETAIL_MESSAGES.dependency,
      };
    }
  }
  return {
    kind: failure === null ? "unknown" : "upstream_failure",
    retryable: true,
    message:
      failure === null
        ? LEAVE_DETAIL_MESSAGES.unknown
        : LEAVE_DETAIL_MESSAGES.dependency,
  };
}

/** tRPC error codes used at this seam. */
export type LeaveDetailSeamCode =
  "NOT_FOUND" | "FORBIDDEN" | "SERVICE_UNAVAILABLE" | "INTERNAL_SERVER_ERROR";

/** Maps a classified failure onto the tRPC code the client observes. */
export function leaveDetailSeamCode(
  failure: LeaveDetailFailure,
): LeaveDetailSeamCode {
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

/** UI outcome classes for the Leave list and detail screens. */
export type LeaveDetailUiState =
  "not_found" | "forbidden" | "dependency" | "unknown";

/**
 * Maps a tRPC error code (from `error.data.code` on the client) onto the UI
 * outcome class. An absent code means the query failed before a tRPC response
 * existed (client/network failure), which is treated as a recoverable
 * dependency failure.
 */
export function leaveDetailUiState(
  code: string | null | undefined,
): LeaveDetailUiState {
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
export function isRetryableLeaveDetailUiState(
  state: LeaveDetailUiState,
): boolean {
  return state === "dependency" || state === "unknown";
}
