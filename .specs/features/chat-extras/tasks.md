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

### Phase 4: correções da validação

```
T15 → T16
T17
T18
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

- [x] Spec: primeira chamada dispara com `maxAttempts: 1` e o `data` exato; outra em `t + 1_999` não dispara; em `t + 2_000` dispara; outro participante não é afetado
- [x] Spec: entradas velhas saem do mapa
- [x] Quick gate passa

> Nota: `WebhookEventType` (`modules/webhooks/webhook.types.ts`) ganhou `'typing.started'`, necessário para o `dispatch` tipar.

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

- [x] Spec: delega ao `TypingService.notify` com o participante do guard
- [x] Quick gate passa

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

- [x] e2e: token válido → `204` e o servidor de teste recebe `typing.started` assinado com `{ participant: { id, name } }`
- [x] e2e: token inválido → `401`; segunda chamada em menos de 2 s → `204` sem nova entrega em `webhook_deliveries`
- [x] e2e: servidor responde `500` → a entrega fica `FAILED` com `attempts = 1`
- [x] `schema.d.ts` tem `/api/v1/chat/typing`
- [x] Build gate passa

> Nota: o registro no `ChatModule` foi pego pelo container de dev sem rebuild (`POST /api/v1/chat/typing` sem token → `401`).

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

- [x] Spec: envelope válido passa; `participant.id` não-uuid ou sem `name` falha
- [x] Quick gate passa

> Nota: o `handleChatWebhook` repassa o envelope ao `ChatHub.publish(HubEvent)`, então o typecheck exige `HubEvent` com `typing.started` já aqui. O membro do `HubEvent` e o chunk `event: typing` sem `id:` (com o teste do chunk) vieram para esta task; a T5 fica com o descarte no buffer de recuperação e o spec do `handleChatWebhook`. O caso "tipo desconhecido" do spec do schema passou a usar `typing.stopped`, já que `typing.started` agora é conhecido.

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

- [x] Spec: o chunk é `event: typing\ndata: {"participant":…}\n\n` sem `id:`; durante a recuperação, `typing` não entra no `flush`
- [x] Spec do `handleChatWebhook`: webhook `typing.started` válido chega ao hub
- [x] Quick gate passa

> Nota: o chunk sem `id:` foi entregue na T4 (ver nota lá); aqui ficam o descarte no buffer e o spec do receptor. O caso "tipo desconhecido" do spec do receptor passou a usar `typing.stopped`.

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

- [x] Spec MSW: com sessão envia o header do token; `401` e `500` resolvem sem lançar e sem redirect; sem sessão não chama a api
- [x] Quick gate passa

> Nota: falha de rede também resolve sem lançar (`try/catch`), coberta no mesmo `it.each` ("ignora qualquer erro").

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

- [x] Spec MSW: `before=0`/`-1`/`1.5` → `{ ok: false }` sem chamar a api; sessão inválida → `{ ok: false }`; sucesso manda `before` e `limit=50`; `500` → `{ ok: false }`
- [x] Quick gate passa
- [x] Build gate passa (fim da fase 2)

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

- [x] Spec: `typing/started` do próprio `me.id` é ignorado; de outro grava `expiresAt = now + 5_000` e reinicia a cada evento; `typing/expired` remove só os vencidos; mensagem `USER` do autor o remove; `JOINED`/`LEFT` não removem
- [x] Spec: 50 iniciais → `hasMore = true`; 49 → `false`; `history/loaded` com 50 mantém, com 0 ou 20 esconde; itens já presentes não duplicam; mensagens ao vivo chegadas durante `loading` ficam na ordem de `seq`
- [x] Spec: `selectTypingNames` devolve os nomes na ordem de chegada
- [x] Quick gate passa

> Nota: o `me.id` entra no estado como `meId` (opcional em `initChatRoom`), já que o reducer não o tinha. O spec do `initChatRoom` ganhou os campos `typing` e `history` no objeto esperado. `message/confirmed` (a resposta do próprio envio) não mexe no `typing`.

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

- [x] Spec com `EventSource` falso: evento `typing` chama `onTyping` com o participante
- [x] Quick gate passa

> Nota: `onTyping` é opcional em `ChatEventHandlers`, para o `ChatStream` compilar até a T12 ligar o handler.

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

- [x] Spec com `vi.setSystemTime`: várias teclas em 2,9 s → uma chamada; tecla em 3 s → segunda chamada; apagar tudo não chama
- [x] Spec: o componente não cria `setTimeout`/`setInterval`
- [x] Story atualizada
- [x] Full gate passa

> Nota: "conteúdo não vazio" segue a regra do botão "Enviar" (`trim()`): só espaços não avisa. Story nova: `Digitando`.

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

- [x] Spec: botão aparece com `hasMore` e some sem; `loading` desabilita e mostra "Carregando…"; `error` mostra o erro e mantém o botão; clique chama `onLoad`
- [x] Spec (medidas no jsdom): depois de inserir no topo, `scrollTop` aumenta pela diferença de `scrollHeight`; "Novas mensagens ↓" não aparece por causa da inserção
- [x] Story com `play` no Chromium confere que a mensagem do topo continua visível depois de carregar
- [x] Full gate passa

> Nota: o `useStickToBottom` não mudou; a `MessageList` passa a ele só as mensagens a partir da primeira da montagem, então as anteriores não contam como novas. O `scrollHeight` é medido a cada commit (não no clique), para mensagens ao vivo chegadas durante a busca não entrarem na compensação. A raiz da lista usa `overflow-anchor: none`, para a ancoragem do navegador não somar à nossa. O dicionário ganhou `room.loadOlder`, `room.loadingOlder` e `errors.loadOlderFailed`. Stories: `Com mensagens anteriores`, `Carregando anteriores`, `Erro ao carregar anteriores`, `Carregar anteriores mantém a leitura`.

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

- [x] Spec com fake timers: evento `typing` de Ana → "Ana está digitando…"; some em 5 s; novo evento em 4 s estende até 9 s; mensagem `USER` de Ana remove na hora; evento do próprio participante não aparece
- [x] Spec: dois nomes → "Ana e Carlos estão digitando…"; três → "Várias pessoas estão digitando…"
- [x] Spec: sem ninguém digitando não há timer pendente (`vi.getTimerCount() === 0`)
- [x] Spec: "Carregar mensagens anteriores" chama `loadOlder` com o menor `seq` e insere o resultado no topo
- [x] Stories: digitando (1, 2, 3+), carregando anteriores
- [x] Full gate passa

> Nota: o `TypingIndicator` fica no slot do `Composer`, dentro de um `div aria-live="polite"` acima do campo (não no `footer` da lista, que sai da tela quando a pessoa lê mensagens antigas). `actions.typing` e `actions.loadOlder` são opcionais no `ChatStream`: sem `loadOlder` não há botão. O tipo `LoadOlderMessagesResult` saiu da action para `chat.types.ts` (com `LoadOlderMessagesAction`), porque o lint proíbe componentes de importar de `actions/`. O timer de expiração despacha `now = max(Date.now(), próximo vencimento)`, para um timer que dispare 1 ms cedo não deixar o aviso preso.

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

- [x] Specs: o container repassa as actions ao `ChatStream`; a página entrega as actions reais
- [x] Quick gate passa

> Nota: o spec da página já existente passou a esperar as quatro actions (antes só `send` e `leave`).

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

- [x] A digita sem enviar e B vê "A está digitando…" em menos de 1 s; 5 s depois de A parar, o aviso some
- [x] Com 120 mensagens criadas pela api no setup (repartidas entre participantes, porque o limite da F3 é de 5 envios a cada 10 s por participante), B clica "Carregar mensagens anteriores" até o botão sumir; todas as 120 estão na lista, em `seq` crescente e sem duplicata (a sala é compartilhada com outros testes, então a asserção é sobre as 120 criadas e a ordem geral)
- [x] `page.on('request')` não mostra requisição periódica nova com A parado
- [x] `make e2e` e `make gate` passam

> Nota: a sala tem milhares de mensagens de execuções anteriores, então o loop de cliques passa de 50 páginas; além das 120 em ordem, o teste compara a lista inteira (mensagens `USER`) com a da api em ordem de `seq`, o que prova ordem geral e ausência de duplicata. A checagem de erro procura o texto do dicionário, porque o route announcer do Next também tem `role="alert"`. Ambiente: o container web precisou de `docker compose restart web`, porque o `ChatHub` em `globalThis` era da versão anterior à T4/T5 e publicava `typing` como `presence`.

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): cover typing indicator and history pagination`

