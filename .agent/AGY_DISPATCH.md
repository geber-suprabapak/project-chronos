# AGY Dispatch Ledger

## Environment Gate

- Checked again: 2026-09-04.
- Result: available with `HERDR_ENV=1` and workspace `w19`.
- Scout tabs `w19:tX`, `w19:tY`, and `w19:tZ` were collected and closed.
- All builder tabs and dedicated worktrees created for phases 2–3 have been collected and cleaned.

## Active Dispatches

| Worker | Tab | Pane | Role | Objective | Status | Cleanup |
| --- | --- | --- | --- | --- | --- | --- |
| `chronos-rbac-scout` | `w19:tY` | `w19:pY` | scout | Evidence-complete role/action matrix and issue 04 gaps | collected | closed |
| `chronos-data-scout` | `w19:tX` | `w19:pX` | scout | Audit current paging work and issues 01/05 gaps | collected | closed |
| `chronos-gates-scout` | `w19:tZ` | `w19:pZ` | scout | Audit issue 03 contract/request-ID and issue 08 CI gaps | collected | closed |

All three scouts are read-only, share no editing authority, and must return exact paths/lines, commands/results, remaining gaps, and a conflict-free builder or executor package proposal. The primary agent retains architecture, integration, diff review, and final verification.

## Active Builder Wave

| Worker | Workspace / pane | Worktree / branch | Owned package | Status | Cleanup |
| --- | --- | --- | --- | --- | --- |
| `astra-boundary-builder` | `w1F` / `w1F:p1` | `/home/robin/project/.worktrees/astra-settlement-boundaries` / `agy/astra-settlement-boundaries-20260904` | Astra request ID, attendance paging/date/direct lookup, envelopes, canonical contract, focused tests | accepted and integrated as `b41f4c8000b09973d4def9e20609548a04fc79a3` | workspace and worktree cleaned |
| `chronos-correlation-builder` | `w1D` / `w1D:p1` | `/home/robin/project/.worktrees/chronos-correlation` / `agy/chronos-correlation-20260904` | Chronos ingress/tRPC/Astra/export correlation and canonical leave reopen | accepted and integrated as `08d2fb9090ccc0909baa834970c0164abdd49def`; file-proxy semantics reserved for composite RBAC merge | workspace and worktree cleaned |
| `chronos-rbac-builder` | `w1C` / `w1C:p1` | `/home/robin/project/.worktrees/chronos-rbac` / `agy/chronos-rbac-20260904` | Unambiguous role/action visibility, page guards, file-proxy authorization, tests/docs | accepted and integrated as `bc1373907920b0461eecb8bee02368fc7926aed6`; primary merged the file-proxy correlation composite | workspace and worktree cleaned |
| `chronos-ci-builder` | `w19:t11` / `w19:p11` | `/home/robin/project/.worktrees/chronos-ci-gates` / `agy/chronos-ci-gates-20260904` | Issue 08 CI gate wiring, dependency audit, Playwright setup/artifacts, tracked-report cleanup | accepted and integrated as `8a661b6` with primary amendments | tab and worktree cleaned |
| `chronos-paging-builder` | `w19:t12` / `w19:p12` | `/home/robin/project/.worktrees/chronos-paging` / `agy/chronos-paging-20260904` | Issue 01 complete attendance paging, explicit UI page metadata, direct lookup, exact-multiple perizinan fix, large-dataset tests | accepted and integrated as `8931d3f67f677b3ccc8012e7f22a8836004f1d0d` with a primary RBAC-aware attendance-page merge | tab and worktree cleaned |
| `chronos-export-scout` | `w19:t13` / `w19:p13` | dirty Chronos and Astra read-only | Map issue 05 server-side export/backup, audit-record seams, and exact D1/D2 blockers | collected; decision-independent packages accepted for dispatch | tab closed |
| `chronos-responsive-scout` | `w19:t14` / `w19:p14` | dirty Chronos read-only | Establish issue 08 mobile/tablet/a11y gate gaps and bounded round-two UI priorities | collected; 21 viewport probes passed while exposing measured overflow/a11y blockers | tab closed |
| `astra-backup-builder` | `w19:t15` / `w19:p15` | `/home/robin/project/.worktrees/astra-backup-audit` / `agy/astra-backup-audit-20260905` | Add admin-only persisted backup audit/status module and deepen audit-log provider return interface | accepted and integrated | tab and worktree cleaned |
| `chronos-backup-builder` | `w19:t16` / `w19:p16` | `/home/robin/project/.worktrees/chronos-backup-export` / `agy/chronos-backup-export-20260905` | Add authoritative absences XLSX/PDF module, audited monthly backup routes, and server-backed banner | accepted with primary fail-closed/date-bound amendments and integrated | tab and worktree cleaned |
| `chronos-ui-builder` | `w19:t17` / `w19:p17` | `/home/robin/project/.worktrees/chronos-ui-foundation` / `agy/chronos-ui-foundation-20260905` | Fix non-absensi responsive/a11y blockers and add desktop/mobile/tablet CI projects with axe gate | selectively accepted and integrated; RBAC/package contract preserved | tab and worktree cleaned |
| `chronos-platform-scout` | `w19:t18` | dirty Chronos read-only | Map issue 09 delivery/observability gaps | collected and used by primary | tab closed |
| `chronos-platform-builder` | `w19:t19` | `/home/robin/project/.worktrees/chronos-phase3-platform` | Implement issue 09 | rejected after prohibited `.env` copy; no code accepted | copied file deleted uninspected; tab/worktree cleaned |
| `chronos-platform-clean` | `w19:t1A` | `/home/robin/project/.worktrees/chronos-phase3-platform-clean` | Replacement issue 09 builder | cancelled before accepted work at user request | tab/worktree cleaned |

