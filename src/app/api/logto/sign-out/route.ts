import { signOut } from "@logto/next/server-actions";
import type { NextRequest } from "next/server";
import { logtoConfig } from "~/lib/logto/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const postLogoutRedirectUri =
    searchParams.get("redirect") ?? `${logtoConfig.baseUrl}/login`;

  await signOut(logtoConfig, postLogoutRedirectUri);
}
