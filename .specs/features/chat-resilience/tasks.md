# Robustez do chat em tempo real (F3) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/chat-resilience/spec.md`
**Design**: `.specs/features/chat-resilience/design.md`
**Status**: Draft
**Pré-requisito**: F2 (`chat-webhooks`) concluída.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `apps/api/ARCHITECTURE.md` §10, `apps/web/ARCHITECTURE.md` §8-§9, `packages/vitest-config/src/index.ts` (100%).

| Code Layer                               | Required Test Type | Coverage Expectation                                                                                         | Location Pattern                           | Run Command                             |
| ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------- |
| api: limiter, exceção, filtro, service   | unit               | Todos os branches; 1:1 com OPT-02 e RATE-01; relógio por parâmetro                                           | `modules/chat/**/test/*.spec.ts`           | `npm test --workspace=apps/api`         |
| api: repository                          | unit               | `findByClientId`                                                                                             | `modules/chat/repositories/test/*.spec.ts` | `npm test --workspace=apps/api`         |
| api: rota `POST /messages`               | e2e                | Idempotência, `429` + `Retry-After`, isolamento por participante                                             | `test/chat.e2e-spec.ts`                    | `npm run test:e2e --workspace=apps/api` |
| api: schema, migration                   | none               | - (e2e + build)                                                                                              | -                                          | `make gate`                             |
| web: `realtime/`, `session/`, `actions/` | unit               | 1:1 com RECON-01 e AWAY-01; saída agendada com fake timers (29 s / 30 s); paginação de 250 mensagens com MSW | `src/**/*.spec.ts`                         | `npm test --workspace=apps/web`         |
| web: `state/`                            | unit               | Reducer: cada ação nova e o edge case "SSE antes da action"; hooks com medidas definidas no jsdom            | `src/features/chat/state/*.spec.ts`        | `npm test --workspace=apps/web`         |
| web: componentes                         | unit + story       | Testing Library por AC; story com `play` para a rolagem real                                                 | `*.spec.tsx` + `*.stories.tsx`             | `npm test` + `npm run test:storybook`   |
| Fluxos de rede                           | e2e                | Success Criteria                                                                                             | `apps/web/e2e/*.spec.ts`                   | `make e2e`                              |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use                              | Command                                                                                                               |
| ---------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Quick      | Tasks só com testes unitários            | `npm run typecheck --workspace=apps/<app> && npm test --workspace=apps/<app>`                                         |
| Full       | web: tasks com stories                   | Quick + `npm run test:storybook --workspace=apps/web`                                                                 |
| E2E        | Tasks com Playwright                     | `make e2e`                                                                                                            |
| Build      | Schema, migration, contrato, fim de fase | `make gate`                                                                                                           |
| Docs       | Tasks só de documentação                 | `python3 <skill-dir>/scripts/validate_spec.py .specs/features/chat-resilience/spec.md && npx prettier --check .specs` |

---

## Execution Plan

Phases run in order; tasks inside a phase run in order.

### Phase 1: api — idempotência e limite de envio

```
T1 → T2 → T5
T3 → T5
T4 → T5
T5 → T6
```

### Phase 2: web — servidor

```
T7 → T8 → T11
T7 → T9 → T10
T12
```

### Phase 3: web — navegador e E2E

```
T13 → T16
T15 → T16
T13 → T17
T14 → T17
T16 → T17
T17 → T18
```

### Phase 4: correções da validação

```
T19 → T20 → T21
T22
T23
```

---

## Task Breakdown

### Phase 1: api — idempotência e limite de envio

#### T1: Índice único `(participant_id, client_id)`

**What**: `@@unique([participantId, clientId], map: "messages_participant_client_key")` em `Message` e migration `messages_client_id`.
**Where**: `apps/api/prisma/schema.prisma`
**Depends on**: None
**Reuses**: —
**Requirement**: OPT-02
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Migration gerada; mensagens de sistema (`client_id` nulo) continuam livres
- [x] Build gate passa

> **Execução (T1) — desvio:** o Prisma 7 recusa `migrate dev` vindo de agente (ambiente não interativo), então `make migration name=messages_client_id` não rodou. Mesmo caminho da F2: o SQL veio de `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, salvo em `prisma/migrations/20261029145534_messages_client_id/migration.sql` (`CREATE UNIQUE INDEX "messages_participant_client_key"`) e aplicado com `make migrate`. Conferido no banco, numa transação desfeita: duas linhas `JOINED`/`LEFT` do mesmo participante com `client_id` nulo entram; o segundo insert com o mesmo `(participant_id, client_id)` falha com a unique. Container `api` reconstruído. Antes do gate, `prettier --check` falhava em `.specs/features/chat-webhooks/{spec,validation}.md` (herdado da F2); corrigido no commit separado `style(specs)`. `make gate` exit 0 (api 282 testes, 100%).

**Tests**: none (schema; coberto pelo e2e da T6)
**Gate**: build
**Commit**: `feat(api): make client id unique per participant`

---

#### T2: `IMessageRepository.findByClientId`

**What**: Novo método no contrato e na implementação Prisma, com `participant { id, name }`.
**Where**: `apps/api/src/modules/chat/repositories/message.repository.ts`
**Depends on**: T1
**Reuses**: spec do `MessageRepository` (F1)
**Requirement**: OPT-02
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: busca pela chave composta e devolve `null` quando não existe
- [x] Quick gate passa

> **Execução (T2):** o mock do `IMessageRepository` em `services/test/messages.service.spec.ts` ganhou `findByClientId: vi.fn()` para o typecheck passar (sem teste novo ali; os cenários do service são da T5). Quick gate: api 233 testes unitários.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): find message by client id`

