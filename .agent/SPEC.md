# Objective

Expose Astra ticket 06 force-finish through Chronos's existing leave-management tRPC seam and preserve actionable `ATTENDANCE_BLOCKED` errors for manual Attendance.

# Requirements

- Only the existing privileged leave-management seam can force-finish an approved Leave Period.
- Send selected last excused date and required reason to Astra; return mapped period fields.
- Map Astra `ATTENDANCE_BLOCKED` manual Attendance failures to an actionable tRPC conflict.
- Restrict the force-finish tRPC action to the canonical `school_admin` role before forwarding to Astra.

# Constraints

- Ticket 06 only; no broad UI refactor or new dependencies.

# Relevant Areas

- `src/server/api/routers/perizinan.ts`, `src/server/api/routers/absences.ts`, and the existing leave detail page.

# Implementation Notes

Keep force-finish at the tRPC boundary; add the smallest UI action needed for School Administrator to select a last excused date and reason.
