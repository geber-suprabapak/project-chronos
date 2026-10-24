/**
 * Pure status-to-seam mapping for the configuration (location) dependency
 * boundary (`location.get`, `location.getById`, `location.getAll`,
 * `location.getActive`, `location.getStats`, and the
 * `/konfigurasi/lokasi` page).
 *
 * This module is intentionally dependency-free so the classification matrix
 * (403 vs timeout/network vs 5xx) can be verified with `node --test` without
 * booting the tRPC/Logto/Astra stack. Callers at the I/O boundary (the router)
 * narrow the thrown `unknown` to the structural contract
 * `AstraUpstreamFailure` — the public fields of `AstraRequestError`
 * (`status: number`, optional `code: string`) are that contract
 * (see `src/lib/astra/client.ts:45-95`).
 *
 * Privacy rule: authorization failures (403) never echo the upstream status,
 * code, or message; the client-visible message is fixed per outcome class and
 * upstream detail stays internal to the established tRPC error envelope via
 * `TRPCError.cause`.
 *
 * Empty-vs-error rule (C07): a configuration *read* failure is never a
 * successful empty/default response. A genuine first-use/no-config state is
 * the successful `[]`/`null` payload the upstream returns; only successful
 * reads produce it. There is no not-found outcome at this boundary — the
 * location collection either answers (empty or not) or fails.
 */

// Relative (non-alias) import keeps this module loadable under `node --test`.
import type { AstraUpstreamFailure } from "./user-profiles-detail";

export type { AstraUpstreamFailure };

export type ConfigurationReadFailureKind =
  "forbidden" | "timeout" | "network" | "upstream_failure" | "unknown";

export interface ConfigurationReadFailure {
  kind: ConfigurationReadFailureKind;
  /** True when the user can recover by retrying the same read-only query. */
  retryable: boolean;
  /** Client-safe message; never references upstream status or internals. */
  message: string;
}

export const CONFIGURATION_READ_MESSAGES = {
  forbidden: "Anda tidak memiliki izin untuk memuat konfigurasi lokasi.",
  dependency:
    "Layanan konfigurasi sedang tidak tersedia. Coba lagi beberapa saat.",
  unknown:
    "Terjadi kesalahan saat memuat konfigurasi. Coba lagi beberapa saat.",
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

/**
 * Classifies a failure of a configuration read. Like the Leave collection
 * rule, no upstream status here means "no configuration": even an upstream
 * 404 on a read surfaces as a recoverable dependency failure instead of an
 * empty/default result, while 403 stays a non-retryable authorization
 * failure. `null` represents a non-upstream internal failure.
 */
export function classifyConfigurationReadFailure(
  failure: AstraUpstreamFailure | null,
): ConfigurationReadFailure {
  if (failure !== null) {
    if (
      failure.status === FORBIDDEN_STATUS ||
      failure.code === FORBIDDEN_CODE
    ) {
      return {
        kind: "forbidden",
        retryable: false,
        message: CONFIGURATION_READ_MESSAGES.forbidden,
      };
    }
    if (failure.status === TIMEOUT_STATUS || failure.code === TIMEOUT_CODE) {
      return {
        kind: "timeout",
        retryable: true,
        message: CONFIGURATION_READ_MESSAGES.dependency,
      };
    }
    if (
      failure.status === NETWORK_STATUS ||
      (failure.code !== undefined && NETWORK_CODES.has(failure.code))
    ) {
      return {
        kind: "network",
        retryable: true,
        message: CONFIGURATION_READ_MESSAGES.dependency,
      };
    }
  }
  return {
    kind: failure === null ? "unknown" : "upstream_failure",
    retryable: true,
    message:
      failure === null
        ? CONFIGURATION_READ_MESSAGES.unknown
        : CONFIGURATION_READ_MESSAGES.dependency,
  };
}

/** tRPC error codes used at this seam. */
export type ConfigurationReadSeamCode =
  "FORBIDDEN" | "SERVICE_UNAVAILABLE" | "INTERNAL_SERVER_ERROR";

/** Maps a classified failure onto the tRPC code the client observes. */
export function configurationReadSeamCode(
  failure: ConfigurationReadFailure,
): ConfigurationReadSeamCode {
  switch (failure.kind) {
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

/** UI outcome classes for the configuration screen. */
export type ConfigurationReadUiState = "forbidden" | "dependency" | "unknown";

/**
 * Maps a tRPC error code (from `error.data.code` on the client) onto the UI
 * outcome class. An absent code means the query failed before a tRPC response
 * existed (client/network failure), which is treated as a recoverable
 * dependency failure.
 */
export function configurationReadUiState(
  code: string | null | undefined,
): ConfigurationReadUiState {
  switch (code) {
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
export function isRetryableConfigurationReadUiState(
  state: ConfigurationReadUiState,
): boolean {
  return state === "dependency" || state === "unknown";
}
