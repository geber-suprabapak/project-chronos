# Decision Index

| Decision | Status | Source | Affects |
| --- | --- | --- | --- |
| tRPC is the administration server boundary | Observed | `src/server/api/root.ts`, `src/server/api/trpc.ts` | UI/server integration |
| Logto roles gate protected procedures | Observed | `src/server/api/trpc.ts` | Administration authorization |
| Astra is the API authority for management and file calls | Documented | `docs/rbac-implementation.md`, `contracts/astra-v1.json` | Integration |
| Chronos remains an incumbent UI to polish, not replace | Confirmed for settlement | `PRODUCT.md` | UI and design work |
| Operational exports/backups are server-authoritative | Confirmed for settlement | `PRODUCT.md` | Export and backup |
| `/profiles` versus `/siswa` responsibility | Needs decision | Settlement issue 13 | IA, queries, permissions, exports |
| Attendance event/status taxonomy | Needs decision | Settlement issue 14 | Astra contract, filters, statistics, exports |
| Design language and component philosophy | Decided (2026-09-04) | “The Calm Operations Desk”: professional, friendly, data-dense, restrained, a11y-first; subtle depth on shadcn/ui foundations | `DESIGN.md`, `.impeccable/design.json`, UI remediation |

Historical rationale beyond these sources is not recorded.

Settlement tickets live in the workspace issue tracker at `.scratch/chronos-settlement-audit/` outside this repository.
