# Delivery and Observability

Chronos publishes an OCI image only after the CI verification job succeeds. Each image includes commit SHA, build-time, and application-version metadata plus buildx max provenance and an SBOM.

## Deployment & Immutable Digest Pinning

Production deployment requires an immutable image digest. Docker Compose enforces this via bash parameter expansion:

```sh
CHRONOS_IMAGE_REF=ghcr.io/owner/project-chronos@sha256:<digest> docker compose up -d --no-build
```

If `CHRONOS_IMAGE_REF` is unset, `docker-compose.yml` aborts with an error (`Set CHRONOS_IMAGE_REF to an immutable digest-pinned image`), preventing accidental deployment of mutable `:latest` tags.

## Health Probes Architecture

- **Compatibility Endpoint** (`GET /api/health`): Preserved for backward-compatible health checks; returns HTTP 200 `{ "status": "ok" }`.
- **Process Liveness Probe** (`GET /api/health/live`): Process-only liveness endpoint for Docker container runtime healthchecks (`HEALTHCHECK`). Requires 0 external dependencies.
- **Traffic Readiness Probe** (`GET /api/health/ready`): Evaluates upstream Astra (`GET /ready`) and Logto OIDC discovery (`GET /oidc/.well-known/openid-configuration`) with a strict 3,000ms timeout (`AbortSignal.timeout(3000)`) and 0 state mutation.
  - Returns HTTP 200 `{ "status": "ok", "dependencies": { "astra": true, "logto": true } }` when ready.
  - Returns HTTP 503 `{ "status": "degraded", "dependencies": { "astra": ..., "logto": ... } }` when any dependency fails or times out.

## Canonical Security Headers

Chronos enforces defense-in-depth canonical security headers across both `next.config.js` (for application routes and static assets) and `middleware.ts` (for edge-intercepted requests and auth redirects):

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-DNS-Prefetch-Control: on`
- `Content-Security-Policy`: canonical policy allowing `'self'`, styles (`'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com`), scripts (`'self' 'unsafe-inline' 'unsafe-eval'`), images (`'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com`), connect (`'self' https://*.tile.openstreetmap.org`), and `frame-ancestors 'none'`.

## Structured Operational Logging

Operational events are emitted as single-line JSON records via `src/lib/observability.ts`:

- **Event Types**: `"astra.request"`, `"auth.failure"`, `"export.access"`, `"export.failure"`, `"trpc.error"`, `"upload.error"`, `"http.request"`.
- **Properties**: `timestamp` (ISO-8601), `event`, `outcome` (`"success"` | `"failure"`), `requestId`, `path`, `status`, `code`, `durationMs`.
- **Sanitization**: `safeOperationalPath` automatically strips query parameters and URL fragments (`split("?")[0]`) to guarantee zero PII or credential leakage. Request/response bodies, authorization headers, and cookies are never logged.

## Rollback Runbook

If a regression or outage occurs during deployment:

1. **Identify Previous Digest**: Retrieve the last known-good image digest from the CI release history or deployment registry.
2. **Execute Rollback**:
   ```sh
   export CHRONOS_IMAGE_REF="ghcr.io/owner/project-chronos@sha256:<previous-good-digest>"
   docker compose up -d --no-build
   ```
3. **Verify Health**:
   ```sh
   # Verify process liveness
   curl -f http://127.0.0.1:13000/api/health/live
   # Verify dependency readiness
   curl -f http://127.0.0.1:13000/api/health/ready
   ```
4. **Verify Core Workflow**:
   - Perform a browser login via Logto OIDC flow.
   - Navigate to an admin operational route (e.g. `/absensi` or `/siswa`).
   - Check security headers on protected redirect:
     ```sh
     curl -I http://127.0.0.1:13000/dashboard
     ```
5. **Anti-Pattern Warning**: Never attempt rollback by deploying mutable `:latest` or `:main` tags. Always pin to an immutable digest.
