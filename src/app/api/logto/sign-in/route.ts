import { signIn } from "@logto/next/server-actions";
import type { NextRequest } from "next/server";
import { logtoConfig } from "~/lib/logto/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawMode = searchParams.get("interactionMode");
  const interactionMode =
    rawMode === "signIn" || rawMode === "signUp" ? rawMode : undefined;

  await signIn(logtoConfig, {
    redirectUri: `${logtoConfig.baseUrl}/api/logto/callback`,
    interactionMode,
  });
}
