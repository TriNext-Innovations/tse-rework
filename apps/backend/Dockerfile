# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9

# Manifests first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile

# Sources
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# medusa build outputs to apps/backend/.medusa/server/
WORKDIR /app/apps/backend
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN /app/node_modules/.bin/medusa build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Root node_modules contains the medusa CLI binary and all runtime deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Medusa server bundle
COPY --from=builder /app/apps/backend/.medusa ./apps/backend/.medusa

# medusa-config.ts is loaded by the migration CLI at startup
COPY --from=builder /app/apps/backend/medusa-config.ts ./apps/backend/medusa-config.ts
COPY --from=builder /app/apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

WORKDIR /app/apps/backend

COPY apps/backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["./docker-entrypoint.sh"]
