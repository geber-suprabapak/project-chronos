# Current Objective

Complete ticket 03 invalid roster workbook handling in Chronos only.

# Completed

- Read repository, domain, ADR0013, issue/spec, base refs, and TDD guidance.
- Created isolated branch `codex/ticket-03-finish` from Chronos
  `21ced06920dc52066655957917f8aa6dfdae9177`.
- Confirmed Astra base has the canonical staged-roster rejection contract and
  no Astra worktree is required.

# In Progress

Parser lint annotation, Astra rejection provenance/accept guards, canonical
mock rejection classes, regression coverage, and verification are complete.

# Exact Next Action

Hand off the latest Ticket03 commit to the coordinator.

# Important Decisions

- Keep valid rows visible when the report contains invalid rows.
- Local parser failures return the full report without Astra stage calls.
- Astra stays authoritative for existing NIS/class/period and canonical
  rejection details.
- Astra rejection items are normalized with source worksheet/row provenance;
  malformed acceptance reports fail closed.

# Changed Files

- `src/server/roster/parser.ts`
- `src/server/api/routers/roster-import.ts`
- `src/components/roster-import-panel.tsx`
- `e2e/fixtures/mock-server.ts`
- `e2e/siswa.spec.ts`
- `tests/roster-workbook.test.ts`

# Validation

Focused parser: 15 passing. Full unit suite: 317 passing. Full lint and
typecheck pass. Targeted `e2e/siswa.spec.ts`: 10 passing, including no accept
counter increment for Astra-rejected input. Contract check requires
`ASTRA_CONTRACT_PATH=/home/robin/project/project-astra/contracts/astra-v1.json`
and then reports existing snapshot drift.

# Known Issues / Blockers

Canonical Astra contract is outside this Chronos worktree; default contract
check path is absent and the explicit canonical path reports snapshot drift.

# Git State

Branch `codex/ticket-03-finish`; latest commit is the Ticket03 finish commit;
worktree is clean.
