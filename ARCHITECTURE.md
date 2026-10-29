# Arquitetura do Monorepo

Base para projetos com **API NestJS** e **front Next**, num monorepo com **npm workspaces** e **Turborepo**.

| Documento                                            | Conteúdo                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| Este arquivo                                         | visão geral, regras entre apps e pacotes, contrato, infra e CI |
| [apps/api/ARCHITECTURE.md](apps/api/ARCHITECTURE.md) | camadas, convenções e checklist da api                         |
| [apps/web/ARCHITECTURE.md](apps/web/ARCHITECTURE.md) | SSR-first, estrutura, testes, Storybook e checklist do web     |

---

## 1. Requisitos

| #   | Requisito                                                                                     |
| --- | --------------------------------------------------------------------------------------------- |
| R1  | **npm em tudo**: sem yarn, pnpm ou bun (o `preinstall` bloqueia)                              |
| R2  | **api com 100% de cobertura** (statements, branches, functions e lines)                       |
| R3  | **web com 100% de cobertura**                                                                 |
| R4  | **web documentado no Storybook**                                                              |
| R5  | **web SSR-first**: Server Components por padrão; Client Components explícitos (`.client.tsx`) |

Os pacotes internos (`packages/*`) com código também têm 100% de cobertura.

---

## 2. Estrutura

```
.
├── apps/
│   ├── api/                  # NestJS + Prisma + PostgreSQL
│   └── web/                  # Next (App Router) + Tailwind + shadcn/ui + Storybook
├── packages/
│   ├── api-client/           # @repo/api-client: tipos + client HTTP gerados do OpenAPI da api
│   ├── tsconfig/             # @repo/tsconfig: base, nest, next e library
│   └── vitest-config/        # @repo/vitest-config: regra de cobertura (100%) compartilhada
├── .github/workflows/ci.yml  # CI
├── docker-compose.yml        # stack de desenvolvimento
├── turbo.json                # tarefas e dependências entre elas
├── package.json              # workspaces + scripts da raiz
├── package-lock.json         # ÚNICO lockfile
├── .npmrc                    # engine-strict, save-exact
├── .oxlintrc.json            # regras de lint base (os apps estendem)
├── .prettierrc
└── .env.example              # só infraestrutura do Compose
```

---

## 3. Regras do monorepo

1. **Um app não importa de outro app.** O que precisa ser compartilhado vira um pacote em `packages/`.
2. **Um pacote só existe se for usado por pelo menos dois apps.**
3. **O Prisma é exclusivo da `api`.** O `web` fala só com a api, que é a única dona das regras de negócio.
4. **Os pacotes não têm regra de negócio.** Só tipos, client HTTP e configuração.
5. **Os pacotes são consumidos como código-fonte** (`exports` apontando para `src`), sem build próprio. O Next e o Vitest transpilam direto.
6. **Cada app tem o próprio `.env`, validado com zod.** O `.env` da raiz é só do Compose.
7. **Um único `package-lock.json`, na raiz.** Não rode `npm install` dentro dos apps; use `--workspace`.
8. **Dependência interna usa a versão `"*"`** (o npm não suporta `workspace:`).

---

## 4. O contrato entre api e web

O **Swagger da api é a fonte da verdade**. Dele saem os tipos que o web usa:

```
apps/api (DTOs + @ApiProperty)
   │  npm run openapi:export (api)      → apps/api/openapi.json        (sem banco: modo preview do Nest)
   ▼
packages/api-client
   │  npm run generate (api-client)     → src/schema.d.ts              (openapi-typescript)
   │  createApiClient({ baseUrl })      → client tipado                (openapi-fetch)
   ▼
apps/web
   getApi().GET('/api/v1/chat/messages', { params: { query: { limit } } })   → tipado como o DTO
```

- `npm run generate` (na raiz) roda a cadeia inteira: build da api → export → tipos.
- O Turborepo faz `typecheck`, `test`, `build` etc. do web dependerem dessa geração.
- **Se um DTO mudar de forma incompatível, o typecheck/build do web quebra no CI**, antes de chegar a produção.
- `openapi.json` e `schema.d.ts` são gerados e não são versionados.

---

## 5. Comentários no código

