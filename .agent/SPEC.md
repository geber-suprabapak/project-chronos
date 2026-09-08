# Objective

Build a complete Monthly Attendance Recap in Chronos for a selected calendar
month and optional class or Student filter.

# Requirements

- Collect complete Astra attendance data and all required academic, class,
  enrollment, schedule, calendar-exception, student, and leave sources.
- Aggregate scheduled WIB dates using approved effective Leave Periods,
  arrival-state precedence, transfer-aware enrollments, and legacy data rules.
- Expose the dataset through a protected tRPC query and render a responsive
  class-grouped monthly matrix in Chronos.

# Acceptance Criteria

- Every Ticket 07 checklist item and spec criterion is covered by focused
  aggregation/router/UI checks.
- Existing roster, leave, attendance, contract, typecheck, lint, build, and
  E2E behavior remains green.

# Constraints

- Astra remains the domain gateway; use existing routes and publish only the
  minimal contract additions needed for existing enrollment/calendar routes.
- Reuse existing pagination and attendance collection helpers; no new deps.
- Do not implement XLSX/PDF export, roster, or unrelated refactors.

# Relevant Areas

- `src/server/attendance/monthly-recap.ts`
- `src/server/api/routers/monthly-attendance.ts`
- `src/app/(main)/absensi/rekap-bulanan/page.tsx`
- `src/app/(main)/absensi/perkelas/page.tsx`
- `src/lib/astra/pagination.ts`, `src/server/api/routers/attendance-source.ts`
- focused tests and E2E mock fixtures

# Implementation Notes

Keep pure aggregation independent of Astra calls. Normalize date-only values
and source variants at the boundary, derive one shared dataset for UI, and
fail closed on paginated-source metadata.
