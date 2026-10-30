#!/usr/bin/env bash
# make smoke: builds the production images without .env, starts them with test
# variables (as the Railway services) and checks /health, / and one webhook from
# the api to the web. Everything it creates is removed at the end, pass or fail.
set -euo pipefail

NAME=web-hook-smoke
NET=$NAME
DB=$NAME-db
API=$NAME-api
WEB=$NAME-web
TIMEOUT_S=60

DATABASE_URL="postgresql://postgres:smoke@$DB:5432/smoke"
WEBHOOK_SECRET="whsec_$(openssl rand -base64 32)"

cleanup() {
  docker rm -f "$DB" "$API" "$WEB" "$NAME-migrate-a" "$NAME-migrate-b" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Prints the reason and, when given, the logs of the container that failed.
fail() {
  echo "smoke: FALHOU: $1" >&2
  if [ -n "${2:-}" ]; then docker logs "$2" 2>&1 | tail -50 >&2; fi
  exit 1
}

step() { echo "smoke: $1"; }

# ---------- images (.dockerignore keeps every .env out of the context) ----------
step "construindo as imagens"
docker build -q -f apps/api/Dockerfile.migrate -t "$NAME-migrate" . >/dev/null
docker build -q -f apps/api/Dockerfile --target production -t "$NAME-api" . >/dev/null
docker build -q -f apps/web/Dockerfile --target production -t "$NAME-web" . >/dev/null

step "conferindo que nenhuma imagem leva .env"
for image in "$NAME-migrate" "$NAME-api" "$NAME-web"; do
  found=$(docker run --rm --entrypoint sh "$image" -c \
    "find /app -name '.env*' ! -name '.env.example' -not -path '*/node_modules/*'")
  [ -z "$found" ] || fail "$image tem arquivos de ambiente: $found"
done

# ---------- database and migrations ----------
cleanup
docker network create "$NET" >/dev/null
docker run -d --name "$DB" --network "$NET" \
  -e POSTGRES_PASSWORD=smoke -e POSTGRES_DB=smoke postgres:18-alpine >/dev/null
for _ in $(seq "$TIMEOUT_S"); do
  docker exec "$DB" pg_isready -U postgres -d smoke >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$DB" pg_isready -U postgres -d smoke >/dev/null 2>&1 || fail "o Postgres não ficou pronto" "$DB"

step "aplicando as migrations num banco vazio"
docker run --name "$NAME-migrate-a" --network "$NET" -e DATABASE_URL="$DATABASE_URL" \
  "$NAME-migrate" >/dev/null 2>&1 || fail "o migrate não encerrou com 0" "$NAME-migrate-a"
docker rm "$NAME-migrate-a" >/dev/null

# Railway may start a new migrate while an old one runs: both must exit 0.
step "rodando dois migrates ao mesmo tempo, sem nada pendente"
docker run -d --name "$NAME-migrate-a" --network "$NET" -e DATABASE_URL="$DATABASE_URL" "$NAME-migrate" >/dev/null
docker run -d --name "$NAME-migrate-b" --network "$NET" -e DATABASE_URL="$DATABASE_URL" "$NAME-migrate" >/dev/null
for container in "$NAME-migrate-a" "$NAME-migrate-b"; do
  [ "$(docker wait "$container")" = 0 ] || fail "$container não encerrou com 0" "$container"
done

# ---------- api and web, with only the variables Railway sets ----------
step "subindo a api e o web"
docker run -d --name "$API" --network "$NET" \
  -e NODE_ENV=production \
  -e DATABASE_URL="$DATABASE_URL" \
  -e CORS_ORIGIN=http://localhost:3000 \
  -e WEBHOOK_TARGET_URL="http://$WEB:3000/webhooks/chat" \
  -e WEBHOOK_SECRET="$WEBHOOK_SECRET" \
  "$NAME-api" >/dev/null
docker run -d --name "$WEB" --network "$NET" \
  -e API_URL="http://$API:3333" \
  -e WEBHOOK_SECRET="$WEBHOOK_SECRET" \
  "$NAME-web" >/dev/null

# HTTP status from inside the container, with the image's own Node.
status_of() {
  docker exec "$1" node -e \
    "fetch('$2', $3).then((r) => console.log(r.status)).catch(() => console.log(0))" 2>/dev/null || echo 0
}

wait_for() {
  local container=$1 url=$2 expected=$3 init=${4:-'{}'}
  for _ in $(seq "$TIMEOUT_S"); do
    [ "$(status_of "$container" "$url" "$init")" = "$expected" ] && return 0
    sleep 1
  done
  fail "$url não respondeu $expected em ${TIMEOUT_S}s" "$container"
}

step "esperando GET /health da api"
wait_for "$API" http://localhost:3333/health 200
step "esperando GET / do web"
wait_for "$WEB" http://localhost:3000/ 200

# The api's webhook reaches the web by its private hostname, over IPv4 and IPv6 alike.
step "entrando no chat pela api: o webhook precisa chegar assinado no web"
status=$(status_of "$API" http://localhost:3333/api/v1/chat/participants \
  "{ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'smoke' }) }")
[ "$status" = 201 ] || fail "POST /chat/participants respondeu $status" "$API"
for _ in $(seq "$TIMEOUT_S"); do
  delivered=$(docker exec "$DB" psql -U postgres -d smoke -tAc \
    "SELECT count(*) FROM webhook_deliveries WHERE status = 'SUCCEEDED'")
  [ "$delivered" -ge 1 ] && break
  sleep 1
done
[ "$delivered" -ge 1 ] || fail "nenhum webhook foi entregue ao web" "$API"

step "OK"
