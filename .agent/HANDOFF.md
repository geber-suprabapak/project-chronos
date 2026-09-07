# Current Objective

Harden the integrated Chronos client portion of ticket 06.

# Completed

- Read exact base `0ac4e1846b90dc19682b58abe5a45779243100b5` and confirmed manual Attendance and leave detail seams.
- Added `perizinan.forceFinish`, mapping the selected effective end date and required reason to Astra's admin endpoint and returning the mapped Leave Period fields.
- Added a School Administrator-facing force-finish form to the Leave detail page, including date bounds, reason validation, optimistic loading state, and cache invalidation.
- Mapped Astra `ATTENDANCE_BLOCKED` from manual Attendance to an actionable tRPC `CONFLICT`, preserving Astra's error as the cause.
- Synchronized `contracts/astra-v1.json` with the paired Astra ticket manifest (`ATTENDANCE_BLOCKED` and force-finish route).
- Restricted `perizinan.forceFinish` to `school_admin`; Astra remains the authoritative cross-repository guard.
- Reverted unrelated contract snapshot formatter churn while retaining the Ticket 06 route/error entries.

# In Progress

- Ready for parent review and paired Astra integration.

# Exact Next Action

Commit this Chronos worktree and return the new commit SHA plus validation evidence.

# Important Decisions

- Reuse `perizinan` tRPC and leave detail page; do not invent a separate admin flow.

# Changed Files

- `contracts/astra-v1.json`
- `src/app/(main)/perizinan/show/[id]/page.tsx`
- `src/lib/astra/client.ts`
- `src/server/api/routers/absences.ts`
- `src/server/api/routers/perizinan.ts`
- Continuity files under `.agent/`

# Validation

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `LOGTO_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/login pnpm test` passed: 301 tests.
- `ASTRA_CONTRACT_PATH=/home/robin/worktrees/ticket-06/astra/contracts/astra-v1.json pnpm contract:check` passed.
- `LOGTO_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/login pnpm build` passed.
- Initial tests without the required environment variable failed only in pre-existing Logto/RBAC suites; rerun with the documented local value passed.

# Known Issues / Blockers

- None.

# Git State

- Branch `codex/ticket-06-hardening`; base `cc86c57`; uncommitted hardening ready to commit.
