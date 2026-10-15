# Chat básico: entrar, histórico, enviar e sair (F1) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/chat-core/spec.md`
**Design**: `.specs/features/chat-core/design.md`
**Status**: Draft
**Pré-requisito**: F0 (`chat-theme`) concluída — os componentes de `features/chat/components/` e `chat.types.ts` já existem.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `apps/api/ARCHITECTURE.md` §10 (100% somando unitários e e2e; onde fica cada teste; prefixo `e2e-`), `apps/web/ARCHITECTURE.md` §8-§9 (MSW com `onUnhandledFrame: 'error'`, containers chamados como função, story obrigatória), `packages/vitest-config/src/index.ts` (limites de 100%).

| Code Layer                                                                      | Required Test Type | Coverage Expectation                                                                                        | Location Pattern                                  | Run Command                              |
| ------------------------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| api: service, `security/`                                                       | unit               | Todos os branches; 1:1 com os ACs; todos os edge cases                                                      | `modules/chat/{services,security}/test/*.spec.ts` | `npm test --workspace=apps/api`          |
| api: repository                                                                 | unit               | Cada método, incluindo a transação e os ramos de cursor; `PrismaService` mockado                            | `modules/chat/repositories/test/*.spec.ts`        | `npm test --workspace=apps/api`          |
| api: controller, guard, decorator, mapper, DTO de request                       | unit               | Controller delega ao service; guard nos 3 casos de `401`; DTO nos limites (2/20, 1000/1001, `limit` 1..100) | `modules/chat/**/test/*.spec.ts`                  | `npm test --workspace=apps/api`          |
| api: rotas HTTP                                                                 | e2e                | Todas as rotas: caminho feliz + cada edge case + `400`/`401`/`404`/`409`                                    | `test/*.e2e-spec.ts`                              | `npm run test:e2e --workspace=apps/api`  |
| api: module, schema, migration, DTO de response                                 | none               | - (cobertos pelo e2e e pelo build gate)                                                                     | -                                                 | `make gate`                              |
| web: `session/`, `queries/`, `actions/`, `schemas/`, route handlers, `proxy.ts` | unit               | Vitest + MSW; cada AC de JOIN-03, SEND-02, LEAVE-01; falhas da api                                          | `src/**/*.spec.ts`                                | `npm test --workspace=apps/web`          |
| web: containers, `app/`                                                         | unit               | Container chamado como função; página com a feature mockada                                                 | `src/**/*.spec.tsx`                               | `npm test --workspace=apps/web`          |
| web: componentes                                                                | unit + story       | Testing Library por AC; story por estado                                                                    | `*.spec.tsx` + `*.stories.tsx`                    | `npm test` + `npm run test:storybook`    |
| web: `index.ts`, tipos                                                          | none               | - (typecheck)                                                                                               | -                                                 | `npm run typecheck --workspace=apps/web` |
| Fluxo completo                                                                  | e2e                | Success Criteria da spec                                                                                    | `apps/web/e2e/*.spec.ts`                          | `make e2e`                               |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use                                 | Command                                                                                                                           |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Quick      | Tasks só com testes unitários               | `npm run typecheck --workspace=apps/<app> && npm test --workspace=apps/<app>`                                                     |
| Full       | api: tasks com e2e · web: tasks com stories | api: Quick + `make migrate && npm run test:e2e --workspace=apps/api` · web: Quick + `npm run test:storybook --workspace=apps/web` |
| E2E        | Tasks com Playwright                        | `make e2e`                                                                                                                        |
| Build      | Fim de fase, schema, migration, contrato    | `make gate`                                                                                                                       |

---

## Execution Plan

Phases run in order; tasks inside a phase run in order.

### Phase 1: api — dados e remoção de `examples`

```
T1 → T2 → T4
T2 → T34a
T3
```

### Phase 2: api — domínio

```
T7 → T8
T5 → T10
T8 → T10
T9 → T10
T6 → T11
T8 → T11
T9 → T11
```

### Phase 3: api — HTTP e contrato

```
T12 → T13 → T15
T12 → T14 → T15
T15 → T16
T15 → T17
```

### Phase 4: web — sessão e leitura

```
T18 → T21 → T23
T18 → T22
T19 → T20
T19 → T23
T19 → T24
```

### Phase 5: web — Server Actions

```
T25 → T27
T26 → T28
T29
```

### Phase 6: web — feature na tela

```
T30 → T32
T31 → T32
T32 → T33
```

### Phase 7: web — rotas, remoção de `examples` e E2E

```
T34 → T38
T35 → T38
T36 → T38
T37 → T38
```

---

## Task Breakdown

### Phase 1: api — dados e remoção de `examples`

#### T1: Remover o módulo `examples` da api

**What**: Apagar `modules/examples/`, o `ExampleModule` do `app.module.ts`, `prisma/seeds/examples.seed.ts` e o registro no `seeds/index.ts`, os cenários `/examples` do `test/app.e2e-spec.ts` e as asserções de `examples` do `app/test/openapi.spec.ts`. O `model Example` fica até a T2.
**Where**: `apps/api/src/modules/examples/`
**Depends on**: None
**Reuses**: —
**Requirement**: CLEAN-01
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `grep -ri example apps/api/src apps/api/test apps/api/prisma/seeds` não acha código (só o model, que sai na T2)
- [x] `app.e2e-spec.ts` mantém os cenários de `/health`; `openapi.spec.ts` confere `/health` no lugar de `/api/v1/examples`
- [x] Full gate da api passa

**Tests**: e2e
**Gate**: full
**Commit**: `refactor(api)!: remove examples reference module`

> **Execução (T1):** sem git; os arquivos removidos foram movidos para o scratchpad da sessão, não apagados. O grep ainda acha `@ApiProperty({ example: … })` em `common/dtos/response/paginated-response.dto.ts`: é a chave do Swagger, não código do módulo. `logger.options.spec.ts` passou a usar `/api/v1/chat/messages` como rota de exemplo. **Desvio:** `ApiPaginatedResponse` e `PaginatedResponseDto.create` (base, ARCHITECTURE §5.3) só eram exercitados pelo `examples`; para manter os 100% foram criados `common/decorators/test/api-paginated-response.decorator.spec.ts` e `common/dtos/response/test/paginated-response.dto.spec.ts`.

---

#### T2: Schema do chat e migration `chat_init`

**What**: Trocar o `model Example` por `Participant`, `Message` e `MessageType` com `previewFeatures = ["partialIndexes"]`; apagar `migrations/20261014150117_init/` e gerar `chat_init` (`make migration name=chat_init` depois de `make reset`).
**Where**: `apps/api/prisma/schema.prisma`
**Depends on**: T1
**Reuses**: generator atual do `schema.prisma`
**Requirement**: JOIN-02 (AC5, AC8-9), ROOM-02, CLEAN-01; AD-006
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] O SQL da migration tem `CREATE UNIQUE INDEX "participants_online_name_key" … WHERE ("left_at" IS NULL)`; se o preview não gerar, o índice entra como SQL manual na migration (AD-006) e o desvio é anotado
- [x] `seq` é `BIGSERIAL` único; `token_hash` é `CHAR(64)` único
- [x] `make reset force=1` e `npm run generate` rodam limpos — o usuário rodou o `make reset` (o banco ficou só com `participants`, `messages` e a migration `chat_init`); `generate` limpo
- [x] Build gate passa (`TURBO_FORCE=true make gate` exit 0, fim da fase 1, depois da T34a)
- [x] A descrição do PR (quando houver) avisa que bancos locais precisam de `make reset`

