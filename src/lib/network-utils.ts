/**
 * Shared utility functions for detecting and handling transient network errors
 */

/**
 * Detects whether an error is a transient network error that may succeed on retry.
 * Checks both error.code and error.message for common network error patterns.
 */
export function isTransientNetworkError(error: unknown): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";

  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|network|fetch failed/i.test(
    `${code} ${message}`,
  );
}
