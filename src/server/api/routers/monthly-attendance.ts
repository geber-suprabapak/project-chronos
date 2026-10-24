import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fetchCompleteList } from "~/lib/astra/complete-list";
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
