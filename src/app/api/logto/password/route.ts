import { getAccessToken, getLogtoContext } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "~/env.js";
import {
  buildAstraContractHeaders,
  createAstraRequestId,
  getAstraResponseRequestId,
} from "~/lib/astra/request-id";
import { logtoConfig } from "~/lib/logto/config";

const passwordSchema = z.object({ password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));

  const context = await getLogtoContext(logtoConfig);
  if (!context.isAuthenticated || !context.claims?.sub) {
    return NextResponse.json(
      { error: "Unauthorized", request_id: requestId },
      { status: 401, headers: { "X-Request-ID": requestId } },
    );
  }

  const parsed = passwordSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Password must be 8-128 characters.",
        request_id: requestId,
      },
      { status: 400, headers: { "X-Request-ID": requestId } },
    );
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(logtoConfig, env.LOGTO_RESOURCE);
  } catch {
    return NextResponse.json(
      { error: "Session is unavailable.", request_id: requestId },
      { status: 401, headers: { "X-Request-ID": requestId } },
    );
  }

  const { headers } = buildAstraContractHeaders(
    {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    requestId,
  );

  const response = await fetch(`${env.ASTRA_API_URL}/v1/auth/password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ new_password: parsed.data.password }),
  });
  const responseRequestId = getAstraResponseRequestId(response, requestId);
  if (
    !response.ok ||
    response.headers.get("X-Astra-Contract-Version") !== "v1"
  ) {
    if (response.ok) {
      return NextResponse.json(
        {
          error: "Password contract is unavailable or incompatible.",
          request_id: responseRequestId,
        },
        { status: 502, headers: { "X-Request-ID": responseRequestId } },
      );
    }
    // SAFETY: Astra returns its documented error envelope for non-success responses.
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      message?: string;
    } | null;
    return NextResponse.json(
      {
        error:
          body?.error?.message ?? body?.message ?? "Password update failed.",
        request_id: responseRequestId,
      },
      {
        status: response.status,
        headers: { "X-Request-ID": responseRequestId },
      },
    );
  }

  return NextResponse.json(
    { success: true, request_id: responseRequestId },
    { headers: { "X-Request-ID": responseRequestId } },
  );
}
