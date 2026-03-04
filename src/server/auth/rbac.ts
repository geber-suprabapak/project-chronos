import type { User } from "@supabase/supabase-js";
import type { db as appDb } from "~/server/db";
import { extractRoleFromAppMetadata } from "~/lib/jwt";

export const APP_ROLES = [
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
  "siswa",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const PRIVILEGED_ROLES: readonly AppRole[] = [
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
];

export const ADMIN_ROLES: readonly AppRole[] = ["admin", "kepala_sekolah"];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

/**
 * Read role from user JWT claims (app_metadata)
 */
export function readRoleFromUserClaims(user: User): AppRole | null {
  const role = extractRoleFromAppMetadata(user.app_metadata);
  return role && isAppRole(role) ? role : null;
}

export async function readRoleFromDb(
  db: typeof appDb,
  userId: string,
): Promise<AppRole | null> {
  const profile = await db.query.userProfiles.findFirst({
    columns: { role: true },
    where: (table, { eq }) => eq(table.userId, userId),
  });

  return isAppRole(profile?.role) ? profile.role : null;
}

/**
 * Resolve user role from claims, then database, defaulting to "siswa"
 */
export async function resolveUserRole(
  db: typeof appDb,
  user: User,
): Promise<AppRole> {
  const claimRole = readRoleFromUserClaims(user);
  if (claimRole) return claimRole;

  const dbRole = await readRoleFromDb(db, user.id);
  return dbRole ?? "siswa";
}

/**
 * Check if a role has required privileges
 */
export function hasRequiredRole(
  role: AppRole,
  allowed: readonly AppRole[],
): boolean {
  return allowed.includes(role);
}
