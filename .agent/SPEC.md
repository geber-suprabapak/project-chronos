# Objective

Implement Chronos Ticket 02: upload the official roster workbook, parse and
normalize it server-side, preview the complete staged report, and accept it
atomically through Astra without creating identities.

# Requirements

- Parse the first official `No`, `NIS`, `Nama Siswa`, `L/P` block per worksheet.
- Preserve cached formula values, normalize source text, and map class metadata.
- Stage through Astra, show rows/errors/provenance before writing, and accept only a valid report.
- Restrict the workflow to School Administrators and preserve `/siswa` directory behavior.

# Acceptance Criteria

- Variable header/data-row position, multiple sheets, cached formula NIS, and mirrored-column exclusion are covered at the parser seam.
- Preview and accept are public tRPC/API seams with no persistence before explicit accept.
- Browser flow proves upload -> preview -> accept.

# Constraints

- Use installed ExcelJS; server-only parsing; no new dependency.
- Ticket 02 only. Do not implement Ticket 03 invalid-case matrix or unrelated roster/export work.
- Astra remains owner of persistence. Correct the Astra public contract only if required to expose an already implemented academic-period read route.

# Relevant Areas

- `src/app/(main)/siswa/page.tsx`
- `src/server/api/routers/biodata-siswa.ts`
- `src/lib/astra/client.ts`
- `e2e/fixtures/mock-server.ts`, `e2e/fixtures/data.ts`, `e2e/siswa.spec.ts`

# Implementation Notes

Add a pure exported workbook parser and focused Node test first, then the
server tRPC adapter and school-admin UI, extending existing mock and browser
seams. Keep the report in Astra; Chronos holds no import persistence.
