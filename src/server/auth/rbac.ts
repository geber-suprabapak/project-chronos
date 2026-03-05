import type { User } from "@supabase/supabase-js";
import { db as appDb } from "~/server/db";
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

function isTransientDbError(error: unknown): boolean {
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

// ---------------------------------------------------------------------------
// In-memory role cache – avoids DB round-trip on every tRPC call.
// Entries expire after ROLE_CACHE_TTL_MS.  Cache is per-process (fine for
// single-instance dev / small prod deployments).
// ---------------------------------------------------------------------------
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedRole {
  role: AppRole;
  expiresAt: number;
}

const roleCache = new Map<string, CachedRole>();

function getCachedRole(userId: string): AppRole | null {
  const entry = roleCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    roleCache.delete(userId);
    return null;
  }
  return entry.role;
}

function setCachedRole(userId: string, role: AppRole): void {
  roleCache.set(userId, { role, expiresAt: Date.now() + ROLE_CACHE_TTL_MS });
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

const isDev = process.env.NODE_ENV === "development";

/**
 * Resolve user role from:  JWT claims → in-memory cache → database.
 * Caches successful DB lookups for 5 min to survive transient DB outages.
 * Retries once on transient DB errors; throws instead of silently defaulting.
 */
export async function resolveUserRole(
  db: typeof appDb,
  user: User,
): Promise<AppRole> {
  // 1. JWT claims (instant, no DB)
  const claimRole = readRoleFromUserClaims(user);
  if (claimRole) {
    if (isDev) console.log(`[RBAC] ${user.id} role from JWT: ${claimRole}`);
    return claimRole;
  }

  // 2. In-memory cache
  const cached = getCachedRole(user.id);
  if (cached) {
    if (isDev) console.log(`[RBAC] ${user.id} role from cache: ${cached}`);
    return cached;
  }

  // 3. Database lookup (with retry on transient errors)
  if (isDev) console.log(`[RBAC] ${user.id} JWT has no role, querying DB…`);

  try {
    const dbRole = await readRoleFromDb(db, user.id);
    if (dbRole) {
      setCachedRole(user.id, dbRole);
      if (isDev) console.log(`[RBAC] ${user.id} role from DB: ${dbRole}`);
      return dbRole;
    }
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    console.warn(
      `[RBAC] Transient DB error resolving role for ${user.id}, retrying…`,
      error instanceof Error ? error.message : error,
    );
    try {
      const dbRole = await readRoleFromDb(db, user.id);
      if (dbRole) {
        setCachedRole(user.id, dbRole);
        if (isDev) console.log(`[RBAC] ${user.id} role from DB (retry): ${dbRole}`);
        return dbRole;
      }
    } catch (retryError) {
      console.error(
        `[RBAC] Role resolution failed after retry for ${user.id}`,
        retryError instanceof Error ? retryError.message : retryError,
      );
      throw retryError;
    }
  }

  // 4. No profile row found – genuine default
  if (isDev)
    console.warn(
      `[RBAC] ${user.id} no role in JWT, cache, or DB → defaulting to siswa`,
    );
  return "siswa";
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