---

#### T3: `SendRateLimiter`

**What**: Janela deslizante de 10 s por participante, `SEND_LIMIT = 5`, `tryAcquire(participantId, nowMs)`, remove a chave quando a janela esvazia.
**Where**: `apps/api/src/modules/chat/services/send-rate-limiter.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: RATE-01 (AC1-2)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: 5 chamadas em `t` passam; a 6ª em `t + 9_999` recusa com `retryAfterSeconds = 1`; em `t + 10_000` passa; outro participante não é afetado; `retryAfterSeconds` arredonda para cima
- [x] Spec: depois de a janela esvaziar, o mapa interno não guarda a chave
- [x] Quick gate passa

> **Execução (T3):** cada `tryAcquire` limpa as janelas vencidas de todos os participantes, não só do atual; sem isso, a chave de quem parou de enviar nunca sairia do mapa. Uma recusa não entra na janela. `@Injectable()` para a T5 injetar. Quick gate: api 241 testes unitários.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add per-participant send rate limiter`

---

#### T4: `RateLimitedException` e filtro

**What**: Exceção `429` com `retryAfterSeconds` e `RateLimitedExceptionFilter`, que grava o header `Retry-After` e o corpo padrão.
**Where**: `apps/api/src/modules/chat/filters/rate-limited-exception.filter.ts`
**Depends on**: None
**Reuses**: `common/filters/prisma-exception.filter.ts` e o spec dele
**Requirement**: RATE-01 (AC1)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: o filtro responde `429`, `Retry-After: 3` e o corpo no formato dos outros erros da api
- [x] Quick gate passa

> **Execução (T4):** a exceção fica no mesmo arquivo do filtro (o único `Where` da task). A api não tem dicionário de mensagens (os textos ficam nas exceções, como no guard e nos services), então a mensagem é a mesma do aviso do web: "Você está enviando mensagens rápido demais. Aguarde alguns segundos." Corpo `{ statusCode, error, message }`, igual às exceções do Nest e ao `PrismaExceptionFilter`. Quick gate: api 243 testes unitários.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add rate limited exception and filter`

---

#### T5: `MessagesService.send` idempotente e limitado

**What**: Ordem do design: `findByClientId` (achou → devolve, sem limite e sem webhook) → `tryAcquire` (recusa → `RateLimitedException`) → `create` (`P2002` na chave composta → devolve a existente, sem webhook) → `dispatch`.
**Where**: `apps/api/src/modules/chat/services/messages.service.ts`
**Depends on**: T2, T3, T4
**Reuses**: spec do `MessagesService` (F1/F2)
**Requirement**: OPT-02, RATE-01 (AC1-3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: reenvio com `clientId` existente não chama o limiter, nem `create`, nem `dispatch`
- [x] Spec: limiter recusa → exceção com `retryAfterSeconds`; `create` não é chamado
- [x] Spec: `P2002` em `create` → `findByClientId` e devolve, sem `dispatch`; outros erros propagam
- [x] Spec: sem `clientId`, o fluxo pula a busca
- [x] Quick gate passa

> **Execução (T5):** o `P2002` não é filtrado pelo nome da constraint (o formato do `meta` muda com o driver adapter). Com `clientId`, o service busca pelo par; se nada voltar, propaga o erro original. `SendRateLimiter` registrado no `ChatModule`. Na corrida entre reenvios, o perdedor já gastou uma vaga do limite (aceito: caso raro). O e2e "61 envios seguidos não recebem 429" (AD-004) passa a falhar no 6º envio, como a RATE-01 manda; ele é ajustado na T6. Quick gate: api 250 testes unitários.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): make message send idempotent and rate limited`

---

#### T6: `POST /chat/messages` com `429` no contrato e e2e

**What**: `@UseFilters(RateLimitedExceptionFilter)` e `@ApiTooManyRequestsResponse` com o header `Retry-After` no `MessagesController`; cenários novos no `test/chat.e2e-spec.ts`; regenerar o `@repo/api-client`.
**Where**: `apps/api/src/modules/chat/controllers/messages.controller.ts`
**Depends on**: T5
**Reuses**: `test/chat.e2e-spec.ts` (F1)
**Requirement**: OPT-02, RATE-01 (AC1-3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] e2e: o mesmo `clientId` duas vezes → dois `201` com o mesmo `id`, uma linha no banco e uma entrega em `webhook_deliveries`
- [x] e2e: 5 envios passam; o 6º → `429` com `Retry-After` inteiro; outro participante envia normalmente; um reenvio com `clientId` já gravado passa mesmo com o limite estourado
- [x] `schema.d.ts` documenta o `429`
- [x] Build gate passa