---

### Phase 4: correções da validação

Origem: `validation.md` (iteração 1, FAIL): Gap 1 (janela de digitação depois de um envio), Gap 2 (rejeição de `notifyTyping` sem tratamento no navegador) e Gap 3 (E2E de paginação sobre uma sala sem limite).

#### T15: Spec: quando a janela de digitação recomeça

**What**: Em `spec.md`, dois ACs novos no "Ver quem está digitando": o envio de uma mensagem recomeça a janela de 3 s do `Composer` (a próxima tecla avisa na hora); a api zera o limite de 2 s do participante quando grava uma mensagem `USER` dele, e um reenvio com `clientId` já gravado não zera. Traceability e Assumptions atualizadas. O commit leva o `validation.md` (FAIL) e as lições do Verifier.
**Where**: `.specs/features/chat-extras/spec.md`
**Depends on**: None
**Reuses**: Fix plan do Gap 1 no `validation.md`
**Requirement**: TYPE-01 (AC12-13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] TYPE-01 tem o AC12 (`Composer`) e o AC13 (api) em EARS; Traceability (`AC 1-5, 12-13`, tasks novas) e Assumptions atualizadas
- [x] `validate_spec.py` sem erro e `npx prettier --check .specs` passa

> **Execução (T15):** os ACs entraram no fim da lista do "Ver quem está digitando" (12 e 13), para não renumerar os ACs 6-11 citados nos testes. Nova linha nas Assumptions ("Janela de digitação depois de um envio"). TYPE-01 fica `In Progress` até a T18; HIST-01 ganhou a T18 na Traceability. O commit leva o `validation.md` da iteração 1 (FAIL) e as lições do Verifier (L-022 confirmada, L-026 e L-027 candidatas).

