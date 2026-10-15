# Tempo real por webhooks e SSE (F2) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/chat-webhooks/spec.md`
**Design**: `.specs/features/chat-webhooks/design.md`
**Status**: Draft
**Pré-requisito**: F1 (`chat-core`) concluída.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `apps/api/ARCHITECTURE.md` §10, `apps/web/ARCHITECTURE.md` §8-§9, `packages/vitest-config/src/index.ts` (100%), `apps/api/vitest.config.ts` (projects `unit` e `e2e`).

| Code Layer                                                       | Required Test Type              | Coverage Expectation                                                                                             | Location Pattern                                                     | Run Command                             |
| ---------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| api: assinatura, dispatcher, http client, config                 | unit                            | Todos os branches; 1:1 com WHOUT-01..04; vetores oficiais do Standard Webhooks; esperas com `vi.useFakeTimers()` | `modules/webhooks/**/test/*.spec.ts`, `common/config/test/*.spec.ts` | `npm test --workspace=apps/api`         |
| api: repository                                                  | unit                            | Cada método; a transação do `recordAttempt`                                                                      | `modules/webhooks/repositories/test/*.spec.ts`                       | `npm test --workspace=apps/api`         |
| api: services do chat (chamada ao dispatcher)                    | unit                            | Ordem e conteúdo dos `dispatch`                                                                                  | `modules/chat/services/test/*.spec.ts`                               | `npm test --workspace=apps/api`         |
| api: entrega real                                                | e2e                             | Servidor HTTP de teste: assinatura válida, retentativa, registro no banco                                        | `test/*.e2e-spec.ts`                                                 | `npm run test:e2e --workspace=apps/api` |
| api: module, schema, migration                                   | none                            | - (e2e + build)                                                                                                  | -                                                                    | `make gate`                             |
| web: `realtime/`, `schemas/`, `lib/env.ts`, `instrumentation.ts` | unit                            | 1:1 com WHIN-01..03 e SSE-01; cada edge case; heartbeat com fake timers                                          | `src/**/*.spec.ts`                                                   | `npm test --workspace=apps/web`         |
| web: `state/`                                                    | unit                            | Reducer puro: ordem e duplicação; hook com `EventSource` falso                                                   | `src/features/chat/state/*.spec.ts`                                  | `npm test --workspace=apps/web`         |
| web: componentes, containers, actions                            | unit (+ story para componentes) | SSE-02 por AC                                                                                                    | `*.spec.tsx` + `*.stories.tsx`                                       | `npm test` + `npm run test:storybook`   |
| Infra (`Makefile`, Compose, `.env.example`)                      | none                            | - (verificação manual descrita na task)                                                                          | -                                                                    | `make gate`                             |
| Fluxo em tempo real                                              | e2e                             | Success Criteria (p95, uma conexão, sem polling)                                                                 | `apps/web/e2e/*.spec.ts`                                             | `make e2e`                              |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use                                          | Command                                                                                                                           |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Quick      | Tasks só com testes unitários                        | `npm run typecheck --workspace=apps/<app> && npm test --workspace=apps/<app>`                                                     |
| Full       | api: tasks com e2e · web: tasks com stories          | api: Quick + `make migrate && npm run test:e2e --workspace=apps/api` · web: Quick + `npm run test:storybook --workspace=apps/web` |
| E2E        | Tasks com Playwright                                 | `make e2e`                                                                                                                        |
| Build      | Fim de fase, schema, migration, rotas do Next, infra | `make gate`                                                                                                                       |

---

## Execution Plan

Phases run in order; tasks inside a phase run in order.

### Phase 1: api — configuração, dados e assinatura

```
T1
T2 → T5
T3
T4
```

### Phase 2: api — entrega e integração com o chat

```
T6 → T7 → T9
T6 → T8 → T9
```

### Phase 3: web — ambiente e verificação do webhook

```
T10 → T11
T10 → T12
T13
T14
T15
```

### Phase 4: web — hub, receptor e stream

```
T16 → T17 → T18
T17 → T19
```

### Phase 5: web — navegador e E2E

```
T20 → T22
T21 → T22 → T23 → T25
T24 → T25
```

---

## Task Breakdown

### Phase 1: api — configuração, dados e assinatura

#### T1: Variáveis `WEBHOOK_TARGET_URL` e `WEBHOOK_SECRET` na api

**What**: Adicionar ao `env.schema.ts` (`z.url()` e `^whsec_[A-Za-z0-9+/]+={0,2}$`), getters no `AppConfigService`, `<webhook-secret>` e `WEBHOOK_TARGET_URL=http://localhost:3000/webhooks/chat` no `.env.example`, valores fictícios no `openapi.ts` e `WEBHOOK_TARGET_URL=http://localhost:4599` no `env` do project `e2e`.
**Where**: `apps/api/src/common/config/env.schema.ts`
**Depends on**: None
**Reuses**: `env.schema.spec.ts`, `app-config.service.spec.ts`, o tratamento da `DATABASE_URL` no `openapi.ts`
**Requirement**: WHOUT-04 (AC12)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: URL inválida falha; segredo sem `whsec_`, com caracteres fora do base64 ou vazio falha; `whsec_` + base64 válido passa
- [x] Spec do `AppConfigService` cobre os dois getters
- [x] `npm run openapi:export` continua rodando sem `.env`
- [x] Quick gate passa

