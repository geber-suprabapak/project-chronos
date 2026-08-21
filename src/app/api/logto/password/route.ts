import { getAccessToken, getLogtoContext } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env.js";
import { logtoConfig } from "~/lib/logto/config";

const passwordSchema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const context = await getLogtoContext(logtoConfig);
  if (!context.isAuthenticated || !context.claims?.sub) {
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

  let accessToken: string;
  try {
    accessToken = await getAccessToken(logtoConfig, env.LOGTO_RESOURCE);
  } catch {
    return NextResponse.json(
      { error: "Session is unavailable." },
      { status: 401 },
    );
  }

  const response = await fetch(`${env.ASTRA_API_URL}/v1/auth/password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Astra-Contract-Version": "v1",
    },
    body: JSON.stringify({ new_password: parsed.data.password }),
  });
  if (!response.ok) {
    // SAFETY: Astra returns its documented error envelope for non-success responses.
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      message?: string;
    } | null;
    return NextResponse.json(
      {
        error:
          body?.error?.message ?? body?.message ?? "Password update failed.",
      },
      { status: response.status },
    );
  }

  return NextResponse.json({ success: true });
}