**Tests**: none (só documentação)
**Gate**: docs (`validate_spec.py` + `npx prettier --check .specs`)
**Commit**: `docs(specs): restart the typing window after a send`

---

#### T16: Janela de digitação recomeça no envio (web + api)

**What**: `Composer.submit()` recomeça a janela de 3 s (`lastTypingAt.current = -Infinity`); `TypingService.reset(participantId)` apaga a entrada do participante; `MessagesService.send` chama `reset` depois de gravar uma mensagem `USER` nova (não num reenvio com `clientId` já gravado, nem na corrida de `P2002`).
**Where**: `apps/web/src/features/chat/components/composer.client.tsx`, `apps/api/src/modules/chat/services/typing.service.ts`, `apps/api/src/modules/chat/services/messages.service.ts`
**Depends on**: T15
**Reuses**: specs do `Composer`, `TypingService` e `MessagesService`
**Requirement**: TYPE-01 (AC12-13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec do `Composer` com `vi.setSystemTime`: tecla em 0, Enter em 1 000, tecla em 1 500 → 2 chamadas a `onTyping`
- [x] Spec do `TypingService`: `notify` em T, `reset` em T + 500, `notify` em T + 1 000 → 2 disparos; `reset` de um participante não afeta outro
- [x] Spec do `MessagesService`: mensagem nova chama `reset` com o id do ator; reenvio com `clientId` já gravado, corrida de `P2002` e falha do `create` não chamam
- [x] Quick gate passa (api e web)

> **Execução (T16):** o spec do `MessagesService` usa o `TypingService` real sobre o mesmo `dispatcher` falso e conta os `typing.started`: com mensagem nova (com e sem `clientId`), `notify` a 1 s do anterior dispara de novo; reenvio, corrida de `P2002` e falha do `create` deixam 1 disparo; o limite de outro participante continua. `reset` roda depois do `create` e antes do `message.created`. O mutante "sem reset no `submit()`" foi aplicado à mão e o teste novo do `Composer` falhou (1 failed); o código voltou ao original. Quick gate: api 266 unit, web 638 unit.

**Tests**: unit
**Gate**: quick (api + web)
**Commit**: `fix(chat): restart the typing window after a send`

---

#### T17: `ChatStream` trata a rejeição de `notifyTyping`

**What**: O `ChatStream` passa ao `Composer` um `onTyping` que chama `actions.typing` e descarta a rejeição (`.catch`), como já faz com `send` e `loadOlder`. O `onTyping` do `Composer` continua `() => void`.
**Where**: `apps/web/src/features/chat/components/chat-stream.client.tsx`
**Depends on**: None
**Reuses**: padrão `.catch` de `deliver` e `loadOlder`
**Requirement**: TYPE-01 (AC1; design: "ignora qualquer erro")
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `typing` é uma função comum que devolve `Promise.reject(new Error('offline'))`; uma tecla não gera `unhandledRejection` (listener em `process`) e a sala continua enviando
- [x] O teste falha sem o `.catch`
- [x] Quick gate passa (web)

> **Execução (T17):** o teste foi escrito antes da correção e falhou (`expected [ Error: offline ] to deeply equal []`). O `ChatStream` passa ao `Composer` `() => notifyTyping(typingAction)`, que faz `void typing().catch(() => {})`; sem `actions.typing`, o `Composer` continua sem `onTyping`. O teste fica fora do `describe` com fake timers e espera um `setTimeout(0)` real, para o Node ter a chance de reportar a rejeição. A nota residual do `toSse` exaustivo (`chat-hub.ts`) fica fora: não é a área desta task. Quick gate: web 639 unit.

**Tests**: unit
**Gate**: quick
**Commit**: `fix(web): ignore notifyTyping transport failures`

---

#### T18: E2E de paginação sobre uma sala limitada

**What**: `globalSetup` do Playwright apaga, antes de cada execução, os participantes `e2e-web-`, as mensagens deles (`USER`, `JOINED`, `LEFT`) e as entregas de webhook ligadas a eles (`data.author.id` ou `data.participant.id`; as tentativas saem em cascata), como `apps/api/test/typing.e2e-spec.ts` faz na api. O E2E de paginação cria as 120 mensagens com menos remetentes (a sala fica abaixo de 150), conta os cliques, compara com `floor(total da api / 50)` e baixa o timeout para 60 s, mantendo a comparação com a sala inteira.
**Where**: `apps/web/e2e/global-setup.ts`, `apps/web/playwright.config.ts`, `apps/web/e2e/chat-extras.spec.ts`
**Depends on**: None
**Reuses**: limpeza de `apps/api/test/typing.e2e-spec.ts`; `DATABASE_URL` de `apps/api/.env`
**Requirement**: HIST-01; Success Criteria
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] O `globalSetup` apaga só linhas criadas pelos E2E do web (prefixo `e2e-web-` e o que é ligado a esses participantes)
- [x] O E2E de paginação clica `floor(total / 50)` vezes (2 numa sala limpa) e vê as 120 em ordem e a sala inteira igual à da api; timeout ≤ 60 s
- [x] Duas execuções seguidas de `make e2e` passam com a mesma contagem de cliques
- [x] Última task: Traceability da TYPE-01 volta a `Implemented`; `make e2e` e `TURBO_FORCE=true make gate` passam

