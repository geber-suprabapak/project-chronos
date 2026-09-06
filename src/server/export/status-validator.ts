import { z } from "zod";
import type { AstraBackupRecord, AstraBackupStatusResponse } from "./types.ts";
import { getAsiaJakartaMonthBounds, isValidYearMonth } from "./date-bounds.ts";

const backupRecordSchema = z.object({
  id: z.string().min(1),
  year_month: z.string(),
  scope: z.literal("absences"),
  format: z.enum(["xlsx", "pdf"]),
  start_date: z.string(),
  end_date: z.string(),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  record_count: z.number().int().nonnegative(),
  byte_length: z.number().int().positive(),
  result: z.literal("completed"),
  created_at: z.string().optional(),
});

const backupStatusSchema = z.union([
  z.object({
    completed: z.literal(false),
    record: z.null(),
  }),
  z.object({
    completed: z.literal(true),
    record: backupRecordSchema,
  }),
]);

export interface RawAstraRecordCandidate {
  readonly id?: string | null;
  readonly year_month?: string | null;
  readonly scope?: string | null;
  readonly format?: string | null;
  readonly start_date?: string | null;
  readonly end_date?: string | null;
  readonly checksum?: string | null;
  readonly record_count?: number | null;
  readonly byte_length?: number | null;
  readonly result?: string | null;
  readonly created_at?: string | null;
}

export interface RawAstraBackupCandidate {
  readonly completed?: boolean | string | number | null;
  readonly record?: RawAstraRecordCandidate | null;
}

export type AstraBackupStatusCandidate =
  RawAstraBackupCandidate | null | undefined;

export interface AstraStatusValidationSuccess {
  readonly ok: true;
  readonly data: AstraBackupStatusResponse;
}

export interface AstraStatusValidationFailure {
  readonly ok: false;
  readonly statusCode: 502;
  readonly error: string;
  readonly details: string;
}

export type AstraStatusValidationResult =
  AstraStatusValidationSuccess | AstraStatusValidationFailure;

function invalidStatus(details: string): AstraStatusValidationFailure {
  return {
    ok: false,
    statusCode: 502,
    error:
      "Respon status backup dari Astra tidak valid atau melanggar kontrak data.",
    details,
  };
}

/**
 * Parses and validates the Astra backup status response at the HTTP boundary.
 * Missing, coerced, fabricated, or internally inconsistent completion data fails closed.
 */
export function validateAstraBackupStatusResponse(
  rawData: AstraBackupStatusCandidate,
  expectedMonth: string,
): AstraStatusValidationResult {
  if (!isValidYearMonth(expectedMonth)) {
    return invalidStatus("Invalid expected backup month.");
  }

  const parsed = backupStatusSchema.safeParse(rawData);
  if (!parsed.success) {
    return invalidStatus(
      "Malformed or inconsistent backup status payload from Astra.",
    );
  }

  if (!parsed.data.completed) {
    return {
      ok: true,
      data: {
        completed: false,
        record: null,
      },
    };
  }

  const bounds = getAsiaJakartaMonthBounds(expectedMonth);
  const record = parsed.data.record;
  if (
    record.year_month !== expectedMonth ||
    record.start_date !== bounds.startDate ||
    record.end_date !== bounds.endDate
  ) {
    return invalidStatus(
      "Backup record month or full-month date bounds do not match the request.",
    );
  }

  const validatedRecord: AstraBackupRecord = record;
  return {
    ok: true,
    data: {
      completed: true,
      record: validatedRecord,
    },
  };
}
