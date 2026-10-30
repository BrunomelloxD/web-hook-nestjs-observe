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

| Comando                      | O que faz                                                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `make` / `make help`         | lista os comandos                                                                                                                                                                                                  |
| **Setup e qualidade**        |                                                                                                                                                                                                                    |
| `make install`               | cria os `.env` que faltam (a partir dos `.env.example`, trocando `<nome-do-projeto>` pelo `name` do `package.json`), roda `npm install`, instala o Chromium do Playwright e gera o contrato (`npm run generate`)   |
| `make gate`                  | sobe o banco, aplica as migrations e roda `npm run check`. É exatamente o que o job "Qualidade" do CI roda. Não inclui o E2E                                                                                       |
| `make e2e`                   | gera o Prisma client no host, sobe a stack em segundo plano (`docker compose up -d --wait`) e roda o Playwright. É o que o job "E2E" do CI roda. A stack continua no ar depois (`make down` para parar)            |
| `make smoke`                 | constrói as imagens de produção (api, migrate e web) sem `.env`, sobe cada uma só com as variáveis do deploy e confere `/health`, `/` e a entrega de um webhook da api ao web. É o job "Imagens de produção" do CI |
| **Ambiente local**           |                                                                                                                                                                                                                    |
| `make dev`                   | `docker compose up --build`: database → migrations → api → web, com logs no terminal. O Ctrl+C só **para** os containers                                                                                           |
| `make down`                  | para e remove os containers. `make down v=1` apaga também o volume do banco                                                                                                                                        |
| `make logs`                  | acompanha os logs da stack. `make logs s=api` mostra um serviço só                                                                                                                                                 |
| `make storybook`             | Storybook do web em `http://localhost:6006`                                                                                                                                                                        |
| **Banco de dados**           |                                                                                                                                                                                                                    |
| `make migrate`               | sobe o banco (se não estiver rodando) e aplica as migrations pendentes                                                                                                                                             |
| `make migration name=<nome>` | cria uma migration a partir das mudanças no `schema.prisma` (`prisma migrate dev`). Sem mudanças, avisa e não cria nada                                                                                            |
| `make seeder`                | roda as migrations e depois os seeders                                                                                                                                                                             |
| `make reset`                 | **apaga o banco local**, reaplica as migrations e roda os seeders. Pede confirmação (`make reset force=1` pula a pergunta). Só para o banco de desenvolvimento                                                     |

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

As três partem da **raiz** e usam `turbo prune` para levar só o necessário:

```bash
docker build -f apps/api/Dockerfile --target production -t api .
docker build -f apps/api/Dockerfile.migrate -t api-migrate .
docker build -f apps/web/Dockerfile --target production -t web .
```

| Imagem        | Conteúdo                                                | Comando                     | Usuário |
| ------------- | ------------------------------------------------------- | --------------------------- | ------- |
| api           | `node_modules` de produção + `dist` (sem CLI do Prisma) | `node dist/app/main.js`     | `node`  |
| api (migrate) | dependências completas + `prisma/` e `prisma.config.ts` | `npx prisma migrate deploy` | `node`  |
| web           | `.next/standalone` + estáticos, escutando em `::`       | `node apps/web/server.js`   | `node`  |

