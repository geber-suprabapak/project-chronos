import { NextResponse, type NextRequest } from "next/server";
import { requireExportAccess } from "~/server/auth/export-guard";
import { astraRequest, AstraRequestError } from "~/lib/astra/client";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import {
  isValidYearMonth,
  validateAstraBackupStatusResponse,
  type AstraBackupStatusCandidate,
} from "~/server/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));

  // 1. Authorize: Admin only via requireExportAccess("backup")
  const access = await requireExportAccess("backup");
  if (!access.ok) {
    access.response.headers.set("X-Request-ID", requestId);
    return access.response;
  }

  // 2. Parse and require valid query parameters at Chronos boundary
  const { searchParams } = new URL(request.url);
  const monthParam =
    searchParams.get("year_month") ?? searchParams.get("month");

  if (!monthParam || !isValidYearMonth(monthParam)) {
    return NextResponse.json(
      {
        error:
          "Parameter 'month' atau 'year_month' wajib diisi dengan format YYYY-MM yang valid (contoh: 2026-09, tahun 1000-9999).",
      },
      {
        status: 400,
        headers: {
          "X-Request-ID": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const queryParams = new URLSearchParams();
  queryParams.set("year_month", monthParam);
  queryParams.set("scope", "absences");

  const astraPath = `/v1/admin/backups/status?${queryParams.toString()}`;

  try {
    const rawData = await runWithRequestId(requestId, () =>
      astraRequest<AstraBackupStatusCandidate>(astraPath),
    );

    const validation = validateAstraBackupStatusResponse(rawData, monthParam);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: validation.error,
          details: validation.details,
        },
        {
          status: validation.statusCode,
          headers: {
            "X-Request-ID": requestId,
            "Cache-Control": "no-store",
          },
        },
      );
    }

    return NextResponse.json(validation.data, {
      status: 200,
      headers: {
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // CRITICAL: "never turns outage into completed false."
    // Any backend Astra outage or failure must fail honestly with an error status (502 / 500)
    // rather than faking completed: false.
    const statusCode =
      error instanceof AstraRequestError && error.status >= 400
        ? error.status
        : 502;
    const message =
      error instanceof Error
        ? error.message
        : "Layanan Astra backup status tidak tersedia";

    return NextResponse.json(
      {
        error: "Layanan Astra backup status mengalami gangguan",
        details: message,
      },
      {
        status: statusCode,
        headers: {
          "X-Request-ID": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
