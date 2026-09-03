import { NextResponse } from "next/server";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import {
  ADMIN_ROLES,
  PRIVILEGED_ROLES,
  type AppRole,
  type AuthenticatedUser,
  hasRequiredRole,
} from "~/server/auth/rbac";

export type ExportResource = "absences" | "perizinan" | "profiles" | "siswa";

const EXPORT_ROLE_MAP = {
  absences: PRIVILEGED_ROLES,
  perizinan: PRIVILEGED_ROLES,
  profiles: ADMIN_ROLES,
  siswa: ADMIN_ROLES,
} as const satisfies Record<ExportResource, readonly AppRole[]>;

type ExportAccessResult =
  | { ok: true; user: AuthenticatedUser; role: AppRole }
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
    const logtoContext = await getLogtoContext(logtoConfig);

    if (!logtoContext.isAuthenticated || !logtoContext.claims) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

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

    const role = resolveLogtoRole(claims?.roles ?? []);
    if (!role || !isPrivilegedRole(role)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    if (!hasRequiredRole(role, requiredRoles)) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }

    // SAFETY: Logto user info fields are standard optional OIDC string claims.
    const fallbackEmail = logtoContext.userInfo?.email as string | undefined;
    const email = claims?.email ?? fallbackEmail ?? "";
    // SAFETY: Logto user info name is the optional OIDC display-name claim.
    const fallbackName = logtoContext.userInfo?.name as string | undefined;
    const fullName = claims?.name ?? fallbackName;
    const user: AuthenticatedUser = {
      id: claims?.sub ?? "",
      email,
      app_metadata: { role },
      user_metadata: { full_name: fullName ?? email },
    };

    return { ok: true, user, role };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}
