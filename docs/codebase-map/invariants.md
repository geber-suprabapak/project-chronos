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