> **Execução (T6) — desvios:** (1) o cenário de idempotência foi para `test/webhooks.e2e-spec.ts`, não para o `chat.e2e-spec.ts`: só ali o `WebhookDispatcher` é real e grava `webhook_deliveries` (o `chat.e2e-spec.ts` troca o dispatcher por um stub). Os cenários de limite ficaram no `chat.e2e-spec.ts`. (2) O e2e da F1 "61 envios seguidos não recebem 429" (AD-004) mandava 61 mensagens de um só participante, o que a RATE-01 agora proíbe. Os 61 envios passaram a vir de 13 participantes (5 cada), do mesmo cliente HTTP; as asserções continuam as mesmas (61 × `201`, `GET` devolve as 50 últimas). Marcado com `SPEC_DEVIATION`; **confirmar com o usuário**. (3) `src/app/test/openapi.spec.ts` listava os status exatos de `POST /chat/messages`; agora inclui `429` e checa `Retry-After` com `type: integer`. `npm run generate` atualizou `schema.d.ts` (`429` com header `Retry-After?: number`). `make gate` exit 0: api 305 testes (250 unit + 55 e2e), web 497 unit + 122 stories, 100%.

**Tests**: e2e
**Gate**: build
**Commit**: `feat(api): expose 429 with Retry-After on message send`

---

### Phase 2: web — servidor

#### T7: Saída agendada no `ChatHub`

**What**: Construtor com `{ awayDelayMs = 30_000, onAway }`; `subscribe` cancela a saída do participante; `unsubscribe` da última conexão agenda `onAway`; `cancelAway(participantId)`; `onAway` rejeitado → `warn` sem propagar.
**Where**: `apps/web/src/features/chat/realtime/chat-hub.ts`
**Depends on**: None
**Reuses**: `ChatHub` da F2
**Requirement**: AWAY-01 (AC1-2, AC4-6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec com fake timers: fechar a única conexão, avançar 29 s → nenhuma chamada; mais 1 s → uma chamada com `{ id, token }`
- [x] Spec: reabrir antes de 30 s cancela; duas abas e fechar uma não agenda; `cancelAway` cancela; `onAway` rejeitado não lança
- [x] Quick gate passa

> **Execução (T7):** `onAway` é tipado como `Promise<unknown>` (o design diz `Promise<void>`) para aceitar o `leaveParticipant`, que devolve `'left' | 'gone' | 'error'`. Até a T9, o `getChatHub()` cria o hub com um `onAway` que não faz nada. O token usado na saída é o da última conexão fechada. Os `new ChatHub()` do spec da F2 passaram a usar um helper com `onAway` falso (o construtor agora exige as opções). Quick gate: web 504 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): schedule leave after last SSE connection closes`

---

#### T8: Buffer de recuperação no `ChatHub`

**What**: `subscribe(conn, { recovering })` devolve `Subscription { unsubscribe, flush(lastSeqWritten) }`; com `recovering`, eventos ao vivo vão para um buffer (só o último `presence`) até o `flush`, que pula `message` com `seq ≤ lastSeqWritten`.
**Where**: `apps/web/src/features/chat/realtime/chat-hub.ts`
**Depends on**: T7
**Reuses**: —
**Requirement**: RECON-01 (AC2)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: durante a recuperação nada é escrito; `flush(1045)` escreve 1046 e descarta 1044 e 1045; dois `presence` no buffer viram um (o último); depois do `flush`, eventos vão direto
- [x] Quick gate passa

> **Execução (T8):** `Subscription` declara `unsubscribe` e `flush` como propriedades (`() => void`), não como métodos, para poderem ser desestruturadas sem perder o `this`. O `presence` mais novo entra no fim do buffer e o antigo sai, então a ordem relativa às mensagens segue a da chegada. O `openChatStream` e o spec do `handleChatWebhook` passaram a usar `.unsubscribe` (mudança de assinatura, sem mudar comportamento). Quick gate: web 510 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): buffer live events while recovering a stream`

---

#### T9: `leaveParticipant` e ligação com o hub

**What**: `leaveParticipant({ id, token })` → `'left' | 'gone' | 'error'` (`204` / `401`-`404` / outros); `getChatHub()` cria o hub com `onAway: leaveParticipant`.
**Where**: `apps/web/src/features/chat/session/leave-participant.ts`
**Depends on**: T7
**Reuses**: chamada `POST /participants/:id/leave` da action `leave` (F1)
**Requirement**: AWAY-01 (AC3, AC6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: `204` → `left`; `401` e `404` → `gone`; `500` e erro de rede → `error`; o header do token é enviado
- [x] Spec: o hub do `getChatHub()` chama `leaveParticipant` quando a saída vence
- [x] Quick gate passa

> **Execução (T9):** `leaveParticipant` nunca rejeita (erro de rede vira `'error'`), então o `warn` do hub fica para falhas inesperadas. O spec do hub mocka `../session/leave-participant` para testar a ligação do `getChatHub()` sem rede. Quick gate: web 516 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): extract leaveParticipant and use it for away timeout`

---

#### T10: Action `leave` cancela a saída agendada

**What**: `leave` chama `getChatHub().cancelAway(participantId)` e depois `leaveParticipant`, mantendo "ignora falha, apaga o cookie, redireciona".
**Where**: `apps/web/src/features/chat/actions/leave.ts`
**Depends on**: T9
**Reuses**: spec da action (F1)
**Requirement**: AWAY-01 (AC5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `cancelAway` é chamado antes da api; os casos da F1 continuam passando
- [x] Quick gate passa

> **Execução (T10):** o `try/catch` da action saiu, porque `leaveParticipant` não rejeita; os casos da F1 (`204`, `401`, `500`, falha de rede) passam sem mudança. O spec checa a ordem gravando, no handler do MSW, as chamadas ao `cancelAway` já feitas. Quick gate: web 517 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): cancel scheduled leave on explicit exit`

---

#### T11: Recuperação por `Last-Event-ID` no `openChatStream`