> **Execução (T1):** getters `webhookTargetUrl`/`webhookSecret` no `AppConfigService`. Export do OpenAPI conferido num diretório sem `.env` (6 rotas). Os `.env` locais ganharam um `WEBHOOK_SECRET` aleatório (o mesmo na api e no web) e `WEBHOOK_TARGET_URL`.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): validate webhook target and secret env vars`

---

#### T2: Tabelas `webhook_deliveries` e `webhook_delivery_attempts`

**What**: `WebhookDeliveryStatus`, `WebhookDelivery` e `WebhookDeliveryAttempt` no schema; migration `webhooks`.
**Where**: `apps/api/prisma/schema.prisma`
**Depends on**: None
**Reuses**: convenções do schema da F1
**Requirement**: WHOUT-03 (AC11)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Migration gerada com `make migration name=webhooks`; `event_id` único; `(delivery_id, attempt)` único; `ON DELETE CASCADE`
- [x] Build gate passa

> **Execução (T2) — desvio:** o Prisma 7 recusa `migrate dev` vindo de agente, então `make migration name=webhooks` não rodou. Com o banco em dia (`make migrate`), o SQL veio de `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, salvo em `prisma/migrations/20261015024023_webhooks/migration.sql` e aplicado com `make migrate` (mesmo caminho da F1). O SQL tem `webhook_deliveries_event_id_key` (UNIQUE), `webhook_delivery_attempts_delivery_id_attempt_key` (UNIQUE em `delivery_id, attempt`) e a FK com `ON DELETE CASCADE`. Depois, `migrate diff --exit-code` volta vazio e `npm run generate` roda limpo. `make gate` exit 0 (api 231 testes, 100%).

**Tests**: none (schema; coberto pelo e2e da T9)
**Gate**: build
**Commit**: `feat(api): add webhook delivery tables`

---

#### T3: Assinatura Standard Webhooks

**What**: `decodeSecret(secret)` e `signWebhook({ key, id, timestamp, body })`.
**Where**: `apps/api/src/modules/webhooks/signing/standard-webhooks.ts`
**Depends on**: None
**Reuses**: `node:crypto`
**Requirement**: WHOUT-02 (AC5)
**Tools**: MCP: NONE · Skill: NONE · Web: `WebFetch` no repositório `standard-webhooks/standard-webhooks` para copiar o vetor de teste oficial (nunca de memória)

**Done when**:

- [x] Spec reproduz o vetor oficial (segredo, id, timestamp, corpo → assinatura esperada), com a fonte citada num comentário
- [x] Spec: `decodeSecret` tira o prefixo e decodifica; um byte a mais no corpo muda a assinatura
- [x] Quick gate passa

> **Execução (T3):** vetor tirado de `standard-webhooks/standard-webhooks`, `libraries/python/tests/test_webhooks.py` (`test_sign_function`), baixado do GitHub e conferido com `node:crypto` antes de virar teste. A fonte está citada no spec.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add Standard Webhooks signing`

---

#### T4: Tipos do webhook e `WebhookHttpClient`

**What**: `WebhookEventType`/`WebhookEnvelope` em `webhook.types.ts` e o cliente `post(url, body, headers)` com `AbortSignal.timeout(5000)` que nunca lança.
**Where**: `apps/api/src/modules/webhooks/http/webhook-http-client.ts`
**Depends on**: None
**Reuses**: `fetch` nativo
**Requirement**: WHOUT-02 (AC4), WHOUT-03 (AC8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec com `fetch` mockado: `204` → `{ status: 204, error: null }`; `500` → `{ status: 500 }`; erro de rede → `{ status: null, error }`; timeout → `{ status: null, error: 'timeout' }`; `durationMs` sempre preenchido
- [x] Quick gate passa

> **Execução (T4):** brecha de precisão da spec. Para `500` a task só diz `{ status: 500 }`. Escolha: `error: null` sempre que houve resposta HTTP; o código já diz o que aconteceu. Um timeout real do `fetch` no Node 24 rejeita com `name: "TimeoutError"` (conferido) e vira `error: "timeout"`. O cliente lê o corpo da resposta para devolver a conexão ao pool.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add webhook HTTP client with timeout`

---

#### T5: `WebhookDeliveryRepository`

