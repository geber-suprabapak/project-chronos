# AGY Master Prompt — Complete Chronos Settlement

You are the execution lead for the complete Skanida Chronos settlement. Work autonomously from evidence until every roadmap phase is implemented and verified. Start by resolving D1 and D2, record both decisions, then complete the remaining work in dependency order. Do not stop after producing an audit or plan: implement fixes, run proportionate verification, repair failures, update durable documentation, and prepare final human sign-off evidence.

## Mission

Bring Chronos to a genuinely settled state before new product features begin:

1. Resolve the outstanding domain decisions D1 and D2.
2. Reconcile and complete any residual Phase 0–3 work.
3. Complete Phase 4 UI/UX, accessibility, responsive, language, and geocoding work.
4. Complete Phase 5 dependency upgrades and proven legacy cleanup.
5. Complete Phase 6 verification and sign-off preparation.
6. Keep production safe. Repository/local/mock work is authorized; production mutations require an explicit approval gate.

Completion means implementation and evidence, not a plausible status report.

## Workspace and authoritative sources

- Workspace: `/home/robin/project`
- Chronos repository: `/home/robin/project/project-chronos`
- Astra repository: `/home/robin/project/project-astra`
- Audit specification: `/home/robin/project/.scratch/chronos-settlement-audit/spec.md`
- Roadmap: `/home/robin/project/.scratch/chronos-settlement-audit/map.md`
- Audit report: `/home/robin/project/.scratch/chronos-settlement-audit/report.md`
- Issue details: `/home/robin/project/.scratch/chronos-settlement-audit/issues/01-*.md` through `15-*.md`
- Chronos continuity: `/home/robin/project/project-chronos/.agent/{SPEC,TRACKER,HANDOFF,AGY_DISPATCH}.md`
- Domain and design sources: `CONTEXT.md`, `PRODUCT.md`, `DESIGN.md`, `docs/adr/`, `docs/codebase-map/`
- Repository instructions: nearest `AGENTS.md` files and `/home/robin/.codex/RTK.md`
- Infrastructure reference: `/home/robin/project/docs/agents/infrastructure.md`

Read the instructions and relevant issue files before editing. Treat current files and Git state as authoritative. The working trees are intentionally dirty from prior audit/remediation work: preserve all existing user changes and integrate with them. Never reset, discard, overwrite, or broadly reformat unrelated work.

## Current known state — verify, do not blindly redo

- The audit found no P0.
- Phase 2 repository work is substantially implemented: deterministic Logto handoff, complete authoritative server-side exports, Astra-persisted backup audit/status, and fail-closed backup UI.
- Phase 3 repository work is substantially implemented: expanded CI gates, desktop/tablet/mobile Playwright projects, liveness/readiness, security headers, structured operational events, OCI metadata, provenance/SBOM, digest-required Compose deployment, and rollback documentation.
- Previous validation evidence includes complete Chronos unit suites, cross-repo contract checks, Astra unit/integration suites, Playwright coverage, a passing current `pnpm check`, a passing production build, and a passing digest-pinned `docker compose config -q`.
- Generated Playwright reports are intended to be ignored and removed from version control.
- Known unresolved mismatch: Chronos exposes operational `/siswa`/roster-backed behavior to teacher/staff roles while Astra's current `/v1/admin/students` boundary is admin-only.
- D1 and D2 were intentionally left unresolved. This prompt now authorizes you to resolve them using repository/domain evidence and the principles below.

Confirm the actual current state before relying on any item above. Retain correct work, improve incomplete work, and replace incorrect work narrowly.

## Operating contract

### Evidence loop

For every issue or phase:

1. Read its acceptance criteria and identify the exact code, docs, configuration, and runtime evidence needed.
2. Inspect current implementation and relevant call sites across Chronos and Astra.
3. Record whether each criterion is proven, contradicted, incomplete, or missing.
4. Implement the smallest coherent production fix that satisfies the real criterion.
5. Add only high-value tests that exercise production code or shared schemas.
6. Run targeted checks while iterating; run full gates only at meaningful phase checkpoints and once at final settlement.
7. Repair failures before moving on. Never redefine success around tests that happen to pass.
8. Update issue evidence, domain docs, semantic map, tracker, and handoff while the facts are fresh.

### Test economy

Keep the suite rigorous but compact. Reuse fixtures, table-driven cases, and shared helpers. Avoid redundant permutations, screenshot spam, duplicate parser implementations, or tests that restate framework behavior. During implementation run only tests touching the changed seam. Run the complete required matrix at the final gate and at dependency-upgrade checkpoints where isolation is necessary.

