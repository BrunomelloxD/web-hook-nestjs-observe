# STATE

## Decisions

### AD-001

- **Decision**: O tema é aplicado por um script inline no `<head>` do root layout, que lê o cookie `theme` antes da primeira pintura. O root layout nunca lê dados da requisição (`cookies()`, `headers()`).
- **Reason**: Com Cache Components, ler o cookie no root layout torna o app inteiro bloqueante (`instant = false`) e elimina o static shell. O script é o padrão da doc do Next 16.4 (`preventing-flash-before-hydration`) e mantém o PPR.
- **Trade-off**: O HTML do servidor não traz `data-theme`; o `<html>` usa `suppressHydrationWarning`; o `ThemeToggle` reaplica o tema num `useLayoutEffect` por causa do remount do Strict Mode em dev.
- **Scope**: web (`app/layout.tsx`, `lib/theme.ts`, `components/ui/theme-toggle.client.tsx`); toda preferência futura que mude um atributo do `<html>`.
- **Date**: 2026-10-14
- **Status**: active

### AD-002

- **Decision**: A sessão do chat é checada em duas camadas. O `proxy.ts` só olha a presença do cookie `chat_session` e redireciona (`/` ↔ `/chat`). Os containers e route handlers validam a sessão na api. Um cookie inválido é apagado pela rota `GET /session/end`, porque Server Components não podem escrever cookies.
- **Reason**: Mantém `/` estático e dá redirect `307` antes de renderizar, sem chamar a api no proxy. A doc do Next indica o proxy só para checagens otimistas.
- **Trade-off**: A regra de sessão fica em três lugares (proxy, `getValidSession()`, `/session/end`). Um cookie inválido custa um redirect a mais.
- **Scope**: web (`proxy.ts`, `features/chat/session/`, `app/session/end/route.ts`) e qualquer área autenticada futura.
- **Date**: 2026-10-14
- **Status**: active

### AD-003

- **Decision**: O hub de tempo real é um singleton em memória no processo do Next, guardado em `globalThis` (`Symbol.for('web-hook.chat-hub')`). O web roda com uma instância.
- **Reason**: É o desenho do PRD (§2.2, §12). O `globalThis` garante uma instância só entre os bundles dos route handlers e das Server Actions, e sobrevive ao HMR em dev.
- **Trade-off**: Sem escala horizontal do web; a presença em memória se perde ao reiniciar. Evolução prevista: Redis pub/sub.
- **Scope**: web (`features/chat/realtime/`).
- **Date**: 2026-10-14
- **Status**: active

### AD-004

- **Decision**: Os controllers do módulo `chat` da api usam `@SkipThrottle()`. O limite de abuso é por participante (limite de envio na F3, limite de digitação na F4), não por IP.
- **Reason**: Toda chamada ao chat chega do servidor do Next, com o mesmo IP. O `ThrottlerGuard` global (60 req/min por IP) bloquearia a sala inteira com poucos participantes.
- **Trade-off**: `POST /chat/participants` fica sem limite por IP. Aceitável no estudo; a api não é exposta à internet (só o web a chama).
- **Scope**: api (`modules/chat/controllers/`).
- **Date**: 2026-10-14
- **Status**: active

### AD-005

- **Decision**: Os webhooks são entregues por timers no processo da api, depois do commit, sem outbox. Cada entrega e cada tentativa são gravadas (`webhook_deliveries`, `webhook_delivery_attempts`). Entregas pendentes não são retomadas após reiniciar.
- **Reason**: Simples para o estudo. A reconexão com `after=<seq>` (F3) recupera mensagens perdidas.
- **Trade-off**: Um crash entre o commit e a entrega perde o evento. Evolução prevista: transactional outbox com worker.
- **Scope**: api (`modules/webhooks/`) e qualquer novo tipo de evento.
- **Date**: 2026-10-14
- **Status**: active

### AD-006

- **Decision**: A unicidade do nome entre os participantes online usa a coluna `name_key` (nome em minúsculas, NFC) com índice único parcial `WHERE left_at IS NULL`, declarado no schema com o preview feature `partialIndexes` do Prisma 7.10.
- **Reason**: O banco garante a regra sem corrida e o índice fica no `schema.prisma`, sem SQL manual que o `migrate dev` poderia tratar como drift. O Prisma não aceita índice por expressão (`lower(name)`).
- **Trade-off**: Dependência de um preview feature. Se ele mudar, a saída é SQL manual na migration.
- **Scope**: api (`prisma/schema.prisma`, `modules/chat/`).
- **Date**: 2026-10-14
- **Status**: active

## Handoff

- **Feature**: `chat-core` (F1), all tasks done (T1-T38, T34a). Phase 7 closed with `make e2e` (11 passed) and `TURBO_FORCE=true make gate` exit 0 (19/19; web 366 unit tests at 100%, 118 story tests; api 205 at 100%).
- **Next step**: feature-level validation (Verifier sub-agent) for `chat-core`.
- **Deviations in phase 7**: `proxy.ts` imports from `features/chat/routing.ts` (new proxy-safe entry) instead of `index.ts`; `SESSION_COOKIE` moved to `session/route-by-session.ts` and is re-exported by `session-cookie.ts`. See the T37 note.
- **Blockers**: none.
- **Pending (out of scope)**: `apps/web/src/lib/search-params.ts` (+ spec) has no callers; the root `ARCHITECTURE.md` still cites `examples` (lines 77, 106, 142-143); `apps/web/ARCHITECTURE.md` still describes `examples` as the reference feature; E2E messages stay in the database (no delete endpoint, D2).
- **Uncommitted files**: no git in this project.