**What**: Contrato `IWebhookDeliveryRepository` e implementação Prisma: `create`, `recordAttempt` (`$transaction`: insere a tentativa e atualiza `attempts`, `lastStatus`, `lastError`) e `markStatus`.
**Where**: `apps/api/src/modules/webhooks/repositories/webhook-delivery.repository.ts`
**Depends on**: T2
**Reuses**: padrão dos repositórios do chat (F1)
**Requirement**: WHOUT-03 (AC7, AC10-11)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `recordAttempt` grava `attempt`, `statusCode` (ou `null`), `durationMs` e `error` (ou `null`) e atualiza a entrega na mesma transação
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add webhook delivery repository`

---

### Phase 2: api — entrega e integração com o chat

#### T6: `WebhookDispatcher`

**What**: `dispatch(type, data, { maxAttempts })` síncrono (`setImmediate`), envelope serializado uma vez, mesmo `webhook-id` e corpo em todas as tentativas, novo timestamp e assinatura a cada uma, `RETRY_DELAYS_MS = [1s, 5s, 30s, 2min, 10min]`, `SUCCEEDED`/`FAILED`, log por tentativa e `onApplicationShutdown()` que cancela timers.
**Where**: `apps/api/src/modules/webhooks/services/webhook-dispatcher.service.ts`
**Depends on**: T1, T3, T4, T5
**Reuses**: `Logger` do pino (`new Logger(WebhookDispatcher.name)`)
**Requirement**: WHOUT-01 (AC3), WHOUT-02 (AC4, AC6), WHOUT-03 (AC7-11)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec com fake timers e cliente falso: `dispatch` volta antes de qualquer `post`; headers `webhook-id`, `webhook-timestamp`, `webhook-signature`, `content-type`; corpo `{ type, occurredAt, data }`
- [x] Spec: falhas 1..5 agendam 1 s, 5 s, 30 s, 2 min e 10 min (nenhuma chamada 1 ms antes de cada espera); a 6ª falha marca `FAILED` e não agenda mais; `2xx` marca `SUCCEEDED`
- [x] Spec: o id e o corpo se repetem entre tentativas; timestamp e assinatura mudam
- [x] Spec: `maxAttempts: 1` não retenta; erro do repo é logado e não propaga; `onApplicationShutdown` cancela o timer pendente
- [x] Spec: o log tem `eventId`, tipo, tentativa, status e duração, sem o corpo
- [x] Quick gate passa

> **Execução (T6):** o log usa `log` para sucesso e `warn` para falha, com `{ msg, eventId, type, attempt, status, durationMs, error }`. Erros internos saem em `error` com `{ msg, eventId, type, error }`. Depois do `onApplicationShutdown`, uma tentativa ainda em andamento não agenda a próxima (flag `closed`), para o `app.close()` não deixar timer vivo. O `payload` gravado é o `JSON.parse` do corpo enviado, então guarda exatamente os bytes assinados.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add webhook dispatcher with retries`

---

#### T7: `MessagesService.send` dispara `message.created`

**What**: Depois de gravar, `dispatcher.dispatch('message.created', dto)`.
**Where**: `apps/api/src/modules/chat/services/messages.service.ts`
**Depends on**: T6
**Reuses**: spec do `MessagesService` (F1)
**Requirement**: WHOUT-01 (AC1), WHOUT-04 (AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `dispatch` chamado uma vez com o mesmo `MessageResponseDto` devolvido; não chamado se o repo lança
- [x] O service não importa config nem URL
- [x] Quick gate passa

> **Execução (T7) — desvio de ordem:** `webhooks.module.ts` e o `imports: [WebhooksModule]` do `ChatModule` (previstos na T9) entraram aqui. Sem eles, o `MessagesService` não resolve o `WebhookDispatcher`, e o `AppModule` (inclusive o export do OpenAPI em modo preview, coberto pelo `openapi.spec.ts`) não sobe. A T9 fica com o e2e. `grep` em `messages.service.ts` não acha `config`, URL nem segredo.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): emit message.created webhook on send`

---

#### T8: `ParticipantsService` dispara entrada e saída

**What**: Em `join` e `leave`, depois da transação: `dispatch('message.created', dtoDaMensagemDeSistema)` e `dispatch('presence.changed', { online: await repo.countOnline() })`, nessa ordem.
**Where**: `apps/api/src/modules/chat/services/participants.service.ts`
**Depends on**: T6
**Reuses**: spec do `ParticipantsService` (F1)
**Requirement**: WHOUT-01 (AC1-2)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `join` dispara `JOINED` e depois `presence.changed` com o valor de `countOnline` (lido depois da transação); `leave` idem com `LEFT`; `409`/`401`/`404` não disparam nada
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): emit join, leave and presence webhooks`

---

#### T9: `WebhooksModule`, import no `ChatModule` e e2e de entrega

**What**: `webhooks.module.ts` exportando o `WebhookDispatcher`; `ChatModule` importa; `test/webhooks.e2e-spec.ts` com servidor HTTP na porta 4599.
**Where**: `apps/api/test/webhooks.e2e-spec.ts`
**Depends on**: T7, T8
**Reuses**: `test/chat.e2e-spec.ts` (F1)
**Requirement**: WHOUT-01..04 (Independent Test)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] e2e: `POST /messages` responde `201` antes de o servidor de teste receber algo; a requisição recebida tem assinatura válida (verificada com `signWebhook`)
- [x] e2e: servidor responde `500`, `500`, `204` → banco com 3 tentativas e `SUCCEEDED` (timeout do teste 15 s)
- [x] e2e: `POST /participants` gera `message.created` (`JOINED`) e `presence.changed` com o `online` certo
- [x] e2e: com o servidor desligado, `POST /messages` ainda responde `201`
- [x] `chat.e2e-spec.ts` continua verde; `app.close()` encerra sem timers pendentes
- [x] Full gate da api passa; `test:cov` da api em 100%

> **Execução (T9):** o módulo e o import no `ChatModule` entraram na T7 (ver nota). Desvios: (1) o project `e2e` do `vitest.config.ts` ganhou `fileParallelism: false`, porque os arquivos dividem o banco e a porta 4599, e o `online` do `presence.changed` ficaria sujeito a corrida; (2) o `chat.e2e-spec.ts` troca o `WebhookDispatcher` por um stub (`overrideProvider`). Sem isso, cada execução deixava cerca de 200 entregas `PENDING` no banco e retentativas contra uma porta fechada. A entrega real fica coberta pelo `webhooks.e2e-spec.ts`, e nenhuma asserção do chat mudou. Para mostrar que o `app.close()` cancela os timers, o teste fecha uma segunda instância da app com a retentativa de 1 s pendente, religa o servidor e confere que nada chega em 1,5 s. Uma mutação que tira o cancelamento faz esse teste falhar. Pendência para o CI: o `.env` criado do `.env.example` ainda tem `<webhook-secret>` e não passa na regex até a T12 gerar o segredo no `make env`.

