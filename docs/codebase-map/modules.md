# Modules

## Next application and middleware

**Purpose:** Render pages, API routes, and route-level access behavior.
**Entry points:** `src/app/`, `middleware.ts`.
**Boundary:** Middleware admits authenticated privileged roles to page surfaces, while API routes and tRPC procedures must enforce their own authorization.

## Application shell and navigation

**Purpose:** Render the shared sidebar, current-page title, user control, and monthly backup prompt.
**Entry points:** `src/app/(main)/layout.tsx`, `src/components/app-sidebar.tsx`, `src/components/nav-main.tsx`, `src/components/current-page-title.tsx`, `src/components/monthly-backup-banner.tsx`.
**Known seam:** Navigation visibility is not yet role-specific; server authorization remains mandatory.

## tRPC foundation

**Purpose:** Build context, authenticate Logto sessions, resolve roles, and define protected/admin procedures.
**Entry points:** `src/app/api/trpc/[trpc]/route.ts`, `src/server/api/trpc.ts`.

## Administration routers

**Purpose:** Expose absences, leave requests, profiles/students, locations, and schedules.
**Entry point:** `src/server/api/root.ts`.
**Boundary:** Feature routers map Astra wire types into Chronos view models. They must not silently turn gateway failures into legitimate empty datasets.

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
**Contract:** `contracts/astra-v1.json` declares required headers and route inventory. Current settlement work must eliminate drift between this snapshot, Chronos calls, and Astra handlers.

## Test harness

**Purpose:** Run deterministic local tests with mock Astra and Logto services.
**Entry points:** `tests/`, `e2e/`, `e2e/fixtures/start-servers.ts`, `e2e/fixtures/mock-server.ts`, `playwright.config.ts`.
**Constraint:** Fixture configuration must be self-contained and must never inherit production redirect origins or target production write paths.

## Legacy database residue (Settled / Removed)

**Purpose:** Historical SQL/migration snapshots and a transient-database error helper from the pre-Astra architecture.
**Entry points:** Formerly `sql/`, `src/server/lib/db-utils.ts`, and Drizzle lint configuration in `eslint.config.js`.
**Status:** Removed in Milestone M5 (Issue 11). Astra backend (`project-astra`) is the single authoritative source of truth for database schema and migrations (`project-astra/drizzle/`). 0 call sites existed in Chronos.
