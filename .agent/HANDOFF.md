# Current Objective

Complete ticket 03 invalid roster workbook handling in Chronos only.

# Completed

- Read repository, domain, ADR0013, issue/spec, base refs, and TDD guidance.
- Created isolated branch `codex/ticket-03-invalid-rosters` from Chronos
  `600930c7b0a3120b691cbf49dd8c5bfeaffb469a`.
- Confirmed Astra base has the canonical staged-roster rejection contract and
  no Astra worktree is required.

# In Progress

Parser and server/UI validation extensions are complete; full gates remain.

# Exact Next Action

Run the full Chronos test, contract, build, and relevant empirical gates; then
inspect and commit the focused ticket03 diff.

# Important Decisions

- Keep valid rows visible when the report contains invalid rows.
- Local parser failures return the full report without Astra stage calls.
- Astra stays authoritative for existing NIS/class/period and canonical
  rejection details.

# Changed Files

- `src/server/roster/parser.ts`
- `src/server/api/routers/roster-import.ts`
- `src/components/roster-import-panel.tsx`
- `e2e/fixtures/mock-server.ts`
- `e2e/siswa.spec.ts`
- `tests/roster-workbook.test.ts`

# Validation

Focused parser: 14 passing. Lint and typecheck pass. Targeted
`e2e/siswa.spec.ts`: 10 passing.

# Known Issues / Blockers

None.

# Git State

Branch `codex/ticket-03-invalid-rosters`; product worktree clean.
