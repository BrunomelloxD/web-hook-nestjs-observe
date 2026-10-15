# Extras: digitando e mensagens anteriores (F4) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/chat-extras/spec.md`
**Design**: `.specs/features/chat-extras/design.md`
**Status**: Draft
**Pré-requisito**: F3 (`chat-resilience`) concluída.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `apps/api/ARCHITECTURE.md` §10, `apps/web/ARCHITECTURE.md` §8-§9, `packages/vitest-config/src/index.ts` (100%).

| Code Layer                               | Required Test Type              | Coverage Expectation                                                                                | Location Pattern                    | Run Command                             |
| ---------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------- |
| api: service, controller                 | unit                            | Todos os branches; 1:1 com TYPE-01; limite de 2 s com relógio por parâmetro                         | `modules/chat/**/test/*.spec.ts`    | `npm test --workspace=apps/api`         |
| api: rota `POST /chat/typing`            | e2e                             | `204`, `401`, limite de 2 s e uma tentativa de entrega                                              | `test/*.e2e-spec.ts`                | `npm run test:e2e --workspace=apps/api` |
| web: `schemas/`, `realtime/`, `actions/` | unit                            | 1:1 com TYPE-02 (AC6) e HIST-01 (AC2); erros ignorados ou devolvidos                                | `src/**/*.spec.ts`                  | `npm test --workspace=apps/web`         |
| web: `state/`                            | unit                            | Cada ação nova; expiração em 5 s; edge cases de 50 mensagens e de mensagens ao vivo durante a busca | `src/features/chat/state/*.spec.ts` | `npm test --workspace=apps/web`         |
| web: componentes, containers             | unit (+ story para componentes) | Testing Library por AC; fake timers para 3 s e 5 s                                                  | `*.spec.tsx` + `*.stories.tsx`      | `npm test` + `npm run test:storybook`   |
| Fluxos                                   | e2e                             | Independent Tests da spec                                                                           | `apps/web/e2e/*.spec.ts`            | `make e2e`                              |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use                   | Command                                                                       |
| ---------- | ----------------------------- | ----------------------------------------------------------------------------- |
| Quick      | Tasks só com testes unitários | `npm run typecheck --workspace=apps/<app> && npm test --workspace=apps/<app>` |
| Full       | web: tasks com stories        | Quick + `npm run test:storybook --workspace=apps/web`                         |
| E2E        | Tasks com Playwright          | `make e2e`                                                                    |
| Build      | Contrato, fim de fase         | `make gate`                                                                   |

---

## Execution Plan

Phases run in order; tasks inside a phase run in order.

### Phase 1: api — `POST /chat/typing`

```
T1 → T2 → T3
```

### Phase 2: web — servidor

```
T4 → T5
T6
T7
```

### Phase 3: web — navegador e E2E

```
T8 → T11 → T12
T8 → T12
T9 → T12
T10 → T12
T12 → T13 → T14
```

---

## Task Breakdown

### Phase 1: api — `POST /chat/typing`

#### T1: `TypingService`

**What**: `notify(actor, nowMs = Date.now())`: menos de 2 s da última aceita → nada; senão grava `nowMs` e `dispatch('typing.started', { participant: { id, name } }, { maxAttempts: 1 })`; o mapa descarta entradas com mais de 2 s quando consultado.
**Where**: `apps/api/src/modules/chat/services/typing.service.ts`
**Depends on**: None
**Reuses**: formato do `SendRateLimiter` (F3); `WebhookDispatcher` (F2)
**Requirement**: TYPE-01 (AC2, AC4-5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec: primeira chamada dispara com `maxAttempts: 1` e o `data` exato; outra em `t + 1_999` não dispara; em `t + 2_000` dispara; outro participante não é afetado
- [ ] Spec: entradas velhas saem do mapa
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add typing service with 2s throttle`

---

#### T2: `TypingController`

**What**: `@Controller('chat/typing')`, `@SkipThrottle()`, `POST /` com `ParticipantTokenGuard`, `@HttpCode(204)`, `@ApiHeader` e `@ApiUnauthorizedResponse`.
**Where**: `apps/api/src/modules/chat/controllers/typing.controller.ts`
**Depends on**: T1
**Reuses**: `MessagesController` (F1)
**Requirement**: TYPE-01 (AC2-3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec: delega ao `TypingService.notify` com o participante do guard
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(api): add typing controller`

---

#### T3: Registro no `ChatModule`, e2e e contrato

**What**: Registrar `TypingController` e `TypingService` no `ChatModule`; cenários em `test/typing.e2e-spec.ts`; regenerar o `@repo/api-client`.
**Where**: `apps/api/test/typing.e2e-spec.ts`
**Depends on**: T2
**Reuses**: servidor HTTP de teste da F2 (`test/webhooks.e2e-spec.ts`)
**Requirement**: TYPE-01 (AC2-5)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] e2e: token válido → `204` e o servidor de teste recebe `typing.started` assinado com `{ participant: { id, name } }`
- [ ] e2e: token inválido → `401`; segunda chamada em menos de 2 s → `204` sem nova entrega em `webhook_deliveries`
- [ ] e2e: servidor responde `500` → a entrega fica `FAILED` com `attempts = 1`
- [ ] `schema.d.ts` tem `/api/v1/chat/typing`
- [ ] Build gate passa

