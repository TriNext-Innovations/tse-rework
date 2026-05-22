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
COPY migration/seed-data.json ./migration/seed-data.json

# medusa build outputs to apps/backend/dist/
WORKDIR /app/apps/backend
ENV NODE_OPTIONS="--max-old-space-size=3072"
RUN /app/node_modules/.bin/medusa build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1536"

# Root node_modules contains the medusa CLI binary and all runtime deps
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Compiled backend (dist/) and admin dashboard
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Lift admin build out to where the runtime looks for it.
# tsconfig.outDir="./dist" cascades to medusa-build, so admin lands in
# dist/public/admin/, but adminLoader expects ${cwd}/public/admin/index.html.
COPY --from=builder /app/apps/backend/dist/public ./apps/backend/public

# Seed data needed by medusa exec src/scripts/seed.ts
COPY --from=builder /app/migration/seed-data.json ./migration/seed-data.json

# Config and manifest files needed by medusa start and db:migrate
COPY --from=builder /app/apps/backend/medusa-config.ts ./apps/backend/medusa-config.ts
COPY --from=builder /app/apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

WORKDIR /app/apps/backend

COPY apps/backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["./docker-entrypoint.sh"]