**What**: `parseLastEventId(header)`; com valor, `subscribe({ recovering: true })` antes da busca, `recoverMissed(after)` pagina `getMessages({ after, limit: 100 })` até vir menos de 100, escreve cada mensagem com `id: seq` e chama `flush`; falha → `unsubscribe()` + `controller.error()`.
**Where**: `apps/web/src/features/chat/realtime/open-chat-stream.ts`
**Depends on**: T8
**Reuses**: `getMessages` (F1), `formatSseEvent` (F2)
**Requirement**: RECON-01 (AC1-4)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `parseLastEventId` aceita `"1040"` e rejeita `"0"`, `"-1"`, `"abc"`, `"1.5"`, `null`
- [x] Spec MSW: 250 mensagens perdidas → três páginas (100, 100, 50) escritas em ordem antes de um evento ao vivo publicado durante a busca
- [x] Spec: evento ao vivo com `seq` já recuperado não é escrito duas vezes
- [x] Spec: busca com `500` encerra o stream com erro e remove a conexão do hub
- [x] Quick gate passa

> **Execução (T11):** `parseLastEventId` também recusa `""` e inteiros acima de `Number.MAX_SAFE_INTEGER` (não podem ser um `seq`). Cada página pede `after` = último `seq` escrito. Se o navegador sai durante a busca, o erro de escrita no stream fechado é descartado (sem `controller.error`); um spec cobre esse caso. O helper `collect` do spec passou a guardar o erro do `reader.read()`. Quick gate: web 530 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): replay missed messages on SSE reconnect`

---

#### T12: `sendMessage` trata `429`

**What**: `429` → `{ ok: false, reason: 'rate_limited', retryAfter }` lendo `Retry-After`.
**Where**: `apps/web/src/features/chat/actions/send-message.ts`
**Depends on**: None
**Reuses**: spec da action (F1/F2)
**Requirement**: RATE-02
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: `429` com `Retry-After: 4` → `{ ok: false, reason: 'rate_limited', retryAfter: 4 }`; sem `refresh()` em nenhum caminho
- [x] Quick gate passa

> **Execução (T12):** o tipo `SendMessageResult` (em `schemas/message.schema.ts`) ganhou a variante `rate_limited`. `retryAfter` é `Number(Retry-After)`; a api sempre manda o header (T6), então um valor ausente ou inválido não tem tratamento próprio (a spec não define). Última task da fase 2: `TURBO_FORCE=true make gate` exit 0 (api 305 testes, 250 unit + 55 e2e; web 531 unit + 122 stories; 100%).

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): surface rate limit from sendMessage`

---

### Phase 3: web — navegador e E2E

#### T13: `chatRoomReducer` com otimista e conexão

**What**: `pending` e `connection` no estado; ações `message/optimistic`, `message/confirmed`, `message/failed`, `message/retry`, `connection/changed`; `message/received` e `message/confirmed` removem a pendente com o mesmo `clientId`; seletor `selectItems`.
**Where**: `apps/web/src/features/chat/state/chat-room.reducer.ts`
**Depends on**: None
**Reuses**: reducer da F2
**Requirement**: OPT-01 (AC1-5), RECON-02
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: otimista entra no fim como `sending`; evento SSE com o mesmo `clientId` substitui sem duplicar; resposta da action antes do SSE substitui; SSE depois da action não duplica (mesmo `seq`); SSE antes da action mantém uma só
- [x] Spec: `failed` e `retry` alternam o estado; `connection/changed` alterna `open`/`reconnecting`; `selectItems` põe as pendentes depois das confirmadas
- [x] Quick gate passa

> **Execução (T13):** `message/received` e `message/confirmed` passam pela mesma função: tiram a pendente com o mesmo `clientId` e inserem pelo `seq`; com `seq` repetido e nenhuma pendente a tirar, devolvem o mesmo estado. `initChatRoom` recebe só `{ messages, online }` e começa com `pending: []` e `connection: 'open'`; o teste da F2 que comparava o estado inicial passou a incluir os dois campos novos. Quick gate: web 542 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add optimistic and connection state to chat reducer`

---

#### T14: `useChatEvents` informa o estado da conexão

**What**: Novo handler `onStatus(status)`: `error` → `reconnecting`; `open` → `open`.
**Where**: `apps/web/src/features/chat/state/use-chat-events.ts`
**Depends on**: None
**Reuses**: spec do hook (F2)
**Requirement**: RECON-02 (AC5-6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec com `EventSource` falso: `error` → `onStatus('reconnecting')`; `open` → `onStatus('open')`; nenhum timer criado
- [x] Quick gate passa

> **Execução (T14) — desvio de escopo:** `onStatus` é obrigatório em `ChatEventHandlers`, então o `ChatStream` já passa a despachar `connection/changed` e a mostrar `t.errors.reconnecting` no `notice` do `Composer`. Sem isso, a função ficava sem cobertura (100% exigido) e não havia o que observar no spec. O teste do `ChatStream` para "Reconectando…" (critério da T17) entrou aqui; a story fica na T17. Quick gate: web 544 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): report SSE connection status`

---

#### T15: `useStickToBottom`