**Tests**: e2e
**Gate**: build
**Commit**: `feat(api): expose typing endpoint`

---

### Phase 2: web — servidor

#### T4: Envelope `typing.started`

**What**: Novo membro `{ type: 'typing.started', data: { participant: { id: uuid, name } } }` no `webhookEnvelopeSchema`.
**Where**: `apps/web/src/features/chat/schemas/webhook-envelope.schema.ts`
**Depends on**: None
**Reuses**: spec do schema (F2)
**Requirement**: TYPE-02 (AC6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec: envelope válido passa; `participant.id` não-uuid ou sem `name` falha
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): accept typing.started webhooks`

---

#### T5: `ChatHub` publica `event: typing`

**What**: `HubEvent` ganha `typing.started`; `publish` escreve `event: typing` com o `data` e sem `id:`; o buffer de recuperação descarta `typing`.
**Where**: `apps/web/src/features/chat/realtime/chat-hub.ts`
**Depends on**: T4
**Reuses**: spec do hub (F2/F3)
**Requirement**: TYPE-02 (AC6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec: o chunk é `event: typing\ndata: {"participant":…}\n\n` sem `id:`; durante a recuperação, `typing` não entra no `flush`
- [ ] Spec do `handleChatWebhook`: webhook `typing.started` válido chega ao hub
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): broadcast typing events over SSE`

---

#### T6: Action `notifyTyping`

**What**: Lê a sessão; sem sessão não faz nada; chama `POST /chat/typing`; ignora qualquer erro; sem `refresh()` e sem redirect.
**Where**: `apps/web/src/features/chat/actions/notify-typing.ts`
**Depends on**: None
**Reuses**: `readSession()` (F1)
**Requirement**: TYPE-01 (AC1)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec MSW: com sessão envia o header do token; `401` e `500` resolvem sem lançar e sem redirect; sem sessão não chama a api
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add notifyTyping server action`

---

#### T7: Action `loadOlderMessages`

**What**: `loadOlderMessages(before)`: valida `before` (inteiro positivo, zod); sem sessão válida → `{ ok: false }`; `getMessages({ before, limit: 50 })` → `{ ok: true, items }`; erro → `{ ok: false }`.
**Where**: `apps/web/src/features/chat/actions/load-older-messages.ts`
**Depends on**: None
**Reuses**: `getMessages` (F1), `getValidSession` (F1)
**Requirement**: HIST-01 (AC2, AC6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec MSW: `before=0`/`-1`/`1.5` → `{ ok: false }` sem chamar a api; sessão inválida → `{ ok: false }`; sucesso manda `before` e `limit=50`; `500` → `{ ok: false }`
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add loadOlderMessages server action`

---

### Phase 3: web — navegador e E2E

#### T8: `chatRoomReducer` com digitando e histórico

