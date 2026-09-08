# Current Objective

Complete Ticket 07 Monthly Attendance Recap in Chronos with only minimal
published contract additions for existing Astra routes if required.

# Completed

- Read repository, applicable AGENTS, RTK, TDD/continuity guidance, CONTEXT,
  ADR-0013, issue/spec, testing/domain docs, and codebase map.
- Created isolated Chronos worktree `/home/robin/worktrees/ticket-07-finish/chronos`
  on branch `codex/ticket-07-finish` from integrated HEAD
  `6758e17c246c29498655e80c34c2826d5a4132f7`.
- Confirmed Astra HEAD `37623cc30bfd2a07d493bb75783e766cd65e7c71` publishes
  the existing enrollment/calendar-exception routes and the monthly source
  manifest; Chronos checks this canonical snapshot without drift.
- Replaced the four anti-slop violations in the monthly source collector with
  typed list-envelope handling that fails closed on non-list responses.
- Added a source-collector regression for complete multi-page collection and
  malformed incomplete-page metadata.

# In Progress

Implementation and verification are complete; commit and parent handoff remain.

# Exact Next Action

Commit the Chronos worktree and return the SHA plus validation evidence.

# Important Decisions

- Keep aggregation pure and expose one dataset for UI and future export.
- Use complete attendance collection plus complete/validated list sources;
  never call a capped result complete.
- Use effective enrollment timelines and approved leave periods only.

# Changed Files

`src/server/api/routers/monthly-attendance.ts`
`tests/monthly-attendance-collector.bun.ts`
Continuity files under `.agent/`

# Validation

`bun test tests/monthly-attendance.test.ts ./tests/monthly-attendance-collector.bun.ts` passed.
`LOGTO_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/login bun run test` passed: 321 tests.
`bun run typecheck` passed with the required local environment variable.
`bun run lint` passed.
`LOGTO_POST_LOGOUT_REDIRECT_URI=http://localhost:3000/login bun run build` passed.
`e2e/absensi.spec.ts` passed twice in dev and once in production.
`ASTRA_CONTRACT_PATH=/home/robin/worktrees/ticket-07-finish/astra/contracts/astra-v1.json pnpm contract:check` passed.

# Known Issues / Blockers

The monthly heading regression did not reproduce: full `e2e/absensi.spec.ts`
passed in dev twice and in production once.
The worktree uses locally installed dependencies; generated `.next` and
`node_modules` are ignored.

# Git State

Branch `codex/ticket-07-finish`; base `6758e17`; uncommitted router/test changes ready to commit.
