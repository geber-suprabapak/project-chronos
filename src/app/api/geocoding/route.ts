import { NextResponse } from "next/server";
import { getLogtoContext } from "@logto/next/server-actions";
import {
  executeGeocode,
  GeocodingError,
  type GeocodeResponsePayload,
  type GeocodeErrorPayload,
} from "~/server/geocoding/proxy";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { writeOperationalEvent } from "~/lib/observability";
import { logtoConfig } from "~/lib/logto/config";
import {
  extractExtendedClaims,
  isPasswordChangeRequired,
  resolveLogtoRole,
} from "~/lib/logto/claims";
import { canAccessConfiguration } from "~/server/auth/rbac";

export const dynamic = "force-dynamic";

async function authorizeGeocodeRequest(
  requestId: string,
): Promise<NextResponse | null> {
  const denied = (status: 401 | 403, error: string, code: string) => {
    writeOperationalEvent({
      event: "http.request",
      outcome: "failure",
      requestId,
      path: "/api/geocoding",
      status,
      code,
      error,
    });
    return NextResponse.json(
      { success: false, error, code },
      {
        status,
        headers: {
          "X-Request-ID": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  };

  let logtoContext;
  try {
    logtoContext = await getLogtoContext(logtoConfig);
  } catch {
    return denied(401, "Unauthorized", "UNAUTHORIZED");
  }

  if (!logtoContext.isAuthenticated || !logtoContext.claims) {
    return denied(401, "Unauthorized", "UNAUTHORIZED");
  }

  const claims = extractExtendedClaims(logtoContext.claims);
  if (isPasswordChangeRequired(claims)) {
    return denied(403, "Password change required", "FORBIDDEN");
  }

  const role = resolveLogtoRole(claims?.roles ?? []);
  if (!canAccessConfiguration(role)) {
    return denied(403, "Forbidden", "FORBIDDEN");
  }

  return null;
}

export async function GET(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const authError = await authorizeGeocodeRequest(requestId);
  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  try {
    const { data, cached, deduplicated, durationMs } = await executeGeocode(q);

    const headers = new Headers();
    headers.set("X-Request-ID", requestId);
    headers.set("X-Cache", cached ? "HIT" : "MISS");
    headers.set(
      "Cache-Control",
      "private, max-age=86400, stale-while-revalidate=3600",
    );
    if (deduplicated) {
      headers.set("X-Deduplicated", "true");
    }

    const payload: GeocodeResponsePayload = {
      success: true,
      data,
      meta: {
        query: q.trim(),
        count: data.length,
        cached,
        deduplicated,
        durationMs,
      },
    };

    return NextResponse.json(payload, {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof GeocodingError) {
      writeOperationalEvent({
        event: "http.request",
        outcome: "failure",
        requestId,
        path: "/api/geocoding",
        status: error.statusCode,
        code: error.code,
        error: error.message,
      });

      const responseHeaders = new Headers();
      responseHeaders.set("X-Request-ID", requestId);
      if (error.retryAfter !== undefined) {
        responseHeaders.set("Retry-After", String(error.retryAfter));
      }

      const errorBody: GeocodeErrorPayload = {
        success: false,
        error: error.message,
        code: error.code,
      };
      if (error.retryAfter !== undefined) {
        errorBody.retryAfter = error.retryAfter;
      }

      return NextResponse.json(errorBody, {
        status: error.statusCode,
        headers: responseHeaders,
      });
    }

    const message =
      error instanceof Error ? error.message : "Kesalahan server tidak dikenal";
    writeOperationalEvent({
      event: "http.request",
      outcome: "failure",
      requestId,
      path: "/api/geocoding",
      status: 500,
      error: message,
    });

    const errorHeaders = new Headers();
    errorHeaders.set("X-Request-ID", requestId);

    return NextResponse.json(
      {
        success: false,
        error: "Terjadi kesalahan internal pada layanan geocoding.",
        code: "INTERNAL_SERVER_ERROR",
      },
      {
        status: 500,
        headers: errorHeaders,
      },
    );
  }
}
