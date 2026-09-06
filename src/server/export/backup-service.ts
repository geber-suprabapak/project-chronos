import { calculateSha256 } from "./checksum.ts";
import {
  collectAuthoritativeAttendanceRows,
  type AttendanceCollectionDependencies,
} from "./collector.ts";
import { getAsiaJakartaMonthBounds } from "./date-bounds.ts";
import { generateAttendancePdf } from "./pdf-generator.ts";
import { generateAttendanceXlsx } from "./xlsx-generator.ts";
import type {
  AstraBackupAuditPayload,
  AstraBackupRecord,
  AttendanceExportFilter,
  ExportArtifact,
  ExportFormat,
  MonthlyBackupResult,
  OrderedAttendanceRow,
} from "./types.ts";

export interface BuildArtifactOptions {
  format: ExportFormat;
  filenamePrefix?: string;
  title?: string;
  subtitle?: string;
}

/**
 * Builds either an XLSX or PDF artifact from sorted attendance rows, computes SHA-256,
 * and attaches metadata.
 */
export async function buildAttendanceArtifact(
  rows: readonly OrderedAttendanceRow[],
  options: BuildArtifactOptions,
): Promise<ExportArtifact> {
  const { format, filenamePrefix = "absensi", title, subtitle } = options;
  let buffer: Buffer;
  let mimeType: string;

  if (format === "xlsx") {
    buffer = await generateAttendanceXlsx(rows, { title });
    mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    buffer = await generateAttendancePdf(rows, { title, subtitle });
    mimeType = "application/pdf";
  }

  const sha256 = calculateSha256(buffer);
  const filename = `${filenamePrefix}.${format}`;
  const generatedAt = new Date().toISOString();

  return {
    format,
    buffer,
    sha256,
    filename,
    mimeType,
    rowCount: rows.length,
    generatedAt,
  };
}

export interface PerformMonthlyBackupParams {
  month: string; // YYYY-MM
  format: ExportFormat;
}

export interface MonthlyBackupDependencies extends AttendanceCollectionDependencies {
  persistBackupAudit?: (
    audit: AstraBackupAuditPayload,
  ) => Promise<AstraBackupRecord | null | void>;
}

async function defaultPersistBackupAudit(
  audit: AstraBackupAuditPayload,
): Promise<AstraBackupRecord | null> {
  const { astraRequest } = await import("~/lib/astra/client");
  const record = await astraRequest<AstraBackupRecord>("/v1/admin/backups", {
    method: "POST",
    body: JSON.stringify(audit),
    headers: {
      "Content-Type": "application/json",
    },
  });
  return record ?? null;
}

/**
 * Executes authoritative monthly backup:
 * 1. Validates month YYYY-MM and computes full Asia/Jakarta bounds.
 * 2. Collects complete attendance and student collection from Astra.
 * 3. Applies deterministic stable ordering.
 * 4. Generates binary artifact (XLSX or PDF) with SHA-256 checksum.
 * 5. Persists completed audit record to Astra at POST /v1/admin/backups.
 * 6. FAILS CLOSED: If audit persistence fails, throws and aborts without returning the file.
 */
export async function performMonthlyBackup(
  params: PerformMonthlyBackupParams,
  deps?: MonthlyBackupDependencies,
): Promise<MonthlyBackupResult> {
  const { month, format } = params;

  // 1. Month validation & Asia/Jakarta full date range
  const bounds = getAsiaJakartaMonthBounds(month);

  // 2. Full collection across bounds
  const filter: AttendanceExportFilter = {
    startDate: bounds.startDate,
    endDate: bounds.endDate,
  };
  const rows = await collectAuthoritativeAttendanceRows(filter, deps);

  // 3. Artifact generation
  const artifact = await buildAttendanceArtifact(rows, {
    format,
    filenamePrefix: `backup-absensi-${bounds.month}`,
    title: `Backup Data Absensi Bulan ${bounds.month}`,
    subtitle: `Periode: ${bounds.startDate} s.d. ${bounds.endDate} (${bounds.timezone}) | Total: ${rows.length} data`,
  });

  // 4. Audit payload construction aligned to Astra canonical contract
  const audit: AstraBackupAuditPayload = {
    year_month: bounds.month,
    scope: "absences",
    format,
    start_date: bounds.startDate,
    end_date: bounds.endDate,
    checksum: artifact.sha256,
    record_count: artifact.rowCount,
    byte_length: artifact.buffer.length,
    result: "completed",
  };

  // 5. Persist completed audit to Astra before returning
  // CRITICAL: Fail closed if audit persistence fails!
  let persistedRecord: AstraBackupRecord | null = null;
  try {
    if (deps?.persistBackupAudit) {
      const res = await deps.persistBackupAudit(audit);
      persistedRecord = res ?? null;
    } else {
      persistedRecord = await defaultPersistBackupAudit(audit);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Gagal menyimpan audit log backup bulanan ke Astra: ${detail}. Backup dibatalkan.`,
    );
  }

  return { artifact, audit, persistedRecord };
}