### Safety

- Local repositories, local services, mocks, synthetic fixtures, documentation, and reversible build artifacts are in scope.
- Production inspection is read-only until explicit approval is received.
- Never expose or persist tokens, cookies, credentials, raw PII, database contents, `.env` contents, or exported student data.
- Use only an explicitly approved credential/session source for authenticated production smoke.
- Before any deploy, restart, migration, credential, database, storage, IAM, DNS, proxy, container, or other shared-state mutation, stop and ask for explicit approval. State the exact command/action, blast radius, rollback, and evidence collected first.
- Do not use destructive shortcuts such as volume deletion, broad prune, forced replacement, reset, or independent credential changes.
- Domain migrations must be backward-compatible, staged, and separately approved before production execution.

## Phase 0 — Resolve D1 and D2 first

You have authority to make these product/domain decisions in the repositories. Do not leave them as `needs-info` merely because alternatives exist. Use existing behavior, user workflows, Astra ownership, least privilege, migration cost, and semantic clarity to choose the best model. If evidence strongly contradicts the preferred baseline below, choose the evidence-backed alternative and explain why.

### D1 — Profiles versus Data Siswa

Preferred baseline:

- `/profiles` is the admin-only account lifecycle/directory surface for identity-backed people and account administration.
- `/siswa` is the operational student roster for school workflows.
- Teachers and authorized staff may read the minimum student roster needed for attendance/leave work; account lifecycle fields and actions remain admin-only.
- Astra remains the domain data authority and must expose an explicit least-privilege roster contract rather than making Chronos depend on an admin-only endpoint.
- Profile export and student-roster export have distinct names, fields, scopes, and authorization.

Required result:

- Inspect actual data models, routes, roles, UI, exports, and Astra policies.
- Choose and document one definition in `CONTEXT.md` and an ADR.
- Define field ownership, allowed actions, role visibility, export scope, route naming, and redirect/migration compatibility.
- Implement matching Chronos IA/navigation/page guards/export behavior and Astra route/scope policy.
- Update the cross-repo contract and role matrix.
- Cover unauthenticated, password-change-required, student, staff, teacher/wali kelas, school admin, platform admin, and supported legacy aliases.
- Remove the `/siswa` versus `/v1/admin/students` mismatch without widening account-administration access.

### D2 — Attendance taxonomy

Preferred modeling principle:

- Separate attendance events from daily attendance state.
- `action_type` represents the event/action, such as check-in or check-out.
- Canonical status/category represents the interpreted daily result or exception.
- Indonesian labels are presentation, not competing domain values.
- Leave categories, lateness, dismissal, absence, and historical legacy values need explicit compatibility rules.

Required result:

- Inventory every persisted value and mapping in Astra, Chronos, Bronya-facing contracts if relevant, filters, statistics, manual entry, exports, and historical fixtures.
- Select canonical event types, daily states, exception/leave categories, legal state transitions, aggregation rules, and Indonesian labels.
- Document the vocabulary and transition model in `CONTEXT.md` plus an ADR shared by Chronos/Astra.
- Define backward-compatible read mapping and any required migration/backfill plan. Do not mutate production data without approval.
- Implement one shared model across Astra contract, Chronos types/parsers, UI filters, statistics, manual entry, and exports.
- Add focused compatibility tests for legacy values and canonical output.

Phase 0 is complete only when both ADRs exist, code and contract reflect them, dependent issue statuses are updated, and no unresolved semantic fork remains.

## Phase 1 — Reconcile contracts, data completeness, and authorization

Re-audit issues 01, 03, 04, and 07 after D1/D2. Preserve passing work and close residual gaps.

- Confirm one canonical versioned Chronos–Astra contract covers every used route, method, request/response/error envelope, request ID, pagination field, authorization scope, and idempotency behavior.
- Ensure contract drift fails CI and rollout/rollback order remains backward-compatible.
- Prove complete, stable paging and ordering for 0, 99, 100, 101, exact multiples, and more than 1,500 records without silent truncation or success fallback to empty data.
- Ensure filters and date/timezone boundaries have one documented owner and semantics.
- Enforce the D1-derived role/action matrix consistently in navigation, layouts/pages, tRPC, route handlers, exports, upload/delete behavior, and Astra endpoints.
- Keep file proxy MIME/extension validation, correlation IDs, and least privilege aligned.
- Harden Astra client behavior for non-JSON errors, timeouts, contract mismatch, invalid envelopes, and dependency/network failures with accessible UI error states.

