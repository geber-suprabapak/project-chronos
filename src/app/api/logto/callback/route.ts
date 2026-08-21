import { getLogtoContext, handleSignIn } from "@logto/next/server-actions";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isAdminRole,
  isMfaVerified,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  await handleSignIn(logtoConfig, searchParams);

  const context = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  if (!context.isAuthenticated || !context.claims) {
    redirect("/login?error=unauthorized");
  }

  const claims = extractExtendedClaims(context.claims);
  if (isPasswordChangeRequired(claims)) {
    redirect("/ganti-password");
  }

  const rawRoles = claims?.roles ?? [];
  const resolvedRole = resolveLogtoRole(rawRoles);

  if (!resolvedRole || !isPrivilegedRole(resolvedRole)) {
    redirect("/login?error=forbidden_role");
  }

  if (isAdminRole(resolvedRole)) {
    const mfaOk = isMfaVerified(claims?.mfa_verified, claims?.amr);
    if (!mfaOk) {
      redirect("/login?error=mfa_required");
    }
  }

  redirect("/dashboard");
}