Vale para **todo o monorepo**: api, web, pacotes e arquivos de configuração (`*.ts`, `*.tsx`, `*.mjs`, `Dockerfile`, `*.yml`, `.env.example`, `schema.prisma`, CSS).

### 5.1 Regras

| Regra                            | Detalhe                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sempre em inglês**             | Comentários e JSDoc são escritos em inglês. A documentação (`*.md`) e os textos que o usuário vê (`dictionary`, mensagens de erro da api) continuam em português. |
| **Explique o porquê, não o quê** | Comente só o que o código não diz sozinho: um motivo, uma restrição, uma armadilha. Se um nome melhor resolve, renomeie em vez de comentar.                       |
| **Curto**                        | Uma linha é o padrão; três é o máximo. Explicação longa vai para o `ARCHITECTURE.md` do app, e o comentário pode só apontar para lá.                              |
| **JSDoc só quando agrega**       | Use em props e APIs públicas quando o tipo não basta (o Storybook mostra o JSDoc das props). Não repita o nome do parâmetro nem o tipo.                           |
| **Proibido**                     | Código comentado, comentário que repete o código, `TODO` sem referência (issue ou ticket) e blocos de "cabeçalho" explicando o arquivo inteiro.                   |

### 5.2 Exemplos

```ts
// ❌ Repete o código (e em português)
// Converte o model do Prisma no DTO de resposta
static toResponse(message: MessageWithAuthor): MessageResponseDto { ... }

// ❌ Longo demais: isso é documentação, não comentário
/**
 * Server Action: é um endpoint público (POST). Por isso valida a entrada aqui,
 * mesmo que o formulário já valide no navegador.
 * Esta base ainda não tem autenticação; quando tiver, a sessão é checada aqui.
 */

// ✅ Curto, em inglês, explica o porquê
// Public POST endpoint: always validate here. Check the session once auth exists.

// ✅ Restrição que não é óbvia
// ConfigModule validates env when AppModule is imported.
const { AppModule } = await import('./app.module.js');

// ✅ JSDoc que acrescenta informação ao tipo
/** Without /api/v1: it's already part of the paths. */
baseUrl: string;
```

Na revisão de PR, comentário fora destas regras é tratado como qualquer outro problema de código.

---

## 6. Reaproveitamento de código

Antes de escrever algo novo, procure se já existe. Quando algo for compartilhado, ele tem um lugar certo.

### 6.1 Onde fica o código compartilhado

| Escopo do reuso                               | Lugar                                              | Exemplos atuais                                                                                              |
| --------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Entre apps (api, web) e pacotes               | `packages/*`                                       | `@repo/api-client`, `@repo/tsconfig`, `@repo/vitest-config`                                                  |
| Entre módulos da api                          | `apps/api/src/common/`                             | `IBaseRepository`, `PaginationDto`, `PaginatedResponseDto`, `PrismaExceptionFilter`, `@ApiPaginatedResponse` |
| Entre features do web                         | `apps/web/src/components/ui/`, `apps/web/src/lib/` | `PaginationNav`, `Button`, `getApi()`, `formatTime()`                                                        |
| Dentro de um módulo/feature                   | a própria pasta do módulo/feature                  | `MessageMapper`, `chat.dictionary.ts`                                                                        |
| Entre testes (e stories) de um módulo/feature | `test-fixtures.ts` na raiz do módulo/feature       | `makeParticipant()` e `makeMessage()` (api e web), `makeConversation()` (web)                                |
| Configuração de ferramentas                   | arquivo base na raiz + `extends`, ou pacote        | `.oxlintrc.json` da raiz, `@repo/tsconfig`, `@repo/vitest-config`                                            |

### 6.2 Quando extrair

| Situação                                                          | O que fazer                                                                                                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A mesma lógica aparece em 2+ lugares **e muda pelo mesmo motivo** | Extraia para o lugar da tabela acima. Ex.: a regra de cobertura de 100% estava copiada em três `vitest.config.ts` e virou `@repo/vitest-config`                          |
| A semelhança é só de forma (os dois mudam por motivos diferentes) | Mantenha separado. Ex.: a validação de `.env` da api (`ConfigModule`) e a do web (`getEnv()` sob demanda) compartilham três linhas, mas se integram de jeitos diferentes |
| Uma abstração genérica para um único uso                          | Não crie. Espere o segundo ou terceiro uso real para enxergar o que é comum                                                                                              |
| Um tipo que já existe no contrato                                 | Nunca redeclare: use `Schemas['XDto']` do `@repo/api-client` no web e os tipos do Prisma na api                                                                          |
| Dados de teste repetidos entre specs ou stories                   | `make<Entidade>(overrides)` no `test-fixtures.ts` do módulo/feature                                                                                                      |

