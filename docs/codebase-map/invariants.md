# Invariants

## INV-CHRONOS-001 — Protected procedures require permitted Logto context

**Rule:** Do not bypass tRPC authentication/role middleware for administration operations.
**Evidence:** `src/server/api/trpc.ts`.

## INV-CHRONOS-002 — Astra remains the domain gateway

**Rule:** Astra-owned state uses its supported API contract rather than a direct substitute.
**Evidence:** `docs/rbac-implementation.md`, `contracts/astra-v1.json`, `src/server/api/routers/perizinan.ts`, `src/lib/astra/`.

## INV-CHRONOS-003 — Leave dates are date-only across tRPC

**Rule:** Preserve date-only normalization to avoid invalid timestamp coercion.
**Evidence:** `src/server/api/routers/perizinan.ts`.

## INV-CHRONOS-004 — Default location identity is deterministic and protected

**Rule:** Derive location UI IDs and the default location from the same deterministic ordering, and do not modify or delete that default through configuration mutations.
**Evidence:** `src/server/api/routers/location-mapping.ts`, `src/server/api/routers/configuration.ts`, `tests/location-mapping.test.ts`.

## INV-CHRONOS-005 — API routes authorize independently

**Rule:** Middleware bypasses `/api/*`; each Route Handler and tRPC procedure must authenticate, enforce password-change state where relevant, and authorize the requested capability. UI hiding never replaces server enforcement.
**Evidence:** `middleware.ts`, `src/server/api/trpc.ts`, `src/server/auth/export-guard.ts`, `src/app/api/astra/files/route.ts`.

## INV-CHRONOS-006 — Collection completeness is explicit

**Rule:** A list, statistic, export, or backup must either consume every required Astra page or clearly expose a bounded result. Never call a capped response “raw” or “all”.
**Evidence:** `src/server/api/routers/history-query.ts`, `src/server/api/routers/absences.ts`, `src/app/api/export/absences/route.ts`.

## INV-CHRONOS-007 — Test fixtures are environment-isolated

**Rule:** Mock Astra/Logto URLs, redirect URIs, credentials, and ports are set by the fixture and cannot inherit production origins. Test write paths must never target production.
**Evidence:** `e2e/fixtures/start-servers.ts`, `playwright.config.ts`.

## INV-CHRONOS-008 — Export generation is server authoritative

**Rule:** Operational backup/export content comes from authorized server queries, not the currently rendered DOM or client pagination state.
**Evidence:** `src/app/api/export/`, `src/components/monthly-backup-banner.tsx`.
