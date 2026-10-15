# Build from the monorepo root:
#   docker build -f apps/api/Dockerfile --target production -t api .

# ---------- base ----------
FROM node:24-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1
WORKDIR /app
RUN chown node:node /app
USER node

# ---------- pruner ----------
FROM base AS pruner
COPY --chown=node:node . .
RUN npx --yes turbo@$(node -p "require('./package.json').devDependencies.turbo") prune api --docker

# ---------- deps ----------
FROM base AS deps
COPY --from=pruner --chown=node:node /app/out/json/ .
RUN npm ci

# ---------- dev (docker compose) ----------
FROM deps AS dev
COPY --from=pruner --chown=node:node /app/out/full/ .
WORKDIR /app/apps/api
RUN npx prisma generate
EXPOSE 3333
CMD ["npm", "run", "start:dev"]

# ---------- builder ----------
FROM deps AS builder
COPY --from=pruner --chown=node:node /app/out/full/ .
RUN npx turbo run build --filter=api

# ---------- prod-deps ----------
# The Prisma CLI is an optional peer of @prisma/client; --omit=dev alone keeps it.
FROM base AS prod-deps
COPY --from=pruner --chown=node:node /app/out/json/ .
RUN npm ci --omit=dev --omit=optional --omit=peer && npm cache clean --force

# ---------- production ----------
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
USER node
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
# Needed for "type": "module".
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
EXPOSE 3333
CMD ["node", "dist/app/main.js"]