**What**: `useStickToBottom(ref, { count, forceKey })` → `{ showNewBelow, scrollToBottom }`; "no fim" = distância ≤ 80 px.
**Where**: `apps/web/src/features/chat/state/use-stick-to-bottom.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: SCROLL-01 (AC1-2, AC4-5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec (medidas com `Object.defineProperty`): a 80 px do fim, nova mensagem rola; a 81 px mantém a posição e liga `showNewBelow`; rolar até o fim desliga; mudar `forceKey` rola mesmo longe do fim
- [x] Quick gate passa

> **Execução (T15):** "estar no fim" é medido no evento `scroll` e guardado num ref, porque quando o `count` muda a mensagem nova já aumentou o `scrollHeight`. A decisão de rolar roda num `useLayoutEffect` (antes da pintura), inclusive na montagem, o que cobre a abertura no fim (ROOM-01 AC2). `ref` aceita `null` (lista sem contêiner rolável, como nos testes da F1). Quick gate: web 553 testes unitários, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add stick-to-bottom scroll hook`

---

#### T16: `MessageList` com pendentes e "Novas mensagens ↓"

**What**: Receber `ChatItem[]` (pendentes com `status` e `onRetry` no `MessageBubble`), usar `useStickToBottom` e mostrar o botão "Novas mensagens ↓"; textos novos no dicionário.
**Where**: `apps/web/src/features/chat/components/message-list.client.tsx`
**Depends on**: T13, T15
**Reuses**: `MessageBubble` (`status`, `onRetry` da F0), `Button`
**Requirement**: SCROLL-01 (AC3), OPT-01 (AC1, AC4)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: pendente `sending` mostra o estado; `failed` mostra "Não enviada · Tentar de novo" e chama `onRetry`; clique em "Novas mensagens ↓" rola e esconde o botão
- [x] Story com `play` no Chromium: rolar para cima, injetar mensagem, ver o botão, clicar, ver a lista no fim
- [x] Full gate passa

> **Execução (T16):** a prop `messages` virou `items: ChatItem[]`; `onRetry(clientId)` e `scrollKey` (o `forceKey` do hook) são opcionais. A pendente vira um `ChatMessage` com `author.id = meId`, então sai à direita como "Você". O `useLayoutEffect` que abria a lista no fim (ROOM-01 AC2) agora só acha o contêiner rolável; quem rola é o `useStickToBottom`, e os testes da F1 de rolagem continuam passando. Mudanças fora do arquivo da task: `test-fixtures.ts` ganhou `asItems(messages)`; specs e stories da F1/F2 (`message-list`, `chat-room-view`) passaram a usar `items={asItems(...)}`; o `ChatStream` passa `selectItems(state)`; `room.newMessages` no dicionário; o `scrollToBottom` do hook virou propriedade (`() => void`) por causa do `unbound-method` do oxlint. Stories novas: Enviando, Não enviada, Novas mensagens ↓ (com `play`). Full gate: web 558 unit + 128 stories, 100%.

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add pending items and new-messages button to list`

---

#### T17: `ChatStream` com envio otimista, retry e avisos

**What**: `send(content)` gera `clientId`, despacha a otimista e chama a action em `startTransition` (`ok` → `confirmed`; `rate_limited` → `failed` + aviso de limite; outros → `failed`); `retry(clientId)` reenvia o mesmo conteúdo e `clientId`; `onStatus` liga "Reconectando…" no `Composer`; envio muda o `forceKey` da lista.
**Where**: `apps/web/src/features/chat/components/chat-stream.client.tsx`
**Depends on**: T13, T14, T16
**Reuses**: `ChatStream` da F2, `Composer` (`notice`, `error`)
**Requirement**: OPT-01 (AC1-5, AC7), RATE-02 (AC4-5), RECON-02 (AC5-6), SCROLL-01 (AC5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec com `EventSource` falso: enviar mostra "enviando" na hora; evento com o mesmo `clientId` deixa uma mensagem só
- [x] Spec: action falha → "Não enviada · Tentar de novo"; "Tentar de novo" chama a action com o mesmo `clientId` e conteúdo
- [x] Spec: `rate_limited` → "Você está enviando mensagens rápido demais. Aguarde alguns segundos." no `Composer` e a mensagem como falha
- [x] Spec: `error` do `EventSource` mostra "Reconectando…"; `open` esconde (teste entrou na T14)
- [x] Stories: enviando, falha, limite, reconectando
- [x] Full gate passa

> **Execução (T17) — desvios:** (1) O `Composer` mudou de contrato: a prop `send: SendMessageAction` virou `onSend(input): void` e ganhou `error?: string`. O campo limpa na hora e o botão não fica mais bloqueado enquanto a action roda; falha aparece na própria mensagem (OPT-01 AC4), não no `Composer`. Os testes e stories da F1 que exigiam "manter o texto e mostrar `errors.send` na falha" e "bloquear enquanto envia" saíram, porque a OPT-01 substitui esse comportamento; `errors.send` saiu do dicionário (ficou sem uso) e entrou `errors.rateLimited`. O `clientId` continua gerado no `Composer` (F1), não no `ChatStream`. (2) A action é chamada fora de `startTransition` (`SPEC_DEVIATION` no código): o React segura as atualizações de transições assíncronas até todas terminarem, então a confirmação de uma mensagem esperaria os envios seguintes. (3) Uma action que rejeita (falha de rede até o Next) também vira `message/failed`. (4) Lacuna de precisão da spec: ela não diz quando o aviso de limite some; ele some no próximo envio ou "Tentar de novo". (5) O teste da F2 "o Composer envia pela action send e nada mais acontece na lista" foi trocado pelos testes de envio otimista, pois a OPT-01 AC1 inverte o que ele afirmava. Full gate: web 564 unit + 134 stories, 100%.

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): optimistic send with retry and connection notice`

