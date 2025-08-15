# AI agent guide for project-chronos

Purpose: Give coding agents the minimum, concrete context to ship changes fast and safely in this repo.

## Architecture snapshot
- Next.js 15 (App Router) with React 19 and ESM. Path alias: `~/*` → `./src/*` (see `tsconfig.json`).
- tRPC v11 for server API, mounted at `/api/trpc` via `src/app/api/trpc/[trpc]/route.ts`.
- Data layer: Drizzle ORM over Postgres (`postgres` driver). Schema in `src/server/db/schema.ts`, connection in `src/server/db/index.ts`.
- Auth/session: Supabase (SSR-friendly clients). Server client: `src/lib/supabase/server.ts`; Browser client: `src/lib/supabase/client.ts`; Middleware client: `src/lib/supabase/middleware.ts`.
- App-wide middleware (`middleware.ts`) enforces auth for pages. API stays public at edge level, but routers use `protectedProcedure` so unauth calls fail.

## How things talk to each other
- Server components use tRPC directly via RSC helpers: `src/trpc/server.ts` exports `{ api, HydrateClient }`. Example: `await api.absences.listRaw()` in `src/app/(main)/dashboard/page.tsx`.
- Client components use React Query + tRPC hooks from `src/trpc/react.tsx` (httpBatchStreamLink + SuperJSON). Wrap trees with `TRPCReactProvider` when needed.
- tRPC server kernel in `src/server/api/trpc.ts`:
  - `createTRPCContext` exposes `{ db, headers }`.
  - `protectedProcedure` adds Supabase `user` to ctx. Use it for anything requiring auth.
- Routers live in `src/server/api/routers/*`. Register them in `src/server/api/root.ts` (exported as `appRouter`).

## Database and migrations (Drizzle)
- Schema: `src/server/db/schema.ts` defines tables `absences`, `user_profiles`, `perizinan` (note enums/constraints, e.g. `kategori_izin` limited to 'sakit' | 'pergi').
- Drizzle config: `drizzle.config.ts` (uses `env.DATABASE_URL`).
- Scripts (pnpm): `db:generate`, `db:migrate`, `db:push`, `db:studio` (see `package.json`).
- Local DB helper: `./start-database.sh` (intended for WSL/mac/linux). Ensure `.env` has `DATABASE_URL`.

## Patterns and conventions
- API inputs validated with Zod. Dates commonly use `YYYY-MM-DD` string regex; paginate with `limit`/`offset`; build dynamic filters with Drizzle `and/eq/desc`.
- Prefer `protectedProcedure` by default. ctx contains `{ db, headers, user? }`. Example list endpoints return arrays; `getById` returns row or `null`.
- Serialization: SuperJSON configured in both client (`src/trpc/react.tsx`) and server (`src/trpc/server.ts`, tRPC transformer) — keep return shapes serializable.
- RSC-first data fetching: favor `src/trpc/server.ts` in server components to reduce client JS. Use client hooks only in `"use client"` components (e.g., forms/mutations).
- Env validation via `src/env.js` (`@t3-oss/env-nextjs`). Required: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Examples that match the codebase
- Add a router procedure (read): in `src/server/api/routers/foo.ts`
  - `list: protectedProcedure.input(z.object({ limit:z.number().default(20), offset:z.number().default(0) }).optional()).query(({ ctx, input }) => ctx.db.select()...)`
  - Register it in `src/server/api/root.ts` and import types from `AppRouter`.
- Call from RSC: `const rows = await api.foo.list({ limit: 50 })`.
- Call from client: `const { data } = api.foo.list.useQuery({ limit: 50 })`; for writes: `api.foo.update.useMutation()`.

## Developer workflows
- Run dev: `pnpm dev` (Next.js; env is validated on startup). Build: `pnpm build`; Preview: `pnpm preview`.
- Lint/typecheck/format: `pnpm lint`, `pnpm typecheck`, `pnpm format:check` / `format:write`.
- DB lifecycle: run local DB (optional) → `db:generate` (SQL) → `db:migrate` (apply) or `db:push` (dev) → `db:studio`.

## Integration gotchas
- Middleware `PUBLIC_PATHS` allows `/login` and static assets; adjust if you need to lock down `/api` at the edge too.
- `perizinan.id` defaults use `extensions.uuid_generate_v4()`; ensure the extension exists in your DB (or switch to `gen_random_uuid()`).
- Use the `~` alias for imports and keep ESM style (`type: module`).

Questions or gaps? If anything above feels off or incomplete (e.g., different auth rules, additional scripts), tell me what to refine and I’ll update this file accordingly.
