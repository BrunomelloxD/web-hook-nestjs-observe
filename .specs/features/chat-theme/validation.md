# chat-theme (F0) - verification report

**Result**: PASS ✅. The round-3 fix holds: M24, M25 and M28 are now killed by unit tests with literal strings. Every earlier fix still holds, and all 15 fresh mutants on spec-defined behavior are killed. T22's FigCraft sync is an open user action, outside this code verdict.

**Iteration**: 4 (after fix round 3)
**Date**: 2026-10-14
**Spec**: `.specs/features/chat-theme/spec.md`
**Diff range**: snapshot `chat-theme-base` → working tree (2026-10-14, no git)
**Verifier**: independent sub-agent (author ≠ verifier). It did not edit code or tests. Mutations ran only in a scratch copy, which was deleted afterwards.

Diff surface: 55 files under `apps/web` (src, e2e, `.storybook`, `scripts`, `vitest.config.ts`, `package.json`), plus `package-lock.json`, `.prettierignore` (entries for the two script-rendered lessons files), `.specs/prd.md`, `.specs/STATE.md`, the lessons files and the feature docs. Ignored: build outputs (`apps/api/dist`, `*.tsbuildinfo`) and prettier-only changes in the other features' `design.md` files. Round 3 changed only `apps/web/src/features/chat/chat.dictionary.spec.ts` (`:19-24`) and `apps/web/src/features/chat/components/chat-header.spec.tsx` (`:42-55`). No production code changed.

---

## Task Completion

| Task   | Status                   | Notes                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1-T21 | ✅ Done                  | Every Done-when box is checked. The fix round 3 note on T18 (tasks.md:509) matches the code: `chat.dictionary.spec.ts:20-23` and `chat-header.spec.tsx:46-54`                                                                                                                           |
| T22    | ⚠️ Pending a user action | The PRD has the 4 AA values, the `.specs/figcraft/index.figcraft` path and the `avatar/*` table. The FigCraft Tema collection still has the old values because the permission system denied the write. This is not an implementation defect, and the Verifier did not write to FigCraft |

---

## Spec-Anchored Acceptance Criteria

### P1: Tokens de cor (THEME-01)

| AC                                                                                         | Spec-defined outcome                                                                                                 | `file:line` + assertion                                                                                                                                                                                                                                                                                            | Result  |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| T-AC1 15 tokens × light/dark × 3 selectors                                                 | Light in `:root`; Dark in `[data-theme="dark"]` and in `@media (prefers-color-scheme: dark) :root:not([data-theme])` | `apps/web/src/app/globals.spec.ts:58` `expect(SELECTORS[':root'][name]).toBe(expected.light)`; `:62` `.toBe(expected.dark)`; `:66-70` media block `.toBe(expected.dark)`. The table at `:7-27` matches PRD §8.2 with the 4 AA adjustments. V11 (dark brand) and V14 (media-block muted) are killed                 | ✅ PASS |
| T-AC2 no literal color in chat components                                                  | No hex, rgb or Tailwind palette class                                                                                | Direct grep of `src/features/chat/**`, `avatar*` and `theme-toggle*` (non-spec) for hex, color functions, `style=`, `white`/`black` and palette shades finds nothing. Guard: `apps/web/scripts/check-conventions.mjs:57-148`, run by `npm run lint`. S30 (3 probes) and P2-P10 are killed; allow-side probe passes | ✅ PASS |
| T-AC3 AA for text/primary, text/secondary, text/on-brand on their backgrounds, both themes | ≥ 4.5:1                                                                                                              | `apps/web/src/app/globals.spec.ts:129` `expect(contrast(vars[fg]!, vars[bg]!)).toBeGreaterThanOrEqual(4.5)` over the pairs at `:118-123`, in both themes (V11 fails `--text-on-brand sobre --brand-default`). a11y addon `test: 'error'` (`apps/web/.storybook/preview.ts:60`)                                     | ✅ PASS |

### P1: Tema sem piscar (THEME-02 / THEME-03)