> **Execução (T2) — BLOQUEADA no gate.** Schema trocado; `20261014150117_init/` movida para o scratchpad. O preview `partialIndexes` gerou o índice parcial, sem SQL manual. `npm run generate` roda limpo.
>
> - **Reset:** o Prisma 7 recusa `migrate reset` e `migrate dev` vindos de um agente sem o texto de consentimento do usuário (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`). A migration `20261014214058_chat_init` foi gerada com `prisma migrate diff --from-empty --to-schema … --script` (mesmo SQL do `migrate dev` num banco vazio, sem a linha `CREATE SCHEMA`) e aplicada com `make migrate`. Depois o usuário rodou `make reset force=1`; o banco local ficou só com as tabelas do chat e a migration `chat_init`.
> - **Gate:** `make gate` regenera `openapi.json` e `schema.d.ts` sem `/api/v1/examples`. Isso quebra o typecheck de `packages/api-client/src/test/index.spec.ts` (usa `/api/v1/examples`; nenhuma task cobre esse arquivo) e o de `apps/web/src/features/examples/` (que só sai na T34). Resolvido pela T34a (decisão do usuário).
> - **Nota de PR:** bancos locais precisam de `make reset` porque a migration `init` foi apagada.
>
> **Fix round 1 (T2, JOIN-02 AC7, Verifier Fix 2):** `name_key` passou de `VARCHAR(20)` para `VARCHAR(60)`. `toNameKey` faz NFC + `toLowerCase`, e um caractere aceito pelo DTO cresce no máximo para 3 (U+FB2C: NFC dá 3 code points / 3 unidades UTF-16; `'İ'` vira 2 no lowercase), conferido em todos os code points com o Node 24; o NFC e o lowercase da string inteira não passam da soma das partes, então 20 × 3 = 60 (o Postgres conta code points, ≤ unidades UTF-16). Migration `20261015021518_widen_name_key` gerada com `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (o `--from-migrations` pede `shadowDatabaseUrl`; o banco estava em dia com `chat_init`), aplicada com `make migrate`. O SQL é só `ALTER TABLE "participants" ALTER COLUMN "name_key" SET DATA TYPE VARCHAR(60);` (`SET DATA TYPE` = `TYPE`; aumentar o tamanho não perde dados). Depois: `\d participants` mostra `character varying(60)` e o `participants_online_name_key UNIQUE … WHERE left_at IS NULL` intacto; `migrate diff --exit-code` do banco para o schema volta vazio; `npm run generate` limpo. Commit: `fix(api): widen name_key to fit lowercased 20-character names`.

**Tests**: none (schema; coberto pelo e2e da T15)
**Gate**: build
**Commit**: `feat(api)!: replace Example model with chat schema`

---

#### T3: Token e chave do nome em `security/participant-token.ts`

**What**: `generateToken()` (32 bytes, base64url), `hashToken(token)` (SHA-256 hex) e `toNameKey(name)` (`normalize('NFC').toLowerCase()`).
**Where**: `apps/api/src/modules/chat/security/participant-token.ts`
**Depends on**: None
**Reuses**: `node:crypto`
**Requirement**: JOIN-02 (AC5, AC8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: token com 43 caracteres base64url, sem `.`, dois tokens diferentes; hash de 64 hex e determinístico; `toNameKey('ANA')` = `toNameKey('ana')`; forma NFD e NFC de "Érica" dão a mesma chave
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add participant token and name key helpers`

---

#### T4: Contratos dos repositórios e fixtures do módulo

**What**: Classes abstratas `IParticipantRepository` e `IMessageRepository` (sem `IBaseRepository`), o tipo `MessageWithAuthor`, e `test-fixtures.ts` com `makeParticipant()` e `makeMessage()`.
**Where**: `apps/api/src/modules/chat/repositories/*.repository.interface.ts`
**Depends on**: T2
**Reuses**: `modules/examples/repositories/example.repository.interface.ts` e `test-fixtures.ts` (do histórico do git)
**Requirement**: JOIN-02, ROOM-02, SEND-02, LEAVE-01
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Assinaturas iguais às do design; `MessageWithAuthor` derivado de `Prisma.MessageGetPayload`
- [x] Quick gate passa (typecheck)

> **Execução (T4):** `MessageWithAuthor` fica em `message.repository.interface.ts`. Os parâmetros viraram tipos nomeados (`CreateParticipantData`, `FindMessagePageParams`, `CreateMessageData`) com os mesmos campos do design. **Desvio (SPEC_DEVIATION):** para o build gate da fase 1 fechar em 100%, `modules/chat/test/test-fixtures.spec.ts` confere o formato das fixtures (o plano dizia que os specs das fases 2/3 as exercitariam), como na F0.

**Tests**: none (contratos abstratos e fixtures; exercitados pelos specs das fases 2 e 3)
**Gate**: quick
**Commit**: `feat(api): add chat repository contracts and fixtures`

---

#### T34a: Remoção de `examples` no web e no `@repo/api-client`

**What**: Metade de limpeza da T34, antecipada (decisão do usuário em 2026-10-14): a T1/T2 removeram `/api/v1/examples` e regeneraram o `schema.d.ts`, o que quebra o typecheck do `@repo/api-client` e do web até a T34. Apagar `apps/web/src/features/examples/`, `apps/web/src/app/examples/`, `apps/web/e2e/examples.spec.ts`, `apps/web/e2e/pages/examples.page.ts`; `app/page.tsx` vira uma página estática provisória (sem redirect para `/examples`) até a T34; `packages/api-client/src/test/index.spec.ts` passa a usar `/health`; o comentário de exemplo em `components/ui/pagination-nav.tsx` deixa de citar `/examples`; healthcheck do web no `docker-compose.yml` passa para `/`.
**Where**: `apps/web/src/app/page.tsx`, `packages/api-client/src/test/index.spec.ts`
**Depends on**: T2
**Reuses**: `app/page.spec.tsx`
**Requirement**: CLEAN-01
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `grep -ri example apps/web/src apps/web/e2e docker-compose.yml packages/api-client/src` vazio (fora `lib/search-params.ts`, se citar)
- [x] `page.spec.tsx` confere a página provisória (sem `redirect`)
- [x] O spec do `@repo/api-client` cobre os mesmos cenários com `/health`
- [x] `lib/search-params.ts` fica (fora de escopo) e entra na seção Handoff do `STATE.md` como pendência
- [x] Build gate passa (fim da fase 1)

**Tests**: unit
**Gate**: build
**Commit**: `refactor(web)!: remove examples feature from web and api-client`

> **Execução (T34a):** arquivos removidos movidos para o scratchpad (`removed/web/`). O grep só acha `@example` no JSDoc gerado do `schema.d.ts` (vem do Swagger do health). O comentário do `Schemas` em `packages/api-client/src/index.ts` passou a citar `MessageResponseDto`. **Desvio:** o cenário de "query params tipados" do spec do api-client virou "baseUrl + resposta tipada", porque `/health` não tem query params no contrato. `make gate` (forçado): exit 0, 19/19.

---

### Phase 2: api — domínio

#### T5: `ParticipantRepository`

**What**: Implementar `createWithJoinMessage` e `leaveWithMessage` (`$transaction` interativa), `findById`, `findActiveByTokenHash` (`leftAt: null`), `listOnline` (por `joinedAt`) e `countOnline`.
**Where**: `apps/api/src/modules/chat/repositories/participant.repository.ts`
**Depends on**: T4
**Reuses**: `modules/examples/repositories/example.repository.ts` (padrão de mock do `PrismaService`)
**Requirement**: JOIN-02 (AC9), LEAVE-01 (AC2, AC6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: a transação cria o participante e a mensagem `JOINED` (`content: ''`) com o mesmo `participantId`; `leaveWithMessage` preenche `leftAt` e cria `LEFT` na mesma transação
- [x] Spec: `findActiveByTokenHash` filtra `leftAt: null`; `listOnline`/`countOnline` filtram online
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add participant repository`

---

#### T6: `MessageRepository`

**What**: `findPage({ limit, before?, after? })` e `create({ participantId, content, clientId })`, ambos incluindo `participant { id, name }`.
**Where**: `apps/api/src/modules/chat/repositories/message.repository.ts`
**Depends on**: T4
**Reuses**: padrão de spec de repositório
**Requirement**: ROOM-02 (AC8-10), SEND-02 (AC9)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: sem cursor → `orderBy seq desc, take limit` e resultado invertido; `before` → `seq < before` desc invertido; `after` → `seq > after` asc sem inverter
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add message repository with seq cursor`

---

#### T7: DTOs de response do chat

**What**: `ParticipantJoinedResponseDto`, `OnlineParticipantsResponseDto` (+ `OnlineParticipantDto`), `MessageResponseDto` (`seq` number, `type` enum, `clientId` nullable, `author`) e `MessagesResponseDto`, com `@ApiProperty`.
**Where**: `apps/api/src/modules/chat/dtos/response/`
**Depends on**: None
**Reuses**: `modules/examples/dtos/response/example-response.dto.ts`
**Requirement**: JOIN-02 (AC7), ROOM-02 (AC12)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Campos e tipos do design; `seq` documentado como `number`
- [x] Quick gate passa

> **Execução (T7):** `author` virou a classe `MessageAuthorDto` (schema nomeado); `type` usa o enum `MessageType` do Prisma (`enumName: 'MessageType'`, mesmos três valores). **Desvio (SPEC_DEVIATION):** a task não previa teste, mas até os controllers da fase 3 nada carrega essas classes e o build gate da fase 2 exige 100%. `dtos/response/test/chat-response-dtos.spec.ts` gera o OpenAPI de um controller de teste e confere os schemas (`seq` `number`, `type` enum, `clientId` nullable), como o spec do `ApiPaginatedResponse`.

**Tests**: none (declarativo; coberto pelo e2e e pelo `openapi.spec.ts` da T16)
**Gate**: quick
**Commit**: `feat(api): add chat response DTOs`

---

#### T8: Mappers do chat

**What**: `MessageMapper.toResponse` (`seq: Number(m.seq)`, `createdAt` ISO, `author` do `participant`) e `ParticipantMapper.toJoined(p, token)` / `toOnline(p)`.
**Where**: `apps/api/src/modules/chat/mappers/`
**Depends on**: T7
**Reuses**: `modules/examples/mappers/example.mapper.ts`
**Requirement**: ROOM-02 (AC12), JOIN-02 (AC7)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `seq` `BigInt(1040)` → `1040` (number); `toJoined` inclui o token puro; `toOnline` só `id` e `name`
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add chat mappers`

---

#### T9: DTOs de request do chat

**What**: `JoinParticipantDto` (trim + `^[\p{L}\p{M}0-9 ._-]{2,20}$/u` com mensagem em português), `SendMessageDto` (trim, não vazio, ≤ 1000, `clientId` uuid opcional) e `ListMessagesQuery` (`limit` 1..100 padrão 50, `before`/`after` inteiros positivos).
**Where**: `apps/api/src/modules/chat/dtos/request/`
**Depends on**: None
**Reuses**: `common/dtos/request/pagination.dto.ts` e o spec dele
**Requirement**: JOIN-02 (AC4), SEND-02 (AC7), ROOM-02 (AC11)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: nomes com 2 e 20 caracteres passam; 1 e 21 falham; " Ana " vira "Ana"; "Érica", "João_1", "a.b-c" passam; "Ana!" e emoji falham
- [x] Spec: conteúdo com 1000 passa, 1001 falha, " " falha; `clientId` não-uuid falha
- [x] Spec: `limit` 0 e 101 falham; `before=abc`, `before=0`, `before=-1` falham
- [x] Quick gate passa

> **Execução (T9):** o trim fica em `dtos/request/trim-string.ts`, usado pelos dois DTOs. **Lacuna de precisão da spec:** a spec não fixa o texto do erro do nome; o DTO usa "O nome deve ter de 2 a 20 caracteres: letras, números, espaço, ".", "_" ou "-"." e o spec confere esse literal.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add chat request DTOs with validation`

---

#### T10: `ParticipantsService`

**What**: `join` (token, `nameKey`, `createWithJoinMessage`, devolve o token puro), `listOnline` (`{ items, total }`), `leave(id, actor)` (`404` sem participante; `401` se `id ≠ actor.id`) e `authenticate(token)`.
**Where**: `apps/api/src/modules/chat/services/participants.service.ts`
**Depends on**: T3, T5, T8, T9
**Reuses**: `modules/examples/services/example.service.ts`
**Requirement**: JOIN-02 (AC5, AC7-9), LEAVE-01 (AC2-4)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `join` grava só o hash (o repo nunca recebe o token puro) e devolve o puro uma vez; `P2002` do repo propaga (vira `409` no filtro global)
- [x] Spec: `leave` com id inexistente → `NotFoundException`; id de outro → `UnauthorizedException`; próprio → `leaveWithMessage`
- [x] Spec: `authenticate` chama `findActiveByTokenHash(hashToken(token))`
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add participants service`

---

#### T11: `MessagesService`

**What**: `list(query)` (`before` + `after` juntos → `BadRequestException`) e `send(actor, dto)` (`type=USER`, `content` com trim, `clientId ?? null`).
**Where**: `apps/api/src/modules/chat/services/messages.service.ts`
**Depends on**: T6, T8, T9
**Reuses**: padrão de service
**Requirement**: ROOM-02 (AC8-11), SEND-02 (AC9)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `before` e `after` juntos → `400`; cada cursor repassado ao repo; `send` grava com o `participantId` do ator e devolve o DTO mapeado
- [x] Quick gate passa

> **Execução (T11):** o `content` chega já com trim do `SendMessageDto` (T9), como diz o design ("já com `trim`"); o service não repete o trim. O `type=USER` é gravado pelo `MessageRepository.create` (o contrato da T4 não tem `type`), conferido no spec da T6.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add messages service`

---

### Phase 3: api — HTTP e contrato

#### T12: `ParticipantTokenGuard` e `@CurrentParticipant()`

**What**: Guard que lê `X-Participant-Token`, chama `authenticate` e grava `request.participant`; decorator que o devolve.
**Where**: `apps/api/src/modules/chat/guards/participant-token.guard.ts`
**Depends on**: T10
**Reuses**: —
**Requirement**: SEND-02 (AC8), JOIN-02 (AC8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: header ausente → `401`; desconhecido ou de quem saiu (`authenticate` → `null`) → `401`; válido → `request.participant` preenchido e decorator devolve o participante
- [x] Quick gate passa

> **Execução (T12):** header vazio conta como ausente (não chama `authenticate`); o valor vai sem trim nem esquema, então `Bearer <token>` dá `401`. A lógica do decorator fica em `getCurrentParticipant`, testada direto (ARCHITECTURE §10.4). **Lacuna de precisão da spec:** a spec não fixa o corpo do `401`; os testes conferem só o status.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add participant token guard`

---

#### T13: `ParticipantsController`

**What**: `POST /chat/participants` (`201`), `GET /chat/participants/online`, `POST /chat/participants/:id/leave` (`204`, guard, `ParseUUIDPipe`), com `@SkipThrottle()` (AD-004), `@ApiTags('Chat')`, `@ApiHeader` e respostas de erro no Swagger.
**Where**: `apps/api/src/modules/chat/controllers/participants.controller.ts`
**Depends on**: T12
**Reuses**: `modules/examples/controllers/example.controller.ts`
**Requirement**: JOIN-02 (AC4-7), LEAVE-01 (AC2-4)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec do controller delega cada rota ao service com os argumentos certos
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add participants controller`

---

#### T14: `MessagesController`

**What**: `GET /chat/messages` e `POST /chat/messages` (guard), com `@SkipThrottle()` e Swagger.
**Where**: `apps/api/src/modules/chat/controllers/messages.controller.ts`
**Depends on**: T12
**Reuses**: padrão de controller
**Requirement**: ROOM-02, SEND-02 (AC6-9)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec do controller delega `list` e `send`
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add messages controller`

---

#### T15: `ChatModule`, registro no `AppModule` e e2e do chat

**What**: Criar `chat.module.ts` (repos por classe abstrata, services, guard; exporta `ParticipantsService`), registrar no `AppModule` e escrever `test/chat.e2e-spec.ts`.
**Where**: `apps/api/test/chat.e2e-spec.ts`
**Depends on**: T13, T14
**Reuses**: `test/app.e2e-spec.ts` (`setupApp()`, limpeza com prefixo `e2e-`)
**Requirement**: JOIN-02, ROOM-02, SEND-02, LEAVE-01 e os edge cases da spec
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] e2e cobre: `201` com nome após trim e token; `409` para "ana" com "Ana" online; "Ana" e "ANA" em `Promise.all` → um `201` e um `409`; nomes 2/20 aceitos; nome inválido `400`
- [x] e2e cobre: `GET /messages` sem cursor, com `before`, com `after` (ordem crescente, `seq` number); `before`+`after` `400`; `limit` 0/101 `400`; `before=-1` `400`
- [x] e2e cobre: `POST /messages` `201`, conteúdo 1000 aceito, 1001 `400`, vazio `400`, token ausente/desconhecido/de quem saiu `401`
- [x] e2e cobre: `leave` `204` e grava `LEFT`; sair duas vezes `401`; token de outro `401`; id inexistente `404`; o nome fica livre depois
- [x] e2e: mais de 60 chamadas seguidas não recebem `429` (AD-004)
- [x] Full gate da api passa; `test:cov` da api em 100%

> **Execução (T15):** `test/chat.e2e-spec.ts` (45 cenários) usa o prefixo `e2e-api-` e o nome de 2 caracteres `Q9`, apagados antes e depois (mensagens primeiro, por causa da FK). Além do pedido: `400` para id que não é uuid no `leave` (`ParseUUIDPipe`), `GET /participants/online` sem quem saiu, e o padrão `limit=50` (61 envios seguidos, que também cobrem o AD-004). Tirar o `@SkipThrottle()` dos dois controllers faz os 2 testes de rate limit falharem (conferido e revertido). O spec do `MessagesController` usa `overrideGuard`, porque o Nest instancia o guard ao compilar o módulo de teste. `test:cov` da api: 100% (201 testes).
>
> **Fix round 1 (T15):**
>
> - **Fix 2 (JOIN-02 AC7):** novo caso `'İ'.repeat(20)` (20 caracteres, chave com 40) → `201` com o nome igual e 1 online pela chave; o mesmo nome de novo → `409` e continua 1. O nome entra no `cleanup()` (`EXPANDING_NAME`, como o `Q9`, não cabe o prefixo). Antes da migration, com `VARCHAR(20)`, o caso falhou com `expected 500 to be 201` (`chat.e2e-spec.ts:164`); depois dela, 47/47.
> - **Fix 3 (robustez):** `400 para nome com %s, sem gravar` agora conta as linhas com o nome antes e depois da própria requisição e espera o mesmo número (as 3 linhas que o sensor do Verifier deixou no banco não foram apagadas e não quebram mais o teste; um `Q` gravado pela requisição ainda faz o teste falhar). O `.sort()` da linha 135 ganhou comparador numérico (`require-array-sort-compare`). Commit: `test(api): scope invalid-name e2e to rows its own request writes`.

**Tests**: e2e
**Gate**: full
**Commit**: `feat(api): wire chat module with e2e coverage`

---

#### T16: Contrato no OpenAPI e no `@repo/api-client`

**What**: Atualizar `app/test/openapi.spec.ts` para os caminhos e schemas do chat (incluindo o header `X-Participant-Token`) e regenerar `openapi.json` e `packages/api-client/src/schema.d.ts` com `npm run generate`.
**Where**: `apps/api/src/app/test/openapi.spec.ts`
**Depends on**: T15
**Reuses**: `openapi.spec.ts` atual
**Requirement**: Goal "endpoints no Swagger e no `@repo/api-client`"
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec confere `/api/v1/chat/participants`, `/online`, `/{id}/leave`, `/api/v1/chat/messages`, `MessageResponseDto` e o header obrigatório nas rotas protegidas
- [x] `schema.d.ts` tem `MessageResponseDto`, `ParticipantJoinedResponseDto`, `OnlineParticipantsResponseDto`
- [x] Build gate passa

> **Execução (T16):** o spec também confere que as rotas públicas (`POST /participants`, `GET /online`, `GET /messages`) não pedem o header, os status documentados de cada rota e o enum `MessageType`. No `schema.d.ts`, `X-Participant-Token: string` é obrigatório em `header` nas duas rotas protegidas. `make gate`: exit 0, 19/19.

**Tests**: unit
**Gate**: build
**Commit**: `feat(api-client): generate chat contract`

---

#### T17: Documentação da api

**What**: Trocar as referências a `examples` por `chat` no `apps/api/ARCHITECTURE.md` e no `README.md`, e registrar no §14 a exceção "repositórios do chat sem `IBaseRepository`".
**Where**: `apps/api/ARCHITECTURE.md`
**Depends on**: T15
**Reuses**: —
**Requirement**: CLEAN-01
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Nenhuma referência a `examples` na documentação da api; a exceção está no §14 com o motivo
- [x] Build gate passa (`prettier --check`)

> **Execução (T17):** só o `apps/api/ARCHITECTURE.md` mudou; o `apps/api/README.md` não citava `examples`. O exemplo de contrato com `IBaseRepository` no §5.4 passou a usar o `Order` hipotético do §5.6, porque os repositórios do chat não o estendem; o §5.4 mostra o `IMessageRepository` como a exceção. O §12 manda remover o domínio do chat. O `grep` só acha `.env.example`. **Fora do escopo:** o `ARCHITECTURE.md` da raiz ainda cita `examples` (linhas 77, 106, 142-143). `TURBO_FORCE=true make gate` (fim da fase 3): exit 0, 19/19.

**Tests**: none (documentação)
**Gate**: build
**Commit**: `docs(api): describe chat module and repository exception`

---

### Phase 4: web — sessão e leitura

#### T18: Tipos do chat a partir do contrato

**What**: Trocar `ChatMessage`, `OnlineParticipant` e `OnlineParticipants` por aliases de `Schemas[...]` do `@repo/api-client`.
**Where**: `apps/web/src/features/chat/chat.types.ts`
**Depends on**: T16
**Reuses**: `features/examples/example.types.ts` (padrão de alias)
**Requirement**: Goal "contrato no `@repo/api-client`"
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Typecheck do web passa sem mudar os componentes da F0 (ou cada ajuste é anotado)
- [x] Quick gate passa

> **Execução (T18):** `ChatParticipant` virou `Schemas['MessageAuthorDto']` e `ChatMessageType` virou `Schemas['MessageType']` (os componentes da F0 seguem usando esses nomes); `OnlineParticipant` e `OnlineParticipants` foram criados. O marcador `SPEC_DEVIATION` da F0 saiu. Nenhum componente mudou. Quick gate: typecheck limpo, 208 testes.

**Tests**: none (tipos)
**Gate**: quick
**Commit**: `refactor(web): derive chat types from api contract`

---

#### T19: Cookie de sessão em `session/session-cookie.ts`

**What**: `SESSION_COOKIE`, `Session`, `encodeSession`/`decodeSession` (`"<uuid>.<token>"` validado com zod), `readSession`, `writeSession` (`httpOnly`, `sameSite: 'lax'`, `secure` em produção, `path: '/'`, sem `maxAge`/`expires`) e `clearSession`.
**Where**: `apps/web/src/features/chat/session/session-cookie.ts`
**Depends on**: None
**Reuses**: `next/headers` (mockado no spec)
**Requirement**: JOIN-03 (AC10)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: ida e volta do encode/decode; valores malformados (sem ponto, uuid inválido, vazio) → `null`
- [x] Spec: `writeSession` grava os atributos exatos; `secure` só com `NODE_ENV=production`; sem `maxAge`/`expires`
- [x] Quick gate passa

> **Execução (T19):** o token é validado como base64url (`^[A-Za-z0-9_-]+$`), então "dois pontos", token vazio e token com espaço também dão `null`. O spec usa um cookie store em memória (mock de `next/headers`) e confere que nomes parecidos (`chat_session_old`, `Chat_Session`) não contam como sessão e que `clearSession` apaga só o `chat_session`. O módulo importa `server-only`. 19 testes novos (227).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add chat session cookie helpers`

---

#### T20: Regra de redirect `routeBySession`

**What**: Função pura `routeBySession(pathname, hasSessionCookie)`.
**Where**: `apps/web/src/features/chat/session/route-by-session.ts`
**Depends on**: T19
**Reuses**: —
**Requirement**: JOIN-03 (AC11-12)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `/` com cookie → `/chat`; `/chat` sem cookie → `/`; `/` sem cookie e `/chat` com cookie → `null`
- [x] Quick gate passa

> **Execução (T20):** **Desvio (SPEC_DEVIATION):** `pathname` é `string`, não `'/' | '/chat'`: o `proxy.ts` recebe uma string, e qualquer outro caminho segue (`null`). O spec confere caminhos parecidos (`/chat/stream`, `/chat/`, `/chats`, `/session/end`, `''`), para que uma regra com `startsWith` falhe. 13 testes novos (240).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add session redirect rule`

---

#### T21: Query `getOnline`

**What**: `GET /api/v1/chat/participants/online` via `getApi()`; erro → `throw`.
**Where**: `apps/web/src/features/chat/queries/get-online.ts`
**Depends on**: T18
**Reuses**: `features/examples/queries/get-examples.ts`
**Requirement**: ROOM-01 (AC3, AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: `200` devolve `{ items, total }`; `500` lança
- [x] Quick gate passa

> **Execução (T21):** o spec confere o método `GET`, o `total` e cada item por campo. **Lacuna de precisão da spec:** a spec não fixa a mensagem do erro; a query lança "Falha ao carregar os participantes online" (padrão do `getExamples`) e o spec confere esse literal. 2 testes novos (242).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add online participants query`

---

#### T22: Query `getMessages`

**What**: `GET /api/v1/chat/messages` com `limit`, `before` e `after`; erro → `throw`.
**Where**: `apps/web/src/features/chat/queries/get-messages.ts`
**Depends on**: T18
**Reuses**: `get-examples.ts`
**Requirement**: ROOM-01 (AC1, AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: os parâmetros chegam na query string; `200` devolve `items`; `500` lança
- [x] Quick gate passa

> **Execução (T22):** o spec confere a query string inteira (`limit`+`before`, `limit`+`after`, e nenhuma chave quando não há parâmetro) e os `items` por campo e ordem de `seq`. **Lacuna de precisão da spec:** mensagem do erro não fixada; a query lança "Falha ao carregar as mensagens". 5 testes novos (247).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add messages query`

---

#### T23: `getValidSession`

**What**: Cookie + `getOnline()`; devolve `{ session, me, online }` quando o participante está online, senão `null`.
**Where**: `apps/web/src/features/chat/session/get-valid-session.ts`
**Depends on**: T19, T21
**Reuses**: —
**Requirement**: JOIN-03 (AC13), ROOM-01 (AC3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: sem cookie → `null` sem chamar a api; cookie de quem não está online → `null`; online → objeto com `me` e a lista (uma chamada só)
- [x] Quick gate passa

> **Execução (T23):** o spec usa MSW de verdade (não mocka `getOnline`): um handler pega qualquer caminho da api e registra `método caminho`, então "sem chamar a api" e "uma chamada só" são conferidos pela lista de chamadas. Além do pedido: cookie malformado → `null` sem chamada; participante com o mesmo nome e outro id → `null`; api com `500` → lança (design, "api fora do ar ao abrir `/chat`"). Tipo `ValidSession` exportado. 6 testes novos (253).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): validate chat session against online list`

---

#### T24: `endInvalidSession`

**What**: Apaga o cookie local (`clearSession()`) e `redirect('/')`, sem chamar a api.
**Where**: `apps/web/src/features/chat/session/end-invalid-session.ts`
**Depends on**: T19
**Reuses**: —
**Requirement**: JOIN-03 (AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: apaga o cookie, redireciona para `/` e não faz chamada de rede (MSW sem handler)
- [x] Quick gate passa

> **Execução (T24):** no lugar de "MSW sem handler", o spec registra um handler `http.all('*')` que anota toda requisição e confere a lista vazia (mais forte que depender do `onUnhandledFrame`). O mock de `redirect` lança como o Next, então apagar o cookie depois do `redirect` faria o teste falhar; o spec confere que só o `chat_session` sai (o `theme` fica). Fim da fase 4: `TURBO_FORCE=true make gate` exit 0, 19/19; web 254 unitários com 100% de cobertura, 116 testes de story.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): clear invalid chat session`

---

### Phase 5: web — Server Actions

#### T25: Schema do formulário Entrar

**What**: `joinFormSchema` (trim + a mesma regex da api) e `JoinFormState`.
**Where**: `apps/web/src/features/chat/schemas/join-form.schema.ts`
**Depends on**: None
**Reuses**: `features/examples/schemas/example-form.schema.ts`
**Requirement**: JOIN-01 (AC2-3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec com os mesmos casos de nome da T9 (limites, acentos, caracteres proibidos)
- [x] Quick gate passa

> **Execução (T25):** **Desvio (SPEC_DEVIATION):** `JoinFormState` mantém a forma da F0 (`{ status: 'error'; message; values }`), sem `fieldErrors`: o `JoinForm` da F0 mostra `message` no campo (`aria-invalid`, `aria-describedby`) e os testes dele dependem disso. O tipo saiu do componente para o schema (o componente reexporta). **Lacuna de precisão da spec:** o texto do erro do nome não é fixado; usa o mesmo da api (`errors.nameInvalid`), conferido como literal. `readJoinForm` lê o campo (ausente ou não-texto → `''`). 22 testes novos (276).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add join form schema`

---

#### T26: Schema da mensagem

**What**: `messageSchema` (`content` trim 1..1000, `clientId` uuid).
**Where**: `apps/web/src/features/chat/schemas/message.schema.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: SEND-01 (AC4-5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: vazio após trim falha; 1000 passa; 1001 falha; uuid inválido falha
- [x] Quick gate passa

> **Execução (T26):** o limite conta pontos de código (`[...value].length`), não unidades UTF-16: 1000 emojis passam e 1001 falham, como no `MaxLength` da api e no `VarChar(1000)`. **Lacuna de precisão da spec:** o texto do erro de tamanho não é fixado; o dicionário ganhou `errors.messageTooLong` ("A mensagem pode ter no máximo 1000 caracteres."), conferido como literal. `SendMessageResult`/`SendMessageAction` ficam no schema (componentes não podem importar `actions/`). 17 testes novos (293).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add message schema`

---

#### T27: Action `join`

**What**: zod → `POST /chat/participants` → `writeSession` → `redirect('/chat')`; `409` vira `fieldErrors.name = [t.errors.nameTaken]`; `400`/outros viram mensagem.
**Where**: `apps/web/src/features/chat/actions/join.ts`
**Depends on**: T25
**Reuses**: `features/examples/actions/create-example.ts`
**Requirement**: JOIN-01 (AC2-3), JOIN-01 (AC6), JOIN-03 (AC10)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: nome inválido não chama a api; `409` → "Esse nome já está em uso na sala."; `400` e `500` → mensagem geral; `201` → cookie gravado com `id` e `token` e redirect para `/chat`
- [x] Quick gate passa

> **Execução (T27):** o `409` vira `message` (desvio da T25), não `fieldErrors`. **Lacuna de precisão da spec:** a mensagem geral não é fixada; o dicionário ganhou `errors.joinFailed` ("Não foi possível entrar no chat. Tente de novo."), conferida como literal. O spec registra toda requisição à api (método, caminho, corpo): o nome vai com trim e um nome inválido não gera chamada; o `set` do cookie é conferido com nome, valor `<id>.<token>` e atributos. 9 testes novos (302).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add join server action`

---

#### T28: Action `sendMessage`

**What**: zod → `POST /chat/messages` com `X-Participant-Token`; sem sessão ou `401` → `clearSession()` + `redirect('/')`; `201` → `refresh()` + `{ ok: true, message }`; outros → `{ ok: false, reason }`.
**Where**: `apps/web/src/features/chat/actions/send-message.ts`
**Depends on**: T26
**Reuses**: `create-example.ts` (mock de `next/cache`)
**Requirement**: SEND-02 (AC6), SEND-01 (AC10-11)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: o header e o corpo `{ content, clientId }` chegam à api; `201` chama `refresh()`; `401` apaga o cookie e redireciona; sem cookie redireciona sem chamar a api; conteúdo inválido → `invalid`; `500` → `unexpected`
- [x] Quick gate passa

> **Execução (T28):** a sessão é checada antes do zod; sem sessão (ou cookie malformado) a action também chama `clearSession()` antes do `redirect('/')`, então o cookie malformado sai. O spec registra cada requisição (método, caminho, `X-Participant-Token`, corpo) e confere o corpo com `content` depois do trim; `invalid` cobre vazio após trim, 1001 caracteres e `clientId` não-uuid. 8 testes novos (310).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add sendMessage server action`

---

#### T29: Action `leave`

**What**: `POST /chat/participants/:id/leave` com o token, ignorando qualquer falha; `clearSession()`; `redirect('/')`.
**Where**: `apps/web/src/features/chat/actions/leave.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: LEAVE-01 (AC1, AC5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: `204`, `401` e `500` terminam todos em cookie apagado + redirect para `/`; sem cookie só redireciona
- [x] Quick gate passa

> **Execução (T29):** além de `204`/`401`/`500`, o spec cobre falha de rede (`HttpResponse.error()`): o `try/catch` fica só em volta da chamada, e o `redirect` fica fora dele. Cada caso confere método, caminho com o `id` da sessão e o `X-Participant-Token`. Cookie malformado → sem chamada, cookie apagado, redirect. 6 testes novos (316). Fim da fase 5: `TURBO_FORCE=true make gate` exit 0, 19/19; web 316 unitários com 100% de cobertura, 116 testes de story.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add leave server action`

---

### Phase 6: web — feature na tela

#### T30: `Composer` envia de verdade

**What**: Receber a action `send` por props; Enter envia, Shift+Enter quebra linha; botão desabilitado com conteúdo vazio após trim; acima de 1000 mostra o erro sem enviar; `crypto.randomUUID()` por envio dentro de `startTransition`; limpa o campo no sucesso.
**Where**: `apps/web/src/features/chat/components/composer.client.tsx`
**Depends on**: T28
**Reuses**: `Composer` da F0
**Requirement**: SEND-01 (AC1-5, AC10)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: Enter chama a action com `{ content, clientId }` (uuid); Shift+Enter não chama; " " deixa o botão desabilitado; 1001 caracteres mostra o erro e não chama; `ok: true` limpa o campo; `ok: false` mantém o texto
- [x] Stories atualizadas com `fn()` devolvendo cada resultado
- [x] Full gate passa

> **Execução (T30):** a prop `onSend` da F0 virou `send: SendMessageAction`; `pending` e `error` deixaram de ser props (o pending vem do `useTransition`, o erro é interno); `notice` fica para a F2/F3. Spec e stories da F0 foram reescritos para a nova interface, mantendo as checagens de posição do erro e do aviso. O limite de 1000 usa a regra do `messageSchema` (mesma da action) e também desabilita o botão. **Lacuna de precisão da spec:** a spec só diz "mantém o texto" para `ok: false`; o `Composer` também mostra `errors.send`, que some no próximo envio bem-sucedido. Unitários: 18 no `Composer` (antes 6), total 328; stories 118 (nova "Longa demais"). Lint limpo, cobertura 100%.

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): wire Composer to sendMessage`

---

#### T31: `MessageList` rola até o fim ao montar

**What**: `useLayoutEffect` que rola até a última mensagem no primeiro render.
**Where**: `apps/web/src/features/chat/components/message-list.client.tsx`
**Depends on**: None
**Reuses**: `MessageList` da F0
**Requirement**: ROOM-01 (AC2)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: com `scrollHeight` definido no jsdom, `scrollTop` termina no fim depois do render
- [x] Story "lista longa" com `play` conferindo a rolagem no Chromium
- [x] Full gate passa

> **Execução (T31):** quem rola não é a `MessageList`, e sim o `<main>` da `ChatRoomView` (ou o wrapper da story). O efeito procura o ancestral mais próximo com `overflow-y` `auto`/`scroll` (estilo computado) e põe `scrollTop = scrollHeight`. O spec confere `auto` e `scroll` e um ancestral intermediário que não rola (como a coluna `h-full` da Sala), que fica em 0. A story "Longa (rolável)" confere `scrollTop + clientHeight ≥ scrollHeight - 1` no Chromium. Unitários 331 (+3); stories 118.

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): scroll message list to bottom on mount`

---

#### T32: `ChatRoomContainer`

**What**: `getValidSession()` → `null` → `redirect('/session/end')`; `getMessages({ limit: 50 })`; renderiza `ChatRoomView` com `ChatHeader` (`online.total`, `me`, `leaveAction`), `MessageList` (`meId`) e `Composer` (`send`).
**Where**: `apps/web/src/features/chat/containers/chat-room.container.tsx`
**Depends on**: T30, T31
**Reuses**: `features/examples/containers/examples-table.container.tsx` (teste chamando a função)
**Requirement**: ROOM-01 (AC1, AC3-7), SEND-01 (AC12)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: sessão inválida → `redirect('/session/end')`; válida → `getMessages` chamado com `limit: 50`; o header recebe `total` e "1 pessoa online" quando `total` é 1; mensagens próprias pelo `me.id`
- [x] Quick gate passa

> **Execução (T32):** o spec mocka `getValidSession` e `getMessages` e chama o container como função. Fixtures que discriminam: `total` 7 com 2 itens (o header mostra "7 pessoas online"), e duas sessões diferentes (Bruno e Carlos) invertem quais balões são próprios. Também confere: ordem recebida, estado vazio, `content` com HTML renderizado como texto (SEND-01 AC12), e que `send` chega ao `Composer` (Enter) e `leave` ao botão "Sair". 10 testes novos (341), cobertura 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add chat room container`

---

#### T33: API pública da feature

**What**: `index.ts` (`join`, `sendMessage`, `leave`, `JoinForm`, `ChatRoomContainer`, `endInvalidSession`, `routeBySession`, `chatDictionary`) e `client.ts` (`chatDictionary`).
**Where**: `apps/web/src/features/chat/index.ts`
**Depends on**: T32
**Reuses**: `features/examples/index.ts` e `client.ts`
**Requirement**: BFF-01 (AC1-2)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `client.ts` não reexporta nada server-only
- [x] Quick gate passa (typecheck + lint)

> **Execução (T33):** `client.ts` reexporta só o `chatDictionary` (arquivo sem imports). **Atenção para a T37:** `routeBySession` sai pelo `index.ts`, que também puxa `actions/` e `session/` (com `server-only` e `next/headers`); se o bundle do `proxy.ts` reclamar, o proxy pode precisar de uma entrada própria. Fim da fase 6: `TURBO_FORCE=true make gate` exit 0, 19/19; web 341 unitários com 100% de cobertura, 118 testes de story.

**Tests**: none (reexportações)
**Gate**: quick
**Commit**: `feat(web): expose chat feature public API`

---

### Phase 7: web — rotas, remoção de `examples` e E2E

#### T34: Página Entrar

**What**: `app/page.tsx` estático com `JoinForm action={join}` (substitui a página provisória da T34a); título "Chat" no `metadata` do layout. A remoção de `examples` foi antecipada para a T34a.
**Where**: `apps/web/src/app/page.tsx`
**Depends on**: T33
**Reuses**: `app/page.spec.tsx` (padrão de mock da feature)
**Requirement**: JOIN-01 (AC1)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `page.spec.tsx` renderiza o `JoinForm` com a action `join` (feature mockada)
- [x] `grep -ri example apps/web/src apps/web/e2e docker-compose.yml` continua vazio (feito na T34a)
- [x] Build gate passa

> **Execução (T34):** a página repete o quadro da story "Chat/Telas/Entrar" da F0: cartão centralizado e `ThemeToggle` no canto (rótulos do `chatDictionary`). O `metadata.title` do layout virou `{ default: 'Chat', template: '%s | Chat' }`; o `layout.spec.tsx` da F0 conferia `web-hook` e passou a conferir `Chat`. O `page.spec.tsx` confere que o `JoinForm` recebe a própria `join` (mesma referência) e que a página não lê `next/headers` nem chama `redirect`. `make gate`: exit 0, 19/19; `next build` mostra `○ /` (estático); web 343 unitários com 100%, 118 stories.

**Tests**: unit
**Gate**: build
**Commit**: `feat(web): add join page`

---

#### T35: Página `/chat` e `error.tsx`

**What**: `app/chat/page.tsx` com `<Suspense>` + `ChatRoomContainer actions={{ send: sendMessage, leave }}`; `app/chat/error.tsx` com "Não foi possível carregar a sala" e "Tentar novamente".
**Where**: `apps/web/src/app/chat/page.tsx`
**Depends on**: T33
**Reuses**: `app/examples/page.tsx` e `error.tsx` (histórico do git)
**Requirement**: ROOM-01 (AC1, AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Specs: página passa as actions ao container; `error.tsx` mostra o texto e chama `retry()` no clique
- [x] Quick gate passa

> **Execução (T35):** o dicionário ganhou `room.loadError` ("Não foi possível carregar a sala") e `room.retry` ("Tentar novamente"), conferidos como literais no `chat.dictionary.spec.ts` e no `error.spec.tsx`. O fallback do `<Suspense>` é um bloco vazio com `aria-busy` e o fundo da página (a spec não define texto de carregamento). O `page.spec.tsx` confere `{ actions: { send: sendMessage, leave } }` pelas referências da feature mockada. Quick gate: typecheck limpo, 346 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add chat room page`

---

#### T36: Rota `GET /session/end`

**What**: `export const GET = () => endInvalidSession()`.
**Where**: `apps/web/src/app/session/end/route.ts`
**Depends on**: T33
**Reuses**: —
**Requirement**: JOIN-03 (AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: o handler delega a `endInvalidSession`
- [x] Quick gate passa

> **Execução (T36):** o mock de `endInvalidSession` lança `NEXT_REDIRECT`, como o real; o spec confere que o `GET` propaga esse resultado e chama a função uma vez. O efeito na resposta HTTP (cookie apagado e volta para `/`) fica no E2E da T38. Quick gate: typecheck limpo, 347 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add session end route`

---

#### T37: `proxy.ts`

**What**: `proxy(request)` lê a presença do cookie, chama `routeBySession` e responde `307` ou segue; `config.matcher = ['/', '/chat']`.
**Where**: `apps/web/src/proxy.ts`
**Depends on**: T33
**Reuses**: guia de proxy em `node_modules/next/dist/docs/` (AGENTS.md do web)
**Requirement**: JOIN-03 (AC11-12); AD-002
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `/` com cookie → `307` para `/chat`; `/chat` sem cookie → `307` para `/`; outros casos seguem; o matcher não inclui `/chat/stream`
- [x] `next build` mostra `/` estático
- [x] Build gate passa

> **Execução (T37):** **Desvio (SPEC_DEVIATION):** o proxy importa de uma entrada nova, `features/chat/routing.ts` (só `routeBySession` e `SESSION_COOKIE`), e não do `index.ts`. Conferido no build: com o `index.ts` o proxy funciona, mas o bundle dele leva as actions, o `lib/env`, o zod e o dicionário (483 KB, com `API_URL`); com o `routing.ts` cai para 228 KB, sem nada disso. Para isso o `SESSION_COOKIE` passou para `session/route-by-session.ts` (sem `server-only`), e o `session-cookie.ts` o reexporta. **Lacuna de precisão da spec:** "presença" do cookie com valor vazio (`chat_session=`) conta como ausente; um valor malformado conta como presente (quem valida é a página). O spec confere `307` e o `Location` literal, a passagem (`x-middleware-next: 1`, sem `Location`), cookies parecidos (`chat_session_old`, `Chat_Session`, `session`, vazio) e o matcher com `unstable_doesMiddlewareMatch` (a doc cita `unstable_doesProxyMatch`, que não existe no pacote 16.4.0): `/` e `/chat` rodam; `/chat/stream`, `/chat/x`, `/chats`, `/session/end`, estáticos não. `make gate`: exit 0, 19/19; build mostra `○ /`, `◐ /chat`, `ƒ /session/end`, `ƒ Proxy`; web 366 unitários com 100%, 118 stories.

**Tests**: unit
**Gate**: build
**Commit**: `feat(web): redirect by session cookie in proxy`

---

#### T38: E2E do chat básico

**What**: Page Objects `e2e/pages/join.page.ts` e `room.page.ts` e `e2e/chat.spec.ts` com dois contextos.
**Where**: `apps/web/e2e/chat.spec.ts`
**Depends on**: T34, T35, T36, T37
**Reuses**: padrão `e2e/pages/`; textos do `chatDictionary`; prefixo `e2e-web-`
**Requirement**: Success Criteria; JOIN-01, JOIN-03, ROOM-01, SEND-01, LEAVE-01, BFF-01; THEME-03 (AC7-8, clique pendente da F0)
**Tools**: MCP: NONE · Skill: `run`

**Done when**:

- [x] A e B entram; A envia; B recarrega e vê a mensagem à esquerda; A vê a sua à direita
- [x] B tenta entrar com o nome de A em outra caixa → "Esse nome já está em uso na sala."
- [x] B sai; A recarrega e vê "B saiu do chat" e o contador menor; B entra de novo com o mesmo nome
- [x] `/chat` sem sessão → `/`; `/` com sessão → `/chat`; cookie de participante que saiu → `/session/end` → `/` sem cookie
- [x] Com 60 mensagens criadas pela api no setup, o HTML do servidor de `/chat` traz as 50 últimas em ordem
- [x] `page.on('request')` registra todas as requisições do navegador e nenhuma vai para o host da api
- [x] Clique no `ThemeToggle` + recarregar mantém o tema
- [x] `make e2e` e `make gate` passam

> **Execução (T38):** 7 cenários em `e2e/chat.spec.ts` (com os 4 do `theme.spec.ts`, 11 no `make e2e`). Os nomes usam `e2e-web-` + 5 caracteres da execução + uma letra (≤ 20). O lado do balão é conferido pela posição do texto em relação ao meio da tela, junto com o rótulo "Você" ou o nome de A; a mensagem nova é o último item da lista e o campo fica vazio. As requisições são registradas com `context.on('request')` nos dois contextos (inclui as de `page.on`): nenhuma vai para o host da api, e todas têm a origem do web. Os redirects conferem `307` e o `Location` literal: o Next manda redirects da mesma origem com `Location` relativo (`/` e `/chat`), não absoluto como o `NextResponse` do teste unitário. `GET /session/end` responde `307` para `/` com um único `Set-Cookie` `chat_session=;` com `Path=/` e `Expires=Thu, 01 Jan 1970 00:00:00 GMT`. O teste das 60 mensagens lê só o HTML renderizado (`data-testid="message-content"`, fora do payload RSC) e espera exatamente as mensagens 11 a 60. **Limpeza:** o `afterAll` faz o `leave` de todo participante criado; as mensagens ficam no banco, porque a api não tem como apagá-las (D2), e levam o prefixo. `make e2e`: 11 passaram. `TURBO_FORCE=true make gate`: exit 0, 19/19; web 366 unitários com 100%, 118 stories; api 205 com 100%. Depois do E2E, `docker compose stop api web` (só o banco segue no ar).
>
> **Fix round 1 (T38, BFF-01 AC2, mutante W31):** novo cenário `BFF-01: nada que /chat manda ao navegador traz o token ou a URL da api`. Entra pela tela, recarrega `/chat` e guarda o corpo de toda resposta que a página recebe (documentos, scripts, resposta da Server Action de entrar, payloads RSC); pede `/chat` de novo com o cookie do contexto (HTML `text/html`, e com `RSC: 1`, `text/x-component`). O token sai de `context.cookies()` pelo formato `<participantId>.<token>`. Nenhum corpo pode conter o token, o host da api visto do host (`E2E_API_URL`, padrão `localhost:3333`, igual ao `API_URL` de `apps/web/.env`) nem o host da rede do compose (`api:<porta>`, `docker-compose.yml`; `E2E_INTERNAL_API_HOST` sobrescreve). **Discriminação:** W31 aplicado temporariamente na árvore real (o web do compose monta `src/` com hot reload; um scratch com o compose não era prático), `sha256` de `chat-room.container.tsx` antes; o cenário falhou com `token sent to the browser`. Variante com `process.env.API_URL` como prop: falhou com `api:3333 sent to the browser`. Arquivo restaurado da cópia e `sha256sum -c` OK nas duas vezes. Commit: `test(web): assert /chat never sends the token or api host to the browser`.

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): cover basic chat flow end to end`

---

## Validation

### Task Granularity Check

| Task             | Scope                                    | Status                                                                              |
| ---------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| T1               | remoção de 1 módulo e suas referências   | ⚠️ vários arquivos, uma mudança coesa (D1)                                          |
| T2               | schema + migration gerada dele           | ⚠️ 2 artefatos inseparáveis                                                         |
| T3, T19-T26      | 1 arquivo de funções ou 1 query/schema   | ✅                                                                                  |
| T4               | 2 contratos + fixtures                   | ⚠️ coesos, sem lógica                                                               |
| T5, T6, T10, T11 | 1 repository ou service                  | ✅                                                                                  |
| T7, T9           | DTOs da mesma direção                    | ⚠️ 3-4 arquivos declarativos coesos                                                 |
| T8               | 2 mappers pequenos                       | ⚠️ coesos                                                                           |
| T12              | guard + decorator que lê o que ele grava | ⚠️ coesos                                                                           |
| T13, T14         | 1 controller                             | ✅                                                                                  |
| T15              | module + registro + e2e                  | ⚠️ o e2e precisa do módulo (merge forward)                                          |
| T16, T17, T33    | 1 contrato / doc / índice                | ✅                                                                                  |
| T27-T29          | 1 Server Action                          | ✅                                                                                  |
| T30-T32          | 1 componente ou container                | ✅                                                                                  |
| T34              | página + remoção de `examples`           | ⚠️ a página substitui o redirect para `/examples`; separar deixaria a rota quebrada |
| T35-T37          | 1 rota                                   | ✅                                                                                  |
| T38              | 1 spec E2E + Page Objects                | ✅                                                                                  |

### Diagram-Definition Cross-Check

| Task          | Depends On (task body)  | Diagram Shows         | Status |
| ------------- | ----------------------- | --------------------- | ------ |
| T1, T3        | None                    | —                     | ✅     |
| T2            | T1                      | T1 → T2               | ✅     |
| T4            | T2                      | T2 → T4               | ✅     |
| T5, T6        | T4 (fase 1)             | —                     | ✅     |
| T7, T9        | None                    | —                     | ✅     |
| T8            | T7                      | T7 → T8               | ✅     |
| T10           | T3 (fase 1), T5, T8, T9 | T5/T8/T9 → T10        | ✅     |
| T11           | T6, T8, T9              | T6/T8/T9 → T11        | ✅     |
| T12           | T10 (fase 2)            | —                     | ✅     |
| T13, T14      | T12                     | T12 → T13, T12 → T14  | ✅     |
| T15           | T13, T14                | T13 → T15, T14 → T15  | ✅     |
| T16, T17      | T15                     | T15 → T16, T15 → T17  | ✅     |
| T18           | T16 (fase 3)            | —                     | ✅     |
| T19           | None                    | —                     | ✅     |
| T20, T24      | T19                     | T19 → T20, T19 → T24  | ✅     |
| T21, T22      | T18                     | T18 → T21, T18 → T22  | ✅     |
| T23           | T19, T21                | T19 → T23, T21 → T23  | ✅     |
| T25, T26, T29 | None                    | —                     | ✅     |
| T27           | T25                     | T25 → T27             | ✅     |
| T28           | T26                     | T26 → T28             | ✅     |
| T30           | T28 (fase 5)            | —                     | ✅     |
| T31           | None                    | —                     | ✅     |
| T32           | T30, T31                | T30 → T32, T31 → T32  | ✅     |
| T33           | T32                     | T32 → T33             | ✅     |
| T34-T37       | T33 (fase 6)            | —                     | ✅     |
| T38           | T34, T35, T36, T37      | T34/T35/T36/T37 → T38 | ✅     |

### Test Co-location Validation

| Task         | Code Layer                         | Matrix Requires | Task Says                   | Status |
| ------------ | ---------------------------------- | --------------- | --------------------------- | ------ |
| T1           | remoção + e2e da api               | e2e             | e2e                         | ✅     |
| T2           | schema/migration                   | none            | none                        | ✅     |
| T3           | `security/`                        | unit            | unit                        | ✅     |
| T4           | contratos, fixtures                | none            | none                        | ✅     |
| T5, T6       | repository                         | unit            | unit                        | ✅     |
| T7           | DTO de response                    | none            | none                        | ✅     |
| T8, T9       | mapper, DTO de request             | unit            | unit                        | ✅     |
| T10, T11     | service                            | unit            | unit                        | ✅     |
| T12-T14      | guard, controller                  | unit            | unit                        | ✅     |
| T15          | module + rotas                     | e2e             | e2e                         | ✅     |
| T16          | contrato (`openapi.spec.ts`)       | unit            | unit                        | ✅     |
| T17          | documentação                       | none            | none                        | ✅     |
| T18, T33     | tipos, reexportações               | none            | none                        | ✅     |
| T19-T29      | session, queries, schemas, actions | unit            | unit                        | ✅     |
| T30, T31     | componentes                        | unit + story    | unit (+ story no Done when) | ✅     |
| T32, T34-T37 | container, `app/`, `proxy.ts`      | unit            | unit                        | ✅     |
| T38          | fluxo completo                     | e2e             | e2e                         | ✅     |
