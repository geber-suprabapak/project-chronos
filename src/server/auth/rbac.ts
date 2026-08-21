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

export {
  isMfaVerified,
  isPasswordChangeRequired,
  resolveLogtoRole,
  isPrivilegedRole,
  isAdminRole,
  isMfaRequired,
} from "~/lib/logto/claims";
