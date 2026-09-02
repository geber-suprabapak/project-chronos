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