Exit only when issues 01, 03, 04, and 07 meet their acceptance criteria across both repositories.

## Phase 2 — Revalidate core flows

Re-audit issues 02 and 05 against the newly resolved domain model.

- Verify Logto sign-out and password-change handoff use canonical registered origins and deterministic local/E2E configuration.
- Confirm protected-route redirect behavior and post-password-change behavior.
- Ensure PDF/XLSX exports are generated server-side from complete authoritative data, never from visible DOM rows.
- Ensure export field sets, labels, role scopes, timezone, date bounds, and filenames follow D1/D2 and canonical Indonesian copy.
- Ensure backup job/audit state is persisted server-side with actor, scope, range, checksum, outcome, and correlation metadata.
- UI success must be derived from validated persisted success and must fail closed on malformed or missing status.
- Prove completeness above 100 records using compact production-code tests.

Exit only when auth, export, backup, and relevant write paths are trustworthy under the final D1/D2 model.

## Phase 3 — Revalidate automated gates, delivery, and observability

Re-audit issues 08 and 09. Improve only real gaps.

- CI must enforce dependency audit, formatting/lint, typecheck, unit, integration/contract, contract drift, production build, representative E2E, role matrix, large-dataset cases, mobile/tablet coverage, and mock write paths.
- Tests must import production code/shared schemas rather than reimplement parsers.
- Failure artifacts must be uploaded by CI and ignored locally.
- Preserve compatibility `GET /api/health` behavior while maintaining explicit liveness and dependency-aware readiness with bounded timeouts and no mutation.
- Security headers must be canonical and eventually verified at public ingress.
- Operational signals must make request/error rate and latency derivable and distinguish Astra, auth, tRPC, and export failures without logging sensitive payloads or stacks.
- Published images must carry revision/build/version metadata, provenance, SBOM, and an immutable digest reference.
- Compose/deployment must reject an unspecified mutable image reference.
- Rollback documentation must identify the previous digest and representative verification path.

Exit only when repository gates are green and remaining public-runtime checks are explicitly queued for Phase 6.

## Phase 4 — Usability, accessibility, responsive UI, and geocoding

Complete issues 06 and 12 using the design direction already approved:

- Professional, calm school-administration dashboard.
- Friendly, predictable, data-detailed, and fast for repetitive work.
- Preserve shadcn/ui and existing identity.
- Use typography, alignment, spacing, borders, restrained semantic color, and subtle but visible elevation/button depth.
- Avoid decorative redesign or unnecessary motion.

Required UI outcomes:

- Dashboard, profiles, siswa, absensi, perizinan, lokasi, jadwal, upload, and export flows work keyboard-only and meet WCAG 2.2 AA.
- Fix labels/names, focus visibility/order, dialog semantics, nested interactive controls, contrast, touch targets, and non-color-only states.
- Viewports 1440×900, 1024×768, and 390×844 preserve content and quick actions without clipping or unnecessary nested scroll.
- Client navigation preserves active state and correct titles on subroutes.
- Metadata, labels, validation, loading/empty/error/success states, dialogs, pagination, and export copy use canonical Indonesian.
- Repetitive quick actions stay near the records they affect and do not add unnecessary navigation.
- Visual QA is batched once after functional fixes; retain only useful evidence and do not commit generated reports.

Required geocoding outcomes:

- Replace direct browser-to-Nominatim fan-out with one internal Chronos boundary.
- Add input validation, provider identification, timeout, rate limiting, cache, in-flight deduplication, and privacy-safe logging.
- Client issues one debounced request per query, supports cancellation, and announces empty/error/loading results accessibly.
- Add compact tests for cache hit, rate limit, timeout, and empty result.

Exit only when issue 06 and 12 acceptance criteria pass on representative desktop/tablet/mobile flows.

## Phase 5 — Dependencies and proven legacy cleanup

Complete issues 10 and 11 in controlled batches.

### Dependencies

- Inspect current `package.json`, lockfile, release notes, deprecations, peer ranges, runtime support, and security audit using current primary documentation.
- Upgrade in coherent checkpoints: toolchain/lint, React/Next framework, UI/data libraries, then export stack.
- Prefer supported stable versions and smallest compatible migrations; do not chase versions without product value.
- At each checkpoint run targeted checks plus the full gate needed to isolate upgrade regressions.
- Eliminate the `exceljs -> uuid` advisory if an upstream upgrade permits it. Otherwise document exact exposure, mitigation, owner, review date, and risk acceptance rather than hiding it.
- Keep the lockfile frozen-install deterministic and scan the final image/dependency tree.

### Legacy cleanup

