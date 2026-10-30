# Build from the monorepo root:
#   docker build -f apps/web/Dockerfile --target production -t web .

# ---------- base ----------
FROM node:24-alpine AS base
ENV TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN chown node:node /app
USER node

# ---------- pruner ----------
# Includes api: the web build needs the types generated from its OpenAPI.
FROM base AS pruner
COPY --chown=node:node . .
RUN npx --yes turbo@$(node -p "require('./package.json').devDependencies.turbo") prune web api --docker

# ---------- deps ----------
FROM base AS deps
COPY --from=pruner --chown=node:node /app/out/json/ .
RUN npm ci

# ---------- dev (docker compose) ----------
FROM deps AS dev
COPY --from=pruner --chown=node:node /app/out/full/ .
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- builder ----------
FROM deps AS builder
COPY --from=pruner --chown=node:node /app/out/full/ .
RUN npx turbo run build --filter=web

# ---------- production (Next standalone) ----------
FROM node:24-alpine AS production
# "::" listens on IPv6 and IPv4: the api delivers webhooks over Railway's
# private network, which is IPv6-only in environments created before 2025-10-16.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=:: PORT=3000
WORKDIR /app
USER node
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
