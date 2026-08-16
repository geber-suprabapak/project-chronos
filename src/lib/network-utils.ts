/**
 * Shared utility functions for detecting and handling transient network errors
 */

/**
 * Detects whether an error is a transient network error that may succeed on retry.
 * Checks both error.code and error.message for common network error patterns.
 */
export function isTransientNetworkError(cause: unknown): boolean {
  if (!cause || !(cause instanceof Object)) return false;
  const message = "message" in cause ? String(cause.message) : "";
  const code = "code" in cause ? String(cause.code) : "";

  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|network|fetch failed/i.test(
    `${code} ${message}`,
  );
}
