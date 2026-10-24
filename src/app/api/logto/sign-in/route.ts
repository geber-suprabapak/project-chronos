import { signIn } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logtoConfig } from "~/lib/logto/config";
import {
  classifyLogtoFailure,
  isDegradedLogtoOutcome,
} from "~/lib/logto/outcome";

export const dynamic = "force-dynamic";

/**
 * Initiates the OIDC sign-in flow. A failing identity provider (non-OK,
 * malformed, timeout/network during discovery) must not surface as an
 * unhandled 500 (C09): the failure is classified and routed to the
 * application-owned degraded state (`/auth/unavailable`) or, for a
 * provider-rejected session/account, back to the existing login route with
 * its established error banner. `signIn` performs its own navigation by
 * throwing a NEXT_REDIRECT error, which must propagate untouched.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawMode = searchParams.get("interactionMode");
  const interactionMode =
    rawMode === "signIn" || rawMode === "signUp" ? rawMode : undefined;

  try {
    await signIn(logtoConfig, {
      redirectUri: `${logtoConfig.baseUrl}/api/logto/callback`,
      interactionMode,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
      throw error;
    }
    const outcome = classifyLogtoFailure(error);
    if (isDegradedLogtoOutcome(outcome)) {
      return NextResponse.redirect(
        new URL("/auth/unavailable?from=/login", logtoConfig.baseUrl),
      );
    }
    return NextResponse.redirect(
      new URL(
        outcome.action === "forbidden_role"
          ? "/login?error=forbidden_role"
          : "/login?error=unauthorized",
        logtoConfig.baseUrl,
      ),
    );
  }
}
