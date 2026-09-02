# Decision Index

| Decision | Status | Source | Affects |
| --- | --- | --- | --- |
| tRPC is the administration server boundary | Observed | `src/server/api/root.ts`, `src/server/api/trpc.ts` | UI/server integration |
| Logto roles gate protected procedures | Observed | `src/server/api/trpc.ts` | Administration authorization |
| Astra is the API authority for management and file calls | Documented | `docs/rbac-implementation.md`, `contracts/astra-v1.json` | Integration |

Historical rationale beyond these sources is not recorded.
