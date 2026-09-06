# RBAC Implementation & Enforcement (Chronos)

## Authority Boundaries

Chronos uses Logto's built-in RBAC. Role assignment is made in Logto; the
application does not mint, transform, or trust a locally generated role claim.

- **Logto global roles** are the source of truth for who may use the Chronos
  administrative UI.
- The Chronos callback and session middleware read the standard `roles` claim
  issued by Logto. It admits only configured privileged roles and redirects
  students or unauthenticated users away from the dashboard.
- **Astra is the API authority.** Chronos requests an Astra resource token and
  Astra authorizes each request from Logto resource scopes, not from a Chronos
  role check.

This keeps UI admission and API authorization explicit, while retaining a
single authority for role-to-permission assignment: Logto.

## Role Taxonomy & Legacy Alias Mapping

### Canonical Roles

The canonical role taxonomy consists of five roles:

- `platform_admin`: System-level administrator with full platform control.
- `school_admin`: School-level administrator managing school configuration,
  staff, and policies.
- `teacher`: Instructional staff managing classrooms, student attendance
  tracking, and leave requests.
- `staff`: Non-instructional operational staff supporting school records and
  attendance operations.
- `student`: Enrolled student (denied access to administrative Chronos UI).

### Legacy Role Aliases

To support backward compatibility during active migration of older accounts,
legacy aliases are mapped to canonical roles:

- `admin` → `school_admin`
- `kepala_sekolah` → `school_admin`
- `guru` → `teacher`
- `wali_kelas` → `teacher`
- `siswa` → `student`

### Legacy Alias Sunset Plan

1. **Phase 1 (Active/Settled):** Legacy aliases are recognized and normalized
   across `src/server/auth/rbac.ts` via `ROLE_ALIAS_MAP` and
   `toCanonicalRole()`. All route layouts, component visibility filters, file
   proxies, and export guards accept both canonical names and legacy aliases.
2. **Phase 2 (Tenant Normalization):** Logto user directory migration converts
   legacy role assignments to canonical names (`admin` / `kepala_sekolah` →
   `school_admin`, `guru` / `wali_kelas` → `teacher`, `siswa` → `student`).
3. **Phase 3 (Deprecation & Removal):** Remove legacy aliases from `APP_ROLES`,
   `PRIVILEGED_ROLES`, `ADMIN_ROLES`, and `ROLE_ALIAS_MAP`, enforcing strict
   canonical role matching.

## Authoritative Role / Action Enforcement Matrix

| Surface / Action | Platform Admin | School Admin (`school_admin`, `admin`, `kepala_sekolah`) | Teacher (`teacher`, `guru`, `wali_kelas`) | Staff (`staff`) | Student (`student`, `siswa`) | Unauthenticated / Password Change Required |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Main App Admission (`/dashboard`)** | Allowed | Allowed | Allowed | Allowed | Denied (Redirect) | Denied (Redirect) |
| **Configuration (`/konfigurasi/*`)** | Allowed | Allowed | Denied (Redirect) | Denied (Redirect) | Denied | Denied |
| **Profiles Management (`/profiles/*`)** | Allowed | Allowed | Denied (Redirect) | Denied (Redirect) | Denied | Denied |
| **Attendance Read (`/absensi`)** | Allowed | Allowed | Allowed | Allowed | Denied | Denied |
| **Manual Attendance (`AbsenManualDialog`)** | Allowed | Allowed | Hidden / Blocked | Hidden / Blocked | Denied | Denied |
| **Attendance Delete / Bulk Actions** | Allowed | Allowed | Hidden / Blocked | Hidden / Blocked | Denied | Denied |
| **Monthly Backup Banner (`MonthlyBackupBanner`)** | Allowed | Allowed | Hidden | Hidden | Denied | Denied |
| **Leave Management (`/perizinan`, `IzinManualDialog`)** | Allowed | Allowed | Allowed | Allowed | Denied | Denied |
| **Data Siswa Read (`/siswa`)** | Allowed | Allowed | Allowed | Allowed | Denied | Denied |
| **File Proxy Upload (`/api/astra/files`)** | Allowed | Allowed | Allowed | Allowed | 403 Forbidden | 401/403 Forbidden |
| **Export Absences (`/api/export/absences`)** | Allowed | Allowed | Allowed | Allowed | 403 Forbidden | 401/403 Forbidden |
| **Export Perizinan (`/api/export/perizinan`)** | Allowed | Allowed | Allowed | Allowed | 403 Forbidden | 401/403 Forbidden |
| **Export Profiles (`/api/export/profiles`)** | Allowed | Allowed | 403 Forbidden | 403 Forbidden | 403 Forbidden | 401/403 Forbidden |
| **Export Siswa (`/api/export/siswa`)** | Allowed | Allowed | Allowed | Allowed | 403 Forbidden | 401/403 Forbidden |

## Policy Enforcement Details

### 1. Whole App Denial

- **Unauthenticated Users:** Redirected to `/login`.
- **Password Change Required (`must_change_password: true`):** Redirected to
  `/ganti-password`. Blocked from tRPC, export routes, and file uploads.
- **Students (`student`, `siswa`):** Denied access to the entire Chronos
  administration application. Redirected or returned 403 Forbidden.

### 2. Admin-Only Surfaces

