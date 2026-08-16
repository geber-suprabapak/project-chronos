/**
 * JWT utilities for safe token parsing and claim extraction
 */

export type AppMetadataClaims = {
  readonly role?: string | null;
  readonly roles?: readonly string[] | null;
};

export type JwtClaims = {
  readonly sub?: string;
  readonly email?: string;
  readonly role?: string;
  readonly app_metadata?: AppMetadataClaims | null;
  readonly exp?: number;
  readonly iat?: number;
  readonly aud?: string | readonly string[];
  readonly iss?: string;
};

/**
 * Safely decode JWT payload without validation (for claims only)
 * Does NOT verify signature - only for reading claims in trusted context
 */
export function decodeJwtPayload(
  token: string | null | undefined,
): JwtClaims | null {
  if (!token) return null;

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
    // SAFETY: JSON payload of decoded JWT matches JwtClaims structure
    return JSON.parse(decoded) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * Extract role from app_metadata object.
 */
export function extractRoleFromAppMetadata(
  appMetadata: AppMetadataClaims | null | undefined,
): string | null {
  if (!appMetadata) return null;

  if (appMetadata.role) return appMetadata.role;

  if (Array.isArray(appMetadata.roles)) {
    const role = appMetadata.roles.find((r): r is string => Boolean(r));
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
