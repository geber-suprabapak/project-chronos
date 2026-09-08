import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { AstraRequestError, astraRequestEnvelope } from "~/lib/astra/client";
import { collectAstraPages } from "~/lib/astra/pagination";
import { fetchAllAttendanceRecords } from "~/server/api/routers/attendance-source";
import {
  aggregateMonthlyAttendance,
  type MonthlyRecapAttendance,
  type MonthlyRecapCalendarException,
  type MonthlyRecapClass,
  type MonthlyRecapEnrollment,
  type MonthlyRecapLeaveRequest,
  type MonthlyRecapPeriod,
  type MonthlyRecapSchedule,
  type MonthlyRecapStudent,
} from "~/server/attendance/monthly-recap";
import { createTRPCRouter, privilegedProcedure } from "~/server/api/trpc";

const monthSchema = z
  .string()
  .regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/)
  .refine((value) => {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year!, month!, 0)).getUTCMonth() === month! - 1;
  }, "Month must be a real calendar month.");

type ListEnvelope<T> = {
  data?: readonly T[] | null;
  items?: readonly T[] | null;
  rows?: readonly T[] | null;
  results?: readonly T[] | null;
};

function listRows<T>(value: readonly T[] | ListEnvelope<T> | null): T[] | null {
  if (Array.isArray(value)) return value;
  if (value === null) return null;
  if (!(
    "data" in value ||
    "items" in value ||
    "rows" in value ||
    "results" in value
  ))
    return null;
  const envelope = value;
  if (Array.isArray(envelope.data)) return envelope.data;
  if (Array.isArray(envelope.items)) return envelope.items;
  if (Array.isArray(envelope.rows)) return envelope.rows;
  if (Array.isArray(envelope.results)) return envelope.results;
  return null;
}

function withPagination(path: string, limit: number, offset: number): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}limit=${limit}&offset=${offset}`;
}

async function fetchCompleteList<T>(path: string): Promise<T[]> {
  const first = await astraRequestEnvelope<T[] | ListEnvelope<T>>(path);
  const firstRows = listRows(first.data);
  if (firstRows === null) {
    throw new AstraRequestError(
      `Astra returned a non-list response for ${path}.`,
      502,
      first.requestId,
      "CONTRACT_RESPONSE_INVALID",
    );
  }
  const pagination = first.meta.pagination;
  if (!pagination) {
    return firstRows;
  }

  const pageSize = pagination.limit ?? -1;
  if (
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    pagination.offset !== 0 ||
    (pagination.has_more !== true && pagination.has_more !== false) ||
    firstRows.length > pageSize ||
    (pagination.has_more && (pageSize < 1 || firstRows.length !== pageSize))
  ) {
    throw new AstraRequestError(
      `Astra returned invalid pagination metadata for ${path}.`,
      502,
      first.requestId,
      "CONTRACT_RESPONSE_INVALID",
    );
  }

  if (!pagination.has_more) return firstRows;

  const completePageSize = pageSize;

  const remaining = await collectAstraPages<T>(
    async ({ limit, offset }) => {
      const response = await astraRequestEnvelope<T[] | ListEnvelope<T>>(
        withPagination(path, limit, offset),
      );
      const rows = listRows(response.data);
      if (rows === null) {
        throw new AstraRequestError(
          `Astra returned a non-list response for ${path}.`,
          502,
          response.requestId,
          "CONTRACT_RESPONSE_INVALID",
        );
      }
      return { ...response, data: rows };
    },
    { pageSize: completePageSize },
  );

  return remaining;
}

function queryPath(
  resource: string,
  params: Record<string, string | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return `/v1/admin/${resource}${encoded ? `?${encoded}` : ""}`;
}

export interface MonthlyRecapSources {
  periods: MonthlyRecapPeriod[];
  period: MonthlyRecapPeriod;
  classes: MonthlyRecapClass[];
  students: MonthlyRecapStudent[];
  enrollments: MonthlyRecapEnrollment[];
  schedules: MonthlyRecapSchedule[];
  calendarExceptions: MonthlyRecapCalendarException[];
  attendances: MonthlyRecapAttendance[];
  leaveRequests: MonthlyRecapLeaveRequest[];
}

export async function fetchMonthlyRecapSources(
  month: string,
  academicPeriodId?: string,
): Promise<MonthlyRecapSources> {
  const periods = await fetchCompleteList<MonthlyRecapPeriod>(
    "/v1/admin/academic-periods",
  );
  const monthStart = `${month}-01`;
  const monthEnd = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const period = academicPeriodId
    ? periods.find((candidate) => candidate.id === academicPeriodId)
    : periods.find(
        (candidate) =>
          candidate.start_date <= monthEnd && candidate.end_date >= monthStart,
      );
  if (!period) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Academic period not found for the selected month.",
    });
  }

  const [
    classes,
    students,
    enrollments,
    schedules,
    calendarExceptions,
    attendances,
    leaveRequests,
  ] = await Promise.all([
    fetchCompleteList<MonthlyRecapClass>(
      queryPath("classes", { academic_period_id: period.id }),
    ),
    fetchCompleteList<MonthlyRecapStudent>("/v1/admin/students"),
    fetchCompleteList<MonthlyRecapEnrollment>(
      queryPath("enrollments", { academic_period_id: period.id }),
    ),
    fetchCompleteList<MonthlyRecapSchedule>(
      queryPath("schedules", { academic_period_id: period.id }),
    ),
    fetchCompleteList<MonthlyRecapCalendarException>(
      queryPath("calendar-exceptions", {
        academic_period_id: period.id,
        start_date: monthStart,
        end_date: monthEnd,
      }),
    ),
    fetchAllAttendanceRecords<MonthlyRecapAttendance>({
      startDate: monthStart,
      endDate: monthEnd,
    }),
    fetchCompleteList<MonthlyRecapLeaveRequest>(
      queryPath("leave-requests", {
        start_date: monthStart,
        end_date: monthEnd,
      }),
    ),
  ]);

  return {
    periods,
    period,
    classes,
    students,
    enrollments,
    schedules,
    calendarExceptions,
    attendances,
    leaveRequests,
  };
}

export const monthlyAttendanceInput = z.object({
  month: monthSchema,
  academicPeriodId: z.string().trim().min(1).max(255).optional(),
  className: z.string().trim().min(1).max(255).optional(),
  studentId: z.string().trim().min(1).max(255).optional(),
  userId: z.string().trim().min(1).max(255).optional(),
  nis: z.string().trim().min(1).max(255).optional(),
});

export const monthlyAttendanceRouter = createTRPCRouter({
  get: privilegedProcedure
    .input(monthlyAttendanceInput)
    .query(async ({ input }) => {
      const sources = await fetchMonthlyRecapSources(
        input.month,
        input.academicPeriodId,
      );
      return aggregateMonthlyAttendance({
        ...sources,
        period: sources.period,
        month: input.month,
        className: input.className,
        studentId: input.studentId,
        userId: input.userId,
        nis: input.nis,
      });
    }),
});

export type MonthlyAttendanceRouter = typeof monthlyAttendanceRouter;
