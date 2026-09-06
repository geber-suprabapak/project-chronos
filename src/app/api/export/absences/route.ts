import { NextResponse, type NextRequest } from "next/server";
import { requireExportAccess } from "~/server/auth/export-guard";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import { isDateOnlyValue } from "~/lib/date-utils";
import {
  buildAttendanceArtifact,
  collectAuthoritativeAttendanceRows,
  hasOrderedDateBounds,
  sanitizeFilenameSegment,
  type ExportFormat,
} from "~/server/export";
import { writeOperationalEvent } from "~/lib/observability";

// Ensure fresh data on each request
export const dynamic = "force-dynamic";
// Excel and PDF generation requires Node.js runtime
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const access = await requireExportAccess("absences");
  if (!access.ok) {
    access.response.headers.set("X-Request-ID", requestId);
    return access.response;
  }

  // Get filter and format params from query
  const { searchParams } = new URL(request.url);
  const className = searchParams.get("className");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const formatParam = (searchParams.get("format") ?? "xlsx").toLowerCase();

  // Validate format
  if (formatParam !== "xlsx" && formatParam !== "pdf") {
    return NextResponse.json(
      { error: "Format ekspor tidak didukung. Pilih 'xlsx' atau 'pdf'." },
      {
        status: 400,
        headers: {
          "X-Request-ID": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // Validate real YYYY-MM-DD date format
  if (startDate && !isDateOnlyValue(startDate)) {
    return NextResponse.json(
      {
        error:
          "Parameter 'startDate' harus berformat tanggal YYYY-MM-DD yang valid.",
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

  if (endDate && !isDateOnlyValue(endDate)) {
    return NextResponse.json(
      {
        error:
          "Parameter 'endDate' harus berformat tanggal YYYY-MM-DD yang valid.",
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

  // Reject reversed bounds before querying
  if (!hasOrderedDateBounds(startDate, endDate)) {
    return NextResponse.json(
      {
        error:
          "Rentang tanggal tidak valid: 'startDate' tidak boleh lebih besar dari 'endDate'.",
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
    const rows = await runWithRequestId(requestId, () =>
      collectAuthoritativeAttendanceRows({
        className,
        startDate,
        endDate,
      }),
    );

    const safeClass =
      className && className !== "ALL"
        ? sanitizeFilenameSegment(className)
        : "";
    const filenameSuffix = safeClass ? `-${safeClass}` : "";
    const title = `Data Absensi${className && className !== "ALL" ? ` Kelas ${className}` : ""}`;

    const artifact = await buildAttendanceArtifact(rows, {
      format,
      filenamePrefix: `absensi${filenameSuffix}`,
      title,
    });

    return new NextResponse(new Uint8Array(artifact.buffer), {
      status: 200,
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengekspor data absensi";
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/absences",
      status: 500,
      error: message,
    });
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "X-Request-ID": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