| AC                                                                                  | Spec-defined outcome                                | `file:line` + assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Result  |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| D-AC1 no `theme` cookie → no `data-theme`                                           | attribute absent                                    | `apps/web/src/lib/theme.spec.ts:76` `expect(html.hasAttribute('data-theme')).toBe(false)`; look-alikes `:90-99` `toBe(false)`; `apps/web/src/components/ui/theme-toggle.client.spec.tsx:124` `toBe(false)`; real browser `apps/web/e2e/theme.spec.ts:44` `toBeNull()` at DOMContentLoaded. N11, N16 killed                                                                                                                                                                                                | ✅ PASS |
| D-AC2 `theme=dark` → `data-theme="dark"` before first paint, inline `<head>` script | `"dark"`                                            | `apps/web/src/lib/theme.spec.ts:70` `expect(html.getAttribute('data-theme')).toBe(value)`; `apps/web/src/app/layout.spec.tsx:44-46` script in `<head>`, `__html` `toBe(THEME_INIT_SCRIPT)`; `:35` `suppressHydrationWarning` `toBe(true)`; `apps/web/e2e/theme.spec.ts:32` `toBe('dark')` at DOMContentLoaded                                                                                                                                                                                             | ✅ PASS |
| D-AC3 `theme=light` → `"light"`                                                     | `"light"`                                           | `apps/web/src/lib/theme.spec.ts:70` (`light` case); `apps/web/e2e/theme.spec.ts:40` `toBe('light')`. V4 (script accepts only `dark`) killed                                                                                                                                                                                                                                                                                                                                                               | ✅ PASS |
| D-AC4 invalid value = absent                                                        | no attribute                                        | `apps/web/src/lib/theme.spec.ts:86` (`blue`, `DARK`, `''`) `toBe(false)`; `:52` `parseTheme(value)).toBeNull()`; `apps/web/e2e/theme.spec.ts:50` `toBeNull()`; `theme-toggle.client.spec.tsx:137` `toBe(false)`. V1 (case-insensitive parse) killed                                                                                                                                                                                                                                                       | ✅ PASS |
| D-AC5 light → moon icon + label **"Usar tema escuro"**                              | moon; that exact label                              | Shipped label: `apps/web/src/features/chat/chat.dictionary.spec.ts:20-23` `expect(t.theme).toEqual({ toDark: 'Usar tema escuro', toLight: 'Usar tema claro' })`. Wiring: `apps/web/src/features/chat/components/chat-header.spec.tsx:46` `getByText('Usar tema escuro').parentElement`, `:47` `toHaveClass('dark:hidden')`, `:48` `querySelector('svg.lucide-moon')).not.toBeNull()`, `:49` sun `toBeNull()`. Component: `theme-toggle.client.spec.tsx:92`, `:102-103`. M24, M25, V7, V12, V13, S9 killed | ✅ PASS |
| D-AC6 dark → sun icon + label **"Usar tema claro"**                                 | sun; that exact label                               | `chat.dictionary.spec.ts:20-23` (`toLight`); `chat-header.spec.tsx:51` `getByText('Usar tema claro').parentElement`, `:52` `toHaveClass('hidden', 'dark:inline-flex')`, `:53` `svg.lucide-sun` `not.toBeNull()`, `:54` moon `toBeNull()`; `theme-toggle.client.spec.tsx:94`, `:104-105`. M24, M28, V12, V13, S9b killed                                                                                                                                                                                   | ✅ PASS |
| D-AC7 toggle flips `data-theme` to the opposite of the effective theme, no reload   | opposite theme                                      | `theme-toggle.client.spec.tsx:45` `toBe('dark')`, `:60` `toBe('light')`, `:79` with no cookie, the opposite of `matchMedia`; `apps/web/src/lib/theme.spec.ts:122` `toHaveBeenCalledWith('(prefers-color-scheme: dark)')`. V5 (no apply) and V6 (inverted query) killed                                                                                                                                                                                                                                    | ✅ PASS |
| D-AC8 toggle writes cookie `theme` with `Path=/`, `SameSite=Lax`, 1 year            | `theme=<x>; Path=/; Max-Age=31536000; SameSite=Lax` | `theme-toggle.client.spec.tsx:47`, `:62`, `:81` `expect(cookieWrites).toHaveBeenCalledExactlyOnceWith(\`theme=<x>; ${COOKIE_ATTRIBUTES}\`)`with`COOKIE_ATTRIBUTES`at`:20`; `apps/web/src/lib/theme.spec.ts:58-60`. S7, V2 (`Strict`), V3 (`Path=/chat`) killed                                                                                                                                                                                                                                            | ✅ PASS |

