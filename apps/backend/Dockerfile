FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm@9

# Copy manifests first for layer caching
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

RUN pnpm --filter @tse/backend build

# ---- Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pnpm@9

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 9000

CMD ["node", "dist/main.js"]
