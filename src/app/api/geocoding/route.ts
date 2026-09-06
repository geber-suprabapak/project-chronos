import { NextResponse } from "next/server";
import {
  executeGeocode,
  GeocodingError,
  type GeocodeResponsePayload,
  type GeocodeErrorPayload,
} from "~/server/geocoding/proxy";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { writeOperationalEvent } from "~/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";

  try {
    const { data, cached, deduplicated, durationMs } = await executeGeocode(q);

    const headers = new Headers();
    headers.set("X-Request-ID", requestId);
    headers.set("X-Cache", cached ? "HIT" : "MISS");
    headers.set(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=3600",
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
