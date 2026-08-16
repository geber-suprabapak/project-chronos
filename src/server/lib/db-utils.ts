/**
 * Detects whether an error is a transient database error that may succeed on retry.
 * Checks both error.code and error.message for common database error patterns.
 */
export function isTransientDbError(cause: unknown): boolean {
  if (!cause || !(cause instanceof Object)) return false;
  const msg = "message" in cause ? String(cause.message) : "";
  const code = "code" in cause ? String(cause.code) : "";
  return /ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated|socket/i.test(
    `${code} ${msg}`,
  );
}