---

#### T18: E2E de robustez

**What**: `e2e/chat-resilience.spec.ts`.
**Where**: `apps/web/e2e/chat-resilience.spec.ts`
**Depends on**: T17
**Reuses**: Page Objects da F1
**Requirement**: Success Criteria; RECON-01, RECON-02, AWAY-01, OPT-01
**Tools**: MCP: NONE · Skill: `run`

**Done when**:

- [x] B fica offline (`context.setOffline(true)`), "Reconectando…" aparece, A envia 3 mensagens, B volta e vê as 3 na ordem, sem recarregar
- [x] B fecha a aba; A vê "B saiu do chat" e o contador cair em até 31 s (timeout do teste 45 s)
- [x] B dá F5; ninguém vê "B saiu do chat"
- [x] Sem duplicata em 100 envios com o SSE ativo, feitos por 20 participantes × 5 (o limite de 5 em 10 s impede 100 seguidos de uma pessoa; ver nota abaixo)
- [x] `make e2e` e `make gate` passam

> **Execução (T18) — desvios e achados:** (1) O `setOffline` do Chromium só falha requisições novas: o `EventSource` aberto continua conectado e "Reconectando…" nunca aparece (o risco previsto no design). B entra por um proxy TCP local criado no próprio spec; a queda chama `setOffline(true)` e derruba os sockets do proxy (`SPEC_DEVIATION` no spec). (2) **Lacuna de produto (RECON-01):** o navegador só manda `Last-Event-ID` depois de receber pelo SSE pelo menos um evento `message` (só eles têm `id`). Se a conexão cai antes disso, nada é recuperado: as mensagens gravadas entre o HTML do servidor e a queda faltam. O E2E cobre o caso de uma conversa em andamento (B recebe uma mensagem pelo SSE antes da queda). Fica para decisão: por exemplo, o stream escrever no início um `id:` com o último `seq` que o cliente já tem. (3) `enter()` espera o `EventSource` abrir (a página hidratada), pois o web roda em modo dev e o HTML chega antes do stream. (4) Dois E2E antigos quebraram com a F3 e foram ajustados: em `chat-realtime.spec.ts`, as 20 mensagens de A (p95) saem a cada 2,1 s, por causa da RATE-01 (`SPEC_DEVIATION`; teste com 90 s); em `chat.spec.ts`, as 60 mensagens vêm de 12 participantes × 5 (`SPEC_DEVIATION`), e o lado da bolha própria é medido depois que sai "Enviando…" (a otimista é trocada pela confirmada). (5) No fim do teste de queda, B clica "Sair" para que a saída agendada dele não altere o contador do teste seguinte. `make e2e`: 19 testes passam. Status da Traceability em `spec.md`: `Implemented`.

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): cover reconnect, away timeout and optimistic send`

> **Nota sobre a spec**: o Success Criterion "Nenhuma mensagem duplicada em 100 envios seguidos" conflita com RATE-01 (5 mensagens em 10 s). Esta task usa 20 × 5. Confirmar ou ajustar a spec antes de executar.

---

### Phase 4: correções da validação

Origem: `validation.md` (iteração 1, FAIL): Gap 1, notas de precisão da spec 1-3 e o comentário de `actions/leave.ts` (Code Quality).

#### T19: Spec: recuperação sem `Last-Event-ID` e notas de precisão

**What**: Em `spec.md`: novos ACs da RECON-01 (o stream sem `Last-Event-ID` recupera a partir de `after=<último seq renderizado pelo servidor>`; o `ChatStream.client` abre o stream com esse `after`); AC3 da RECON-01 passa a valer para os dois valores; Success Criterion "100 envios" → "100 envios de 20 participantes × 5"; RATE-02 AC4 diz quando o aviso some; RATE-01 AC1 fala em "envios aceitos". Commit leva o `validation.md` (FAIL) e as lições do Verifier.
**Where**: `.specs/features/chat-resilience/spec.md`
**Depends on**: None
**Reuses**: Fix 1 e "Spec-precision notes" do `validation.md`
**Requirement**: RECON-01, RATE-01 (AC1), RATE-02 (AC4)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] RECON-01 tem os ACs novos em EARS; Traceability e Assumptions atualizadas
- [x] Success Criterion, RATE-01 AC1 e RATE-02 AC4 reescritos como acima
- [x] `validate_spec.py` sem erro e `prettier --check .specs` passa

> **Execução (T19):** RECON-01 ganhou o AC7 (servidor: sem `Last-Event-ID` válido, recupera do `after` da query; com os dois, vale o cabeçalho) e o AC8 (cliente: abre com `after` = último `seq` do SSR; sala vazia, sem `after`). O AC3 passou a valer para os dois valores, e o Independent Test diz que B cai antes de receber qualquer mensagem pelo SSE. Nova linha nas Assumptions. `design.md` ganhou duas linhas (ponto de partida no `openChatStream`, `after` no `ChatStream`). RECON-01 fica `In Progress` até a T21. A nota da T18 sobre os 100 envios fica resolvida pelo novo Success Criterion. O commit leva o `validation.md` da iteração 1 (FAIL) e as lições do Verifier.

**Tests**: none (só documentação)
**Gate**: docs (`validate_spec.py` + `npx prettier --check .specs`)
**Commit**: `docs(specs): recover chat stream from the last rendered seq`

---

#### T20: Stream recupera a partir do `after` do SSR

**What**: `ChatStream` calcula uma vez, na montagem, o último `seq` de `initialMessages` e `useChatEvents` abre `/chat/stream?after=<seq>` (sem `seq`, sem `after`); `openChatStream` usa `Last-Event-ID` válido e, sem ele, `after` válido da query, pelo mesmo caminho `subscribe({ recovering })` → `recoverMissed` → `flush`; `after` inválido → sem recuperação.
**Where**: `apps/web/src/features/chat/realtime/open-chat-stream.ts`, `apps/web/src/features/chat/state/use-chat-events.ts`, `apps/web/src/features/chat/components/chat-stream.client.tsx`
**Depends on**: T19
**Reuses**: `parseLastEventId`, `recoverMissed`, specs do `openChatStream`, `useChatEvents` e `ChatStream`
**Requirement**: RECON-01 (AC3, AC7-8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec MSW: sem cabeçalho e `?after=1040` → recupera de 1040 antes do evento ao vivo
- [x] Spec MSW: `Last-Event-ID: 1100` e `?after=1040` → recupera de 1100 (o navegador reconecta com a mesma URL, então o cabeçalho tem de vencer)
- [x] Spec: `?after=abc` (e `0`) sem cabeçalho → nenhuma busca, eventos ao vivo direto
- [x] Spec do hook: `after` vira `?after=` na URL; sem `after`, a URL é `/chat/stream`; um `after` novo depois da montagem não reabre o stream
- [x] Spec do `ChatStream`: abre `/chat/stream?after=<último seq>`; sala sem mensagens → `/chat/stream`
- [x] Quick gate passa (web)

> **Execução (T20):** `openChatStream` parte de `parseLastEventId(Last-Event-ID) ?? parseLastEventId(after da query)`, pelo mesmo `subscribe({ recovering })` → `recoverMissed` → `flush`. `useChatEvents` ganhou a opção `after` e fixa a URL na montagem (`useState`), então novas mensagens não reabrem o stream; o `ChatStream` passa `initialMessages.at(-1)?.seq` (o SSR vem em ordem crescente de `seq`). Evidência: `open-chat-stream.spec.ts:351` `queries).toEqual([{ after: '1040', … }])` e chunks em ordem antes do ao vivo; `:369` cabeçalho `1100` vence `?after=1040`; `:375` `abc`, `0`, `-5`, vazio → `queries).toEqual([])`; `use-chat-events.spec.ts:61,77`; `chat-stream.client.spec.tsx:66,79,92`. Três asserções antigas esperavam `'/chat/stream'` com mensagens iniciais e passaram a esperar o `after` que a RECON-01 AC8 agora exige: `chat-stream.client.spec.tsx` (SSE-02 AC8, `?after=3`), `containers/chat-room.container.spec.tsx` (`?after=6`) e a story `Padrão` de `chat-stream.client.stories.tsx` (`?after=6`); a sala vazia continua com `/chat/stream`. Quick + full gate: web 574 unit (+10) e 134 stories, 100%.

**Tests**: unit
**Gate**: quick
**Commit**: `fix(web): recover messages missed before the first SSE event`

---

#### T21: E2E da queda sem mensagem anterior pelo SSE

**What**: Tirar de `e2e/chat-resilience.spec.ts` a mensagem que B recebia pelo SSE antes da queda, para o teste provar o Success Criterion como está escrito.
**Where**: `apps/web/e2e/chat-resilience.spec.ts`
**Depends on**: T20
**Reuses**: proxy TCP e Page Objects da T18
**Requirement**: RECON-01; Success Criteria
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] B cai sem ter recebido nenhuma mensagem pelo SSE; A envia 3; B volta e vê as 3 na ordem, sem recarregar
- [x] `make e2e` passa

> **Execução (T21):** saíram a mensagem `antes da queda` e o comentário que a justificava; a ordem é conferida só sobre as 3 enviadas (`contents.filter(...)).toEqual(sent)`). Com isso B não recebe nenhum evento `message` antes da queda, e o teste passa pelo `after` do SSR (antes da T20, a prova do Verifier ficava em `[0, 0, 0]`). Fora do arquivo da task: o E2E da F2 em `e2e/chat-realtime.spec.ts` ("uma só conexão a /chat/stream") esperava a URL terminar em `/chat/stream`; agora espera `/chat/stream?after=<n>`, como a RECON-01 AC8 manda (o `JOINED` de B está na página). `make e2e`: 19 passam. RECON-01 volta a `Implemented` na Traceability.

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): drop pre-seeded message from reconnect e2e`

