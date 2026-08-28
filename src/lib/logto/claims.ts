import type { IdTokenClaims } from "@logto/next";
import type { AppRole } from "~/server/auth/rbac";

export type ExtendedLogtoClaims = IdTokenClaims & {
  readonly roles?: readonly string[];
  readonly must_change_password?: boolean | string | number | null;
};

export function extractExtendedClaims(
  claims: IdTokenClaims | null | undefined,
): ExtendedLogtoClaims | null {
  if (!claims) return null;
  // SAFETY: Logto ID token claims include standard OIDC claims and custom platform claims
  return claims as ExtendedLogtoClaims;
}

export function isPasswordChangeRequired(
  claims:
    | { readonly must_change_password?: boolean | string | number | null }
    | null
    | undefined,
): boolean {
  const value = claims?.must_change_password;
  return (
    value === true ||
    value === 1 ||
    value === "true" ||
    value === "1" ||
    value === "yes"
  );
}

const ROLE_PRIORITY: readonly AppRole[] = [
  "platform_admin",
  "school_admin",
  "admin",
  "kepala_sekolah",
  "wali_kelas",
  "teacher",
  "guru",
  "staff",
  "student",
  "siswa",
];

export function resolveLogtoRole(
  roles?: readonly string[] | null,
): AppRole | null {
  if (!roles || roles.length === 0) return null;

  for (const candidate of ROLE_PRIORITY) {
    if (roles.includes(candidate)) {
      return candidate;
    }
  }

  return null;
}

const PRIVILEGED_SET = new Set<string>([
  "platform_admin",
  "school_admin",
  "teacher",
  "staff",
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
]);

export function isPrivilegedRole(role: string | null | undefined): boolean {
  return role != null && PRIVILEGED_SET.has(role);
}

const ADMIN_SET = new Set<string>([
  "platform_admin",
  "school_admin",
  "admin",
  "kepala_sekolah",
]);

export function isAdminRole(role: string | null | undefined): boolean {
  return role != null && ADMIN_SET.has(role);
}
