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

| Gate Level | When to Use                              | Command                                                                       |
| ---------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| Quick      | Tasks só com testes unitários            | `npm run typecheck --workspace=apps/<app> && npm test --workspace=apps/<app>` |
| Full       | web: tasks com stories                   | Quick + `npm run test:storybook --workspace=apps/web`                         |
| E2E        | Tasks com Playwright                     | `make e2e`                                                                    |
| Build      | Schema, migration, contrato, fim de fase | `make gate`                                                                   |

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

- [ ] Migration gerada; mensagens de sistema (`client_id` nulo) continuam livres
- [ ] Build gate passa

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

- [ ] Spec: busca pela chave composta e devolve `null` quando não existe
- [ ] Quick gate passa

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

- [ ] Spec: 5 chamadas em `t` passam; a 6ª em `t + 9_999` recusa com `retryAfterSeconds = 1`; em `t + 10_000` passa; outro participante não é afetado; `retryAfterSeconds` arredonda para cima
- [ ] Spec: depois de a janela esvaziar, o mapa interno não guarda a chave
- [ ] Quick gate passa

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

- [ ] Spec: o filtro responde `429`, `Retry-After: 3` e o corpo no formato dos outros erros da api
- [ ] Quick gate passa

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

- [ ] Spec: reenvio com `clientId` existente não chama o limiter, nem `create`, nem `dispatch`
- [ ] Spec: limiter recusa → exceção com `retryAfterSeconds`; `create` não é chamado
- [ ] Spec: `P2002` em `create` → `findByClientId` e devolve, sem `dispatch`; outros erros propagam
- [ ] Spec: sem `clientId`, o fluxo pula a busca
- [ ] Quick gate passa

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

- [ ] e2e: o mesmo `clientId` duas vezes → dois `201` com o mesmo `id`, uma linha no banco e uma entrega em `webhook_deliveries`
- [ ] e2e: 5 envios passam; o 6º → `429` com `Retry-After` inteiro; outro participante envia normalmente; um reenvio com `clientId` já gravado passa mesmo com o limite estourado
- [ ] `schema.d.ts` documenta o `429`
- [ ] Build gate passa

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

- [ ] Spec com fake timers: fechar a única conexão, avançar 29 s → nenhuma chamada; mais 1 s → uma chamada com `{ id, token }`
- [ ] Spec: reabrir antes de 30 s cancela; duas abas e fechar uma não agenda; `cancelAway` cancela; `onAway` rejeitado não lança
- [ ] Quick gate passa

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

- [ ] Spec: durante a recuperação nada é escrito; `flush(1045)` escreve 1046 e descarta 1044 e 1045; dois `presence` no buffer viram um (o último); depois do `flush`, eventos vão direto
- [ ] Quick gate passa

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

- [ ] Spec MSW: `204` → `left`; `401` e `404` → `gone`; `500` e erro de rede → `error`; o header do token é enviado
- [ ] Spec: o hub do `getChatHub()` chama `leaveParticipant` quando a saída vence
- [ ] Quick gate passa

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

- [ ] Spec: `cancelAway` é chamado antes da api; os casos da F1 continuam passando
- [ ] Quick gate passa

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

- [ ] Spec: `parseLastEventId` aceita `"1040"` e rejeita `"0"`, `"-1"`, `"abc"`, `"1.5"`, `null`
- [ ] Spec MSW: 250 mensagens perdidas → três páginas (100, 100, 50) escritas em ordem antes de um evento ao vivo publicado durante a busca
- [ ] Spec: evento ao vivo com `seq` já recuperado não é escrito duas vezes
- [ ] Spec: busca com `500` encerra o stream com erro e remove a conexão do hub
- [ ] Quick gate passa

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

- [ ] Spec MSW: `429` com `Retry-After: 4` → `{ ok: false, reason: 'rate_limited', retryAfter: 4 }`; sem `refresh()` em nenhum caminho
- [ ] Quick gate passa

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

