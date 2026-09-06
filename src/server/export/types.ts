export type ExportFormat = "xlsx" | "pdf";

export interface AttendanceExportFilter {
  className?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  userId?: string | null;
}

export interface AstraStudentProfile {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  nis?: string | null;
  class_name?: string | null;
  absence_number?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  lifecycle_status?: string | null;
  gender?: string | null;
}

export interface AstraAttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  status: "Hadir" | "Terlambat" | "Pulang" | "Alpha" | "Datang" | string;
  action_type?: "check_in" | "check_out" | null;
  latitude?: number | null;
  longitude?: number | null;
  created_at?: string | null;
}

export interface OrderedAttendanceRow {
  id: string;
  userId: string;
  date: string;
  nis: string;
  className: string;
  name: string;
  status: string;
  displayStatus: string;
  lokasi: string;
  actionType: string | null;
  createdAt: string | null;
}

export interface ExportArtifact {
  format: ExportFormat;
  buffer: Buffer;
  sha256: string;
  filename: string;
  mimeType: string;
  rowCount: number;
  generatedAt: string;
}

export interface MonthBounds {
  month: string; // YYYY-MM
  startDate: string; // YYYY-MM-01
  endDate: string; // YYYY-MM-DD
  timezone: "Asia/Jakarta";
  year: number;
  monthNumber: number;
  daysInMonth: number;
}

export interface AstraBackupAuditPayload {
  year_month: string; // YYYY-MM
  scope: "absences";
  format: ExportFormat;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  checksum: string; // SHA-256 hex string
  record_count: number;
  byte_length: number;
  result: "completed";
}

export type MonthlyBackupAuditPayload = AstraBackupAuditPayload;

export interface AstraBackupRecord {
  id?: string;
  year_month: string;
  scope: "absences" | string;
  format: ExportFormat;
  start_date: string;
  end_date: string;
  checksum: string;
  record_count: number;
  byte_length: number;
  result: "completed" | string;
  created_at?: string;
  performed_by?: string | null;
}

export type AstraBackupAuditRecord = AstraBackupRecord;

export interface AstraBackupStatusResponse {
  completed: boolean;
  record: AstraBackupRecord | null;
}

export interface MonthlyBackupResult {
  artifact: ExportArtifact;
  audit: AstraBackupAuditPayload;
  persistedRecord?: AstraBackupRecord | null;
}