**What**: Estado `typing` e `history`; ações `typing/started`, `typing/expired`, `history/requested`, `history/loaded`, `history/failed`; `message/received` remove o autor de uma `USER` do `typing`; `hasMore` inicial = `initialMessages.length === 50`; seletor `selectTypingNames`.
**Where**: `apps/web/src/features/chat/state/chat-room.reducer.ts`
**Depends on**: None
**Reuses**: reducer da F2/F3
**Requirement**: TYPE-02 (AC7-9), HIST-01 (AC1, AC5, AC7)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec: `typing/started` do próprio `me.id` é ignorado; de outro grava `expiresAt = now + 5_000` e reinicia a cada evento; `typing/expired` remove só os vencidos; mensagem `USER` do autor o remove; `JOINED`/`LEFT` não removem
- [ ] Spec: 50 iniciais → `hasMore = true`; 49 → `false`; `history/loaded` com 50 mantém, com 0 ou 20 esconde; itens já presentes não duplicam; mensagens ao vivo chegadas durante `loading` ficam na ordem de `seq`
- [ ] Spec: `selectTypingNames` devolve os nomes na ordem de chegada
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add typing and history state to chat reducer`

---

#### T9: `useChatEvents` recebe `typing`

**What**: Novo handler `onTyping(participant)` para o evento `typing`.
**Where**: `apps/web/src/features/chat/state/use-chat-events.ts`
**Depends on**: None
**Reuses**: spec do hook (F2/F3)
**Requirement**: TYPE-02 (AC6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec com `EventSource` falso: evento `typing` chama `onTyping` com o participante
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): handle typing SSE events`

---

#### T10: `Composer` avisa que está digitando

**What**: Prop `onTyping?`; no `onChange` com conteúdo não vazio chama `onTyping` se a última chamada foi há 3 s ou mais (`useRef` com o instante, sem timer).
**Where**: `apps/web/src/features/chat/components/composer.client.tsx`
**Depends on**: None
**Reuses**: `Composer` da F1/F3
**Requirement**: TYPE-01 (AC1)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec com `vi.setSystemTime`: várias teclas em 2,9 s → uma chamada; tecla em 3 s → segunda chamada; apagar tudo não chama
- [ ] Spec: o componente não cria `setTimeout`/`setInterval`
- [ ] Story atualizada
- [ ] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): throttle typing notifications in Composer`

---

#### T11: `MessageList` carrega mensagens anteriores

**What**: Prop `history`; botão "Carregar mensagens anteriores" no topo quando `hasMore`; `loading` → desabilitado com "Carregando…"; `error` → botão + erro do dicionário; compensação de rolagem num `useLayoutEffect` disparado pela troca do primeiro `seq`; `useStickToBottom` ignora inserções no topo.
**Where**: `apps/web/src/features/chat/components/message-list.client.tsx`
**Depends on**: T8
**Reuses**: `useStickToBottom` (F3), `Button`
**Requirement**: HIST-01 (AC1, AC3-6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec: botão aparece com `hasMore` e some sem; `loading` desabilita e mostra "Carregando…"; `error` mostra o erro e mantém o botão; clique chama `onLoad`
- [ ] Spec (medidas no jsdom): depois de inserir no topo, `scrollTop` aumenta pela diferença de `scrollHeight`; "Novas mensagens ↓" não aparece por causa da inserção
- [ ] Story com `play` no Chromium confere que a mensagem do topo continua visível depois de carregar
- [ ] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): load older messages keeping scroll position`

---

#### T12: `ChatStream` com digitando e histórico

**What**: `onTyping` → `typing/started` com `Date.now()`; um `setTimeout` para o próximo `expiresAt` despacha `typing/expired` (comentário: só expira estado local, não busca dados); `loadOlder()` usa a action; `TypingIndicator names={selectTypingNames(state)}` entre a lista e o `Composer`; `Composer onTyping={actions.typing}`.
**Where**: `apps/web/src/features/chat/components/chat-stream.client.tsx`
**Depends on**: T8, T9, T10, T11
**Reuses**: `TypingIndicator` (F0)
**Requirement**: TYPE-02 (AC7-11), HIST-01 (AC2), TYPE-01 (AC1)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Spec com fake timers: evento `typing` de Ana → "Ana está digitando…"; some em 5 s; novo evento em 4 s estende até 9 s; mensagem `USER` de Ana remove na hora; evento do próprio participante não aparece
- [ ] Spec: dois nomes → "Ana e Carlos estão digitando…"; três → "Várias pessoas estão digitando…"
- [ ] Spec: sem ninguém digitando não há timer pendente (`vi.getTimerCount() === 0`)
- [ ] Spec: "Carregar mensagens anteriores" chama `loadOlder` com o menor `seq` e insere o resultado no topo
- [ ] Stories: digitando (1, 2, 3+), carregando anteriores
- [ ] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): show typing indicator and older messages in ChatStream`

---

#### T13: Container e página passam as novas actions

**What**: `ChatRoomContainer` e `app/chat/page.tsx` passam `typing: notifyTyping` e `loadOlder: loadOlderMessages` ao `ChatStream`; `index.ts` exporta as duas actions.
**Where**: `apps/web/src/features/chat/containers/chat-room.container.tsx`
**Depends on**: T12
**Reuses**: specs do container e da página (F1/F2)
**Requirement**: TYPE-01 (AC1), HIST-01 (AC2)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] Specs: o container repassa as actions ao `ChatStream`; a página entrega as actions reais
- [ ] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): wire typing and history actions into chat room`

