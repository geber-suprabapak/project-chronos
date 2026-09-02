<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- repo-map:start -->
## Codebase semantic map

Start repository-wide orientation at `docs/codebase-map/README.md`.

- Domain vocabulary and aliases: `docs/codebase-map/glossary.md`
- Semantic module ownership: `docs/codebase-map/modules.md`
- Architecture boundaries: `docs/codebase-map/architecture/`
- Cross-module flows: `docs/codebase-map/flows/`
- Rules that changes must preserve: `docs/codebase-map/invariants.md`
- Recorded decision sources: `docs/codebase-map/decisions/README.md`

For structural questions such as symbol callers, imports, dependencies, or code relationships, prefer an available code graph / codebase-memory tool before broad repository scans. The graph is an accelerator; source code, tests, schemas, and project docs remain authoritative.

Read only the map pages relevant to the task, then inspect the implementation they point to.
<!-- repo-map:end -->