### P1: Componentes (UI-01..UI-04)

| AC                                                                                                                | Spec-defined outcome                         | `file:line` + assertion                                                                                                                                                                                                                                                                        | Result               |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| C-AC1 9 components, data by props only                                                                            | presence + props                             | One spec per component (`apps/web/src/components/ui/avatar.spec.tsx:33`, `apps/web/src/features/chat/components/*.spec.tsx`). By inspection: no fetch or context; actions arrive as props (`chat-header.tsx:13`, `join-form.client.tsx`)                                                       | ✅ PASS              |
| C-AC2 others left (avatar, name, time, `bg/surface`); own right ("Você", time, `brand/default` + `text/on-brand`) | classes, labels                              | `message-bubble.spec.tsx:20` `toHaveClass('justify-start')`, `:21` avatar, `:23-26` `'14:05'` + `datetime`, `:27` `toHaveClass('bg-surface','text-fg')`; `:54` `justify-end`, `:55` `'Você'` (literal), `:59` `toHaveClass('bg-brand','text-on-brand')`. V8 (own bubble `bg-surface`) killed   | ✅ PASS              |
| C-AC3 SystemMessage centered, `text/muted`                                                                        | `text-center`, `text-fg-muted`               | `system-message.spec.tsx:10` `toHaveClass('text-center','text-sm','text-fg-muted')`                                                                                                                                                                                                            | ✅ PASS              |
| C-AC4 Avatar uppercase initial, `avatar/*` pair chosen deterministically from the `id`                            | initial; FNV-1a pair of the `id`             | `avatar.spec.tsx:11` `initialOf(name)).toBe(initial)`; `:22-23` FNV-1a; `:48` `toHaveClass(bg, fg)`; call site `message-bubble.spec.tsx:34` precondition, `:39-42` `toHaveClass(\`bg-avatar-${idTone}-bg\`, …)`. N5 killed                                                                     | ✅ PASS              |
| C-AC5 text only, no `dangerouslySetInnerHTML`, long words wrap                                                    | literal text; wrap classes                   | `message-bubble.spec.tsx:68` `toHaveTextContent(content)`, `:69` `querySelector('script')).toBeNull()`, `:76-79` `toHaveClass('break-words','[overflow-wrap:anywhere]')`                                                                                                                       | ✅ PASS              |
| C-AC6 < 768 px header shows only the avatar                                                                       | name `hidden md:inline`                      | `chat-header.spec.tsx:28` `toHaveClass('hidden','md:inline')`; `:27` avatar `bg-brand`. V9 (`sm:inline`) killed                                                                                                                                                                                | ✅ PASS              |
| C-AC7 ≥ 1280 px column 800 px centered                                                                            | `xl:max-w-[800px] xl:mx-auto` (xl = 1280 px) | `chat-room-view.spec.tsx:53-60` `toHaveClass('xl:mx-auto','xl:max-w-[800px]')`                                                                                                                                                                                                                 | ✅ PASS              |
| C-AC8 ≥ 768 px Entrar card 420 px centered                                                                        | `md:w-[420px]`                               | `join-form.client.spec.tsx:43` `toHaveClass('w-full','md:w-[420px]')`. V10 (`lg:`) killed. The page owns the centering (spec-precision gap 4)                                                                                                                                                  | ✅ PASS              |
| C-AC9 < 768 px card full width                                                                                    | `w-full`                                     | `join-form.client.spec.tsx:43`                                                                                                                                                                                                                                                                 | ✅ PASS              |
| C-AC10 fixed header, fixed composer, only the list scrolls                                                        | layout classes                               | `chat-room-view.spec.tsx:34-36` `h-dvh flex-col`, `shrink-0`; `:44-47` `overflow-y-auto` only on `main`; story `message-list.client.stories.tsx:51` `scrollHeight > clientHeight`                                                                                                              | ✅ PASS              |
| C-AC11 MessageList `aria-live="polite"`                                                                           | attribute                                    | `message-list.client.spec.tsx:11` `toHaveAttribute('aria-live','polite')`                                                                                                                                                                                                                      | ✅ PASS              |
| C-AC12 all chat text in `chat.dictionary.ts`, pt-BR                                                               | dictionary                                   | `chat.dictionary.spec.ts:8`, `:16`, `:20-23`, `:27-28`. By inspection, every component reads `t.*`. No automated guard against an inline string in a component                                                                                                                                 | ✅ PASS (inspection) |
| C-AC13 stories: empty, long, own + others, system, typing, send error, name taken                                 | 7 states                                     | `message-list.client.stories.tsx:45` Vazia, `:46` Longa, `:54` PropriasEDosOutros, `:63` MensagemDeSistema (`:72`), `:75` ComDigitando; `composer.client.stories.tsx:36-40` ErroDeEnvio; `join-form.client.stories.tsx:33` NomeEmUso                                                           | ✅ PASS              |
| C-AC14 every story viewable in light/dark and mobile/tablet/desktop                                               | theme global + 3 viewports                   | `apps/web/.storybook/preview.ts:6-18` theme global, `:25-30` decorator, `:41-57` 390×844 / 768×1024 / 1440×900                                                                                                                                                                                 | ✅ PASS              |
| C-AC15 a11y addon passes on every chat story, in both themes                                                      | a11y error = fail; 2 projects, 2 themes      | Gate: `test:storybook` 36 files (18 + 18), 132 tests, 0 failed. Sentinel `theme-toggle.client.stories.tsx:20` `expect(document.documentElement.dataset['theme']).toBe(expected)`, `expected` fixed by project name (`.storybook/vitest.setup.ts:16-26`). S11 killed (`storybook-dark` Default) | ✅ PASS              |