- For every deletion candidate, gather import/reference/runtime/build evidence first and record retain/archive/delete.
- Confirm Astra is the source of truth before archiving/removing legacy SQL or database helpers.
- Evaluate SQL history, `db-utils`, Drizzle lint/config residue, generic scaffold README content, unused example components, unused chart/export packages, stale scripts, aliases, and dead routes.
- Delete only proven residue; archive migration history when it still has historical value.
- Update package manifests, documentation, and semantic codebase map with every accepted batch.

Exit only when dependencies are controlled, vulnerabilities are eliminated or explicitly accepted, frozen install works, and every cleanup action is evidence-backed.

## Phase 6 — Full settlement verification and sign-off

### Local and CI-equivalent final gate

From a deterministic environment, run and repair until green:

- Formatting/lint and typecheck.
- Chronos unit and production-code contract tests.
- Astra unit and integration tests affected by settlement.
- Cross-repository contract drift verification.
- Production builds for changed repositories.
- Dependency/security audit and final image scan where tooling is available.
- Representative full E2E including auth, role matrix, paging, export/backup, upload/write mock, network failure, desktop, tablet, mobile, keyboard, and axe.
- Digest-pinned Compose/deployment configuration validation.
- Ensure generated reports, downloads, screenshots, secrets, and local database artifacts do not pollute Git.

Do not claim a broad gate from a narrow test. If a required gate cannot run, identify the exact missing evidence and solve it or surface the concrete external blocker.

### Production read-only evidence

Without mutating production:

- Verify Chronos, Astra, and Logto runtime health/readiness and dependency connectivity.
- Verify canonical public-ingress security headers.
- Record the deployed immutable digest and revision/build metadata and compare them with the intended release.
- With an explicitly approved admin test account/session, smoke login, role-visible navigation, dashboard, representative lists/details, and only the downloads explicitly approved as read-only-safe.
- Record aggregate/sanitized evidence only; do not capture raw PII or session material.
- Inspect representative structured signals for readiness, latency, Astra failure visibility, auth failure visibility, and export visibility.

If the intended settlement release is not deployed, prepare the exact immutable deployment and rollback procedure. Request explicit approval immediately before executing it. After approval, deploy declaratively, verify dependency connectivity plus representative end-to-end behavior, and perform or simulate the approved rollback drill as specified by the maintainer. Never infer approval from this prompt.

### Documentation and final human gate

- Ensure `PRODUCT.md`, `DESIGN.md`, `CONTEXT.md`, ADRs, contract, runbooks, semantic map, audit issue status, `.agent/TRACKER.md`, and `.agent/HANDOFF.md` match the final implementation.
- For every remaining P2/P3 item, assign an owner, target, and explicit risk acceptance. Nothing may silently remain open.
- Produce a concise requirement-by-requirement evidence table with commands/results and runtime observations.
- Present the maintainer with the final approval statement: `Chronos settled; fitur baru boleh dimulai.`
- Only the maintainer may give that final approval. Do not self-approve it.

## Final completion criteria

Do not stop until all conditions below are true, or one concrete approval/credential/external-state blocker prevents further safe progress:

- D1 and D2 are decided, documented, and implemented across Chronos/Astra.
- No P0/P1 issue remains open except the final maintainer-only approval step.
- Issues 01–14 meet their acceptance criteria or have an explicit, approved risk acceptance where the issue permits one.
- Every required automated gate passes against current source.
- Paging/export completeness and stable ordering are proven beyond previous limits.
- Role visibility and server authorization match for every supported role.
- Main UI flows meet the agreed professional-friendly design direction and representative WCAG/responsive gates.
- Dependency and legacy cleanup evidence is current.
- Immutable image, metadata, provenance, SBOM, readiness, security headers, observability, and rollback evidence are present.
- Production was not mutated without explicit approval.
- Working trees contain no accidental generated artifacts or unrelated reversions.
- Continuity/docs state exactly what changed, what passed, and what still requires the maintainer.

## Required final response

Return:

1. The D1 and D2 decisions and ADR paths.
2. Phase-by-phase outcomes and changed paths.
3. A compact acceptance/evidence table for issues 01–15.
4. Exact validation commands and pass/fail counts.
5. Dependency/security and image provenance results.
6. Production read-only evidence, with sensitive values omitted.
7. Any approval-gated action that remains, including blast radius and rollback.
8. Git state and any intentionally uncommitted work.
9. The single maintainer decision still needed, if all technical work is complete.

Do not return only recommendations. Continue implementing and repairing until the completion criteria are actually demonstrated.
