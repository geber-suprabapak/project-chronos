# Docker Deployment Guide

## 🐳 Build & Run Locally

### Build Docker Image
```bash
docker build -t project-chronos .
```

### Run Container
```bash
docker run -p 3000:3000 \
  -e DATABASE_URL="your_database_url" \
  -e NEXT_PUBLIC_SUPABASE_URL="your_supabase_url" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_key" \
  project-chronos
```

### Using Docker Compose
Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/geber-suprabapak/project-chronos:latest
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    restart: unless-stopped
```

Then run:
```bash
docker-compose up -d
```

## 📦 GitHub Container Registry (GHCR)

### Pull from GHCR
```bash
docker pull ghcr.io/geber-suprabapak/project-chronos:latest
```

### Available Tags
- `latest` - Latest build from master branch
- `master` - Latest from master branch
- `v1.0.0` - Specific version tag (when using semver tags)
- `sha-abc123` - Specific commit

### Authentication
To pull private images:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

## 🚀 GitHub Actions Workflow

The workflow automatically:
1. ✅ Builds multi-platform images (amd64, arm64)
2. ✅ Pushes to GHCR on push to master
3. ✅ Creates tags based on git tags/branches
4. ✅ Uses layer caching for faster builds

### Trigger Build
- **Automatic**: Push to `master` branch or create a tag
- **Manual**: Go to Actions tab → "Build and Push Docker Image" → Run workflow

### Creating Version Tags
```bash
git tag v1.0.0
git push origin v1.0.0
```

This will create images with tags:
- `ghcr.io/geber-suprabapak/project-chronos:v1.0.0`
- `ghcr.io/geber-suprabapak/project-chronos:1.0`
- `ghcr.io/geber-suprabapak/project-chronos:1`
- `ghcr.io/geber-suprabapak/project-chronos:latest`

## 🔧 Environment Variables

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

## 📝 Notes

- The image uses Node.js 22 Alpine for minimal size
- Multi-stage build optimizes final image size
- Runs as non-root user (nextjs:1001) for security
- Uses Next.js standalone output for optimal performance
- Supports both amd64 and arm64 architectures