- **Configuration (`/konfigurasi/*`):** Server layout guard
  (`src/app/(main)/konfigurasi/layout.tsx`) checks
  `canAccessConfiguration(userRole)` and redirects non-admins to `/dashboard`.
  Sidebar navigation hides "Konfigurasi" via `canAccessConfiguration(role)`.
- **Profiles (`/profiles/*`):** Server layout guard
  (`src/app/(main)/profiles/layout.tsx`) checks `canAccessProfiles(userRole)`
  and redirects non-admins to `/dashboard`. Sidebar navigation hides
  "Profiles" via `canAccessProfiles(role)`.
- **Manual Attendance Creation:** `AbsenManualDialog` is rendered conditionally
  via `canManageManualAttendance(role)` in the dashboard action card and
  attendance page.
- **Attendance Record Deletion & Bulk Actions:** The attendance page hides row
  selection, delete buttons, and bulk delete actions when
  `canDeleteAttendance(role)` is false.
- **Monthly Backup Banner:** The main layout and banner both enforce
  `canPerformMonthlyBackup(role)`.
- **Administrative Exports:** `requireExportAccess("profiles")` and
  `requireExportAccess("siswa")` restrict exports through
  `canExportResource(role, resource)`.

### 3. Teacher and Staff Operational Surfaces

Teachers and staff retain access to primary operational surfaces:

- **Dashboard:** Read metrics and operational quick actions.
- **Absensi:** Read and export attendance records.
- **Perizinan:** View, create, and export leave records.
- **Data Siswa:** Read the operational student roster defined by ADR-001.

### 4. File Proxy Authorization & Constraints (`/api/astra/files`)

Implemented via `src/server/auth/file-guard.ts` and
`src/app/api/astra/files/route.ts`:

- **Authentication & Privileges:** Requires a valid Logto session with a
  privileged role checked via `canUploadFiles(role)`. Unauthenticated requests
  return 401; students or accounts requiring a password change return 403.
- **File Type Validation:** Requires an explicitly allowed MIME type
  (`image/jpeg`, intentional alias `image/jpg`, `image/png`, `application/pdf`)
  and a compatible extension (`.jpg`, `.jpeg`, `.png`, `.pdf`). Empty MIME,
  `application/octet-stream`, mismatched extensions, and executable files are
  rejected with HTTP 400.
- **File Size Limit:** Enforces a maximum file size of 5 MiB. Oversized uploads
  are rejected with HTTP 413.
- **Astra Contract & Request Correlation:** Preserves or safely generates one
  request ID for the Chronos request, carries the accepted Astra request ID
  from intent to confirmation, and returns `request_id` plus `X-Request-ID`.

## Settled Domain Decisions

### D1: Profiles vs. Data Siswa Surface Separation

- **Status:** Settled by ADR-001.
- **Resolution:** `/profiles` remains the admin-only account directory and
  lifecycle surface for students and staff. `/siswa` remains a dedicated,
  read-only operational roster for all privileged school roles.

### D2: Attendance Action Taxonomy & Teacher Capabilities

- **Status:** Settled by ADR-002 for the current product surface.
- **Resolution:** Attendance events use `check_in` and `check_out`; evaluated
  daily states use the canonical Indonesian taxonomy. Manual creation and
  deletion remain admin-only. Teachers retain read and export capabilities; a
  future delegated class-scoped mutation requires a separate capability and ADR.

## Roles and Astra Permissions

The Astra resource is `https://api.lunaradev.my.id/skanida`. Chronos requests
the following permissions for that resource:

- `mobile:access`
- `admin:read`
- `files:read:any`
- `files:delete:any`

Logto issues only the permissions granted through the authenticated user's
assigned roles. Astra verifies the issuer, audience, signature, and required
scope before handling the request.

## MFA and Password Changes

Chronos no longer requires an application-specific `mfa_verified` JWT claim.
Any MFA policy is configured and enforced in Logto interaction/sign-in policy.
Chronos redirects a user whose Logto custom data declares
`must_change_password: true`; that is an account-lifecycle requirement, not
role-based authorization.

## Deployment and Verification

1. Configure the Astra API resource, scopes, and global roles in Logto.
2. Assign roles in Logto; do not add a Supabase custom access-token hook.
3. Set `LOGTO_RESOURCE` to the exact Astra resource identifier.
4. Register the exact `/api/logto/callback` sign-in redirect URI for the Chronos
   app.
5. Register `${LOGTO_BASE_URL}/login` as a post-sign-out redirect URI in the
   same Logto application, then set `LOGTO_POST_LOGOUT_REDIRECT_URI` to that
   exact absolute URL. Chronos validates the variable at startup and rejects a
   redirect whose origin differs from `LOGTO_BASE_URL`; the error names the
   invalid setting without printing credentials or session data.
6. Login with a role-bearing test user and confirm it reaches `/dashboard`.
7. Sign out and confirm the Logto session is removed, the browser returns to
   `/login`, and a later visit to `/dashboard` requires authentication.
8. Call a protected Astra route and confirm a resource token is accepted only
   when Logto granted its required scope.

## Rollback

Revert the Chronos deployment and preserve the Logto role assignments. Do not
restore the retired Supabase custom-access-token hook as part of this rollback;
it is not part of the Logto authorization boundary.
