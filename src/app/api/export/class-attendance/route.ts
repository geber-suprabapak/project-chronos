import { NextResponse } from "next/server";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import { requireExportAccess } from "~/server/auth/export-guard";
import { getClassAttendanceSummary } from "~/server/attendance/daily-summary";
import { generateClassAttendanceExport } from "~/server/export/class-attendance";
import { sanitizeFilenameSegment } from "~/server/export/date-bounds";
import {
  PER_CLASS_STATUS_OPTIONS,
  resolvePerClassStatusRows,
  filterPerClassStatusRows,
} from "~/lib/attendance-status";
import { isDateOnlyValue } from "~/lib/date-utils";
import { AstraRequestError } from "~/lib/astra/client";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import { writeOperationalEvent } from "~/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  className: z.string().trim().min(1).max(255),
  date: z.string().refine(isDateOnlyValue),
  status: z.enum(PER_CLASS_STATUS_OPTIONS).optional(),
  query: z.string().trim().max(255).optional(),
  format: z.enum(["xlsx", "pdf"]),
});

export async function GET(request: Request) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const access = await requireExportAccess("absences");
  if (!access.ok) {
    access.response.headers.set("X-Request-ID", requestId);
    return access.response;
  }
  const headers = { "Cache-Control": "no-store", "X-Request-ID": requestId };
  const query = new URL(request.url).searchParams;
  const parsed = inputSchema.safeParse({
    className: query.get("className"),
    date: query.get("date"),
    status: query.get("status") || undefined,
    query: query.get("query") || undefined,
    format: (query.get("format") ?? "xlsx").toLowerCase(),
  });
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          "Kelas, tanggal YYYY-MM-DD, status atau format ekspor tidak valid.",
      },
      { status: 400, headers },
    );

  try {
    const input = parsed.data;
    const summary = await runWithRequestId(requestId, () =>
      getClassAttendanceSummary(input),
    );
    const rows = filterPerClassStatusRows(
      resolvePerClassStatusRows(summary.details),
      input.status ?? "",
      input.query ?? "",
    );
    const buffer = await generateClassAttendanceExport(rows, input);
    const filename = `absensi-perkelas-${sanitizeFilenameSegment(input.className)}-${input.date}.${input.format}`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type":
          input.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const status =
      error instanceof AstraRequestError
        ? error.status
        : error instanceof TRPCError
          ? getHTTPStatusCodeFromError(error)
          : 502;
    const message =
      error instanceof Error
        ? error.message
        : "Gagal mengekspor ringkasan absensi kelas.";
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/class-attendance",
      status,
      error: message,
    });
    return NextResponse.json({ error: message }, { status, headers });
  }
}
