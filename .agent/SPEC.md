# Objective

Remediate every open P0/P1 finding from the Chronos settlement audit across Chronos and Astra, preserve a durable handoff for AGY workers, and prove the settlement gates before new feature work begins.

# Requirements

- Complete P1 issues 01, 02, 03, 04, 05, 08, 13, 14, and the human sign-off preparation in issue 15. The audit currently contains no P0 issue; any newly discovered P0 becomes first priority.
- Remove attendance/history truncation and prove complete, stable results at 0, 99, 100, 101, and more than 1,500 records.
- Stabilize Logto sign-out and password-change handoff without inheriting developer or production origins in E2E.
- Align the versioned Chronos–Astra contract, request IDs, used routes, envelopes, errors, scopes, idempotency behavior, drift gate, and backward-compatible rollout order.
- Enforce one explicit role/action matrix in navigation, tRPC/API boundaries, exports, and file proxy behavior.
- Generate exports/backups server-side from authoritative complete data and retain verifiable job/audit metadata.
- Make CI enforce lint/format, typecheck, unit, integration/contract, build, representative E2E, dependency audit, contract drift, role matrix, and large-dataset cases.
- Resolve D1 (Profiles versus Data Siswa) and D2 (attendance taxonomy) with the user, then record the decisions in domain documentation/ADR before dependent behavior changes.
- Prepare issue 15 evidence; production mutation and final human “settled” approval are not delegated or inferred.
- Use continuity files as the repository source of truth and AGY through Herdr for bounded independent workstreams when `HERDR_ENV=1` is available.

# Acceptance Criteria

- No P0/P1 issue remains open except issue 15 awaiting the explicitly human-only production sign-off step.
- Every completed issue has implementation evidence mapped to all of its acceptance criteria and appropriate automated tests.
- `pnpm check`, unit, integration/contract, build, and full E2E pass from a clean deterministic environment.
- Chronos and Astra contract snapshots are generated from or validated against one canonical versioned source, and drift fails CI.
- Paging/export tests prove completeness and stable ordering above the former 100-row boundary.
- Role tests cover unauthenticated, password-change-required, student, staff, teacher, school admin, platform admin, and supported legacy aliases.
- Production remains read-only during agent work. Representative mutations pass only against local/mock services.
- AGY output is reviewed by the primary agent; every created Herdr tab/worktree is collected and cleaned before completion.
- `.agent/TRACKER.md` and `.agent/HANDOFF.md` match the final repository, test, worker, and blocker state.

# Constraints

- Do not mutate production data, credentials, containers, configuration, identity assignments, storage, or infrastructure.
- Do not read or persist unapproved production credentials, tokens, cookies, raw PII, or exports.
- Do not guess D1/D2. Work independent of those decisions may proceed; dependent work stops at the decision boundary.
- Preserve Logto as identity/role authority, Astra as domain-state/API authority, and Chronos as the administrative experience.
- Cross-repository changes must be backward-compatible and document rollout plus rollback order.
- Existing uncommitted audit/design/documentation work belongs to the user and must be preserved.
- AGY builders edit only dedicated worktrees and return commits; scouts are read-only.

# Relevant Areas

- Audit source: `/home/robin/project/.scratch/chronos-settlement-audit/`.
- Chronos: `src/lib/astra/`, `src/lib/logto/`, `src/server/api/`, `src/server/auth/`, `src/app/api/`, `src/components/`, `contracts/`, `tests/`, `e2e/`, `.github/workflows/`, and `docs/`.
- Astra: `/home/robin/project/project-astra/src/modules/admin/`, request-ID middleware, contract/OpenAPI artifacts, and relevant tests.
- Continuity and worker contracts: `.agent/TRACKER.md`, `.agent/HANDOFF.md`, and `.agent/AGY_DISPATCH.md`.

# Implementation Notes

- Execute in dependency order: deterministic auth fix; contract/request-ID and RBAC foundation; complete paging; authoritative export/backup; CI gates; decision-dependent domain work; human sign-off preparation.
- Use Tier-2 verified graph evidence for each bounded implementation and direct source fallback for non-code files or coverage gaps.
- Keep primary-agent ownership of architecture, integration, all diff review, and final verification.

# Round 2 UI/UX Brief

- Mode: Operate. Chronos should feel like a professional, calm dashboard for school administrators while remaining friendly, predictable, and easy to scan under repetitive daily use.
- Priority: WCAG 2.2 AA, keyboard/focus behavior, readable data detail, clear loading/empty/error/success states, responsive reflow, and quick actions placed consistently near the records they affect.
- Visual direction: preserve shadcn/ui and the incumbent identity; use typography, alignment, spacing, borders, and restrained semantic color as the primary hierarchy. Add only subtle-but-visible control/surface depth so buttons and layers feel tangible without heavy shadow.
- Scope boundary: Round 2 starts after settlement P0/P1 stability. It is a bounded usability/a11y/polish pass, not a decorative redesign, new feature program, or change to unresolved D1/D2 domain semantics.
- Proof: representative desktop and mobile flows are keyboard-operable, labels/states are understandable without color alone, touch targets are adequate, frequent actions take no unnecessary navigation, and one batched visual QA pass finds no material hierarchy or overflow defect.
