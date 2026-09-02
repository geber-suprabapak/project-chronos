# Docker Deployment Guide

## GitHub Workflow for GHCR

Workflow file: `.github/workflows/buildtest.yml`

Trigger:

- Push ke branch `master`
- Manual via `workflow_dispatch`

Image yang dipublish:

- `ghcr.io/geber-suprabapak/project-chronos:latest`
- `ghcr.io/geber-suprabapak/project-chronos:sha-<short-commit>`

## Environment Requirements

### Build-time (Docker build args)

- `SKIP_ENV_VALIDATION=1` (opsional, default aktif di Dockerfile untuk build tanpa runtime env)

### Runtime (container environment)

Wajib diisi saat container dijalankan (dapat melalui `.env` atau compose environment):

- `NODE_ENV` (misal: `production`)
- `LOGTO_ENDPOINT` (misal: `http://logto:3001` atau `https://auth.skanida.sch.id`)
- `LOGTO_APP_ID` (misal: `chronos-app`)
- `LOGTO_APP_SECRET` (secret Logto app)
- `LOGTO_COOKIE_SECRET` (secret cookie minimal 32 karakter)
- `LOGTO_BASE_URL` (misal: `https://admin.skanida.sch.id` atau `http://localhost:3000`)
- `LOGTO_RESOURCE` (misal: `https://api.skanida.sch.id`)
- `LOGTO_POST_LOGOUT_REDIRECT_URI` (misal: `https://admin.skanida.sch.id` atau `http://localhost:3000`)
- `ASTRA_API_URL` (misal: `http://astra:3000` atau `https://api.skanida.sch.id`)

Catatan: aplikasi memvalidasi env lewat `src/env.js` saat startup server.

## Pull and Run

### Pull image

```bash
docker pull ghcr.io/geber-suprabapak/project-chronos:latest
```

### Run container

```bash
docker run -p 3000:3000 --env-file .env ghcr.io/geber-suprabapak/project-chronos:latest
```

## Local Build (optional)

Build image Docker secara lokal:

```bash
docker build \
  --build-arg SKIP_ENV_VALIDATION=1 \
  -t project-chronos:local .
```
