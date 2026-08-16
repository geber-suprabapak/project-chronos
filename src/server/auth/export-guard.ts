import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  ADMIN_ROLES,
  PRIVILEGED_ROLES,
  type AppRole,
  hasRequiredRole,
  resolveUserRole,
} from "~/server/auth/rbac";

export type ExportResource = "absences" | "perizinan" | "profiles" | "siswa";

const EXPORT_ROLE_MAP = {
  absences: PRIVILEGED_ROLES,
  perizinan: PRIVILEGED_ROLES,
  profiles: ADMIN_ROLES,
  siswa: ADMIN_ROLES,
} as const satisfies Record<ExportResource, readonly AppRole[]>;

type ExportAccessResult =
  | { ok: true; user: User; role: AppRole }
  | { ok: false; response: NextResponse<{ error: string }> };

/**
 * Check if user can export a specific resource
 * Returns success result with user/role or error response
 */
export async function requireExportAccess(
  resource: ExportResource,
): Promise<ExportAccessResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const role = await resolveUserRole(db, user);
  const requiredRoles = EXPORT_ROLE_MAP[resource];

  if (!hasRequiredRole(role, requiredRoles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user, role };
}