---

#### T14: E2E de digitando e paginação

**What**: `e2e/chat-extras.spec.ts`.
**Where**: `apps/web/e2e/chat-extras.spec.ts`
**Depends on**: T13
**Reuses**: Page Objects da F1
**Requirement**: Success Criteria; TYPE-01, TYPE-02, HIST-01
**Tools**: MCP: NONE · Skill: `run`

**Done when**:

- [ ] A digita sem enviar e B vê "A está digitando…" em menos de 1 s; 5 s depois de A parar, o aviso some
- [ ] Com 120 mensagens criadas pela api no setup, B clica "Carregar mensagens anteriores" até o botão sumir; todas as 120 estão na lista, em `seq` crescente e sem duplicata (a sala é compartilhada com outros testes, então a asserção é sobre as 120 criadas e a ordem geral)
- [ ] `page.on('request')` não mostra requisição periódica nova com A parado
- [ ] `make e2e` e `make gate` passam

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): cover typing indicator and history pagination`

---

## Validation

### Task Granularity Check

| Task     | Scope                                    | Status                                                                    |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| T1, T2   | 1 service / 1 controller                 | ✅                                                                        |
| T3       | registro + e2e + contrato                | ⚠️ merge forward: o e2e precisa do registro                               |
| T4, T5   | 1 schema / 1 comportamento do hub        | ✅                                                                        |
| T6, T7   | 1 Server Action                          | ✅                                                                        |
| T8, T9   | 1 reducer / 1 hook                       | ✅                                                                        |
| T10, T12 | 1 componente                             | ✅                                                                        |
| T11      | 1 componente + ajuste no hook de rolagem | ⚠️ coesos (a compensação e o hook decidem juntos o que é "mensagem nova") |
| T13      | container + página                       | ⚠️ coesos (passagem das mesmas actions)                                   |
| T14      | 1 spec E2E                               | ✅                                                                        |

### Diagram-Definition Cross-Check

| Task        | Depends On (task body) | Diagram Shows       | Status |
| ----------- | ---------------------- | ------------------- | ------ |
| T1          | None                   | —                   | ✅     |
| T2          | T1                     | T1 → T2             | ✅     |
| T3          | T2                     | T2 → T3             | ✅     |
| T4, T6, T7  | None                   | —                   | ✅     |
| T5          | T4                     | T4 → T5             | ✅     |
| T8, T9, T10 | None                   | —                   | ✅     |
| T11         | T8                     | T8 → T11            | ✅     |
| T12         | T8, T9, T10, T11       | T8/T9/T10/T11 → T12 | ✅     |
| T13         | T12                    | T12 → T13           | ✅     |
| T14         | T13                    | T13 → T14           | ✅     |

### Test Co-location Validation

| Task    | Code Layer                          | Matrix Requires | Task Says                   | Status |
| ------- | ----------------------------------- | --------------- | --------------------------- | ------ |
| T1, T2  | service, controller                 | unit            | unit                        | ✅     |
| T3      | rota + contrato                     | e2e             | e2e                         | ✅     |
| T4-T7   | `schemas/`, `realtime/`, `actions/` | unit            | unit                        | ✅     |
| T8, T9  | `state/`                            | unit            | unit                        | ✅     |
| T10-T12 | componentes                         | unit + story    | unit (+ story no Done when) | ✅     |
| T13     | container, `app/`                   | unit            | unit                        | ✅     |
| T14     | fluxos                              | e2e             | e2e                         | ✅     |
