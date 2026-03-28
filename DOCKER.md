# Docker Deployment Guide

## GitHub Workflow for GHCR

Workflow file: `.github/workflows/docker-publish.yml`

Trigger:

- Push ke branch `master`
- Manual via `workflow_dispatch`

Image yang dipublish:

- `ghcr.io/geber-suprabapak/project-chronos:latest`
- `ghcr.io/geber-suprabapak/project-chronos:sha-<short-commit>`

## Environment Requirements

### Build-time (Docker build args)

Wajib diisi saat build image karena dipakai oleh client bundle Next.js:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Di workflow nilainya diambil dari GitHub repository secrets.

### Runtime (container environment)

Wajib diisi saat container dijalankan:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Catatan: aplikasi memvalidasi env lewat `src/env.js` saat startup server.

## Required GitHub Secrets

Set dua secret ini di repository:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

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

Jika build manual lokal, tetap wajib isi build args untuk `NEXT_PUBLIC_*`:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="your-supabase-url" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key" \
  --build-arg SKIP_ENV_VALIDATION=1 \
  -t project-chronos:local .
```