A imagem de produção da api não tem a CLI do Prisma: as migrations rodam pela imagem `migrate`, um arquivo próprio porque o Railway constrói o último estágio do Dockerfile que recebe. O web escuta em `::` (IPv6 e IPv4) porque recebe os webhooks da api pela rede privada ([seção 12](#12-deploy-no-railway)).

O `.dockerignore` deixa todo `.env` fora do contexto; o `make smoke` confere que nenhuma imagem leva um.

---

## 10. CI (`.github/workflows/ci.yml`)

**O CI roda os mesmos comandos `make` usados localmente.** Se `make gate` e `make e2e` passam na sua máquina, passam no CI.

| Job                 | Passos                                              |
| ------------------- | --------------------------------------------------- |
| Qualidade           | `npm ci` → Chromium do Playwright → **`make gate`** |
| E2E                 | `npm ci` → Chromium do Playwright → **`make e2e`**  |
| Imagens de produção | **`make smoke`**                                    |

- O banco do CI é o mesmo do ambiente local: o `make` sobe o Postgres pelo Docker Compose.
- Os `.env` são criados pelo `make` a partir dos `.env.example`.
- Os jobs rodam o projeto inteiro em todo PR (sem filtro de pacotes afetados), exatamente como o `make gate` local.
- O usuário do runner não tem o uid 1000 do usuário `node` das imagens, então o container da api não escreve no `src/` montado. O Prisma client do container fica num volume anônimo (`/app/apps/api/src/generated`), e o `make e2e` gera o client no host antes de subir a stack, para o Docker não criar essa pasta como root.

**Bloqueiam o merge:** erro de lint ou de convenção, erro de tipo, **cobertura abaixo de 100%**, falha de build, story quebrada ou com violação de acessibilidade, falha no E2E e imagem de produção que não sobe.

Os artefatos publicados são a cobertura, o Storybook estático e o relatório do Playwright.

O deploy não passa pelo CI: o Railway constrói as imagens a partir do repositório ([seção 12](#12-deploy-no-railway)).

---

## 11. Dependências e segurança

- O `npm audit` acusa só dependências do shadcn (`zod` e `deepmerge`), que é devDependency e não vai para as imagens de produção.
- A correção sugerida exige `npm audit fix --force` (sai do pin exato do shadcn) e não foi aplicada. Acompanhe as versões novas do shadcn.

---

## 12. Deploy no Railway

Referências: [monorepo](https://docs.railway.com/deployments/monorepo), [Dockerfiles](https://docs.railway.com/guides/dockerfiles), [rede privada](https://docs.railway.com/guides/private-networking).

O monorepo é **compartilhado** (os apps usam `packages/*`). Por isso todo serviço que constrói imagem tem **Root Directory vazio**: os Dockerfiles partem da raiz, com `turbo prune`. Cada serviço escolhe o Dockerfile pela variável `RAILWAY_DOCKERFILE_PATH`. A configuração fica nos serviços do Railway, sem `railway.json`: o config-as-code está obsoleto no Railway.

### 12.1 Serviços

| Serviço    | `RAILWAY_DOCKERFILE_PATH`     | Domínio público | Outras configurações                                                                        |
| ---------- | ----------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| `web`      | `apps/web/Dockerfile`         | sim (HTTPS)     | porta 3000; healthcheck em `/`; **1 réplica** (o hub do tempo real fica em memória, AD-003) |
| `api`      | `apps/api/Dockerfile`         | **não**         | `PORT=3333`; healthcheck em `/health`. Só o web chama a api                                 |
| `migrate`  | `apps/api/Dockerfile.migrate` | não             | restart policy "Never": roda `prisma migrate deploy` e encerra                              |
| `Postgres` | gerenciado                    | não             | a `DATABASE_URL` **privada** vai para `api` e `migrate`                                     |

O webhook vai da api para o web pela rede privada (`http://<serviço-web>.railway.internal:3000/webhooks/chat`) e o web chama a api também pela rede privada. Nenhum dos dois sai pela internet. Nos ambientes do Railway criados antes de 16/10/2025, a rede privada é só IPv6: o web escuta em `::` (`HOSTNAME` no Dockerfile) e o Nest escuta em `::` por padrão.

**Watch paths** (um commit num app não reconstrói o outro):

- `api` e `migrate`: `apps/api/**`, `packages/**`, `package-lock.json`, `package.json`, `turbo.json`;
- `web`: `apps/web/**`, `packages/**`, `package-lock.json`, `package.json`, `turbo.json` e `apps/api/src/**` (o build do web gera os tipos a partir do OpenAPI da api).

### 12.2 Variáveis

Só os nomes; os valores ficam no Railway. Use as referências de variável do Railway (`${{Postgres.DATABASE_URL}}`, `${{web.RAILWAY_PRIVATE_DOMAIN}}`) em vez de copiar valores.

| Serviço   | Variáveis                                                                                                                                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`     | `RAILWAY_DOCKERFILE_PATH`, `NODE_ENV=production`, `PORT=3333`, `APP_NAME`, `LOG_LEVEL`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `CORS_ORIGIN` (URL pública do web), `WEBHOOK_TARGET_URL=http://${{web.RAILWAY_PRIVATE_DOMAIN}}:3000/webhooks/chat`, `WEBHOOK_SECRET` |
| `migrate` | `RAILWAY_DOCKERFILE_PATH`, `DATABASE_URL=${{Postgres.DATABASE_URL}}`                                                                                                                                                                                                    |
| `web`     | `RAILWAY_DOCKERFILE_PATH`, `API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3333`, `WEBHOOK_SECRET` (o mesmo da api)                                                                                                                                                     |

Gere o `WEBHOOK_SECRET` de produção uma vez e grave o mesmo valor na api e no web:

```bash
echo "whsec_$(openssl rand -base64 32)"
```

Com segredos diferentes, o web responde `401` a todo webhook e o chat deixa de atualizar em tempo real.

### 12.3 Primeiro deploy

Nesta ordem: `Postgres` → `migrate` (encerra com 0) → `api` (healthcheck verde) → `web`. Depois, gere o domínio público do web e grave a URL dele no `CORS_ORIGIN` da api.

### 12.4 Operação

- **Migration nova.** O Railway não ordena serviços entre si. Quando um commit traz migration, rode o `migrate` e espere o código 0 **antes** de promover o deploy da api. Sem a migration, a api falha nas consultas novas; o healthcheck em `/health` só confere a conexão com o banco.
- **Escala.** O web roda com **uma réplica**: o hub em memória só conhece os navegadores do próprio processo, e o webhook chega em uma instância só (AD-003). A api pode ter mais réplicas, mas o limite de envio e o de digitação são por processo (AD-004, AD-005).
- **Rotação do `WEBHOOK_SECRET`.** Troque na api e no web **juntos** e faça o redeploy dos dois; entre um e outro, os webhooks recebem `401` e se perdem (sem outbox, AD-005). A reconexão do navegador recupera as mensagens pelo `seq`.
- **Rollback de aplicação.** O Railway guarda os deploys anteriores: volte para o último saudável.
- **Rollback de banco.** As migrations do Prisma só vão para frente. Uma migration destrutiva exige plano próprio: backup antes e migration de reversão escrita à mão.
- **Antes de subir.** `make smoke` reproduz o deploy localmente: constrói as três imagens sem `.env`, aplica as migrations num banco vazio, sobe api e web só com as variáveis desta seção e confere que um webhook chega ao web.
