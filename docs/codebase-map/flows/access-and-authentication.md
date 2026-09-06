# Access and Authentication

1. `middleware.ts` allows static assets and `/api/*` through, then evaluates the Logto session for page navigation.
2. Unauthenticated page requests redirect to `/login` with the original route when applicable.
3. Authenticated users requiring a password change are held at `/ganti-password`.
4. The main layout repeats session, password-change, and privileged-role admission before rendering the application shell.
5. tRPC context independently authenticates and normalizes the role. `adminProcedure` and `privilegedProcedure` apply capability-level server gates.
6. Route Handlers outside tRPC, including export and file routes, must implement the same policy explicitly because middleware does not protect `/api/*`.
7. Sign-out validates a configuration-only post-logout redirect against the Chronos origin, deletes the Logto cookie, and delegates logout to Logto.

## Failure boundaries

- A missing or cross-origin post-logout redirect is rejected as a configuration error; the fixture owns a matching redirect during E2E.
- Navigation and page layouts filter capabilities by normalized role. Server procedures and Route Handlers independently enforce the same matrix as the security boundary.
- The Astra file proxy rejects unauthenticated, password-change-required, and non-privileged users before validating size, MIME type, and extension.

**Evidence:** `middleware.ts`, `src/app/(main)/layout.tsx`, `src/server/api/trpc.ts`, `src/server/auth/rbac.ts`, `src/server/auth/export-guard.ts`, `src/server/auth/file-guard.ts`, `src/components/app-sidebar.tsx`, `src/app/api/astra/files/route.ts`, `src/app/api/logto/sign-out/route.ts`, `src/lib/logto/post-logout-redirect.ts`.
