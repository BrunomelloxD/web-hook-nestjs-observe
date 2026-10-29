# Tema e componentes visuais do chat (F0) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Spec**: `.specs/features/chat-theme/spec.md`
**Design**: `.specs/features/chat-theme/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found: `apps/web/ARCHITECTURE.md` §8 e §9, `apps/web/AGENTS.md`, `packages/vitest-config/src/index.ts` (100% em statements, branches, functions e lines), `apps/web/vitest.config.ts` (projects `unit` e `storybook`), `apps/web/scripts/check-conventions.mjs` (story obrigatória).

| Code Layer                                             | Required Test Type | Coverage Expectation                                                                                          | Location Pattern                       | Run Command                                                    |
| ------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `lib/` (tema, hora)                                    | unit               | Todos os branches; 1:1 com os ACs de THEME-02/03; valores inválidos do cookie                                 | `src/lib/*.spec.ts`                    | `npm test --workspace=apps/web`                                |
| `globals.css` (tokens)                                 | unit               | Cada uma das 19 variáveis nos 3 seletores comparada à tabela do design; contraste AA calculado (THEME-01 AC3) | `src/app/globals.spec.ts`              | `npm test --workspace=apps/web`                                |
| `app/` (layout)                                        | unit               | Atributos do `<html>` e o script no `<head>`                                                                  | `src/app/*.spec.tsx`                   | `npm test --workspace=apps/web`                                |
| `components/ui`, `features/chat/components`            | unit + story       | Testing Library: cada AC e edge case do componente; story por estado, a11y nos dois temas                     | `*.spec.tsx` + `*.stories.tsx` ao lado | `npm test` + `npm run test:storybook` (`--workspace=apps/web`) |
| `features/chat/chat.dictionary.ts`                     | unit               | Funções com plural/variação (1, 2, 3+)                                                                        | `src/features/chat/*.spec.ts`          | `npm test --workspace=apps/web`                                |
| Tipos, `test-fixtures.ts`                              | none               | - (build gate; os fixtures são exercitados pelos specs que os usam)                                           | -                                      | `npm run typecheck --workspace=apps/web`                       |
| Config (`.storybook/`, `vitest.config.ts`, `scripts/`) | none               | - (build gate: `test:storybook`, `lint`)                                                                      | -                                      | `make gate`                                                    |
| Fluxo no navegador real                                | e2e                | Tema aplicado antes da hidratação, persistência após recarregar                                               | `e2e/*.spec.ts`                        | `make e2e`                                                     |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use                      | Command                                                                                        |
| ---------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| Quick      | Tasks só com testes unitários    | `npm run typecheck --workspace=apps/web && npm test --workspace=apps/web`                      |
| Full       | Tasks que criam ou mudam stories | Quick + `npm run test:storybook --workspace=apps/web`                                          |
| E2E        | Tasks com Playwright             | `make e2e`                                                                                     |
| Build      | Fim de fase, CSS/config          | `make gate` (prettier, lint + convenções, typecheck, `test:cov` 100%, `next build`, Storybook) |

---

## Execution Plan

Phases run in order; tasks inside a phase run in order.

### Phase 1: Tema e tokens

```
T1 → T4
T2
T3
T5
```

### Phase 2: Storybook e componentes genéricos

```
T6 → T7 → T9
T8
```

### Phase 3: Base da feature `chat`

```
T10
T11
```

### Phase 4: Peças da conversa

```
T12 → T16
T15 → T16
T13
T14
```

### Phase 5: Telas

```
T17 → T19
T18 → T19
T20
```

### Phase 6: Verificação no navegador e documentação

```
T21
T22
```

---

## Task Breakdown

### Phase 1: Tema e tokens

#### T1: Regras do cookie de tema em `lib/theme.ts`

**What**: Criar `Theme`, `THEME_COOKIE`, `parseTheme`, `serializeThemeCookie`, `THEME_INIT_SCRIPT` e `readEffectiveTheme`.
**Where**: `apps/web/src/lib/theme.ts`
**Depends on**: None
**Reuses**: estilo de `apps/web/src/lib/env.ts` (função pura com spec ao lado)
**Requirement**: THEME-02, THEME-03 (AC8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `parseTheme` aceita só `light`/`dark`; `undefined`, `''`, `DARK`, `blue` → `null` (THEME-02 AC4)
- [x] `serializeThemeCookie('dark')` produz `theme=dark; Path=/; Max-Age=31536000; SameSite=Lax` (THEME-03 AC8)
- [x] O spec executa `THEME_INIT_SCRIPT` no jsdom: `theme=dark` → `data-theme="dark"`; `theme=light` → `"light"`; sem cookie ou inválido → sem atributo (THEME-02 AC1-3)
- [x] `readEffectiveTheme` usa `data-theme` quando existe; senão o `matchMedia` falso
- [x] Quick gate passa; 100% de cobertura do arquivo

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add theme cookie rules and init script`

**Fix round 2** (Verifier N11): `theme.spec.ts` runs `THEME_INIT_SCRIPT` with look-alike cookies (`notheme=dark`, and `xtheme=dark` + `other=1`) and expects no `data-theme`. Dropping the `(?:^|; )` anchor from the script regex fails both cases.

---

#### T2: Tokens do design em `globals.css`

**What**: Definir as 19 variáveis (15 do PRD §8.2 com os 4 ajustes AA + 4 de avatar) em `:root`, `[data-theme='dark']` e `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }`; ligar ao `@theme inline` e às variáveis do shadcn; trocar o `@custom-variant dark`; remover o bloco `.dark`.
**Where**: `apps/web/src/app/globals.css`
**Depends on**: None
**Reuses**: imports, `@layer base` e fontes atuais do `globals.css`
**Requirement**: THEME-01 (AC1-3)
**Tools**: MCP: `figcraft-app` (conferir na coleção Tema os valores e os pares `avatar/*`) · Skill: NONE

**Done when**:

- [x] `src/app/globals.spec.ts` lê o CSS e compara cada variável, nos três seletores, com a tabela do design (valores ajustados)
- [x] O mesmo spec calcula o contraste WCAG de `text/primary`, `text/secondary`, `text/muted` e `text/on-brand` sobre os fundos onde aparecem, nos dois temas, e exige ≥ 4.5:1
- [x] `next build` compila o `@custom-variant dark` com `@media` aninhado; se não compilar, aplicar a alternativa do design (utilitários com os três seletores) e registrar o desvio
- [x] Build gate passa

**Tests**: unit
**Gate**: build
**Commit**: `feat(web): add design color tokens for light and dark themes`

---

#### T3: Checagem de cor literal no `check-conventions`

**What**: Fazer o `check-conventions.mjs` falhar com hex, `rgb(`/`hsl(`/`oklch(` e classes de paleta do Tailwind em `src/features/chat/**` e `src/components/ui/{avatar,theme-toggle}*`.
**Where**: `apps/web/scripts/check-conventions.mjs`
**Depends on**: None
**Reuses**: `walk()` e o acúmulo de `errors` já existentes no script
**Requirement**: THEME-01 (AC2)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Um arquivo temporário em `src/features/chat/` com `bg-blue-500` ou `#fff` faz `npm run check:conventions --workspace=apps/web` sair com erro e apontar o arquivo; o arquivo é apagado depois
- [x] Sem violações, o script passa
- [x] Build gate passa

**Tests**: none (script fora de `src/`, fora da cobertura; validado pelo próprio lint)
**Gate**: build
**Commit**: `chore(web): forbid literal colors in chat components`

**Fix round 1** (Verifier S30): the palette check also rejects `white`/`black` with no shade (`bg-white`, `text-black`, `border-white/50`). `transparent`/`current` stay allowed: they are not palette colors. A temporary `src/features/chat/zz-probe.tsx` with `bg-white` or `text-black` made `npm run check:conventions` exit 1 and name the file; the file was deleted and the script passes again (23 files).

**Fix round 2** (Verifier P2-P10): the check parses every Tailwind v4 color utility (`bg`, `text`, `border` and `border-x/y/t/r/b/l/s/e`, `ring`, `ring-offset`, `outline`, `divide`, `shadow`, `inset-shadow`, `inset-ring`, `drop-shadow`, `fill`, `stroke`, `from`, `via`, `to`, `decoration`, `caret`, `accent`, `placeholder`), with any variant prefix and any `/opacity`. It rejects palette shades (including the v4 `mauve`/`olive`/`mist`/`taupe`), `white`/`black`, `[color:…]` and bare-word bracket values (`bg-[red]`). Hex and `rgb`/`hsl`/`oklch`/`oklab`/`lab`/`lch`/`hwb`/`color(` stay forbidden anywhere. Names declared as `--color-*` in `globals.css` are always allowed, and so are `none`/`inherit`/`initial`/`unset`/`transparent`/`currentcolor` in brackets. Probes in a temporary `src/features/chat/zz-probe.tsx`: all 33 literal cases (P2-P10 included) exit 1 and name the file. All 27 token and non-color cases pass (e.g. `bg-avatar-pink-bg`, `ring-ring/50`, `text-[15px]`, `ring-offset-2`). The file was deleted, and the real tree prints "Convenções OK (23 arquivos verificados)".

---

#### T4: Root layout aplica o tema antes da pintura

**What**: Adicionar `suppressHydrationWarning` ao `<html>` e o `<script>` com `THEME_INIT_SCRIPT` no `<head>`, sem ler cookies (AD-001).
**Where**: `apps/web/src/app/layout.tsx`
**Depends on**: T1
**Reuses**: `layout.tsx` e `layout.spec.tsx` atuais
**Requirement**: THEME-02 (AC1-3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `layout.spec.tsx` confere `lang="pt-BR"`, `suppressHydrationWarning` e o script com o conteúdo de `THEME_INIT_SCRIPT`
- [x] O layout não importa `next/headers`
- [x] Comentário de uma linha explica que o script é constante (RNF-08 trata do texto das mensagens)
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): apply saved theme before first paint`

---

#### T5: Hora dos balões em `lib/format-time.ts`

**What**: Criar `formatTime(iso)` com `pt-BR`, `HH:mm` e fuso `America/Sao_Paulo`.
**Where**: `apps/web/src/lib/format-time.ts`
**Depends on**: None
**Reuses**: —
**Requirement**: UI-01 (AC2, premissa "Hora exibida nos balões")
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `formatTime('2026-10-14T15:05:00Z')` → `12:05`, independentemente do `TZ` do processo
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add fixed-timezone time formatter`

---

### Phase 2: Storybook e componentes genéricos

#### T6: Global de tema e viewports no Storybook

**What**: Adicionar `globalTypes.theme`, `initialGlobals.theme` lido de `import.meta.env.VITE_STORYBOOK_THEME`, o decorator que aplica `data-theme` e `bg-page`, e as viewports `mobile` 390×844, `tablet` 768×1024, `desktop` 1440×900.
**Where**: `apps/web/.storybook/preview.ts`
**Depends on**: T2
**Reuses**: `preview.ts` atual (`a11y: { test: 'error' }`, `nextjs.appDirectory: false`)
**Requirement**: UI-04 (AC14)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] O toolbar mostra o tema e as três viewports
- [x] As stories existentes continuam passando
- [x] Full gate passa

**Tests**: none (config; validado pelo `test:storybook`)
**Gate**: full
**Commit**: `feat(web): add theme toolbar and viewports to Storybook`

---

#### T7: Project `storybook-dark` no Vitest

**What**: Duplicar o project `storybook` como `storybook-dark` com `define: { 'import.meta.env.VITE_STORYBOOK_THEME': '"dark"' }`, de modo que `test:storybook` rode as stories nos dois temas.
**Where**: `apps/web/vitest.config.ts`
**Depends on**: T6
**Reuses**: project `storybook` atual
**Requirement**: UI-04 (AC15)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `npm run test:storybook --workspace=apps/web` roda os dois projects e o resumo mostra as stories duas vezes
- [x] Full gate passa

**Tests**: none (config; a story sentinela da T9 prova que o `define` chega ao preview)
**Gate**: full
**Commit**: `test(web): run every story in the dark theme too`

**Deviations (approved by the user)**:

- Tailwind não era compilado no Storybook. Entrou `@tailwindcss/vite` (4.3.3) e um `viteFinal` em `.storybook/main.ts`. Arquivos extras: `apps/web/.storybook/main.ts`, `apps/web/package.json`, `package-lock.json`.
- Com o Tailwind ativo, o `--destructive` claro do shadcn (`#e7000b`) ficou abaixo de 4.5:1 sobre `bg/page`; passou a `oklch(0.505 0.213 27.518)` em `globals.css`.
- SPEC_DEVIATION: o design usava `define` em `VITE_STORYBOOK_THEME`. O `define` vazava entre os dois projects de navegador. Cada project passa o tema por `provide` (`storybookTheme`), e o setup file `.storybook/vitest.setup.ts` lê com `inject` e chama `setProjectAnnotations` com `initialGlobals: { theme }` e `parameters.expectedTheme` (tipos do módulo virtual em `.storybook/virtual-modules.d.ts`). A story sentinela da T9 compara o `data-theme` com `expectedTheme`, então prova que `storybook` fica claro e `storybook-dark` fica escuro. O `test:storybook` do `package.json` roda os dois projects.

**Fix round 1** (Verifier S11): `parameters.expectedTheme` no longer comes from `provide`. `.storybook/vitest.setup.ts` maps the project name (`server.config.name` from `vitest/browser`, without the ` (chromium)` suffix) to a fixed theme (`storybook` = light, `storybook-dark` = dark) and throws on an unknown project. Only `initialGlobals.theme` still comes from `inject`. With `storybook-dark` providing `'light'`, the T9 sentinel now fails.

---

#### T8: Componente `Avatar`

**What**: Criar `Avatar`, `initialOf`, `pickAvatarTone` (FNV-1a) e `AVATAR_TONES = ['pink', 'green']`, com `tone="brand"` e tamanhos `sm`/`md`.
**Where**: `apps/web/src/components/ui/avatar.tsx`
**Depends on**: T2
**Reuses**: `cn()`; padrão de spec e story de `components/ui/button`
**Requirement**: UI-01 (AC4)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: "érica" → "É"; "ana" → "A"; o mesmo `colorSeed` sempre dá o mesmo tom; seeds diferentes cobrem os dois tons; `tone="brand"` usa `bg-brand text-on-brand`
- [x] Story por variação (tons, `brand`, tamanhos)
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add deterministic Avatar component`

---

#### T9: Componente `ThemeToggle`

**What**: Criar `ThemeToggle({ labels })` com os dois estados no HTML (lua/"Usar tema escuro" e sol/"Usar tema claro", escondidos por CSS), clique que inverte o tema efetivo e grava o cookie, e `useLayoutEffect` que reaplica o cookie.
**Where**: `apps/web/src/components/ui/theme-toggle.client.tsx`
**Depends on**: T1, T7
**Reuses**: `Button` (`variant="ghost"`, `size="icon"`), `lucide-react` (`Moon`, `Sun`)
**Requirement**: THEME-03 (AC5-8)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: com tema efetivo claro, o clique grava `data-theme="dark"` e `document.cookie` com `theme=dark`; com escuro, o inverso; sem cookie, usa o `matchMedia` (premissa "O que o botão alterna")
- [x] Spec: os dois rótulos acessíveis existem e o visível depende do tema (classes `dark:hidden` / `hidden dark:inline-flex`)
- [x] Story com `play` sentinela confere `document.documentElement.dataset.theme` igual ao global do tema (prova o `storybook-dark`)
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add ThemeToggle component`

**Fix round 1** (Verifier S7, S9): the spec spies on the `document.cookie` setter and asserts the exact string `theme=<x>; Path=/; Max-Age=31536000; SameSite=Lax` in the light, dark and no-cookie cases (AC8). A new spec asserts `svg.lucide-moon` (and no sun) inside the `dark:hidden` state and `svg.lucide-sun` (and no moon) inside the `hidden dark:inline-flex` state (AC5/AC6). A bare `theme=<x>` cookie and swapped icons both fail the unit project.

**Fix round 2** (Verifier N16): with only look-alike cookies (`notheme=dark`, and `xtheme=dark` + `other=1`) and a light system, the mount effect leaves `<html>` without `data-theme` and the click goes to `dark`. Dropping the anchor from `COOKIE_PATTERN` fails both cases.

---

### Phase 3: Base da feature `chat`

#### T10: Tipos e fixtures da feature `chat`

**What**: Declarar à mão `ChatMessage` e `ChatParticipant` no formato do `MessageResponseDto` do PRD §6.1, e criar `makeMessage`, `makeParticipant` e `makeConversation` (mensagens dos frames).
**Where**: `apps/web/src/features/chat/chat.types.ts`
**Depends on**: None
**Reuses**: `features/examples/test-fixtures.ts` (formato `make*(overrides)`)
**Requirement**: UI-01 (AC1)
**Tools**: MCP: `figcraft-app` (textos e autores dos frames da Sala) · Skill: NONE

**Done when**:

- [x] `chat.types.ts` e `test-fixtures.ts` existem; `makeConversation()` tem Ana, Carlos, mensagens próprias e de sistema
- [x] Quick gate passa (typecheck)

**Tests**: none (tipos ficam fora da cobertura; os fixtures são exercitados pelos specs dos componentes)
**Gate**: quick
**Commit**: `feat(web): add chat types and test fixtures`

---

#### T11: Dicionário `chat.dictionary.ts`

**What**: Reunir todos os textos do chat em português: tela Entrar, Sala, `online(count)`, `typing(names)`, `system.joined(name)`, `system.left(name)`, rótulos do `ThemeToggle`, estado vazio e erros.
**Where**: `apps/web/src/features/chat/chat.dictionary.ts`
**Depends on**: None
**Reuses**: `features/examples/example.dictionary.ts`
**Requirement**: UI-03 (AC12)
**Tools**: MCP: `figcraft-app` (textos dos frames) · Skill: NONE

**Done when**:

- [x] Spec: `online(1)` → "1 pessoa online"; `online(3)` → "3 pessoas online"
- [x] Spec: `typing(['Ana'])` → "Ana está digitando…"; 2 nomes → "Ana e Carlos estão digitando…"; 3+ → "Várias pessoas estão digitando…"
- [x] Spec: `system.joined('Ana')` → "Ana entrou no chat"; `system.left('Ana')` → "Ana saiu do chat"
- [x] Quick gate passa

**Tests**: unit
**Gate**: quick
**Commit**: `feat(web): add chat dictionary`

---

### Phase 4: Peças da conversa

#### T12: Componente `SystemMessage`

**What**: Renderizar o texto centralizado, `text-fg-muted`, `text-sm`.
**Where**: `apps/web/src/features/chat/components/system-message.tsx`
**Depends on**: T11
**Reuses**: —
**Requirement**: UI-01 (AC1, AC3)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec confere texto e classes; story "Mensagem de sistema"
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add SystemMessage component`

---

#### T13: Componente `OnlineBadge`

**What**: Ponto `bg-online` + `t.online(count)`.
**Where**: `apps/web/src/features/chat/components/online-badge.tsx`
**Depends on**: T11
**Reuses**: —
**Requirement**: UI-01 (AC1)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: 1 → "1 pessoa online"; 5 → "5 pessoas online"; stories para 1 e N
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add OnlineBadge component`

---

#### T14: Componente `TypingIndicator`

**What**: Renderizar `t.typing(names)`; lista vazia não renderiza nada.
**Where**: `apps/web/src/features/chat/components/typing-indicator.tsx`
**Depends on**: T11
**Reuses**: —
**Requirement**: UI-01 (AC1), UI-04 (AC13 "digitando")
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `[]` → nada no DOM; 1, 2 e 3 nomes → textos do dicionário
- [x] Stories: 1, 2 e 3+ pessoas
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add TypingIndicator component`

---

#### T15: Componente `MessageBubble`

**What**: Mensagem dos outros à esquerda (avatar, nome, hora, `bg-surface`) e própria à direita ("Você", hora, `bg-brand text-on-brand`), conteúdo como texto com quebra de palavras longas; props `status` e `onRetry` já previstas.
**Where**: `apps/web/src/features/chat/components/message-bubble.tsx`
**Depends on**: T5, T8, T10, T11
**Reuses**: `Avatar`, `formatTime`
**Requirement**: UI-01 (AC2, AC5)
**Tools**: MCP: `figcraft-app` (comparar com o frame da Sala) · Skill: NONE

**Done when**:

- [x] Spec: própria vs. outros (lado, rótulo "Você", classes de cor); hora formatada
- [x] Spec: conteúdo `<script>alert(1)</script>` aparece como texto literal e nenhum `<script>` entra no DOM
- [x] Spec: palavra de 1000 caracteres usa `break-words [overflow-wrap:anywhere]`
- [x] Stories: própria, dos outros, palavra longa, `sending`, `failed` com "Tentar de novo"
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add MessageBubble component`

**Fix round 2** (Verifier N5): a spec renders `ana`, whose id and name give different `pickAvatarTone` results (it asserts this as a precondition). It then expects the avatar to have the classes for `pickAvatarTone(author.id)`. Seeding with `author.name` fails. `ChatHeader` uses `tone="brand"`, so its seed does not choose a color and needs no test.

---

#### T16: Componente `MessageList`

**What**: `<ol aria-live="polite">` que escolhe `MessageBubble` (comparando `author.id` com `meId`) ou `SystemMessage` (texto do dicionário para `JOINED`/`LEFT`), estado vazio e `footer`.
**Where**: `apps/web/src/features/chat/components/message-list.client.tsx`
**Depends on**: T12, T15
**Reuses**: `makeConversation()`
**Requirement**: UI-01 (AC1), UI-03 (AC11), UI-04 (AC13)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: `aria-live="polite"`; vazio → texto `t.room.empty`; `JOINED` → "{nome} entrou no chat"; `LEFT` → "{nome} saiu do chat"; próprias vs. outros pelo `meId`
- [x] Stories: vazia, longa (rolável), próprias e dos outros, mensagem de sistema
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add MessageList component`

---

### Phase 5: Telas

#### T17: Componente `Composer`

**What**: Textarea "Escreva uma mensagem…" + botão "Enviar"; props `onSend`, `pending`, `error`, `notice`.
**Where**: `apps/web/src/features/chat/components/composer.client.tsx`
**Depends on**: T11
**Reuses**: `Button`, `Label`, `lucide-react` (`Send`)
**Requirement**: UI-01 (AC1), UI-04 (AC13 "erro de envio")
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: clique em "Enviar" chama `onSend` com o texto; `error` e `notice` aparecem acima do campo; `pending` desabilita o botão
- [x] Stories: padrão, enviando, erro de envio, com aviso
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add Composer component`

---

#### T18: Componente `ChatHeader`

**What**: "Sala geral", `OnlineBadge`, `Avatar tone="brand"`, nome (`hidden md:inline`), `ThemeToggle` e `<form action={leaveAction}>` com "Sair".
**Where**: `apps/web/src/features/chat/components/chat-header.tsx`
**Depends on**: T8, T9, T13
**Reuses**: `Button`, `lucide-react` (`LogOut`)
**Requirement**: UI-01 (AC1), UI-02 (AC6)
**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Spec: título, contagem, nome com `hidden md:inline`, botão "Sair" dentro de um `form` ligado a `leaveAction`
- [x] Stories nas viewports `mobile` e `desktop`
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add ChatHeader component`

**Fix round 3** (Verifier M24, M25, M28): `chat.dictionary.spec.ts` asserts `t.theme` equals `{ toDark: 'Usar tema escuro', toLight: 'Usar tema claro' }`, and `chat-header.spec.tsx` finds both labels by literal text and checks the moon is in the `dark:hidden` span and the sun in the `hidden dark:inline-flex` span. Swapping the labels in the header or changing the dictionary text fails a test.

---

#### T19: Layout da Sala `ChatRoomView` e stories das telas

**What**: `h-dvh flex flex-col`, cabeçalho e composer fixos, só a lista rola, coluna `xl:max-w-[800px] xl:mx-auto`; stories `Sala · Faixa · Tema` (3 × 2).
**Where**: `apps/web/src/features/chat/components/chat-room-view.tsx`
**Depends on**: T16, T17, T18
**Reuses**: `makeConversation()`
**Requirement**: UI-02 (AC7, AC10), UI-04 (AC14)
**Tools**: MCP: `figcraft-app` (screenshot dos 6 frames da Sala para comparar) · Skill: NONE

**Done when**:

- [x] Spec: slots `header`, `list` e `composer` renderizados; classes de layout fixo e da coluna de 800 px
- [x] 6 stories com `globals: { theme, viewport }`, comparadas aos frames do FigCraft
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add chat room layout and screen stories`

---

#### T20: Componente `JoinForm` e stories da tela Entrar

**What**: Cartão completo (logo, título, subtítulo, campo "Seu nome", "Entrar no chat", ajuda) com `useActionState`, erro do campo com `aria-describedby`, `w-full md:w-[420px]`; stories `Entrar · Faixa · Tema` (3 × 2) e "nome em uso".
**Where**: `apps/web/src/features/chat/components/join-form.client.tsx`
**Depends on**: T10, T11
**Reuses**: padrão `features/examples/components/example-form.client.tsx`; `Input`, `Label`, `Button`
**Requirement**: UI-01 (AC1), UI-02 (AC8-9), UI-04 (AC13-14)
**Tools**: MCP: `figcraft-app` (frames da tela Entrar) · Skill: NONE

**Done when**:

- [x] Spec: um campo rotulado "Seu nome" e o botão "Entrar no chat"; estado com erro mostra a mensagem ligada ao campo por `aria-describedby`
- [x] Story "nome em uso" com `action: fn()` que devolve o estado de erro; 6 stories das telas
- [x] Full gate passa

**Tests**: unit
**Gate**: full
**Commit**: `feat(web): add JoinForm component and screen stories`

---

### Phase 6: Verificação no navegador e documentação

#### T21: E2E do tema sem piscar

**What**: Playwright abre `/` e lê `document.documentElement.dataset.theme` num listener de `DOMContentLoaded` registrado com `addInitScript`: cookie `theme=dark` → `"dark"`; `theme=light` → `"light"`; sem cookie ou `theme=blue` → sem atributo.
**Where**: `apps/web/e2e/theme.spec.ts`
**Depends on**: T4
**Reuses**: `playwright.config.ts`
**Requirement**: THEME-02 (AC1-4)
**Tools**: MCP: NONE · Skill: `run` (se precisar subir a stack para depurar)

**Done when**:

- [x] Os quatro cenários passam e só dependem de `/` (vale depois que a F1 trocar a página)
- [x] O clique no `ThemeToggle` com recarga fica no E2E da F1 (T38 de `chat-core`), quando o botão aparece numa página real; na F0 ele é coberto pelo spec e pela story da T9
- [x] `make e2e` passa

**Tests**: e2e
**Gate**: e2e
**Commit**: `test(web): cover flash-free theme in e2e`

---

#### T22: PRD e FigCraft com os valores ajustados

**What**: Atualizar o PRD §8.2 com os 4 valores AA e o caminho `.specs/figcraft/index.figcraft`; aplicar os mesmos valores na coleção Tema do FigCraft.
**Where**: `.specs/prd.md`
**Depends on**: T2
**Reuses**: tabela "Valores dos tokens" do design
**Requirement**: THEME-01 (AC3)
**Tools**: MCP: `figcraft-app` · Skill: NONE

**Done when**:

- [x] PRD e FigCraft mostram os mesmos valores do `globals.css`
- [x] Build gate passa (`prettier --check`)

**Resolved 2026-10-29 (FigCraft)**: com a aprovação do usuário, os 4 valores foram gravados na coleção Tema via MCP (`variable.set`) e o arquivo foi salvo. Uma exportação CSS da coleção bate com o `globals.css` em todas as 17 cores, nos dois temas.

**Blocked before (FigCraft)**: o PRD já tinha os 4 valores AA e o caminho `.specs/figcraft/index.figcraft`; ganhou a tabela dos pares `avatar/*`. A coleção Tema do FigCraft ainda tem os valores antigos. A escrita via MCP (`variable.set`) foi negada pelo classificador de permissões. As 3 escritas que passaram foram desfeitas, e o arquivo em disco não mudou. Falta aplicar na coleção Tema: `text/secondary` Light `#687080`, `text/muted` Light `#68707F` e Dark `#7C8597`, `brand/default` Dark `#5B5EF0`. Depois, salvar o arquivo.

**Findings from the frame comparison (T19/T20)**:

- Spec-precision gap: os frames mostram hora nas mensagens de sistema ("Ana entrou no chat · 14:02"). O spec e o design dão ao `SystemMessage` só `text`. Não foi adicionada.
- Diferenças visuais pequenas em componentes já fechados: no frame, os balões dos outros têm borda `border/default` (`MessageBubble` não tem). O `ThemeToggle` do frame tem fundo `bg/surface` e borda com 36-40 px (o componente é `ghost` 32 px). O cabeçalho da Sala no desktop tem padding horizontal de 32 px (o `ChatHeader` usa 16 px em todas as faixas).
- Na T17 e na T18, o `Send` e o `LogOut` do lucide (listados em Reuses) não entraram, porque os frames mostram "Enviar" e "Sair" só com texto.

**Tests**: none (documentação)
**Gate**: build
**Commit**: `docs: sync PRD and design file with AA-adjusted tokens`

---

## Validation

### Task Granularity Check

| Task            | Scope                                     | Status                                             |
| --------------- | ----------------------------------------- | -------------------------------------------------- |
| T1, T5          | 1 módulo de funções puras                 | ✅                                                 |
| T2              | 1 arquivo CSS (tokens)                    | ✅                                                 |
| T3, T6, T7      | 1 arquivo de config                       | ✅                                                 |
| T4              | 1 layout                                  | ✅                                                 |
| T8, T9, T12-T20 | 1 componente (+ spec e story ao lado)     | ✅                                                 |
| T10             | tipos + fixtures                          | ⚠️ 2 arquivos coesos (dados de exemplo da feature) |
| T11             | 1 dicionário                              | ✅                                                 |
| T21             | 1 spec E2E                                | ✅                                                 |
| T22             | 1 documento (+ arquivo de design via MCP) | ✅                                                 |

### Diagram-Definition Cross-Check

| Task           | Depends On (task body)              | Diagram Shows               | Status |
| -------------- | ----------------------------------- | --------------------------- | ------ |
| T1, T2, T3, T5 | None                                | sem setas de entrada        | ✅     |
| T4             | T1                                  | T1 → T4                     | ✅     |
| T6             | T2 (fase 1)                         | — (dependência entre fases) | ✅     |
| T7             | T6                                  | T6 → T7                     | ✅     |
| T8             | T2 (fase 1)                         | —                           | ✅     |
| T9             | T1 (fase 1), T7                     | T7 → T9                     | ✅     |
| T10, T11       | None                                | —                           | ✅     |
| T12, T13, T14  | T11 (fase 3)                        | —                           | ✅     |
| T15            | T5, T8, T10, T11 (fases anteriores) | —                           | ✅     |
| T16            | T12, T15                            | T12 → T16, T15 → T16        | ✅     |
| T17            | T11 (fase 3)                        | —                           | ✅     |
| T18            | T8, T9, T13 (fases anteriores)      | —                           | ✅     |
| T19            | T16 (fase 4), T17, T18              | T17 → T19, T18 → T19        | ✅     |
| T20            | T10, T11 (fase 3)                   | —                           | ✅     |
| T21            | T4 (fase 1)                         | —                           | ✅     |
| T22            | T2 (fase 1)                         | —                           | ✅     |

### Test Co-location Validation

| Task            | Code Layer              | Matrix Requires | Task Says                   | Status |
| --------------- | ----------------------- | --------------- | --------------------------- | ------ |
| T1, T5          | `lib/`                  | unit            | unit                        | ✅     |
| T2              | `globals.css`           | unit            | unit                        | ✅     |
| T3              | `scripts/`              | none            | none                        | ✅     |
| T4              | `app/`                  | unit            | unit                        | ✅     |
| T6, T7          | config Storybook/Vitest | none            | none                        | ✅     |
| T8, T9, T12-T20 | componentes             | unit + story    | unit (+ story no Done when) | ✅     |
| T10             | tipos, fixtures         | none            | none                        | ✅     |
| T11             | dicionário              | unit            | unit                        | ✅     |
| T21             | fluxo no navegador      | e2e             | e2e                         | ✅     |
| T22             | documentação            | none            | none                        | ✅     |
