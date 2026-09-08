import { NextResponse, type NextRequest } from "next/server";
import { AstraRequestError } from "~/lib/astra/client";
import { createAstraRequestId } from "~/lib/astra/request-id";
import { runWithRequestId } from "~/lib/astra/request-context";
import { requireExportAccess } from "~/server/auth/export-guard";
import {
  aggregateMonthlyAttendance,
  type MonthlyRecapInput,
} from "~/server/attendance/monthly-recap";
import {
  fetchMonthlyRecapSources,
  monthlyAttendanceInput,
} from "~/server/api/routers/monthly-attendance";
import {
  generateMonthlyAttendanceXlsx,
  MONTHLY_ATTENDANCE_MIME_TYPE,
} from "~/server/export";
import { sanitizeFilenameSegment } from "~/server/export/date-bounds";
import { writeOperationalEvent } from "~/lib/observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function queryValue(value: string | null): string | undefined {
  const trimmed = value?.trim() ?? "";
  return trimmed || undefined;
}

export async function GET(request: NextRequest) {
  const requestId = createAstraRequestId(request.headers.get("X-Request-ID"));
  const access = await requireExportAccess("monthlyAttendance");
  if (!access.ok) {
    access.response.headers.set("X-Request-ID", requestId);
    return access.response;
  }

  const { searchParams } = new URL(request.url);
  const parsed = monthlyAttendanceInput.safeParse({
    month: queryValue(searchParams.get("month")) ?? "",
    academicPeriodId: queryValue(searchParams.get("academicPeriodId")),
    className: queryValue(searchParams.get("className")),
    studentId: queryValue(searchParams.get("studentId")),
    userId: queryValue(searchParams.get("userId")),
    nis: queryValue(searchParams.get("nis")),
  });
  if (!parsed.success) {
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

  try {
    const result = await runWithRequestId(requestId, async () => {
      const sources = await fetchMonthlyRecapSources(
        parsed.data.month,
        parsed.data.academicPeriodId,
      );
      const input: MonthlyRecapInput = {
        ...sources,
        month: parsed.data.month,
        className: parsed.data.className,
        studentId: parsed.data.studentId,
        userId: parsed.data.userId,
        nis: parsed.data.nis,
      };
      return aggregateMonthlyAttendance(input);
    });
    const buffer = await generateMonthlyAttendanceXlsx(result, parsed.data);
    const filename = `rekap-absensi-bulanan-${sanitizeFilenameSegment(result.month)}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": MONTHLY_ATTENDANCE_MIME_TYPE,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal mengekspor rekap absensi bulanan";
    const status = error instanceof AstraRequestError ? error.status : 502;
    writeOperationalEvent({
      event: "export.failure",
      outcome: "failure",
      requestId,
      path: "/api/export/monthly-attendance",
      status,
      error: message,
    });
    return NextResponse.json(
      { error: message },
      {
        status,
        headers: {
          "X-Request-ID": requestId,
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
