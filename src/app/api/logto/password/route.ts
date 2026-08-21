import { getLogtoContext } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env.js";
import { logtoConfig } from "~/lib/logto/config";

const passwordSchema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const context = await getLogtoContext(logtoConfig);
  const userId = context.claims?.sub;
  if (!context.isAuthenticated || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = passwordSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Password must be 8-128 characters." },
      { status: 400 },
    );
  }
  if (!env.LOGTO_MANAGEMENT_APP_ID || !env.LOGTO_MANAGEMENT_APP_SECRET) {
    return NextResponse.json(
      { error: "Password management is not configured." },
      { status: 503 },
    );
  }

  const tokenResponse = await fetch(`${env.LOGTO_ENDPOINT}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: env.LOGTO_MANAGEMENT_APP_ID,
      client_secret: env.LOGTO_MANAGEMENT_APP_SECRET,
      resource: "https://default.logto.app/api",
      scope: "all",
    }),
  });
  if (!tokenResponse.ok) {
    return NextResponse.json(
      { error: "Identity provider is unavailable." },
      { status: 502 },
    );
  }
  // SAFETY: A successful token response is decoded only for the optional access_token field.
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) {
    return NextResponse.json(
      { error: "Identity provider returned no management token." },
      { status: 502 },
    );
  }

  const updateResponse = await fetch(
    `${env.LOGTO_ENDPOINT}/api/users/${encodeURIComponent(userId)}/password`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: parsed.data.password }),
    },
  );
  if (!updateResponse.ok) {
    return NextResponse.json(
      { error: "Password update failed." },
      { status: updateResponse.status },
    );
  }

  return NextResponse.json({ success: true });
}
