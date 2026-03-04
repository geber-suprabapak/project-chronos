/**
 * JWT utilities for safe token parsing and claim extraction
 */

type JwtClaims = Record<string, unknown>;

type AppMetadataClaims = {
  role?: unknown;
  roles?: unknown;
};

/**
 * Safely decode JWT payload without validation (for claims only)
 * Does NOT verify signature - only for reading claims in trusted context
 */
export function decodeJwtPayload(
  token: string | null | undefined,
): JwtClaims | null {
  if (!token || typeof token !== "string") return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Standard base64url decoding with padding
    const payloadPart = parts[1];
    if (!payloadPart) return null;

    const base64 = payloadPart
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(payloadPart.length + ((4 - (payloadPart.length % 4)) % 4), "=");

    const decoded = atob(base64);
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * Extract role from app_metadata object.
 */
export function extractRoleFromAppMetadata(
  appMetadata: unknown,
): string | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;

  const appMeta = appMetadata as AppMetadataClaims;

  if (typeof appMeta.role === "string") return appMeta.role;

  if (Array.isArray(appMeta.roles)) {
    const role = appMeta.roles.find(
      (r: unknown): r is string => typeof r === "string",
    );
    if (role) return role;
  }

  return null;
}

/**
 * Extract role from JWT app_metadata claim
 * Tries both single role and roles array
 */
export function extractRoleFromClaims(
  payload: JwtClaims | null,
): string | null {
  if (!payload) return null;
  return extractRoleFromAppMetadata(payload.app_metadata);
}

/**
 * Extract role directly from access token
 */
export function extractRoleFromAccessToken(
  accessToken: string | null | undefined,
): string | null {
  const payload = decodeJwtPayload(accessToken);
  return extractRoleFromClaims(payload);
}
