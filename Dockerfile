# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@10.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

ARG SKIP_ENV_VALIDATION=1
ARG COMMIT_SHA=""
ARG BUILD_REVISION=""
ARG BUILD_TIME=unknown
ARG APP_VERSION=0.1.0

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=${SKIP_ENV_VALIDATION}
ENV CHRONOS_COMMIT_SHA=${COMMIT_SHA:-${BUILD_REVISION:-unknown}}
ENV CHRONOS_BUILD_TIME=${BUILD_TIME}
ENV CHRONOS_APP_VERSION=${APP_VERSION}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build

FROM node:22-alpine AS runner

ARG COMMIT_SHA=""
ARG BUILD_REVISION=""
ARG BUILD_TIME=unknown
ARG APP_VERSION=0.1.0

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV CHRONOS_COMMIT_SHA=${COMMIT_SHA:-${BUILD_REVISION:-unknown}}
ENV CHRONOS_BUILD_TIME=${BUILD_TIME}
ENV CHRONOS_APP_VERSION=${APP_VERSION}

LABEL org.opencontainers.image.title="Chronos" \
  org.opencontainers.image.revision="${COMMIT_SHA:-${BUILD_REVISION:-unknown}}" \
  org.opencontainers.image.created="${BUILD_TIME}" \
  org.opencontainers.image.version="${APP_VERSION}"

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && apk add --no-cache curl

COPY --from=builder /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health/live',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
