- Use TypeScript with ESM imports and ~/ alias to src. Production modules
  loaded by native `node --test` may use explicit relative imports with `.ts`
  extensions until that runner supports the tsconfig alias.
- Prefer protectedProcedure for authenticated server operations.
- Keep changes minimal and aligned with existing Zod/tRPC/Drizzle patterns.
- RSC-first data fetching; use client hooks only in client components.
