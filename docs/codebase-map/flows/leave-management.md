# Leave Management

1. A UI request reaches the tRPC route and `perizinanRouter` through `appRouter`.
2. Protected/privileged procedure middleware establishes the Logto user role.
3. Manual creation is available to all four Chronos roles and delegates to Astra for approved-Student targeting, pending-only status, attachment ownership and creator audit. Decision authorization is separate.
4. The router obtains Astra data and maps approval, attachment, and date-only fields to the portal model. The detail page loads its decision timeline from Astra's additive audit-history endpoint and displays actor-name/role snapshots in WIB.
5. Reopen/reset behavior builds the supported pending-reset request rather than treating a rejected request as arbitrary client state.

Unauthorized roles fail before domain calls; legacy audit events without actor snapshots display them as unavailable; date-only normalization avoids invalid-date presentation.

**Evidence:** `src/server/api/root.ts`, `src/server/api/trpc.ts`, `src/server/api/routers/perizinan.ts`, `src/server/api/routers/perizinan-contract.ts`, `contracts/astra-v1.json`.
