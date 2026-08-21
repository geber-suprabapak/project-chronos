import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isAdminRole,
  isMfaVerified,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";
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
  const requiredRoles = EXPORT_ROLE_MAP[resource];

  try {
    const logtoContext = await getLogtoContext(logtoConfig, {
      fetchUserInfo: true,
    });

    if (logtoContext.isAuthenticated && logtoContext.claims) {
      const claims = extractExtendedClaims(logtoContext.claims);
      if (isPasswordChangeRequired(claims)) {
        return {
          ok: false,
          response: NextResponse.json(
            { error: "Password change required" },
            { status: 403 },
          ),
        };
      }

      const rawRoles = claims?.roles ?? [];
      const role = resolveLogtoRole(rawRoles);

      if (!role || !isPrivilegedRole(role)) {
        return {
          ok: false,
          response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
      }

      if (isAdminRole(role)) {
        const mfaOk = isMfaVerified(claims?.mfa_verified, claims?.amr);
        if (!mfaOk) {
          return {
            ok: false,
            response: NextResponse.json(
              { error: "MFA verification required" },
              { status: 403 },
            ),
          };
        }
      }

      if (!hasRequiredRole(role, requiredRoles)) {
        return {
          ok: false,
          response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        };
      }

      // SAFETY: logtoContext userInfo contains standard OIDC email claim
      const fallbackEmail = logtoContext.userInfo?.email as string | undefined;
      const email = claims?.email ?? fallbackEmail ?? "";
      // SAFETY: logtoContext userInfo contains standard OIDC name claim
      const fullName = logtoContext.userInfo?.name as string | undefined;

      const user: User = {
        id: claims?.sub ?? "",
        email,
        app_metadata: { role },
        user_metadata: {
          full_name: fullName ?? email,
        },
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };

      return {
        ok: true,
        user,
        role,
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[requireExportAccess] Logto check failed, falling back:",
        err,
      );
    }
  }

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

  if (!hasRequiredRole(role, requiredRoles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, user, role };
}
