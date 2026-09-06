import { NextResponse, type NextRequest } from "next/server";
import { requireExportAccess } from "~/server/auth/export-guard";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import {
  isValidYearMonth,
  performMonthlyBackup,
  type ExportFormat,
} from "~/server/export";
import { writeOperationalEvent } from "~/lib/observability";

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

  // 2. Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const formatParam = (searchParams.get("format") ?? "xlsx").toLowerCase();

  if (!month || !isValidYearMonth(month)) {
    return NextResponse.json(
      {
        error:
          "Parameter 'month' wajib berformat YYYY-MM yang valid (contoh: 2026-09).",
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

  if (formatParam !== "xlsx" && formatParam !== "pdf") {
    return NextResponse.json(
      {
        error: "Format ekspor tidak didukung. Pilih 'xlsx' atau 'pdf'.",
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

  // SAFETY: formatParam was validated against the allowed ExportFormat values above.
  const format = formatParam as ExportFormat;

  try {
    // 3. Generate authoritative backup and persist completed audit through Astra
    // Fail closed: if audit persistence fails, an exception is thrown
    const { artifact } = await runWithRequestId(requestId, () =>
      performMonthlyBackup({
        month,
        format,
      }),
    );

    // 4. Return downloadable file response with verified checksum header
    return new NextResponse(new Uint8Array(artifact.buffer), {
      status: 200,
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "X-Backup-Checksum": artifact.sha256,
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses backup bulanan";
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/backup",
      status: 502,
      error: message,
    });
    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 502,
        headers: {
          "X-Request-ID": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
