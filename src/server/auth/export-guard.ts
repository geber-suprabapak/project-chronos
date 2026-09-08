import { NextResponse } from "next/server";
import { getLogtoContext } from "@logto/next/server-actions";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import {
  type AppRole,
  type AuthenticatedUser,
  canExportResource,
} from "~/server/auth/rbac";
import { getActiveRequestId } from "~/lib/astra/request-context";
import { writeOperationalEvent } from "~/lib/observability";

export type ExportResource =
  | "absences"
  | "perizinan"
  | "profiles"
  | "siswa"
  | "backup"
  | "monthlyAttendance";

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
  const recordAccess = (outcome: "success" | "failure", status: number) =>
    writeOperationalEvent({
      event: "export.access",
      outcome,
      requestId: getActiveRequestId() ?? undefined,
      path: resource,
      status,
    });

  try {
    const logtoContext = await getLogtoContext(logtoConfig);

    if (!logtoContext.isAuthenticated || !logtoContext.claims) {
      recordAccess("failure", 401);
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const claims = extractExtendedClaims(logtoContext.claims);
    if (isPasswordChangeRequired(claims)) {
      recordAccess("failure", 403);
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Password change required" },
          { status: 403 },
        ),
      };
    }

    const role = resolveLogtoRole(claims?.roles ?? []);
    if (!canExportResource(role, resource)) {
      recordAccess("failure", 403);
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

    recordAccess("success", 200);
    return { ok: true, user, role };
  } catch {
    recordAccess("failure", 401);
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}
