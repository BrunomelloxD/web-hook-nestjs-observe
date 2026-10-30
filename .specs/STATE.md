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

- **Status**: all PRD phases delivered and validated: F0 `chat-theme`, F1 `chat-core`, F2 `chat-webhooks`, F3 `chat-resilience` (PASS on iteration 3), F4 `chat-extras` (PASS on iteration 2). Each feature has a PASS `validation.md`.
- **Last check (2026-10-29)**: `TURBO_FORCE=true make gate` exit 0 (19/19) and `make e2e` 21 passed, on `next` 16.4.3 (upgraded from 16.4.0 for GHSA-p3m5-59mp-jv5r, GHSA-673q-mjm6-r5xr, GHSA-2464-fhr4-w9xw) and after the audit fixes (`body-parser` 2.4.0, `qs` 6.17.1, `fast-uri` 3.1.9, `@nestjs/*` 12.3.2 for `multer`, prisma 7.10.1, vitest 4.1.12, `undici`, `systeminformation`, `mysql2`).
- **User decisions (2026-10-29)**: the user confirmed the F3 SPEC_DEVIATIONs that changed older tests (api e2e "61 envios" as 13 × 5; web e2e p95 spacing and 60 messages as 12 × 5; F1 composer tests replaced by OPT-01). F0 T22 is done: the FigCraft Tema collection matches `globals.css`.
- **Pending (out of scope)**:
  - `npm audit` still reports 4 findings (`zod` and `deepmerge` via `shadcn`); the npm fix needs `--force` (`shadcn` 4.21.5 → 4.23.0) and the user chose to leave them.
  - Dev only: the `globalThis` ChatHub survives HMR, so a change to the hub needs `docker compose restart web`.
  - D2: messages are kept forever.
- **Blockers**: none.
- **Deploy (2026-10-30)**: Railway project `web-hook-nestjs-observe` (environment `production`) with `Postgres`, `migrate`, `api` (private only) and `web` (https://web-production-a4012.up.railway.app). A two-browser check against production passed (message delivered in ~0.8 s; 10/10 webhooks answered 204 over the private network). CI run 41069298049 passed all three jobs.
- **Branch**: `main`, tracks `origin/main`.
