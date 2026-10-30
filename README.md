# web-hook

Monorepo com **npm workspaces** e **Turborepo**: API **NestJS** + front **Next** (SSR-first).

| Caminho                  | O quê                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `apps/api`               | API NestJS ([README](apps/api/README.md), [ARCHITECTURE](apps/api/ARCHITECTURE.md)) |
| `apps/web`               | Front Next ([README](apps/web/README.md), [ARCHITECTURE](apps/web/ARCHITECTURE.md)) |
| `packages/api-client`    | client tipado da api, gerado do OpenAPI                                             |
| `packages/tsconfig`      | configurações base do TypeScript                                                    |
| `packages/vitest-config` | regra de cobertura (100%) compartilhada pelos testes                                |

Visão geral, regras e infraestrutura: [ARCHITECTURE.md](ARCHITECTURE.md).

## Primeiros passos

Requisitos: Node, npm, Docker e `make`.

```bash
make install    # dependências, arquivos .env, navegador de testes e contrato da api
make dev        # sobe database, migrations, api e web
make seeder     # (opcional, em outro terminal) dados de exemplo
```

| URL                                 | O quê                         |
| ----------------------------------- | ----------------------------- |
| `http://localhost:3000`             | web                           |
| `http://localhost:3333/api/v1/...`  | api                           |
| `http://localhost:3333/swagger-api` | Swagger (só fora de produção) |
| `http://localhost:3333/health`      | health check da api           |

O `make install` cria os `.env` que faltam e gera um `WEBHOOK_SECRET` aleatório, gravado igual em `apps/api/.env` e `apps/web/.env`. A api assina os webhooks com ele e o web confere a assinatura. Se recriar um desses `.env`, apague os dois e rode `make env`: com segredos diferentes, o web recusa todos os webhooks com `401`.

## Comandos

| Comando                      | O quê                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `make`                       | lista os comandos                                                                   |
| `make install`               | instala as dependências (api, web e pacotes) e prepara o ambiente                   |
| `make dev`                   | sobe o projeto localmente no Docker                                                 |
| `make down`                  | para e remove os containers (`v=1` apaga também o banco)                            |
| `make logs`                  | logs da stack (`s=api` para um serviço)                                             |
| `make migrate`               | aplica as migrations pendentes                                                      |
| `make migration name=<nome>` | cria uma migration a partir do schema                                               |
| `make seeder`                | popula o banco com dados de exemplo (idempotente)                                   |
| `make reset`                 | apaga o banco local, reaplica as migrations e roda os seeders (pede confirmação)    |
| `make gate`                  | tudo que o CI roda: formatação, lint, tipos, testes (100%), build e Storybook       |
| `make e2e`                   | testes E2E (Playwright) contra a stack; apaga do banco os participantes `e2e-web-*` |
| `make smoke`                 | constrói as imagens de produção e confere que sobem como no Railway                 |
| `make storybook`             | Storybook do web                                                                    |

Lista completa em [ARCHITECTURE.md](ARCHITECTURE.md#7-comandos-na-raiz).

## Deploy

No Railway: api, web, migrate e Postgres, com os serviços falando pela rede privada. Serviços, variáveis, ordem do primeiro deploy e operação: [ARCHITECTURE.md §12](ARCHITECTURE.md#12-deploy-no-railway).
