# RBAC Implementation Guide (Chronos)

## Scope
This document describes the RBAC implementation for Chronos using:

- `user_profiles.role` as the single source of role assignment.
- Supabase custom access token hook to inject role claims.
- Role enforcement at:
  - tRPC procedures (server app layer)
  - API export routes
  - Postgres RLS policies

Role set used in this phase:

- `admin`
- `kepala_sekolah`
- `guru`
- `wali_kelas`
- `siswa`

Default fallback role is `siswa`.

## What Changed

### App Layer (Chronos)

- Added shared RBAC utilities:
  - `src/server/auth/rbac.ts`
  - `src/server/auth/export-guard.ts`
- Upgraded auth context and procedures:
  - `src/server/api/trpc.ts`
  - Added `adminProcedure` and `privilegedProcedure`
- Protected privileged mutations:
  - `src/server/api/routers/absences.ts`
  - `src/server/api/routers/perizinan.ts`
  - `src/server/api/routers/configuration.ts`
  - `src/server/api/routers/jadwal.ts`
- Restricted broad master-data reads to privileged roles:
  - `src/server/api/routers/user-profiles.ts`
  - `src/server/api/routers/biodata-siswa.ts`
- Added auth + RBAC check on export routes:
  - `src/app/api/export/absences/route.ts`
  - `src/app/api/export/perizinan/route.ts`
  - `src/app/api/export/profiles/route.ts`
  - `src/app/api/export/siswa/route.ts`

### Database Layer

- Added migration:
  - `sql/migrations/20260304_rbac_claims_and_hooks.sql`
- Updated schema snapshot:
  - `sql/schema_latest_latest.sql`

Database changes include:

- Role normalization and role check constraint on `user_profiles.role`
- JWT helper functions:
  - `app_role()`
  - `app_has_any_role(text[])`
- Supabase custom access token hook function:
  - `custom_access_token_hook(event jsonb)`
- Claim-based RLS policies for privileged operations

## Server Setup (Self-Hosted Supabase)

This is required in your Supabase infra compose, not in Chronos app compose.

Set these env vars for GoTrue auth service:

- `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true`
- `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook`

Optional: if your auth image/version requires secrets/versioning config, set the matching hook secret env as documented by your deployment template.

## Deployment Order

1. Apply DB migration first.
2. Restart Supabase auth service with hook env enabled.
3. Deploy Chronos app changes.
4. Force relogin or refresh token for test users.

## Verification Checklist

1. Token claim check:
- Login as each role and inspect access token claims.
- Confirm `app_metadata.role` and `app_metadata.roles` are present.

2. tRPC authz check:
- Non-admin cannot call `absences.createManual`, `absences.delete`, `absences.bulkDelete`.
- Non-privileged cannot call `perizinan.updateStatus` and `perizinan.createManual`.
- Non-admin cannot mutate `location` or `jadwal` routes.

3. Export route check:
- Unauthenticated request returns 401.
- Unauthorized role returns 403.
- Authorized role can export successfully.

4. RLS check:
- Validate owner-only behavior still works for `siswa`.
- Validate privileged claims can perform intended actions.

## Rollback Plan

If issue occurs:

1. Disable hook env on Supabase auth and restart auth service.
2. Revert app deployment to previous release.
3. Keep migration but disable claim-based policies (drop only new policies if needed).

Recommended rollback SQL order:

1. Drop newly added claim-based policies.
2. Keep existing owner policies intact.
3. Optionally remove hook function execute grant if hook is disabled.

## Notes

- During transition, app role resolution reads claims first and falls back to DB role.
- Claim updates require token refresh/relogin to take effect immediately.
- This phase intentionally avoids multi-role permission tables to reduce rollout risk.

## Troubleshooting Hook URI Errors

If you see `Error running hook URI: pg-functions://postgres/public/custom_access_token_hook`, check these first:

1. Function exists with exact signature:
- `public.custom_access_token_hook(event jsonb) returns jsonb`

2. Auth admin permissions are present:
- `grant usage on schema public to supabase_auth_admin;`
- `grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;`
- `grant select on table public.user_profiles to supabase_auth_admin;`

3. RLS allows auth admin to read role source table:
- policy on `public.user_profiles` for `select` to `supabase_auth_admin`.

4. Self-hosted auth env is enabled and auth service restarted:
- `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true`
- `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook`
