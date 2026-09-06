# Attendance and Export

1. Attendance pages call `absencesRouter` through tRPC.
2. The router pushes supported date/user/status filters to Astra and uses `collectAstraPages` to follow the canonical offset metadata until the dataset is complete.
3. Chronos maps user/profile fields, normalizes legacy attendance values, applies remaining view filters, and uses stable tie-break ordering before UI pagination.
4. Manual create and delete operations use admin procedures and Astra management routes.
5. PDF and XLSX Route Handlers authorize export access, collect complete Astra data server-side, and stream generated binary artifacts independent of the browser DOM.
6. Monthly backup completion is persisted by Astra with actor, scope, range, checksum, byte length, record count, and result; the banner hides only after validating that authoritative record.

## Integrity boundary

Paging metadata is fail-closed: missing, inconsistent, oversized, or non-terminating pagination raises an error instead of returning a partial dataset. Backup delivery also fails closed if student enrichment or Astra audit persistence fails.

**Evidence:** `src/server/api/routers/absences.ts`, `src/server/api/routers/history-query.ts`, `src/lib/astra/pagination.ts`, `src/server/export/collector.ts`, `src/app/api/export/absences/route.ts`, `src/app/api/export/backup/route.ts`, `src/server/auth/export-guard.ts`, `src/components/monthly-backup-banner.tsx`.
