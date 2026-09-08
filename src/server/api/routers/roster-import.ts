import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { astraRequest } from "~/lib/astra/client";
import { createTRPCRouter, schoolAdminProcedure } from "~/server/api/trpc";
import {
  canAcceptRosterReport,
  parseOfficialRosterWorkbook,
  rosterRowProvenance,
  type RosterParseReport,
} from "~/server/roster/parser";

const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
const MAX_WORKSHEETS = 50;
const MAX_ROWS_PER_WORKSHEET = 100;
const MAX_ROWS_PER_WORKBOOK = 2_000;

interface AcademicPeriod {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
}

interface AstraRosterReport {
  id: string;
  academic_period_id?: string | null;
  total_rows: number;
  valid_rows: number;
  rejected_rows: number;
  status: string;
  review_state: string;
  rows: unknown[];
  rejected_items: unknown;
  accepted_at?: string | null;
  accepted_by?: string | null;
}

const astraRejectedRosterItemSchema = z
  .object({
    row_index: z.number().int().nonnegative(),
    reason: z.string(),
  })
  .passthrough();

const astraAcceptanceReportSchema = z.object({
  rejected_rows: z.number(),
  rejected_items: z.array(astraRejectedRosterItemSchema),
  status: z.string(),
  review_state: z.string(),
});

function decodeBase64(value: string): Uint8Array {
  try {
    const bytes = Buffer.from(value, "base64");
    if (
      bytes.length === 0 ||
      bytes.toString("base64") !== value.replace(/\s/g, "")
    ) {
      throw new Error("invalid base64");
    }
    return new Uint8Array(bytes);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Workbook data is invalid.",
    });
  }
}

function academicYear(period: AcademicPeriod): string | null {
  const named = period.name.match(/(\d{4})\s*\/\s*(\d{4})/);
  if (named) return `${named[1]}/${named[2]}`;
  const start = period.start_date?.slice(0, 4);
  const end = period.end_date?.slice(0, 4);
  if (!start || !end) return null;
  const startMonth = Number(period.start_date?.slice(5, 7));
  return startMonth >= 7
    ? `${start}/${Number(start) + 1}`
    : `${Number(end) - 1}/${end}`;
}

async function listAcademicPeriods(): Promise<AcademicPeriod[]> {
  return astraRequest<AcademicPeriod[]>("/v1/admin/academic-periods");
}

function appendWorkbookError(report: RosterParseReport, message: string) {
  report.errors.push({
    worksheet: "Workbook",
    worksheetRow: null,
    field: "workbook",
    message,
  });
}

function appendWorkbookBounds(report: RosterParseReport) {
  if (report.worksheetCount > MAX_WORKSHEETS) {
    appendWorkbookError(report, "Workbook has too many worksheets.");
  }
  for (const sheet of report.sheets) {
    if (sheet.studentRowCount > MAX_ROWS_PER_WORKSHEET) {
      report.errors.push({
        worksheet: sheet.worksheet,
        worksheetRow: null,
        field: "workbook",
        message: "Worksheet has too many Student rows.",
      });
    }
  }
  if (report.totalRows > MAX_ROWS_PER_WORKBOOK) {
    appendWorkbookError(report, "Workbook has too many Student rows.");
  }
}

export const rosterImportRouter = createTRPCRouter({
  periods: schoolAdminProcedure.query(async () => listAcademicPeriods()),

  preview: schoolAdminProcedure
    .input(
      z.object({
        academicPeriodId: z.string().trim().min(1),
        filename: z.string().trim().min(1).max(255),
        workbookBase64: z
          .string()
          .min(1)
          .max(Math.ceil((MAX_WORKBOOK_BYTES * 4) / 3) + 16),
      }),
    )
    .mutation(async ({ input }) => {
      if (!input.filename.toLowerCase().endsWith(".xlsx")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only .xlsx workbooks are supported.",
        });
      }
      const bytes = decodeBase64(input.workbookBase64);
      if (bytes.byteLength > MAX_WORKBOOK_BYTES) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "Workbook exceeds the 5 MiB limit.",
        });
      }

      let parsed: RosterParseReport;
      try {
        parsed = await parseOfficialRosterWorkbook(bytes);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error && error.message
              ? error.message
              : "Workbook could not be read.",
        });
      }
      appendWorkbookBounds(parsed);

      const periods = await listAcademicPeriods();
      const period = periods.find(
        (candidate) => candidate.id === input.academicPeriodId,
      );
      if (!period) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Academic Period is not available.",
        });
      }
      const expectedYear = academicYear(period);
      if (!parsed.workbookYear) {
        parsed.errors.push({
          worksheet: "Workbook",
          worksheetRow: null,
          field: "workbook",
          message: `Workbook year is missing for Academic Period ${period.name}.`,
        });
      } else if (expectedYear && parsed.workbookYear !== expectedYear) {
        parsed.errors.push({
          worksheet: "Workbook",
          worksheetRow: null,
          field: "workbook",
          message: `Workbook year ${parsed.workbookYear} does not match Academic Period ${period.name}.`,
        });
      }
      if (parsed.errors.length > 0 || parsed.totalRows === 0) {
        return { parsed, report: null, accepted: false };
      }

      const report = await astraRequest<AstraRosterReport>(
        "/v1/admin/bootstrap/roster",
        {
          method: "POST",
          body: JSON.stringify({
            academic_period_id: input.academicPeriodId,
            rows: parsed.rows.map((row) => ({
              nis: row.nis,
              full_name: row.fullName,
              class_name: row.className,
              gender: row.gender,
              absence_number: row.absenceNumber,
            })),
          }),
        },
      );
      const rejectionItems = astraRejectedRosterItemSchema
        .array()
        .safeParse(report.rejected_items);
      return {
        parsed,
        report: {
          ...report,
          rejected_items: rejectionItems.success
            ? rejectionItems.data.map((item) => ({
                ...item,
                provenance: rosterRowProvenance(parsed.rows, item.row_index),
              }))
            : [
                {
                  row_index: -1,
                  reason: "Astra returned malformed rejection details.",
                  provenance: "Workbook",
                },
              ],
        },
        accepted: false,
      };
    }),

  accept: schoolAdminProcedure
    .input(z.object({ reportId: z.string().trim().min(1) }))
    .mutation(async ({ input }) => {
      const report = await astraRequest<AstraRosterReport>(
        `/v1/admin/bootstrap/roster/${encodeURIComponent(input.reportId)}`,
      );
      const acceptanceReport = astraAcceptanceReportSchema.safeParse(report);
      if (
        !acceptanceReport.success ||
        !canAcceptRosterReport(acceptanceReport.data)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Roster report contains validation errors and cannot be accepted.",
        });
      }
      return astraRequest<AstraRosterReport>(
        `/v1/admin/bootstrap/roster/${encodeURIComponent(input.reportId)}/accept`,
        { method: "POST" },
      );
    }),
});

export type RosterImportRouter = typeof rosterImportRouter;
