# Chronos Architecture

Chronos provides web administration UI and a typed server boundary. `appRouter` composes feature routers; `/api/trpc/[trpc]` dispatches them. The tRPC middleware obtains Logto context, rejects unauthenticated/password-change-required/forbidden roles, and enriches protected requests with a normalized user and role.

Dependency direction is UI pages → tRPC API route → `appRouter` feature router → Astra client/proxy for domain operations.

**Evidence:** `src/server/api/root.ts`, `src/server/api/trpc.ts`, `src/app/api/trpc/[trpc]/route.ts`, `src/server/api/routers/perizinan.ts`.