---

#### T22: Comentário da action `leave`

**What**: O comentário de `actions/leave.ts` passa a descrever o que acontece: `cancelAway` cancela a saída já agendada; o redirect fecha o stream depois, um novo timer é agendado, a api responde `401` em 30 s e o resultado é descartado (AWAY-01 AC6).
**Where**: `apps/web/src/features/chat/actions/leave.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: AWAY-01 (AC5-6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Comentário corrigido, sem mudar código
- [x] Última task: `TURBO_FORCE=true make gate` e `make e2e` passam

> **Execução (T22):** o comentário agora descreve o fluxo: `cancelAway` cancela a saída já agendada; o redirect fecha o stream, que agenda outra; em 30 s a api responde `401` ao token antigo e o resultado é descartado (AWAY-01 AC6). Nenhuma mudança de código. Última task da fase 4: `TURBO_FORCE=true make gate` exit 0 (19/19 tasks do turbo, 0 em cache; api 305, web 574 unit + 134 stories, 100%); `make e2e` exit 0 (19 passam).

**Tests**: none (só comentário)
**Gate**: build
**Commit**: `docs(web): describe the leave scheduled after an explicit exit`

---

#### T23: Teste do aviso de limite com "Tentar de novo"

**What**: Teste de que o aviso de limite sai quando a pessoa aciona "Tentar de novo" (cláusula da RATE-02 AC4 criada na T19). Lacuna da validação, iteração 2 (mutante N9 sobreviveu).
**Where**: `apps/web/src/features/chat/components/chat-stream.client.spec.tsx`
**Depends on**: None
**Reuses**: helpers `controlledSend`, `type`, `bubbleOf` do mesmo spec
**Requirement**: RATE-02 (AC4)

**Done when**:

- [x] Spec: `rate_limited` mostra o aviso; clicar em "Tentar de novo" esconde o aviso com o reenvio ainda em "Enviando…"
- [x] O teste falha com o mutante N9 (`setRateLimited(false)` movido de `deliver` para `send`)
- [x] Quick gate passa

> **Execução (T23):** o mutante N9 foi aplicado à mão e o teste novo falhou (1 failed, 20 passed); o código voltou ao original. Só o spec mudou.

**Tests**: unit
**Gate**: quick
**Commit**: `test(web): cover rate-limit notice cleared by retry`

---

> **Confirmação do usuário (2026-10-29):** o usuário confirmou os SPEC_DEVIATIONs que mudaram testes da F1/F2 por causa da RATE-01 e da OPT-01 (e2e da api "61 envios" em 13 × 5; e2e do web com p95 espaçado em 2,1 s e 60 mensagens em 12 × 5; testes do Composer substituídos pelo envio otimista).

## Validation

### Task Granularity Check

| Task          | Scope                                              | Status                                               |
| ------------- | -------------------------------------------------- | ---------------------------------------------------- |
| T1            | schema + migration                                 | ⚠️ inseparáveis                                      |
| T2            | 1 método (contrato + implementação)                | ✅                                                   |
| T3, T15       | 1 módulo puro / 1 hook                             | ✅                                                   |
| T4            | exceção + filtro                                   | ⚠️ coesos                                            |
| T5, T10, T12  | 1 service ou action                                | ✅                                                   |
| T6            | decorators do controller + e2e + contrato          | ⚠️ merge forward: o e2e precisa do filtro na rota    |
| T7, T8        | 1 comportamento do `ChatHub`                       | ✅                                                   |
| T9            | 1 função + a ligação em `getChatHub`               | ⚠️ coesos                                            |
| T11, T13, T14 | 1 módulo                                           | ✅                                                   |
| T16, T17      | 1 componente                                       | ✅                                                   |
| T18           | 1 spec E2E                                         | ✅                                                   |
| T19, T22      | só documentação / comentário                       | ✅                                                   |
| T20           | 1 comportamento em 3 arquivos (servidor + cliente) | ⚠️ coesos: o `after` só tem efeito com os dois lados |
| T21           | 1 spec E2E                                         | ✅                                                   |
| T23           | 1 teste                                            | ✅                                                   |

### Diagram-Definition Cross-Check

| Task          | Depends On (task body) | Diagram Shows        | Status |
| ------------- | ---------------------- | -------------------- | ------ |
| T1, T3, T4    | None                   | —                    | ✅     |
| T2            | T1                     | T1 → T2              | ✅     |
| T5            | T2, T3, T4             | T2/T3/T4 → T5        | ✅     |
| T6            | T5                     | T5 → T6              | ✅     |
| T7, T12       | None                   | —                    | ✅     |
| T8, T9        | T7                     | T7 → T8, T7 → T9     | ✅     |
| T10           | T9                     | T9 → T10             | ✅     |
| T11           | T8                     | T8 → T11             | ✅     |
| T13, T14, T15 | None                   | —                    | ✅     |
| T16           | T13, T15               | T13 → T16, T15 → T16 | ✅     |
| T17           | T13, T14, T16          | T13/T14/T16 → T17    | ✅     |
| T18           | T17                    | T17 → T18            | ✅     |
| T19, T22, T23 | None                   | —                    | ✅     |
| T20           | T19                    | T19 → T20            | ✅     |
| T21           | T20                    | T20 → T21            | ✅     |

### Test Co-location Validation

| Task     | Code Layer                          | Matrix Requires | Task Says                   | Status |
| -------- | ----------------------------------- | --------------- | --------------------------- | ------ |
| T1       | schema/migration                    | none            | none                        | ✅     |
| T2       | repository                          | unit            | unit                        | ✅     |
| T3-T5    | limiter, filtro, service            | unit            | unit                        | ✅     |
| T6       | rota + contrato                     | e2e             | e2e                         | ✅     |
| T7-T12   | `realtime/`, `session/`, `actions/` | unit            | unit                        | ✅     |
| T13-T15  | `state/`                            | unit            | unit                        | ✅     |
| T16, T17 | componentes                         | unit + story    | unit (+ story no Done when) | ✅     |
| T18      | fluxos de rede                      | e2e             | e2e                         | ✅     |
| T19, T22 | documentação / comentário           | none            | none                        | ✅     |
| T20      | `realtime/`, `state/`, componente   | unit            | unit                        | ✅     |
| T21      | fluxos de rede                      | e2e             | e2e                         | ✅     |
