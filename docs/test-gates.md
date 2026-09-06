# CI Quality Gates and Test Artifacts

This document defines the settlement-grade CI quality gates and test artifact policies for Project Chronos.

## Quality Gates Pipeline

All pull requests and commits targeting `master` must pass every gate in the `verify` job before deployment or image publication.

The publication job (`publish`) strictly depends on `verify` (`needs: verify`). In accordance with settlement invariants, jobs never use `continue-on-error` or mock success.

| Gate | Execution Command | Gate Condition & Threshold |
| --- | --- | --- |
| **Dependency Security Audit** | `pnpm audit --audit-level=high` | **Threshold:** Fails on any vulnerability with severity `high` or `critical`. Permitted exception: single moderate advisory in `exceljs > uuid` (<11.1.1 missing buffer bounds check) pending upstream resolution. |
| **Lint & Formatting** | `pnpm lint` | Fails on any Oxlint warning/error or Prettier formatting discrepancy across `.js`, `.jsx`, `.ts`, `.tsx`, and `.json` files. |
| **Typecheck** | `pnpm typecheck` | Fails on any TypeScript compiler diagnostic (`tsc --noEmit`). |
| **Unit & Contract Suite** | `pnpm test` | Fails if any unit test or API contract test fails. CI supplies explicit non-secret fixture values. |
| **Empirical Settlement Suite** | `pnpm test:empirical` | Runs the Bun-backed adversarial and empirical suites that exercise route mocking, export generation, taxonomy, observability, and dependency stress cases. |
| **Canonical Contract Drift** | `pnpm contract:check` | Compares checked-in `contracts/astra-v1.json` against canonical Astra contract from `geber-suprabapak/project-astra`. Fails on contract drift. |
| **Production Build** | `pnpm run build` | Verifies Next.js Turbopack production compilation, standalone output bundling, and static route generation with `SKIP_ENV_VALIDATION=1`. |
| **End-to-End Suite** | `pnpm test:e2e` | Executes Playwright E2E suite using headless Chromium against mock Astra and Logto servers with fixture-owned non-secret configuration. |

## Test Environment Invariants

1. **Isolated Port & Fixture Environment**:
   - Tests must never require production secrets or developer personal credentials.
   - CI and test harnesses run on isolated ports to prevent collisions with parallel worktrees: Chronos app (`3055`), Mock Astra (`23500`), Mock Logto (`23501`).
   - `LOGTO_POST_LOGOUT_REDIRECT_URI` is owned by the test runner (`http://localhost:3055/login`) to prevent session leaking across environments.

2. **Browser Installation**:
   - Headless Chromium is installed in CI using `pnpm exec playwright install --with-deps chromium`.

3. **Artifact Retention & Worktree Cleanliness**:
   - Test reports and results (`playwright-report/` and `test-results/`) are ignored via `.gitignore` and must remain untracked.
   - In CI, failure evidence (traces, screenshots, videos, and HTML report) is automatically captured and uploaded via `actions/upload-artifact@v4` with `if: failure()` and a 14-day retention window.

## Coverage Scope & Viewport Matrices

| Project | Viewport | Scope | Quality Gate Expectations |
| --- | --- | --- | --- |
| **Desktop** | 1440x900 | Full E2E Suite (`e2e/**/*.spec.ts`) | Functional regressions, auth flows, navigation, data grids, modals, and responsive-a11y suite at 1440px desktop baseline. |
| **Tablet** | 1024x768 | Responsive & A11y Suite (`e2e/a11y-responsive.spec.ts`) | Viewport containment, clipping detection, WCAG serious/critical compliance via `@axe-core/playwright`, no nested interactive controls, and keyboard navigation. |
| **Mobile** | 390x844 | Responsive & A11y Suite (`e2e/a11y-responsive.spec.ts`) | Mobile viewport containment, horizontal overflow elimination, clipping detection, WCAG serious/critical compliance via `@axe-core/playwright`, no nested interactive controls, and touch target readiness. |

### Accessibility & Responsive Gates (`e2e/a11y-responsive.spec.ts`)

The responsive accessibility suite runs against all owned routes (`/dashboard`, `/absensi`, `/perizinan`, `/profiles`, `/siswa`, `/konfigurasi/jadwal`, `/konfigurasi/lokasi`) across desktop, tablet, and mobile viewports:
1. **Document Language**: Asserts `document.documentElement.lang === "id"`.
2. **Horizontal Overflow Containment**: Asserts `document.documentElement.scrollWidth <= window.innerWidth` to ensure full responsiveness without horizontal page breakout.
3. **Clipping & Bounding Verification**: Validates visible owned layout containers (`main`, cards, dialogs) do not bleed past the viewport right edge, catching layout clipping that could be masked by root `overflow-x: hidden`.
4. **No Nested Interactive Elements**: Validates DOM hierarchy to ensure interactive elements (e.g. `button`, `a`, `input`, `select`) are never nested within another interactive control (WCAG 4.1.2).
5. **Automated Axe-Core Auditing**: Scans with `@axe-core/playwright` across standard WCAG tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), failing strictly on `serious` or `critical` violations.
6. **Keyboard Focus & Navigation**: Validates keyboard focus navigation across key interactive controls and combobox active option traversal.

The gate covers the primary dashboard and authoritative attendance list. Secondary route variants remain subject to the same shared component and layout constraints.