Each builder is isolated from the dirty primary worktrees, was told to inspect the primary partial implementation only as read-only reference, owns a non-overlapping bounded path set, and must return a clean commit plus verification evidence. No builder commit is accepted until primary diff review and full integration tests pass.

## Shared Verified Context

- Evidence tier: Tier 2 (Verify).
- Chronos graph: `home-robin-project-project-chronos`, generation `2026-09-04T12:28:36Z`, full index, HEAD `ad4dc126b0d276d8d19c162245eba2fa43444133`.
- Astra graph: `home-robin-project-project-astra`, generation `2026-09-02T08:04:08Z`, full index, HEAD `8efa17feae0dc719c4538fd658e25fce3a346acb`.
- Relevant qualified symbols:
  - `home-robin-project-project-chronos.src.lib.astra.client.astraRequest`
  - `home-robin-project-project-chronos.src.server.api.routers.history-query.buildAttendanceListPath`
  - `home-robin-project-project-chronos.src.lib.logto.post-logout-redirect.getPostLogoutRedirectUri`
  - `home-robin-project-project-chronos.src.app.api.astra.files.route.POST`
  - `home-robin-project-project-astra.src.modules.admin.routes.handleDeleteAttendance`
  - `home-robin-project-project-astra.src.modules.admin.routes.handleReopenLeaveRequest`
- Coverage: no recorded issue on Chronos `src/lib/astra/client.ts`, `src/server/api/routers/history-query.ts`, `src/server/api/routers/absences.ts`, `src/lib/logto/post-logout-redirect.ts`, `e2e/fixtures/start-servers.ts`, `e2e/auth.spec.ts`, `src/app/api/astra/files/route.ts`, `src/server/auth/rbac.ts`, `src/components/app-sidebar.tsx`, `contracts/astra-v1.json`, `.github/workflows/buildtest.yml`; or Astra `src/modules/admin/routes.ts`, `src/modules/admin/service.ts`, `src/middleware/request-id.ts`. Signal is best-effort. The probed Astra path `openapi/astra-v1.json` was missing and must be discovered from source.

## Pending Dispatch 1 — Contract Scout

Status: ready when Herdr becomes available.