- [ ] Spec: otimista entra no fim como `sending`; evento SSE com o mesmo `clientId` substitui sem duplicar; resposta da action antes do SSE substitui; SSE depois da action não duplica (mesmo `seq`); SSE antes da action mantém uma só
- [ ] Spec: `failed` e `retry` alternam o estado; `connection/changed` alterna `open`/`reconnecting`; `selectItems` põe as pendentes depois das confirmadas
- [ ] Quick gate passa

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

- [ ] Spec com `EventSource` falso: `error` → `onStatus('reconnecting')`; `open` → `onStatus('open')`; nenhum timer criado
- [ ] Quick gate passa

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

- [ ] Spec (medidas com `Object.defineProperty`): a 80 px do fim, nova mensagem rola; a 81 px mantém a posição e liga `showNewBelow`; rolar até o fim desliga; mudar `forceKey` rola mesmo longe do fim
- [ ] Quick gate passa

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

- [ ] Spec: pendente `sending` mostra o estado; `failed` mostra "Não enviada · Tentar de novo" e chama `onRetry`; clique em "Novas mensagens ↓" rola e esconde o botão
- [ ] Story com `play` no Chromium: rolar para cima, injetar mensagem, ver o botão, clicar, ver a lista no fim
- [ ] Full gate passa

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

- [ ] Spec com `EventSource` falso: enviar mostra "enviando" na hora; evento com o mesmo `clientId` deixa uma mensagem só
- [ ] Spec: action falha → "Não enviada · Tentar de novo"; "Tentar de novo" chama a action com o mesmo `clientId` e conteúdo
- [ ] Spec: `rate_limited` → "Você está enviando mensagens rápido demais. Aguarde alguns segundos." no `Composer` e a mensagem como falha
- [ ] Spec: `error` do `EventSource` mostra "Reconectando…"; `open` esconde
- [ ] Stories: enviando, falha, limite, reconectando
- [ ] Full gate passa

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

- [ ] B fica offline (`context.setOffline(true)`), "Reconectando…" aparece, A envia 3 mensagens, B volta e vê as 3 na ordem, sem recarregar
- [ ] B fecha a aba; A vê "B saiu do chat" e o contador cair em até 31 s (timeout do teste 45 s)
- [ ] B dá F5; ninguém vê "B saiu do chat"
- [ ] Sem duplicata em 100 envios com o SSE ativo, feitos por 20 participantes × 5 (o limite de 5 em 10 s impede 100 seguidos de uma pessoa; ver nota abaixo)
- [ ] `make e2e` e `make gate` passam

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): cover reconnect, away timeout and optimistic send`

> **Nota sobre a spec**: o Success Criterion "Nenhuma mensagem duplicada em 100 envios seguidos" conflita com RATE-01 (5 mensagens em 10 s). Esta task usa 20 × 5. Confirmar ou ajustar a spec antes de executar.

---

## Validation

### Task Granularity Check

| Task          | Scope                                     | Status                                            |
| ------------- | ----------------------------------------- | ------------------------------------------------- |
| T1            | schema + migration                        | ⚠️ inseparáveis                                   |
| T2            | 1 método (contrato + implementação)       | ✅                                                |
| T3, T15       | 1 módulo puro / 1 hook                    | ✅                                                |
| T4            | exceção + filtro                          | ⚠️ coesos                                         |
| T5, T10, T12  | 1 service ou action                       | ✅                                                |
| T6            | decorators do controller + e2e + contrato | ⚠️ merge forward: o e2e precisa do filtro na rota |
| T7, T8        | 1 comportamento do `ChatHub`              | ✅                                                |
| T9            | 1 função + a ligação em `getChatHub`      | ⚠️ coesos                                         |
| T11, T13, T14 | 1 módulo                                  | ✅                                                |
| T16, T17      | 1 componente                              | ✅                                                |
| T18           | 1 spec E2E                                | ✅                                                |

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