### Edge cases

- [x] "érica" → "É": `apps/web/src/components/ui/avatar.spec.tsx:6-7` (also the combining-mark form)
- [x] A 1000-character word wraps: `message-bubble.spec.tsx:76-79`; story `PalavraLonga`
- [x] `<script>` shows as literal text: `message-bubble.spec.tsx:68-69`

**Status**: ✅ All 26 ACs and 3 edge cases match the spec outcome. ⚠️ Spec-precision gaps are listed below.

---

## Spec-Precision Gaps

1. **SystemMessage time.** The FigCraft frames show "Ana entrou no chat · 14:02". The spec (UI-01 AC3) and the design give `SystemMessage` only `text`. The implementation follows the spec, and the spec should decide.
2. **Empty-state copy.** UI-04 AC13 requires the state but not its text. The dictionary has "Nenhuma mensagem ainda. Diga oi!" (`apps/web/src/features/chat/chat.dictionary.ts:15`), asserted via `t.room.empty` (`message-list.client.spec.tsx:18`).
3. **`text/muted` placeholder on `bg/subtle`.** Dark `#7C8597` on `#1C2438` = 4.16:1 (light 4.77:1). THEME-01 AC3 covers only primary, secondary and on-brand, and axe does not check placeholders. The spec should say whether placeholders must meet AA.
4. **"Centralizado" for the Entrar card (C-AC8).** `JoinForm` sets only its width; the story decorator centers it. The spec does not say which component owns the centering (the F1 page).
5. **Visual differences from the frames** (author's notes in tasks.md T22): a border on others' bubbles, the ThemeToggle style, and 32 px header padding on desktop. No AC covers them.

---

## Discrimination Sensor

Scratch: an rsync copy of the repo (no build outputs) with every `node_modules` symlinked from the real tree. Only in the scratch, `server.fs.strict=false` was added to `apps/web/vitest.config.ts`. Scratch baseline: unit 231 passed, Storybook 132 passed, `check-conventions` OK (23 files). A harness applied each mutant, ran the tests, and restored the file from a backup. Lint probes went into a temporary `src/features/chat/zz-probe.tsx`, deleted after each probe. Storybook runs had a 600 s limit; none hung. The scratch was then deleted.

Isolation: SHA-256 of 305 real-tree files (everything outside `node_modules`, `.next`, `.turbo`, `coverage`, `storybook-static`, test reports, `dist` and `*.tsbuildinfo`) was taken before the gate and after the sensor. The two lists are identical.

### Earlier mutants re-run

| #      | Mutation                                                                                                                                                              | File:line                                                     | Tests run         | Killed?                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------- | ------------------------------------------------- |
| S7     | Toggle writes a bare `theme=<x>` cookie                                                                                                                               | `apps/web/src/components/ui/theme-toggle.client.tsx:38`       | unit              | ✅ Killed                                         |
| S9     | Moon swapped for Sun in the light state                                                                                                                               | `apps/web/src/components/ui/theme-toggle.client.tsx:45`       | unit              | ✅ Killed (toggle spec + header spec)             |
| S9b    | Sun swapped for Moon in the dark state                                                                                                                                | `apps/web/src/components/ui/theme-toggle.client.tsx:49`       | unit              | ✅ Killed (toggle spec + header spec)             |
| S11    | `storybook-dark` provides `'light'`                                                                                                                                   | `apps/web/vitest.config.ts:55`                                | storybook ×2      | ✅ Killed (1 failed: `storybook-dark` Default)    |
| S30    | `bg-white`, `text-black`, `border-white/50`                                                                                                                           | `apps/web/scripts/check-conventions.mjs`                      | check-conventions | ✅ Killed (3 probes, file named)                  |
| N5     | Bubble avatar seeded with `author.name`                                                                                                                               | `apps/web/src/features/chat/components/message-bubble.tsx:31` | unit              | ✅ Killed                                         |
| N11    | Init-script regex loses its `(?:^\|; )` anchor                                                                                                                        | `apps/web/src/lib/theme.ts:17`                                | unit              | ✅ Killed (2)                                     |
| N16    | Toggle `COOKIE_PATTERN` loses its anchor                                                                                                                              | `apps/web/src/components/ui/theme-toggle.client.tsx:19`       | unit              | ✅ Killed (2)                                     |
| P2-P10 | `outline-gray-500`, `divide-gray-200`, `shadow-black/10`, `via-blue-500`, `decoration-red-500`, `caret-pink-500`, `accent-blue-600`, `bg-[red]`, `text-[color:white]` | `apps/web/scripts/check-conventions.mjs`                      | check-conventions | ✅ Killed (9 probes)                              |
| M24    | **ChatHeader passes swapped labels to ThemeToggle**                                                                                                                   | `apps/web/src/features/chat/components/chat-header.tsx:39`    | unit              | ✅ Killed (`chat-header.spec.tsx:42-55`)          |
| M25    | **Dictionary `toDark` "Usar tema escuro" → "Tema escuro"**                                                                                                            | `apps/web/src/features/chat/chat.dictionary.ts:29`            | unit              | ✅ Killed (2: dictionary spec, header spec `:46`) |
| M28    | **Dictionary `toLight` "Usar tema claro" → "Tema claro"**                                                                                                             | `apps/web/src/features/chat/chat.dictionary.ts:30`            | unit              | ✅ Killed (2: dictionary spec, header spec `:51`) |
| Allow  | `bg-brand text-fg ring-ring/50 text-[15px] ring-offset-2 border-line bg-avatar-pink-bg`                                                                               | -                                                             | check-conventions | ✅ Passes, as it should                           |

### Fresh mutants (spec-defined behavior)

| #   | Mutation                                                                   | File:line                                                     | AC      | Killed?                               |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ------- | ------------------------------------- |
| V1  | `parseTheme` lower-cases the value (`DARK` accepted)                       | `apps/web/src/lib/theme.ts:9`                                 | D-AC4   | ✅ Killed (`"DARK" vira null`)        |
| V2  | Cookie `SameSite=Lax` → `SameSite=Strict`                                  | `apps/web/src/lib/theme.ts:13`                                | D-AC8   | ✅ Killed                             |
| V3  | Cookie `Path=/` → `Path=/chat`                                             | `apps/web/src/lib/theme.ts:13`                                | D-AC8   | ✅ Killed                             |
| V4  | Init script applies only `dark`                                            | `apps/web/src/lib/theme.ts:17`                                | D-AC3   | ✅ Killed                             |
| V5  | Toggle click no longer sets `data-theme`                                   | `apps/web/src/components/ui/theme-toggle.client.tsx:37`       | D-AC7   | ✅ Killed                             |
| V6  | `readEffectiveTheme` queries `prefers-color-scheme: light`                 | `apps/web/src/lib/theme.ts:26`                                | D-AC7   | ✅ Killed                             |
| V7  | Header passes `toDark` for both labels                                     | `apps/web/src/features/chat/components/chat-header.tsx:39`    | D-AC6   | ✅ Killed                             |
| V8  | Own bubble `bg-brand` → `bg-surface`                                       | `apps/web/src/features/chat/components/message-bubble.tsx:55` | C-AC2   | ✅ Killed                             |
| V9  | Header name `md:inline` → `sm:inline`                                      | `apps/web/src/features/chat/components/chat-header.tsx:35`    | C-AC6   | ✅ Killed                             |
| V10 | Entrar card `md:w-[420px]` → `lg:w-[420px]`                                | `apps/web/src/features/chat/components/join-form.client.tsx`  | C-AC8   | ✅ Killed                             |
| V11 | Dark `--brand-default` `#5b5ef0` → original `#6366f1`                      | `apps/web/src/app/globals.css:153`                            | T-AC1/3 | ✅ Killed (value + on-brand contrast) |
| V12 | Dark-state span always visible (`hidden dark:inline-flex` → `inline-flex`) | `apps/web/src/components/ui/theme-toggle.client.tsx:48`       | D-AC6   | ✅ Killed                             |
| V13 | Dictionary labels swapped                                                  | `apps/web/src/features/chat/chat.dictionary.ts:29-30`         | D-AC5/6 | ✅ Killed (dictionary + header specs) |
| V14 | Media-block dark `--text-muted` `#7c8597` → `#6b7280`                      | `apps/web/src/app/globals.css:175`                            | T-AC1   | ✅ Killed                             |

A first V11 attempt inserted an extra declaration at the top of the dark block. The block's later `--brand-default` overrode it, so it was an equivalent mutant (no behavior change) and was discarded, not counted. The redefined V11 replaces the value itself.

**Sensor depth**: expanded (theme before paint, cookie, tokens and contrast, component state, label wiring, lint guard).
**Sensor outcome**: 24 behavior mutants (10 earlier + 14 fresh), 24 killed. 12 lint probes (S30 ×3, P2-P10), 12 killed; the allow-side probe passes. PASS ✅

---

## Advisory findings (not counted toward the verdict)

- **A1. Residual literal-color forms the checker misses** (carried over from iteration 3, not re-probed; `check-conventions.mjs` did not change in round 3): the v4 trailing-`!` important modifier (`text-red-500!`), `text-shadow-<color>`, and inline `style` named colors. The AC outcome holds today: a grep of every in-scope file finds no literal color and no `style=`. Suggested hardening: strip a trailing `!` before the palette test, add `text-shadow` ahead of `text` in `COLOR_PREFIXES`, and reject `style=` in the token-only scope.
- **A2. JOINED/LEFT text swap is caught only by a story** (`message-list.client.stories.tsx:72`). The unit spec uses the same author for both (`message-list.client.spec.tsx:25-26`). JOINED/LEFT texts are a T16 Done-when item, not a spec AC. Not re-run in this iteration.
- **A3. Storybook hang under a failing mutant** (iteration 3). In this iteration every Storybook run (baseline, S11) finished well within the 600 s limit. Still worth watching if `test:storybook` ever stalls in CI.

---

## Code Quality

| Principle                        | Status                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Minimum code                     | ✅                                                                                                                                       |
| Surgical changes                 | ✅ Round 3 touched only `chat.dictionary.spec.ts`, `chat-header.spec.tsx` and tasks.md                                                   |
| No scope creep                   | ✅                                                                                                                                       |
| Matches patterns                 | ✅                                                                                                                                       |
| Spec-anchored outcome check      | ✅ The D-AC5/6 labels are now asserted as literals on what the app ships (`chat.dictionary.spec.ts:20-23`, `chat-header.spec.tsx:46-54`) |
| Per-layer coverage expectation   | ✅ `lib/` and `globals.css` 1:1; components unit + story; e2e for THEME-02                                                               |
| Every test maps to a requirement | ✅ `test-fixtures.spec.ts` is a declared SPEC_DEVIATION (coverage gate)                                                                  |
| Documented guidelines followed   | ✅ `apps/web/ARCHITECTURE.md`, `apps/web/AGENTS.md`, `packages/vitest-config` (100%)                                                     |

Declared deviations (unchanged, still accepted): `@tailwindcss/vite` in Storybook; `provide`/`inject` instead of `define`, with a sentinel keyed on the project name; light `--destructive` darkened for AA; `test-fixtures.spec.ts`; hand-written chat types.

---

## Gate Check

- **Gate command**: `TURBO_FORCE=true make gate` (migrate + `prettier --check .` + `turbo run lint typecheck test:cov build test:storybook build-storybook`)
- **Exit code**: 0. 19/19 turbo tasks successful, 0 cached.
- **web unit (`test:cov`)**: 34 files, 231 passed, 0 failed, 0 skipped; coverage 100/100/100/100
- **web storybook (`test:storybook`)**: 36 files (18 `storybook` + 18 `storybook-dark`), 132 passed, 0 failed
- **api**: 68 passed; **@repo/api-client**: 3 passed; **@repo/vitest-config**: 3 passed; all at 100%
- **lint**: oxlint 0 warnings and 0 errors in every package; `Convenções OK (23 arquivos verificados)`; prettier clean; `next build` and `build-storybook` succeeded
- **E2E**: `make e2e` exit 0, 8/8 passed (4 `theme.spec.ts`, 4 `examples.spec.ts`). Afterwards `docker compose stop api web`; the project database stays up. No `core-*` container was touched.
- **Unit test count before the feature**: 47 (snapshot). **After**: 231. **Delta**: +184 (+2 since iteration 3: the dictionary label test and the header label → state → icon test)
- **Skipped tests**: none
- **Failures**: none

---

## Fix Plans

None for code. Fix 1 from iteration 3 is done and verified (M24, M25, M28 killed).

### Pending user action: T22 FigCraft (outside the code verdict)

- Apply these values in the FigCraft Tema collection: `text/secondary` Light `#687080`; `text/muted` Light `#68707F` and Dark `#7C8597`; `brand/default` Dark `#5B5EF0`. Then save `.specs/figcraft/index.figcraft`. This cannot be verified until the user does it.

---

## Requirement Traceability Update

| Requirement | Previous Status (iteration 3)                             | New Status                                                |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------- |
| THEME-01    | ✅ Verified in code (FigCraft sync pending a user action) | ✅ Verified in code (FigCraft sync pending a user action) |
| THEME-02    | ✅ Verified                                               | ✅ Verified                                               |
| THEME-03    | ❌ Needs Fix (AC5/AC6 shipped label text not pinned)      | ✅ Verified                                               |
| UI-01       | ✅ Verified                                               | ✅ Verified                                               |
| UI-02       | ✅ Verified                                               | ✅ Verified                                               |
| UI-03       | ✅ Verified                                               | ✅ Verified                                               |
| UI-04       | ✅ Verified                                               | ✅ Verified                                               |

---

## Summary

**Overall**: ✅ Ready (code). T22's FigCraft sync is an open user action outside this code verdict.

**Spec-anchored check**: 26/26 ACs and 3/3 edge cases matched the spec outcome; 5 spec-precision gaps flagged.
**Sensor**: 24/24 behavior mutants killed (incl. M24, M25, M28 and 14 fresh); 12/12 lint probes killed.
**Gate**: exit 0. Web 231 unit + 132 storybook, api 68, packages 6, all at 100% coverage; e2e 8/8.

**What works**: The round-3 fix pins the shipped ThemeToggle labels with literal strings in both the dictionary and the header wiring (label → state span → icon). Every earlier fix still holds (S7, S9, S9b, S11, S30, N5, N11, N16, P2-P10). Tokens match the PRD in all 3 selectors with computed AA checks, the theme is applied before hydration (e2e at DOMContentLoaded), look-alike and invalid cookies are ignored, and the toggle inverts the effective theme and writes the exact cookie.

**Issues found**: None in code. Advisory A1-A3 remain.

**Next steps**: Close F0 in code. The user applies the 4 values in the FigCraft Tema collection (T22).
