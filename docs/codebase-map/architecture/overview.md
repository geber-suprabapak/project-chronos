# Chronos Architecture

Chronos provides web administration UI and a typed server boundary. `appRouter` composes feature routers; `/api/trpc/[trpc]` dispatches them. The tRPC middleware obtains Logto context, rejects unauthenticated/password-change-required/forbidden roles, and enriches protected requests with a normalized user and role.

Dependency direction is UI pages → tRPC API route → `appRouter` feature router → Astra client/proxy for domain operations.

## Authority boundaries

- **Logto:** identity, session, global role assignment, and Astra resource token issuance.
- **Chronos:** page admission, role-aware presentation, input validation, orchestration, view models, and server-side exports.
- **Astra:** API authorization and domain state. Chronos must not restore a direct domain database path.

Page middleware intentionally bypasses `/api/*`; every API route therefore owns its own authentication and authorization. Main-layout admission allows any privileged role, so feature/action restrictions must be expressed separately in navigation and server procedures.

## Integration seam

`astraRequest` is the common server client for most tRPC and export traffic. It adds authorization, the `v1` contract header, a bounded timeout, and a safe request ID; it verifies the response contract and normalizes Astra errors. `/api/astra/files` uses the same correlation and role policy around its upload-intent/PUT/confirm flow.

## Data-query seam

Attendance paths are assembled in `history-query.ts` and consumed through `collectAstraPages`. The collector validates Astra offset metadata, follows every page with a bounded maximum, preserves stable ordering, and fails closed on inconsistent pagination.

## Delivery seam

The application builds as a standalone Next.js image and runs as a non-root user. `/api/health/live` is the container liveness target, while `/api/health/ready` checks bounded Astra and Logto dependencies. OCI labels and runtime environment carry commit, build time, and application version; deployment requires an immutable image digest.

**Evidence:** `src/server/api/root.ts`, `src/server/api/trpc.ts`, `src/app/api/trpc/[trpc]/route.ts`, `src/lib/astra/client.ts`, `src/lib/astra/pagination.ts`, `src/app/api/astra/files/route.ts`, `src/server/api/routers/history-query.ts`, `Dockerfile`, `docker-compose.yml`, `src/app/api/health/live/route.ts`, `src/app/api/health/ready/route.ts`.
