import { getLogtoContext, handleSignIn } from "@logto/next/server-actions";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // The authorization request registered this exact path. Construct it from
  // the configured public base URL instead of request.nextUrl: the app is
  // commonly reached through a tunnel or reverse proxy, whose internal host
  // must never become part of the authorization-code redirect URI.
  const callbackUrl = new URL("/api/logto/callback", logtoConfig.baseUrl);
  callbackUrl.search = request.nextUrl.search;
  await handleSignIn(logtoConfig, callbackUrl);

  const context = await getLogtoContext(logtoConfig);
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

  redirect("/dashboard");
}
