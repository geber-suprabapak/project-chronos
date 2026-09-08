# Objective

Reject invalid and unsafe roster workbooks with a complete bounded report in
Chronos and prevent Astra staging/acceptance for locally invalid input.

# Requirements

- Parse only `.xlsx` workbooks within 5 MiB, 50 worksheets, 100 rows/sheet,
  and 2,000 rows/workbook.
- Report corrupt, encrypted, macro-enabled, malformed, structurally unknown,
  incomplete, duplicate, unsafe, or mismatched roster data with worksheet and
  row provenance.
- Preserve valid rows in invalid reports when available; never partially
  accept a report.

# Acceptance Criteria

- Every ticket-03 checklist item is covered by focused parser, tRPC, and UI/E2E
  behavior where applicable.
- Invalid local reports make no Astra stage/accept request; Astra-invalid
  reports keep accept disabled.
- Existing valid Ticket02 flow remains green.

# Constraints

- Chronos owns workbook parsing/presentation; Astra remains authoritative for
  canonical validation and persistence.
- Reuse ExcelJS and existing roster flow; no new dependencies or Astra edits.
- Work only in ticket-03 isolated worktree and branch.

# Relevant Areas

- `src/server/roster/parser.ts`
- `src/server/api/routers/roster-import.ts`
- `src/components/roster-import-panel.tsx`
- `tests/roster-workbook.test.ts`
- `e2e/siswa.spec.ts`, `e2e/fixtures/mock-server.ts`

# Implementation Notes

Extend the existing parser report with bounded validation/provenance and keep
the router's local-failure short circuit. Normalize/validate source cells at
the parser boundary, add duplicate checks and workbook safeguards, then make
the panel show both local and Astra rejected rows and guard acceptance.
