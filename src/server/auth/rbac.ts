import {
  isPasswordChangeRequired,
  resolveLogtoRole,
  isPrivilegedRole,
  isAdminRole,
  extractExtendedClaims,
} from "../../lib/logto/claims.ts";

export const APP_ROLES = [
  "platform_admin",
  "school_admin",
  "teacher",
  "staff",
  "student",
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
  "siswa",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PRIVILEGED_ROLES: readonly AppRole[] = [
  "platform_admin",
  "school_admin",
  "teacher",
  "staff",
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
];

export const ADMIN_ROLES: readonly AppRole[] = [
  "platform_admin",
  "school_admin",
  "admin",
  "kepala_sekolah",
];

const VALID_APP_ROLES: ReadonlySet<string> = new Set<string>(APP_ROLES);

export function isAppRole(value: string | null | undefined): value is AppRole {
  return value != null && VALID_APP_ROLES.has(value);
}

export type AuthenticatedUser = {
  readonly id: string;
  readonly email?: string;
  readonly app_metadata?: { readonly role?: string | null } | null;
  readonly user_metadata?: {
    readonly full_name?: string;
    readonly avatar_url?: string;
    readonly [key: string]: string | undefined;
  } | null;
};

/**
 * Check if a role has required privileges
 */
export function hasRequiredRole(
  role: AppRole,
  allowed: readonly AppRole[],
): boolean {
  return allowed.includes(role);
}

export type CanonicalRole =
  "platform_admin" | "school_admin" | "teacher" | "staff" | "student";

export const CANONICAL_APP_ROLES: readonly CanonicalRole[] = [
  "platform_admin",
  "school_admin",
  "teacher",
  "staff",
  "student",
];

export const ROLE_ALIAS_MAP = {
  admin: "school_admin",
  kepala_sekolah: "school_admin",
  guru: "teacher",
  wali_kelas: "teacher",
  siswa: "student",
} as const satisfies Record<string, CanonicalRole>;

/**
 * Returns canonical role for a given role (resolves legacy aliases).
 */
export function toCanonicalRole(role: AppRole): CanonicalRole {
  if (role in ROLE_ALIAS_MAP) {
    // SAFETY: Verified by the `role in ROLE_ALIAS_MAP` branch check.
    return ROLE_ALIAS_MAP[role as keyof typeof ROLE_ALIAS_MAP];
  }
  // SAFETY: If role is not in ROLE_ALIAS_MAP, it is already one of CANONICAL_APP_ROLES.
  return role as CanonicalRole;
}

/**
 * RBAC Action Capability Predicates (Issue 04 Matrix)
 */
export function canAccessConfiguration(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isAdminRole(role);
}

export function canAccessProfiles(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isAdminRole(role);
}

export function canManageManualAttendance(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isAdminRole(role);
}

export function canDeleteAttendance(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isAdminRole(role);
}

export function canPerformMonthlyBackup(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isAdminRole(role);
}

export function canExportResource(
  role: AppRole | null | undefined,
  resource: "absences" | "perizinan" | "profiles" | "siswa" | "backup",
): role is AppRole {
  if (!role || !isPrivilegedRole(role)) return false;
  if (resource === "profiles" || resource === "backup") {
    return isAdminRole(role);
  }
  return true;
}

export function canUploadFiles(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isPrivilegedRole(role);
}

export function canAccessSiswa(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isPrivilegedRole(role);
}

export function canAccessAbsensi(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isPrivilegedRole(role);
}

export function canAccessPerizinan(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isPrivilegedRole(role);
}

export function canAccessDashboard(
  role: AppRole | null | undefined,
): role is AppRole {
  return role != null && isPrivilegedRole(role);
}

export {
  isPasswordChangeRequired,
  resolveLogtoRole,
  isPrivilegedRole,
  isAdminRole,
  extractExtendedClaims,
};
