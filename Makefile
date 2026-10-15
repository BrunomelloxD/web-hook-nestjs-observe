SHELL := /bin/bash
.DEFAULT_GOAL := help

PROJECT_NAME := $(shell node -p "require('./package.json').name" 2>/dev/null)
COMPOSE := docker compose
API := --workspace=apps/api
WEB := --workspace=apps/web
ENV_FILES := .env apps/api/.env apps/web/.env
# One value per make run, so apps/api/.env and apps/web/.env created together share it.
WEBHOOK_SECRET := whsec_$(shell node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))")

.PHONY: help install gate dev down logs migrate migration seeder reset e2e storybook env db

help: ## Lista os comandos
	@grep -E '^[a-z0-9-]+:.*## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36mmake %-10s\033[0m %s\n", $$1, $$2}'

# ---------- setup and quality ----------

install: env ## Instala as dependências (api, web e pacotes) e prepara o ambiente
	npm install
	npm exec $(WEB) -- playwright install chromium
	npm run generate

gate: migrate ## Roda tudo que o CI roda: formatação, lint, tipos, testes (100%), build e Storybook
	npm run check

e2e: env ## Sobe a stack em segundo plano e roda os testes E2E (Playwright)
	$(COMPOSE) up -d --build --wait
	npm run test:e2e $(WEB)

# ---------- local environment ----------

dev: env ## Sobe o projeto localmente (database, migrations, api e web) no Docker
	$(COMPOSE) up --build

down: ## Para e remove os containers (make down v=1 também apaga os dados do banco)
	$(COMPOSE) down $(if $(v),-v,)

logs: ## Acompanha os logs da stack (make logs s=api para um serviço)
	$(COMPOSE) logs -f $(s)

storybook: ## Abre o Storybook do web em http://localhost:6006
	npm run storybook $(WEB)

# ---------- database ----------

migrate: db ## Aplica as migrations pendentes
	npm run prisma:deploy $(API)

migration: db ## Cria uma migration a partir do schema (make migration name=add_users)
	@if [ -z "$(name)" ]; then echo "Uso: make migration name=<nome_da_migration>"; exit 1; fi
	npm run prisma:migrate $(API) -- --name $(name)

seeder: migrate ## Popula o banco com os seeders (idempotente)
	npm run prisma:seed $(API)

reset: db ## Apaga o banco, reaplica as migrations e roda os seeders (pede confirmação)
	@if [ -z "$(force)" ]; then \
		read -r -p "Isso apaga TODOS os dados do banco local. Continuar? [s/N] " answer; \
		[[ "$$answer" =~ ^[sSyY]$$ ]] || { echo "Cancelado."; exit 0; }; \
	fi; \
	npm exec $(API) -- prisma migrate reset --force && npm run prisma:seed $(API)

# ---------- internal ----------

env: $(ENV_FILES)

# Created only when missing; never overwrites an existing .env.
$(ENV_FILES):
	@sed -e 's/<nome-do-projeto>/$(PROJECT_NAME)/g' -e 's|<webhook-secret>|$(WEBHOOK_SECRET)|g' $@.example > $@
	@echo "$@ criado a partir de $@.example"

db: env
	$(COMPOSE) up -d --wait database