**Tests**: e2e
**Gate**: full
**Commit**: `feat(api): deliver chat events through signed webhooks`

---

### Phase 3: web — ambiente e verificação do webhook

#### T10: `WEBHOOK_SECRET` no ambiente do web

**What**: Adicionar ao `envSchema` de `lib/env.ts` (mesma regex da api), `process.env.WEBHOOK_SECRET = TEST_WEBHOOK_SECRET` no `test/setup.ts` e `WEBHOOK_SECRET=<webhook-secret>` no `apps/web/.env.example`.
**Where**: `apps/web/src/lib/env.ts`
**Depends on**: None
**Reuses**: `env.spec.ts`
**Requirement**: WHIN-03 (AC8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: segredo ausente ou malformado lança com mensagem clara; válido passa
- [x] Quick gate passa

> **Execução (T10):** a regex tem a mensagem `deve ser whsec_ seguido de base64`, que sai no erro junto do nome da variável. `TEST_WEBHOOK_SECRET` fica em `test/webhooks.ts` (é o segredo do vetor oficial); a T13 acrescenta o `signTestWebhook` no mesmo arquivo. O teste `retorna as variáveis válidas` passou a mandar e esperar o `WEBHOOK_SECRET` (o schema agora exige os dois). Web: 374 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): validate WEBHOOK_SECRET`

---

#### T11: `instrumentation.ts` valida o ambiente na subida

**What**: `register()` chama `getEnv()` quando `NEXT_RUNTIME === 'nodejs'` e `NEXT_PHASE !== 'phase-production-build'`.
**Where**: `apps/web/src/instrumentation.ts`
**Depends on**: T10
**Reuses**: guia de instrumentation em `node_modules/next/dist/docs/`
**Requirement**: WHIN-03 (AC8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: runtime `nodejs` com segredo inválido lança; `edge` ou fase de build não chamam `getEnv`
- [x] `docker build` do web passa sem `.env`
- [x] Build gate passa

> **Execução (T11):** o `register()` importa `./lib/env` dinamicamente dentro do ramo `nodejs`, para o bundle edge não puxar o módulo. O `next build` define `process.env.NEXT_PHASE = 'phase-production-build'` (`next/dist/build/index.js`). O spec prova que `edge` e a fase de build não validam: com segredo inválido, o `register()` resolve sem lançar. `docker build -f apps/web/Dockerfile --target production .` exit 0 (o `.dockerignore` exclui os `.env`). A primeira execução do `make gate` falhou no `test:storybook` por timeout ao conectar ao Chromium, durante o `docker build` em paralelo; a segunda passou (19/19; web 379 unit, 118 stories; api 282).

**Tests**: unit
**Gate**: build
**Commit**: `feat(web): fail fast on invalid env at startup`

---

#### T12: Segredo compartilhado no `Makefile` e destino no Compose

**What**: O alvo de `.env` do `Makefile` gera um `whsec_` com 32 bytes aleatórios uma vez por execução e troca `<webhook-secret>` nos dois `.env.example`; `docker-compose.yml` define `WEBHOOK_TARGET_URL: http://web:3000/webhooks/chat` na api; README explica recriar os dois `.env` juntos.
**Where**: `Makefile`
**Depends on**: T10
**Reuses**: regra `$(ENV_FILES)` atual (o `sed` do `<nome-do-projeto>`)
**Requirement**: WHIN-03 (AC9)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Num diretório temporário com cópias do `Makefile` e dos `.env.example` (sem tocar nos `.env` reais), `make env` cria os três arquivos e `apps/api/.env` e `apps/web/.env` têm o mesmo `WEBHOOK_SECRET`, que passa na regex
- [x] `.env` existentes continuam intocados
- [x] Build gate passa

> **Execução (T12):** `WEBHOOK_SECRET := whsec_$(shell node -e …randomBytes(32)…)` no topo do `Makefile`; o `sed` da regra `$(ENV_FILES)` troca `<webhook-secret>` com delimitador `|`, porque o base64 tem `/`. Conferido no scratchpad (cópias do `Makefile`, `package.json` e dos três `.env.example`): `make env` criou os três, os dois `WEBHOOK_SECRET` são iguais, passam na regex e decodificam em 32 bytes; sem placeholder fora de comentários. Uma segunda execução não muda nada (hash igual), e o mesmo vale para os `.env` reais. Recriar só um dos `.env` gera um segredo diferente, como esperado; o README diz para apagar os dois. O Compose define `WEBHOOK_TARGET_URL: http://web:3000/webhooks/chat` na api; stack recriada com `docker compose up -d --build --wait` (os três serviços healthy). Até a fase 4 criar a rota, os webhooks da api recebem `404` do web e viram retentativas ou `FAILED`. O CI passa a criar um segredo válido, porque `make gate` e `make e2e` dependem de `env`. `make gate` 19/19.

**Tests**: none (infra; verificação manual descrita acima)
**Gate**: build
**Commit**: `build: generate a shared webhook secret on install`

---

#### T13: `verifyWebhook`

