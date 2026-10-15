# api

App NestJS do monorepo. Estrutura, convenções e checklist para criar módulos em [ARCHITECTURE.md](ARCHITECTURE.md).

## Rodando

Na raiz do monorepo:

```bash
make install
make dev
```

| URL                                 | O quê                         |
| ----------------------------------- | ----------------------------- |
| `http://localhost:3333/api/v1/...`  | API                           |
| `http://localhost:3333/swagger-api` | Swagger (só fora de produção) |
| `http://localhost:3333/health`      | Health check                  |

## Scripts

Rode dentro de `apps/api`, ou da raiz com `--workspace=apps/api`.

| Comando                                   | O quê                                                             |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `npm run start:dev`                       | API em modo watch (fora do Docker)                                |
| `npm run build`                           | compila (rode `npm run generate` antes; da raiz, o build já gera) |
| `npm run lint` / `npm run typecheck`      | oxlint / tsc                                                      |
| `npm run format`                          | Prettier                                                          |
| `npm test` / `npm run test:e2e`           | testes unitários / e2e                                            |
| `npm run test:cov`                        | unitários + e2e com cobertura (mínimo 100%)                       |
| `npm run prisma:seed`                     | roda os seeders (ou `make seeder` na raiz)                        |
| `npm run prisma:migrate -- --name <nome>` | cria e aplica uma migration                                       |
| `npm run prisma:deploy`                   | aplica as migrations pendentes                                    |
| `npm run prisma:studio`                   | UI do banco                                                       |
