# Leave Management

1. A UI request reaches the tRPC route and `perizinanRouter` through `appRouter`.
2. Protected/privileged procedure middleware establishes the Logto user role.
3. The router obtains Astra data and maps approval, attachment, and date-only fields to the portal model.
4. Reopen/reset behavior builds the supported pending-reset request rather than treating a rejected request as arbitrary client state.

Unauthorized roles fail before domain calls; date-only normalization avoids invalid-date presentation.

**Evidence:** `src/server/api/root.ts`, `src/server/api/trpc.ts`, `src/server/api/routers/perizinan.ts`, `src/server/api/routers/perizinan-contract.ts`, `contracts/astra-v1.json`.