**What**: Função pura que confere presença dos headers, `|now − timestamp| ≤ 300` e as assinaturas `v1,…` separadas por espaço com `timingSafeEqual`; e o helper `test/webhooks.ts` (`signTestWebhook`).
**Where**: `apps/web/src/features/chat/realtime/verify-webhook.ts`
**Depends on**: None
**Reuses**: `node:crypto`
**Requirement**: WHIN-01 (AC1-3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: assinatura válida → `ok`; header ausente → `missing`; timestamp a 300 s passa e a 301 s (passado ou futuro) → `timestamp`; corpo com um byte a mais → `signature`; lista com uma assinatura errada e uma certa → `ok`; assinatura de tamanho diferente não lança
- [x] Spec usa o mesmo vetor oficial da T3
- [x] Quick gate passa

> **Execução (T13):** escolhas onde a spec não fixa o valor: header vazio conta como `missing`; timestamp que não é inteiro (ex.: `1614265330.5`) dá `timestamp`; só entradas `v1,` são comparadas (`v2,` com o digest certo dá `signature`). O spec também cobre outro segredo, outro id, outro timestamp, byte trocado e lista só com assinaturas erradas. O `verify-webhook.ts` usa `import crypto from 'node:crypto'` e chama `crypto.timingSafeEqual`: o `vi.mock('node:crypto')` não chega aos módulos de `src` neste setup (conferido com um módulo mínimo), e o `vi.spyOn` no objeto default chega. Assim o spec prova a comparação em tempo constante. `signTestWebhook({ id?, timestamp?, body, secret? })` em `test/webhooks.ts` devolve os três headers e reproduz a assinatura do vetor oficial. Web: 401 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): verify Standard Webhooks signatures`

---

#### T14: `RecentIds`

**What**: Conjunto com capacidade 1000 que descarta o mais antigo, guardado em `globalThis`.
**Where**: `apps/web/src/features/chat/realtime/recent-ids.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: WHIN-02 (AC5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: depois de 1001 inserções o primeiro sai e o segundo continua; o getter devolve a mesma instância
- [x] Quick gate passa

> **Execução (T14):** `RecentIds` usa um `Set` (ordem de inserção) e descarta o primeiro valor quando passa de 1000. `getRecentIds()` guarda a instância em `globalThis[Symbol.for('web-hook.recent-webhook-ids')]`, no mesmo padrão do hub (AD-003). O spec cobre as fronteiras 1000, 1001 e 1002 e confere a chave no `globalThis`. Web: 406 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add recent webhook id cache`

---

#### T15: Schema do envelope do webhook

**What**: `messageSchema: z.ZodType<ChatMessage>` e `webhookEnvelopeSchema` (`discriminatedUnion` de `message.created` e `presence.changed`).
**Where**: `apps/web/src/features/chat/schemas/webhook-envelope.schema.ts`
**Depends on**: None
**Reuses**: tipos do contrato (`chat.types.ts`)
**Requirement**: WHIN-01 (AC4)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: envelopes válidos dos dois tipos passam; tipo desconhecido, `occurredAt` ausente, `online` negativo ou `data` sem `seq` falham
- [x] Quick gate passa

> **Execução (T15):** os ids do `messageSchema` são `z.string()`, não `z.uuid()`. A assinatura já autentica a origem, e os fixtures da F1 usam ids que não são UUID válidos (`m0000000-…`). `occurredAt` e `createdAt` são `z.iso.datetime()`; `seq` e `online` são inteiros, com `online ≥ 0`. O spec cobre cada campo obrigatório de `data` ausente e com tipo errado, `online` negativo, fracionário e em texto, e tipo desconhecido. O nome `messageSchema` também existe em `schemas/message.schema.ts` (formulário), mas nenhum barrel exporta os dois. Web: 434 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add webhook envelope schema`

---

### Phase 4: web — hub, receptor e stream

#### T16: Formato SSE

**What**: `formatSseEvent({ event, data, id? })`, `SSE_HEARTBEAT`, `HEARTBEAT_MS` e `SSE_HEADERS`.
**Where**: `apps/web/src/features/chat/realtime/sse.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: SSE-01 (AC2-5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: com id → `id: 7\nevent: message\ndata: {…}\n\n`; sem id → sem linha `id:`; heartbeat é `: heartbeat\n\n`; headers exatos do design
- [x] Quick gate passa

> **Execução (T16):** `formatSseEvent` escreve `id:` só quando há id, depois `event:` e um único `data:` com `JSON.stringify` (uma quebra de linha no conteúdo sai escapada, então o evento nunca vira duas linhas `data:`). Os headers são os do design: `cache-control: no-cache, no-transform` (a spec, SSE-01 AC2, cita só `no-cache`; o `no-transform` vem do design, contra proxies que comprimem). Web: 439 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add SSE formatting helpers`

---

#### T17: `ChatHub`

**What**: `subscribe(conn)` → `unsubscribe`, `publish(event)` (formata uma vez; `message` com `id: seq`, `presence` sem id; `write` que lança remove só aquela conexão), `connectionCount(participantId?)` e `getChatHub()` em `globalThis[Symbol.for('web-hook.chat-hub')]`.
**Where**: `apps/web/src/features/chat/realtime/chat-hub.ts`
**Depends on**: T16
**Reuses**: —
**Requirement**: SSE-01 (AC3-4, AC6); AD-003
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: duas conexões recebem o mesmo chunk; `presence` vira `event: presence` com `{"online":N}` sem `id:`; conexão cujo `write` lança sai e a outra continua recebendo; `unsubscribe` remove; `connectionCount` por participante
- [x] Spec: duas chamadas a `getChatHub()` devolvem a mesma instância
- [x] Quick gate passa

> **Execução (T17):** as conexões ficam num `Set`; `publish` formata o chunk uma vez e o escreve em cada conexão, e a que lança sai do `Set` dentro do mesmo laço. O spec confere os chunks pela string exata, que a conexão quebrada recebe uma só tentativa de escrita, que nada chega depois do `unsubscribe` e que a instância de `globalThis[Symbol.for('web-hook.chat-hub')]` sobrevive a um novo import do módulo (`vi.resetModules()`). O caso "sem conexões" fica no spec do receptor (T18). Web: 446 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add in-memory chat hub`

---

#### T18: Receptor `POST /webhooks/chat`

**What**: `handleChatWebhook(request)` (corpo cru → `verifyWebhook` → zod → `RecentIds` → `publish` → `204`) e `app/webhooks/chat/route.ts`; exportar pelo `index.ts` da feature.
**Where**: `apps/web/src/features/chat/realtime/handle-chat-webhook.ts`
**Depends on**: T17
**Reuses**: `verifyWebhook` (T13), `RecentIds` (T14), `webhookEnvelopeSchema` (T15), `signTestWebhook`
**Requirement**: WHIN-01 (AC1-4), WHIN-02 (AC5-7)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: válido e novo → `204` e o hub recebe o evento; assinatura ausente/errada, timestamp velho e corpo alterado → `401` sem publicar e `warn` sem o corpo; JSON fora do envelope → `400` sem publicar; id repetido → `204` sem publicar; sem conexões → `204`
- [x] Nenhuma chamada de rede (MSW sem handler falha o teste se houver)
- [x] Spec da rota confere que ela delega ao handler
- [x] Quick gate passa

> **Execução (T18):** o spec usa o hub real (`getChatHub()`) com uma conexão falsa e confere o chunk SSE exato que ela recebe. Cada teste assina com um `webhook-id` novo, porque o `RecentIds` é do processo. Um corpo JSON com espaços e quebra de linha, assinado como veio, passa: prova que a verificação usa os bytes crus. Corpo que não é JSON também dá `400`. Um webhook recusado não marca o id como processado (o mesmo id, depois assinado certo, é publicado). O `warn` é `console.warn('Webhook recusado', { reason, webhookId })`: o web não tem logger próprio, e o spec confere que o conteúdo da mensagem não aparece no log. Além do MSW com `onUnhandledFrame: 'error'`, o spec registra `request:start` e confere que a lista fica vazia. Web: 460 testes, cobertura 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): receive signed chat webhooks`

---

#### T19: Stream `GET /chat/stream`

**What**: `openChatStream(request)` (`getValidSession()` → `401`; `ReadableStream` que registra no hub, escreve `retry: 3000`, liga o heartbeat de 25 s e limpa tudo no `abort`/`cancel`) e `app/chat/stream/route.ts`; exportar pelo `index.ts`.
**Where**: `apps/web/src/features/chat/realtime/open-chat-stream.ts`
**Depends on**: T17
**Reuses**: `getValidSession()` (F1), `SSE_HEADERS`
**Requirement**: SSE-01 (AC1-2, AC5-7)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: sem sessão → `401`; com sessão → `200` e os headers; primeiro chunk `retry: 3000`; com fake timers, heartbeat a cada 25 s; `abort` → `connectionCount` volta a 0 e nenhum heartbeat depois
- [x] `next build` lista `/chat/stream` como dinâmica (registrar a linha da saída)
- [x] Build gate passa

> **Execução (T19):** o primeiro chunk é `retry: 3000\n\n`. O `abort` do `request.signal` tira a conexão do hub, para o heartbeat e fecha o stream; o `cancel()` do stream faz a mesma limpeza. A limpeza também remove o listener de `abort`: se o Next cancelar o stream e depois abortar o sinal, um `controller.close()` tardio lançaria dentro do listener (erro não tratado no Node). Uma mutação que tira essa remoção faz o spec falhar com `Invalid state: Controller is already closed`. Uma requisição que já chega abortada (o navegador saiu durante a checagem da sessão) não fica no hub. O spec lê o corpo de verdade (`getReader()`), confere cada chunk pela string exata, o heartbeat com fake timers (nada em 24 999 ms, um chunk em 25 000 ms, duas vezes) e `vi.getTimerCount() === 0` depois do `abort` e do `cancel`. Saída do `next build`: `├ ƒ /chat/stream` (e `└ ƒ /webhooks/chat`). `TURBO_FORCE=true make gate` exit 0: 19/19; web 469 unit a 100%, 118 stories; api 282 a 100%.

**Tests**: unit
**Gate**: build
**Commit**: `feat(web): stream chat events over SSE`

---

### Phase 5: web — navegador e E2E

#### T20: `chatRoomReducer`

**What**: `ChatRoomState`, `ChatRoomAction` (`message/received`, `presence/changed`), `chatRoomReducer` (inserção por busca binária de `seq`, `seq` repetido devolve o mesmo estado) e `initChatRoom`.
**Where**: `apps/web/src/features/chat/state/chat-room.reducer.ts`
**Depends on**: None
**Reuses**: `makeMessage()`
**Requirement**: SSE-02 (AC9-11)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `seq` maior vai para o fim; `seq` no meio entra na posição; `seq` repetido → mesma referência de estado; `presence/changed` troca `online`
- [x] Quick gate passa

> **Execução (T20):** `lowerBound` (busca binária) acha o primeiro índice com `seq` ≥ o novo; se esse índice já tem o mesmo `seq`, o reducer devolve o próprio `state`. O spec cobre fim, meio, começo, lista vazia, chegada fora de ordem (7, 5, 6 → 4..7), `seq` repetido no começo, meio e fim (mesma referência) e que o array anterior não muda. Web: 480 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add chat room reducer`

---

#### T21: `useChatEvents`

**What**: Abre `EventSource('/chat/stream')` no `useEffect`, faz `JSON.parse` de `message` e `presence`, fecha no unmount; `createEventSource` injetável.
**Where**: `apps/web/src/features/chat/state/use-chat-events.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: SSE-02 (AC8), SSE-03 (AC12-13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec com `EventSource` falso: um único `EventSource` para `/chat/stream`; eventos chamam os handlers com o JSON; unmount chama `close()`; um `error` não cria outro `EventSource` nem agenda timer
- [x] Quick gate passa

> **Execução (T21):** os handlers e o `createEventSource` passam por `useEffectEvent` (React 19.2+), e o efeito depende só da `url`: renderizar de novo com handlers novos não reabre o stream (o spec confere com dois `rerender`) e o evento chega ao handler da última renderização. O `EventSource` falso fica em `test/fake-event-source.ts` (`fakeEventSources()` registra as instâncias), compartilhado com o spec e a story da T22. O caso `error` usa fake timers e `fetch` stub: depois de 60 s, uma instância, nenhum timer, nenhum `fetch`. Sem `createEventSource`, o hook usa o `EventSource` global com `/chat/stream` (stub com `vi.stubGlobal`). Web: 487 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add chat events hook`

---

#### T22: `ChatStream.client`

**What**: Dono do estado da sala (`useReducer` + `useChatEvents`); renderiza `ChatRoomView` com `ChatHeader online={state.online}`, `MessageList` e `Composer`; story com `EventSource` falso.
**Where**: `apps/web/src/features/chat/components/chat-stream.client.tsx`
**Depends on**: T20, T21
**Reuses**: componentes da F0/F1
**Requirement**: SSE-02 (AC8-11)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: evento `message` aparece na lista na posição do `seq`; o mesmo evento duas vezes aparece uma vez; `presence` com 4 → "4 pessoas online"
- [x] Story com `play` que emite eventos pelo `EventSource` falso
- [x] Full gate passa

> **Execução (T22):** `ChatStream` aceita um `createEventSource?` opcional (repassado ao `useChatEvents`), como o design pede para a story; o container não o passa. O tipo da action de saída fica inline (`() => Promise<void>`, o mesmo do `ChatHeader`); o design cita um `LeaveAction` que não existe no código. O spec confere a ordem pelo texto de cada mensagem, `seq` repetido (inclusive um da lista inicial), a própria mensagem chegando pelo SSE à direita, "4 pessoas online" e que enviar não mexe na lista nem abre outro stream. Story `Chat/ChatStream` (Padrão e Ao vivo); o tema escuro e o axe vêm do project `storybook-dark`. Web: 496 testes; stories 122.

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add live ChatStream component`

---

#### T23: `ChatRoomContainer` usa o `ChatStream`

**What**: O container passa `me`, `initialMessages`, `initialOnline` e `actions` ao `ChatStream` em vez de montar a sala.
**Where**: `apps/web/src/features/chat/containers/chat-room.container.tsx`
**Depends on**: T22
**Reuses**: spec do container (F1)
**Requirement**: SSE-02 (AC8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: o container renderiza `ChatStream` com os dados iniciais; sessão inválida continua redirecionando
- [x] Quick gate passa

> **Execução (T23):** o container passa `me`, as 50 mensagens, `online.total` e `actions` ao `ChatStream`. O spec do container renderiza o `ChatStream` de verdade: todos os testes da F1 (ordem, cabeçalho, mensagens próprias, vazio, XSS, `send`, `leave`) seguem sem mudança, com um `EventSource` falso no `globalThis` (`vi.stubGlobal`). Um teste novo confere uma só conexão a `/chat/stream` e que um `message` e um `presence` emitidos nela chegam à tela; a sessão inválida agora também confere que nenhum `EventSource` abriu. Web: 497 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(web): render chat room through ChatStream`

---

#### T24: `sendMessage` sem `refresh()`

**What**: Remover o `refresh()` da action; a própria mensagem chega pelo SSE.
**Where**: `apps/web/src/features/chat/actions/send-message.ts`
**Depends on**: None
**Reuses**: spec da action (F1)
**Requirement**: premissa "Mensagem própria vinda pelo SSE"; SSE-03 (AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `201` devolve `{ ok: true, message }` e `refresh` não é chamado
- [x] Quick gate passa

> **Execução (T24):** o teste `201` da F1 esperava `refresh` uma vez; a task troca essa expectativa por `expect(refresh).not.toHaveBeenCalled()` (o `next/cache` segue mockado, então a asserção é sobre o mock). O resto do teste (token, corpo, mensagem devolvida, cookie mantido) não mudou. `grep refresh` em `features/chat` fora dos specs não acha nada. Web: 497 testes.

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(web): stop refreshing after send`

---

#### T25: E2E em tempo real

**What**: `e2e/chat-realtime.spec.ts` com três contextos.
**Where**: `apps/web/e2e/chat-realtime.spec.ts`
**Depends on**: T23, T24
**Reuses**: Page Objects da F1
**Requirement**: Success Criteria; SSE-01..03, WHIN-02
**Tools**: MCP: NONE · Skill: `run`

**Done when**:

- [x] A envia e B vê sem recarregar; C entra e A e B veem o contador subir; C sai e o contador desce
- [x] 20 mensagens de A: p95 entre o clique e a exibição em B < 1 s (o teste imprime o valor)
- [x] Em B, `page.on('request')` mostra uma só requisição a `/chat/stream` e nenhuma requisição repetida durante 30 s parado
- [x] `make e2e` e `make gate` passam

> **Execução (T25):** `e2e/chat-realtime.spec.ts` tem 3 testes, sem `page.reload()`: (1) A envia e B vê uma vez, com o nome de A; C entra e sai, e A e B veem "N+1 pessoas online" e depois "N pessoas online", mais as mensagens de entrada e saída; nenhum `load` depois de entrar e uma só requisição a `/chat/stream` por página; (2) p95 de 20 mensagens, do clique em "Enviar" até a exibição em B (`waitForFunction` com `polling: 'raf'`): 82 ms (mín 64, máx 85); (3) B parado por 30 s: nenhuma requisição nova e uma só a `/chat/stream`. `playwright.config.ts` ganhou `workers: 1` (`SPEC_DEVIATION`): os dois arquivos de chat conferem a contagem exata de online, e entradas de outro arquivo em paralelo a mudariam. Mudanças nos testes da F1, aprovadas pelo usuário: (a) F1 assertion removed with user approval; F2 delivers over SSE; covered by chat-realtime.spec.ts (`chat.spec.ts`, o `toHaveCount(0)` antes do `reload` de B); (b) o BFF-01 ignora respostas `text/event-stream`, porque o corpo do stream nunca termina e o `text()` travava o teste. No lugar, o teste (1) grava no navegador o `data` de cada evento SSE de B (init script que envolve o `EventSource`) e confere que nenhum traz os tokens de A, B e C nem os hosts da api (`localhost:3333` e `api:3333`). Para provar que a checagem acusa um vazamento, o mesmo teste injeta um token e um host em strings sintéticas e confere que os dois são apontados. `make e2e` 15/15; `TURBO_FORCE=true make gate` exit 0 (19/19; web 497 unit a 100%, 122 stories; api 282 a 100%).

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): cover realtime delivery end to end`

---

## Validation

### Task Granularity Check

| Task                  | Scope                                             | Status                                    |
| --------------------- | ------------------------------------------------- | ----------------------------------------- |
| T1, T10               | 1 variável de ambiente nos pontos onde ela é lida | ⚠️ vários arquivos, uma mudança coesa     |
| T2                    | schema + migration                                | ⚠️ inseparáveis                           |
| T3, T13-T17, T20, T21 | 1 módulo puro                                     | ✅                                        |
| T4                    | tipos + cliente HTTP                              | ⚠️ coesos                                 |
| T5                    | contrato + repository                             | ⚠️ coesos                                 |
| T6-T8, T23, T24       | 1 service, container ou action                    | ✅                                        |
| T9                    | module + e2e                                      | ⚠️ merge forward: o e2e precisa do módulo |
| T11                   | 1 arquivo                                         | ✅                                        |
| T12                   | infra de 1 segredo (Makefile, Compose, README)    | ⚠️ coesos                                 |
| T18, T19              | handler + `route.ts` de 1 linha                   | ⚠️ coesos                                 |
| T22                   | 1 componente                                      | ✅                                        |
| T25                   | 1 spec E2E                                        | ✅                                        |

### Diagram-Definition Cross-Check

| Task               | Depends On (task body)  | Diagram Shows        | Status |
| ------------------ | ----------------------- | -------------------- | ------ |
| T1, T2, T3, T4     | None                    | —                    | ✅     |
| T5                 | T2                      | T2 → T5              | ✅     |
| T6                 | T1, T3, T4, T5 (fase 1) | —                    | ✅     |
| T7, T8             | T6                      | T6 → T7, T6 → T8     | ✅     |
| T9                 | T7, T8                  | T7 → T9, T8 → T9     | ✅     |
| T10, T13, T14, T15 | None                    | —                    | ✅     |
| T11, T12           | T10                     | T10 → T11, T10 → T12 | ✅     |
| T16                | None                    | —                    | ✅     |
| T17                | T16                     | T16 → T17            | ✅     |
| T18, T19           | T17                     | T17 → T18, T17 → T19 | ✅     |
| T20, T21, T24      | None                    | —                    | ✅     |
| T22                | T20, T21                | T20 → T22, T21 → T22 | ✅     |
| T23                | T22                     | T22 → T23            | ✅     |
| T25                | T23, T24                | T23 → T25, T24 → T25 | ✅     |

### Test Co-location Validation

| Task              | Code Layer                                         | Matrix Requires | Task Says                   | Status |
| ----------------- | -------------------------------------------------- | --------------- | --------------------------- | ------ |
| T1, T3, T4, T6    | config, assinatura, http client, dispatcher        | unit            | unit                        | ✅     |
| T2                | schema/migration                                   | none            | none                        | ✅     |
| T5                | repository                                         | unit            | unit                        | ✅     |
| T7, T8            | services do chat                                   | unit            | unit                        | ✅     |
| T9                | module + entrega real                              | e2e             | e2e                         | ✅     |
| T10, T11, T13-T19 | `lib/`, `instrumentation`, `realtime/`, `schemas/` | unit            | unit                        | ✅     |
| T12               | infra                                              | none            | none                        | ✅     |
| T20, T21          | `state/`                                           | unit            | unit                        | ✅     |
| T22               | componente                                         | unit + story    | unit (+ story no Done when) | ✅     |
| T23, T24          | container, action                                  | unit            | unit                        | ✅     |
| T25               | fluxo em tempo real                                | e2e             | e2e                         | ✅     |
