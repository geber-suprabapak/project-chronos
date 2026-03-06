/**
 * Shared utility functions for detecting and handling transient database errors
 */

/**
 * Detects whether an error is a transient database error that may succeed on retry.
 * Checks both error.code and error.message for common database error patterns.
 */
export function isTransientDbError(error: unknown): boolean {
  const msg =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated|socket/i.test(
    `${code} ${msg}`,
  );
}