> **Execução (T18):** o `globalSetup` usa `pg` (agora em `devDependencies` do web, mesma versão da api) com o `DATABASE_URL` de `apps/api/.env` (ou `E2E_DATABASE_URL`), numa transação: lê os ids dos participantes com nome `e2e-web-`, apaga as entregas com `data.author.id` ou `data.participant.id` entre eles (as tentativas saem em cascata), as mensagens deles e os participantes. Entregas `presence.changed` (sem participante) e as linhas de fora do prefixo ficam; depois das execuções, as 5 mensagens de fora dos E2E continuam lá. O teste agora usa 12 remetentes × 10 mensagens em duas rodadas (cada remetente espera a janela de 10 s da RATE-01), o que deixa a sala com 140 mensagens: 120 `USER`, 12 + 1 `JOINED` deste teste, 2 do teste de digitando e 5 de fora dos E2E (`SPEC_DEVIATION` atualizado no spec). A contagem de cliques vem do total da api, `floor(total / 50)`, e a linha `2 cliques (sala com 140 mensagens)` sai no log. Duas execuções seguidas de `make e2e`: 21 passam; o teste de paginação levou 13,9 s e 13,6 s (antes: 39,6 s, 78 cliques). Timeout de 300 s para 60 s. Os outros E2E não dependiam de dados antigos e passaram. TYPE-01 volta a `Implemented` na Traceability. `TURBO_FORCE=true make gate` exit 0 (19/19 tasks do turbo, 0 em cache; api 325, web 639 unit + 152 stories, 100%).

**Tests**: e2e
**Gate**: e2e + build
**Commit**: `test(web): keep the pagination e2e on a bounded room`

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
| T15      | só documentação                          | ✅                                                                        |
| T16      | 1 comportamento em 2 apps                | ⚠️ coesos: a janela recomeça no navegador e na api pelo mesmo AC          |
| T17      | 1 componente                             | ✅                                                                        |
| T18      | `globalSetup` + 1 spec E2E               | ⚠️ coesos: a contagem de cliques só vale com a sala limitada              |

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
| T15         | None                   | —                   | ✅     |
| T16         | T15                    | T15 → T16           | ✅     |
| T17, T18    | None                   | —                   | ✅     |

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
| T15     | documentação                        | none            | none                        | ✅     |
| T16     | service, componente                 | unit            | unit                        | ✅     |
| T17     | componente                          | unit            | unit                        | ✅     |
| T18     | fluxos                              | e2e             | e2e                         | ✅     |
