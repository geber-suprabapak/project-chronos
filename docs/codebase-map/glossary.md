# Glossary

## App router

**Meaning:** tRPC root router that composes administration routers.
**Evidence:** `src/server/api/root.ts`.

## Astra request

**Meaning:** Server-side call to the domain gateway rather than a direct domain-database mutation.
**Evidence:** `src/lib/astra/`, `src/server/api/routers/`.

## Perizinan

**Aliases:** leave request, permit.
**Meaning:** Chronos’s administrative view of Astra leave-request data.
**Evidence:** `src/server/api/routers/perizinan.ts`.

## Protected procedure

**Meaning:** tRPC procedure requiring authenticated, permitted Logto context.
**Evidence:** `src/server/api/trpc.ts`.

## Admin procedure

**Meaning:** tRPC procedure restricted to `ADMIN_ROLES`; distinct from a privileged procedure that also admits teacher/staff-class roles and migration aliases.
**Evidence:** `src/server/api/trpc.ts`, `src/server/auth/rbac.ts`.

## List raw

**Meaning:** A router query intended to return the full filtered collection for summaries or exports.
**Caveat:** Current attendance implementation is capped by the upstream `limit=100`; the name does not guarantee completeness until settlement ticket 01 is closed.
**Evidence:** `src/server/api/routers/absences.ts`, `src/server/api/routers/history-query.ts`.

## Profile

**Meaning:** Currently ambiguous between a student record and a broader account/person directory.
**Status:** Decision required; do not encode a new meaning until the profiles-versus-siswa gate is resolved.
**Evidence:** `src/app/(main)/profiles/`, `src/app/(main)/siswa/`, `src/app/api/export/profiles/route.ts`.

## Settlement

**Meaning:** The release gate before new feature work: no P0/P1, all quality gates green, Chronos–Astra contract synced, production smoke complete, and docs/map current.
