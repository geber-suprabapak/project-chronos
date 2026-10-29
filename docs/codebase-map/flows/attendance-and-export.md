# Attendance and Export

1. Attendance pages call `absencesRouter` through tRPC.
2. The router pushes supported date/user/status filters to Astra and uses `collectAstraPages` to follow the canonical offset metadata until the dataset is complete.
3. Chronos maps user/profile fields, normalizes legacy attendance values, applies remaining view filters, and uses stable tie-break ordering before UI pagination.
4. Manual Attendance uses `schoolAdminProcedure`; legacy `admin` and `kepala_sekolah` normalize to `school_admin`, while `platform_admin` is denied. The form lists only failed/error Attempts for the same Student, action, and WIB date; Astra enforces the same boundary at create time. Attendance deletion remains an admin procedure.
5. PDF and XLSX Route Handlers authorize export access, collect complete Astra data server-side, and stream generated binary artifacts independent of the browser DOM.
6. Monthly backup completion is persisted by Astra with actor, scope, range, checksum, byte length, record count, and result; the banner hides only after validating that authoritative record.

## Integrity boundary

Paging metadata is fail-closed: missing, inconsistent, oversized, or non-terminating pagination raises an error instead of returning a partial dataset. Backup delivery also fails closed if student enrichment or Astra audit persistence fails.

The daily dashboard uses the tenant's sole active academic period and active
enrollments for that period. Canonical Student identity deduplicates membership;
roster-only students need no identity account, while linked profiles must be
approved. Attendance and leave categories use that same membership. Sakit takes
precedence over other approved leave, and approved leave takes precedence over
check-in. Missing/ambiguous active periods and source failures raise errors.

Per-class summaries use that same daily assessment, restricted by the active
period's canonical class ID. Approved leave spans include the effective final
date; a force-finished period cannot extend to the original end. Roster-only
students remain distinct by Student ID. The per-class page and
`/api/export/class-attendance` share status/name/NIS/absence-number filtering;
XLSX/PDF export one assessed row per student with No, Nama, NIS, Kelas and Status.
This is distinct from the raw event export's separate check-in/check-out records.
Class summaries show current physical attendance immediately; monthly recap
cutoff rules remain specific to monthly assessment.

Client requests and the daily server default use the Asia/Jakarta school day.
The chart changes its query date at WIB midnight and on focus/visibility wake.

Monthly recaps retain all enrollment statuses for the requested period. A
terminal enrollment with no explicit end or same-period successor has uncertain
membership: recorded attendance/approved leave remain visible with a warning,
and days without evidence stay blank without derived Alpha. Explicit bounds and
transfer successors retain the existing inclusive-end/day-before-successor rule;
updated_at never substitutes for an exit date. Recorded evidence on unscheduled
days remains visible without adding expected school days. Current-day cutoff and
future-day evaluation remain in effect. Class filtering happens after interval
selection so it cannot remove the successor used to bound a transfer.

**Correction evidence:** `src/server/attendance/daily-summary.ts`,
`src/server/attendance/monthly-recap.ts`, `src/lib/astra/complete-list.ts`,
`src/lib/date-utils.ts`, `src/components/pie-chart.tsx`,
`tests/daily-summary.bun.ts`, `tests/monthly-attendance.test.ts`,
`e2e/dashboard-school-date.spec.ts`.

**Evidence:** `src/server/api/routers/absences.ts`, `src/server/api/routers/history-query.ts`, `src/lib/astra/pagination.ts`, `src/server/export/collector.ts`, `src/app/api/export/absences/route.ts`, `src/app/api/export/backup/route.ts`, `src/server/auth/export-guard.ts`, `src/components/monthly-backup-banner.tsx`.
