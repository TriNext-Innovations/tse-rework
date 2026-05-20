# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# Manifests first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

# Sources
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

ENV NEXT_TELEMETRY_DISABLED=1

# next build with output: standalone (see next.config.ts)
RUN pnpm --filter @tse/web build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output bundles its own node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets are not included in standalone — copy them separately
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# In a pnpm monorepo the standalone server.js mirrors the workspace path
CMD ["node", "apps/web/server.js"]
