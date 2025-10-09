#!/usr/bin/env bash
set -e

# Load .env variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Build and push Docker image to GitHub Container Registry (GHCR)
# Usage: ./scripts/build-prod.sh [tag]

# Configuration
REGISTRY=ghcr.io
OWNER=geber-suprabapak
REPO=project-chronos
IMAGE=${REGISTRY}/${OWNER}/${REPO}
TAG=${1:-latest}

# Check required env vars
if [ -z "$GHCR_USERNAME" ] || [ -z "$GHCR_TOKEN" ]; then
  echo "Error: Please set GHCR_USERNAME and GHCR_TOKEN environment variables."
  exit 1
fi

# Login to GHCR
echo "$GHCR_TOKEN" | docker login $REGISTRY -u "$GHCR_USERNAME" --password-stdin

# Build Docker image
docker build -t "${IMAGE}:${TAG}" .

# Push to GHCR
docker push "${IMAGE}:${TAG}"

echo "✅ Pushed ${IMAGE}:${TAG}"