### 6.3 Regras

- **Pacotes:** só existem se forem usados por 2+ apps/pacotes, não têm regra de negócio e mantêm 100% de cobertura (ver [seção 3](#3-regras-do-monorepo)).
- **Direção das dependências:** `common/` (api) e `components/ui`/`lib/` (web) **não importam** de módulos/features. O compartilhado nunca depende do específico. No web, o lint garante isso.
- **Um módulo/feature não importa de outro.** Se dois precisam da mesma coisa, ela sobe para o lugar compartilhado. Na api, o módulo dono **exporta** o service, e o outro **importa o módulo**.
- **Configuração de ferramenta:** uma base na raiz ou num pacote, e os apps só acrescentam o que é deles.
- **Ao extrair, mova os testes junto**, e mantenha a cobertura em 100% no lugar novo.

---

## 7. Comandos (na raiz)

### 7.1 Makefile (uso do dia a dia)

| Comando                      | O que faz                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make` / `make help`         | lista os comandos                                                                                                                                                                                                |
| **Setup e qualidade**        |                                                                                                                                                                                                                  |
| `make install`               | cria os `.env` que faltam (a partir dos `.env.example`, trocando `<nome-do-projeto>` pelo `name` do `package.json`), roda `npm install`, instala o Chromium do Playwright e gera o contrato (`npm run generate`) |
| `make gate`                  | sobe o banco, aplica as migrations e roda `npm run check`. É exatamente o que o job "Qualidade" do CI roda. Não inclui o E2E                                                                                     |
| `make e2e`                   | sobe a stack em segundo plano (`docker compose up -d --wait`) e roda o Playwright. É o que o job "E2E" do CI roda. A stack continua no ar depois (`make down` para parar)                                        |
| **Ambiente local**           |                                                                                                                                                                                                                  |
| `make dev`                   | `docker compose up --build`: database → migrations → api → web, com logs no terminal. O Ctrl+C só **para** os containers                                                                                         |
| `make down`                  | para e remove os containers. `make down v=1` apaga também o volume do banco                                                                                                                                      |
| `make logs`                  | acompanha os logs da stack. `make logs s=api` mostra um serviço só                                                                                                                                               |
| `make storybook`             | Storybook do web em `http://localhost:6006`                                                                                                                                                                      |
| **Banco de dados**           |                                                                                                                                                                                                                  |
| `make migrate`               | sobe o banco (se não estiver rodando) e aplica as migrations pendentes                                                                                                                                           |
| `make migration name=<nome>` | cria uma migration a partir das mudanças no `schema.prisma` (`prisma migrate dev`). Sem mudanças, avisa e não cria nada                                                                                          |
| `make seeder`                | roda as migrations e depois os seeders                                                                                                                                                                           |
| `make reset`                 | **apaga o banco local**, reaplica as migrations e roda os seeders. Pede confirmação (`make reset force=1` pula a pergunta). Só para o banco de desenvolvimento                                                   |

Os `.env` **nunca são sobrescritos**: o `make` só cria o arquivo quando ele não existe.

> O Prisma bloqueia o `migrate reset` quando ele é executado por um agente de IA. Rodado por uma pessoa no terminal, o `make reset` funciona normalmente.

### 7.2 Scripts npm

| Comando                   | O quê                                                        |
| ------------------------- | ------------------------------------------------------------ |
| `npm install`             | instala tudo (só npm)                                        |
| `npm run generate`        | Prisma client + OpenAPI + tipos do api-client                |
| `npm run dev`             | todos os apps em modo dev                                    |
| `npm run build`           | build de todos os apps                                       |
| `npm run lint`            | lint + convenções                                            |
| `npm run typecheck`       | tipos                                                        |
| `npm test`                | testes unitários                                             |
| `npm run test:cov`        | cobertura; **falha abaixo de 100%** (a api precisa do banco) |
| `npm run test:storybook`  | stories como teste (Chromium)                                |
| `npm run build-storybook` | Storybook estático                                           |
| `npm run check`           | tudo que o CI roda, menos o E2E                              |
| `npm run format`          | Prettier                                                     |

Para um app: `npm run <script> --workspace=apps/<app>`. Para instalar uma dependência: `npm install <pacote> --workspace=apps/<app>`.

O Turborepo guarda cache por tarefa: rodar de novo sem mudanças leva segundos.

---

## 8. Ambiente local

```bash
make install
make dev
```

| Serviço     | Porta | Perfil | O quê                                       |
| ----------- | ----- | ------ | ------------------------------------------- |
| `web`       | 3000  | —      | Next em dev (`src/` montado)                |
| `api`       | 3333  | —      | Nest em watch (`src/` e `prisma/` montados) |
| `migrate`   | —     | —      | `prisma migrate deploy`, depois encerra     |
| `database`  | 5432  | —      | Postgres                                    |
| `mock-api`  | 4010  | `mock` | api fake (Prism) gerada do OpenAPI          |
| `storybook` | 6006  | `docs` | Storybook do web                            |

A ordem de subida é: `database` (saudável) → `migrate` (concluído) → `api` (saudável) → `web` (saudável). O `docker compose up --wait` espera a stack inteira ficar pronta.

**Variáveis:**

| Arquivo         | Conteúdo                                                          |
| --------------- | ----------------------------------------------------------------- |
| `.env` (raiz)   | `POSTGRES_*`, portas (`WEB_PORT`, `API_PORT`, ...)                |
| `apps/api/.env` | variáveis da api; `DATABASE_URL` sempre em `localhost`            |
| `apps/web/.env` | `API_URL` sempre em `localhost`; `WEBHOOK_SECRET` igual ao da api |

No Compose, as URLs entre containers (`DATABASE_URL` → `database`, `API_URL` → `api`) são montadas automaticamente. Por isso os `.env` dos apps servem tanto para rodar no Docker quanto fora dele.

---

## 9. Imagens de produção

As duas partem da **raiz** e usam `turbo prune` para levar só o necessário:

```bash
docker build -f apps/api/Dockerfile --target production -t api .
docker build -f apps/web/Dockerfile --target production -t web .
```

| Imagem | Conteúdo                                                | Usuário |
| ------ | ------------------------------------------------------- | ------- |
| api    | `node_modules` de produção + `dist` (sem CLI do Prisma) | `node`  |
| web    | `.next/standalone` + estáticos                          | `node`  |

As migrations de produção rodam no pipeline, antes do deploy da api: a imagem de produção não tem a CLI do Prisma.

---

## 10. CI (`.github/workflows/ci.yml`)

**O CI roda os mesmos comandos `make` usados localmente.** Se `make gate` e `make e2e` passam na sua máquina, passam no CI.

| Job       | Passos                                              |
| --------- | --------------------------------------------------- |
| Qualidade | `npm ci` → Chromium do Playwright → **`make gate`** |
| E2E       | `npm ci` → Chromium do Playwright → **`make e2e`**  |
| Imagens   | build das imagens de produção da api e do web       |

- O banco do CI é o mesmo do ambiente local: o `make` sobe o Postgres pelo Docker Compose.
- Os `.env` são criados pelo `make` a partir dos `.env.example`.
- Os jobs rodam o projeto inteiro em todo PR (sem filtro de pacotes afetados), exatamente como o `make gate` local.

**Bloqueiam o merge:** erro de lint ou de convenção, erro de tipo, **cobertura abaixo de 100%**, falha de build, story quebrada ou com violação de acessibilidade, e falha no E2E.

Os artefatos publicados são a cobertura, o Storybook estático e o relatório do Playwright.

Deploy não está configurado: depende de onde cada app vai rodar.

---

## 11. Dependências e segurança

- O `npm audit` acusa vulnerabilidades em dependências **das CLIs** do Prisma (`mysql2`, `deepmerge-ts`) e do shadcn (`braces`, `fast-glob`).
- Nenhuma delas vai para as imagens de produção: a CLI do Prisma é removida da imagem da api, e o shadcn é só devDependency.
- As correções sugeridas pelo `npm audit fix --force` são **downgrades de versão major** e não devem ser aplicadas. Acompanhe as versões novas do Prisma e do shadcn.
