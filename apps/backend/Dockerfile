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
COPY migration/raw/client-review.csv ./migration/raw/client-review.csv

# medusa build outputs to apps/backend/dist/
WORKDIR /app/apps/backend
# The admin dashboard bakes admin.backendUrl (= MEDUSA_BACKEND_URL) at build
# time. Without it the admin defaults to http://localhost:9000 and the hosted
# admin can't reach the API (blank page). Pass it as a build arg.
ARG MEDUSA_BACKEND_URL=http://localhost:9000
ENV MEDUSA_BACKEND_URL=$MEDUSA_BACKEND_URL
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

# Seed data and compat CSV needed by medusa exec scripts
COPY --from=builder /app/migration/seed-data.json ./migration/seed-data.json
COPY --from=builder /app/migration/raw/client-review.csv ./migration/raw/client-review.csv

# Source scripts needed by medusa exec (exec requires .ts source, not compiled dist)
COPY --from=builder /app/apps/backend/src ./apps/backend/src

# Config and manifest files needed by medusa start and db:migrate
COPY --from=builder /app/apps/backend/medusa-config.ts ./apps/backend/medusa-config.ts
COPY --from=builder /app/apps/backend/tsconfig.json ./apps/backend/tsconfig.json
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json

WORKDIR /app/apps/backend

COPY apps/backend/docker-entrypoint.sh ./
COPY apps/backend/docker-migrate-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh docker-migrate-entrypoint.sh

EXPOSE 9000
ENTRYPOINT ["./docker-entrypoint.sh"]
