import { getLogtoContext, handleSignIn } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  isPrivilegedRole,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import {
  classifyLogtoFailure,
  isDegradedLogtoOutcome,
} from "~/lib/logto/outcome";

export const dynamic = "force-dynamic";

/**
 * Completes the OIDC sign-in flow. A failing identity provider during the
 * token exchange (non-OK, malformed, timeout/network) must not surface as an
 * unhandled 500 (C09): the failure is classified — 401/`invalid_grant`
 * (expired or rejected session) keeps the existing unauthorized login route,
 * 403 keeps the forbidden route, and every provider-side failure routes to
 * the application-owned degraded state (`/auth/unavailable`). The internal
 * `redirect()` calls throw NEXT_REDIRECT errors, which must propagate
 * untouched.
 */
export async function GET(request: NextRequest) {
  // The authorization request registered this exact path. Construct it from
  // the configured public base URL instead of request.nextUrl: the app is
  // commonly reached through a tunnel or reverse proxy, whose internal host
  // must never become part of the authorization-code redirect URI.
  const callbackUrl = new URL("/api/logto/callback", logtoConfig.baseUrl);
  callbackUrl.search = request.nextUrl.search;

  try {
    await handleSignIn(logtoConfig, callbackUrl);
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("NEXT_REDIRECT")) {
      throw cause;
    }
    return redirectForLogtoOutcome(cause, logtoConfig.baseUrl);
  }

  try {
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
  } catch (cause) {
    if (cause instanceof Error && cause.message.includes("NEXT_REDIRECT")) {
      throw cause;
    }
    return redirectForLogtoOutcome(cause, logtoConfig.baseUrl);
  }
}

// Outcome redirects use the configured public base URL, mirroring
// callbackUrl above: request.nextUrl.origin can resolve to the internal
// bind address under `next start`, and a cross-host redirect would split the
// browser's session cookies (observed as `callback_uri_verification.
// state_mismatched` on the sign-in retry).
function redirectForLogtoOutcome(cause: unknown, baseUrl: string) {
  const outcome = classifyLogtoFailure(cause);
  if (isDegradedLogtoOutcome(outcome)) {
    return NextResponse.redirect(
      new URL("/auth/unavailable?from=/login", baseUrl),
    );
  }
  return NextResponse.redirect(
    new URL(
      outcome.action === "forbidden_role"
        ? "/login?error=forbidden_role"
        : "/login?error=unauthorized",
      baseUrl,
    ),
  );
}
