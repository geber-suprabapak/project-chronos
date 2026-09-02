# Modules

## Next application and middleware

**Purpose:** Render pages, API routes, and route-level access behavior.
**Entry points:** `src/app/`, `middleware.ts`.

## tRPC foundation

**Purpose:** Build context, authenticate Logto sessions, resolve roles, and define protected/admin procedures.
**Entry points:** `src/app/api/trpc/[trpc]/route.ts`, `src/server/api/trpc.ts`.

## Administration routers

**Purpose:** Expose absences, leave requests, profiles/students, locations, and schedules.
**Entry point:** `src/server/api/root.ts`.

## Integration mapping helpers

**Purpose:** Encode Astra history filters and maintain deterministic Astra-location-to-UI identity/default mapping.
**Entry points:** `src/server/api/routers/history-query.ts`, `src/server/api/routers/location-mapping.ts`.
**Used by:** Attendance, leave, and location configuration routers.

## Export API

**Purpose:** Authorize and render absence, leave, profile, and student exports.
**Entry points:** `src/app/api/export/`, `src/app/api/export/utils.ts`.
**Depends on:** Logto access checks and the administration routers' Astra-backed data.

## Astra-facing helpers

**Purpose:** Forward supported management/file behavior through Astra.
**Entry points:** `src/lib/astra/`, `src/app/api/astra/`, `src/server/api/routers/`.