```text
Role: scout
Objective: Establish the exact current Chronos–Astra v1 route/header/envelope/scope/idempotency contract delta for settlement issue 03.
Authoritative context: /home/robin/project/project-chronos/.agent/SPEC.md; /home/robin/project/.scratch/chronos-settlement-audit/issues/03-sync-astra-contract.md; shared Tier-2 graph evidence in .agent/AGY_DISPATCH.md.
Scope: Read-only in /home/robin/project/project-chronos/{contracts,src/lib/astra,src/server/api,src/app/api,tests,e2e} and /home/robin/project/project-astra/{src/modules/admin,src/middleware,tests,docs,openapi,contracts}; exclude production/runtime access and all edits.
Execution: Read source and run non-mutating repository searches/tests only. Locate the actual Astra canonical contract artifact; compare every Chronos-used Astra route, method, body, response/error envelope, required scope, request ID, and idempotency behavior. Check delete attendance and leave reopen specifically. Do not make architecture decisions.
Deliverable: A fact table of matched/missing/drifted operations with exact paths/lines; canonical-source candidates; existing relevant test commands/results; backward-compatible rollout constraints; open questions. Include all commands run.
Stop condition: Stop after every Chronos call site in scope is mapped or when one concrete missing decision prevents further factual mapping.
```

## Pending Dispatch 2 — RBAC Scout

Status: ready when Herdr becomes available.

```text
Role: scout
Objective: Map the implemented and intended role/action surface needed to complete settlement issue 04 without assuming product permissions.
Authoritative context: /home/robin/project/project-chronos/.agent/SPEC.md; PRODUCT.md; docs/rbac-implementation.md; /home/robin/project/.scratch/chronos-settlement-audit/issues/04-enforce-role-surface.md; shared Tier-2 graph evidence in .agent/AGY_DISPATCH.md.
Scope: Read-only in src/server/auth, src/server/api, src/app/api, src/components/app-sidebar.tsx, src/components/nav-main.tsx, src/lib/logto, tests, e2e, and relevant Astra scope checks. No edits and no production access.
Execution: Enumerate route/action/navigation/export/file-proxy guards for unauthenticated, password-change-required, student/siswa, staff, teacher/guru/wali_kelas, school_admin/admin/kepala_sekolah, and platform_admin. Separate observed code from missing product decisions.
Deliverable: Exact matrix with path/line evidence, aliases, guard gaps, reusable helpers, test coverage, and unanswered policy questions. Include commands run.
Stop condition: Stop when every in-scope surface has an observed guard classification and every unknown is isolated as a question.
```

## Pending Dispatch 3 — Paging Scout

Status: ready when Herdr becomes available.

```text
Role: scout
Objective: Trace end-to-end paging, filtering, sorting, aggregation, listRaw, export, and backup ownership for settlement issues 01 and 05.
Authoritative context: /home/robin/project/project-chronos/.agent/SPEC.md; /home/robin/project/.scratch/chronos-settlement-audit/issues/01-complete-data-paging.md; /home/robin/project/.scratch/chronos-settlement-audit/issues/05-make-backup-export-authoritative.md; shared Tier-2 graph evidence in .agent/AGY_DISPATCH.md.
Scope: Read-only in Chronos history/query routers, attendance/leave/profile routers, export routes, backup components, tests/e2e, and matching Astra list/admin services/stores/contracts. No production queries, no writes, and no edits.
Execution: Determine actual Astra pagination metadata/cursor behavior and all places Chronos applies client/server filtering, sorting, offset, statistics, or row-length hasNext inference. Identify reusable complete-pagination seams and D1/D2-dependent behavior.
Deliverable: Data-flow map, exact truncation points, current response shapes, recommended implementation seams stated as options rather than a verdict, synthetic test-fixture requirements for 0/99/100/101/>1500, and blockers. Include commands run.
Stop condition: Stop after all issue 01/05 evidence paths and downstream consumers are mapped or at the first external contract fact that cannot be established locally.
```
