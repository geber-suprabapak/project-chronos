# Chronos Authoritative Backup & Export Runbook

This runbook documents the architecture, lifecycle, audit persistence, fail-closed guarantees, and operational procedures for Chronos authoritative backups and absences exports (Settlement Issue 05).

---

## 1. Architecture Overview

### 1.1 Complete, Authoritative Server-Side Generation
All export and backup artifacts (Excel XLSX and PDF) are generated exclusively on the server (`src/server/export`) from complete Astra attendance paging plus Astra student enrichment, completely independent of the client DOM.
- **XLSX Generator**: Uses ExcelJS to generate structured workbooks with styled Indonesian headers, auto-filters, and metadata.
- **PDF Generator**: Uses Node-compatible `jsPDF` + `jspdf-autotable` to render print-ready documents with page numbers and timestamp headers without a browser DOM.
- **Stable Ordering**: Every dataset is sorted deterministically:
  1. `date` ASC (`YYYY-MM-DD`)
  2. `className` ASC
  3. `nis` ASC
  4. Record `id` ASC (tie-breaker)
- **Integrity**: Every generated binary artifact is hashed with cryptographic SHA-256 before delivery.

### 1.2 Resource Access & RBAC Matrix
Export routes enforce the Chronos RBAC matrix:
| Resource | Route | Allowed Roles | Guard |
| :--- | :--- | :--- | :--- |
| `backup` | `/api/export/backup`, `/api/export/backup/status` | `platform_admin`, `school_admin` | `canPerformMonthlyBackup` / `requireExportAccess("backup")` |
| `absences` | `/api/export/absences` | `platform_admin`, `school_admin`, `teacher`, `staff`; Astra permits the same operational roster read roles under ADR-001 | `canExportResource("absences")` |

---

## 2. Monthly Backup Lifecycle

### 2.1 Activation Window
The monthly backup banner activates:
- Starting on **day 25** of the month in the **Asia/Jakarta (WIB, UTC+7)** timezone.
- Or when forced via URL parameter `?showBackupBanner=true` (optionally with `&month=YYYY-MM`).
- For non-administrators, the banner is never rendered.

### 2.2 Server-Persisted Status Checking
- The banner queries `/api/export/backup/status?month=YYYY-MM`, which forwards to Astra `GET /v1/admin/backups/status?year_month=YYYY-MM&scope=absences`.
- Astra returns canonical JSON:
  ```json
  {
    "completed": true,
    "record": {
      "id": "bk-123",
      "year_month": "YYYY-MM",
      "scope": "absences",
      "format": "xlsx",
      "start_date": "YYYY-MM-01",
      "end_date": "YYYY-MM-<lastDay>",
      "checksum": "<sha256-hex>",
      "record_count": 1500,
      "byte_length": 123456,
      "result": "completed",
      "created_at": "..."
    }
  }
  ```
- If Astra reports the canonical pair `completed: false, record: null`, the banner remains visible. Only a strictly validated persisted record paired with `completed: true` hides it.
- **Fail-Safe Invariant**: If Astra is unavailable or encounters an outage, the status endpoint returns HTTP 502/503. It **never** converts an outage into `completed: false`.

### 2.3 Fail-Closed Audit Persistence
When an administrator initiates a backup download:
1. The server computes full Asia/Jakarta calendar bounds (`YYYY-MM-01` to `YYYY-MM-<lastDay>`).
2. Collects the complete attendance and student records from Astra across all pages.
   - **Fail Closed Student Lookup**: Student and profile lookups from Astra do not catch or return empty arrays; any Astra failure aborts the entire backup/export immediately without serving partial records or persisting an audit log.
3. Generates the binary artifact (XLSX or PDF) and computes its SHA-256 checksum.
4. Constructs the canonical audit payload (actor is server-derived on Astra and must not be sent):
   ```json
   {
     "year_month": "YYYY-MM",
     "scope": "absences",
     "format": "xlsx",
     "start_date": "YYYY-MM-01",
     "end_date": "YYYY-MM-<lastDay>",
     "checksum": "<sha256-hex>",
     "record_count": 1500,
     "byte_length": 123456,
     "result": "completed"
   }
   ```
5. **Astra Persistence Gate**: The audit payload is persisted to Astra via `POST /v1/admin/backups`.
   - **Fail Closed**: If Astra persistence fails, the operation throws, the artifact is discarded, and the server returns HTTP 502. The file is **never** served to the client without confirmed persistence.
6. Upon successful persistence, the client downloads the file, refetches the status endpoint, and the banner automatically dismisses.
7. Fake client-side "Selesai", `localStorage`, and DOM `#absensi-table` references are completely eliminated.

### 2.4 Ordinary Absences Export Guards
For standard exports (`/api/export/absences`):
- `startDate` and `endDate` are strictly validated as real `YYYY-MM-DD` dates via calendar check (`isDateOnlyValue`).
- Reversed bounds (`startDate > endDate`) are rejected with HTTP 400 before any downstream querying occurs.
- The `className` parameter is sanitized (`sanitizeFilenameSegment`) to strip directory traversal (`..`), path separators, and special characters before constructing the `Content-Disposition` header.
- The UI uses `DownloadPdfButton` with non-destructive styling, accessible loading states, and canonical label `Unduh PDF`.


---

## 3. Verification & Testing Commands

### 3.1 Focused Unit Tests
Run the comprehensive test suite covering 0, 101, >1500 rows, month bounds, stable order, both artifacts, checksum, audit failure fail-closed, role denial, and table independence:
```bash
node --env-file-if-exists=.env --test tests/authoritative-backup-export.test.ts
```

### 3.2 Full Unit Suite
```bash
pnpm test
```

### 3.3 Typecheck and Linting
```bash
pnpm check
```

### 3.4 Production Build
```bash
pnpm build
```

### 3.5 Targeted E2E Suite
Execute Playwright E2E tests using isolated test ports (23400, 23401, 3045):
```bash
MOCK_ASTRA_PORT=23400 MOCK_LOGTO_PORT=23401 PORT=3045 BASE_URL=http://localhost:3045 pnpm test:e2e e2e/backup-banner.spec.ts e2e/konfigurasi.spec.ts
```
