# chat-resilience (F3) - verification report

**Result**: PASS ✅. Gap 2 of iteration 2 is closed: `chat-stream.client.spec.tsx:372-387` asserts that "Tentar de novo" removes the limit notice while the retry is still pending, and mutant N9 (the gap's surviving mutant) is now killed by that test. Three fresh mutants on F3 behavior (rate-limit condition, 30 s leave delay, 80 px stick threshold) were all killed. `TURBO_FORCE=true make gate` exit 0 on the second run (api 305, web 575 + 134 stories, 100% coverage). The first run failed once on an api test that existed before F3 and is outside the feature diff (residual note 3). All 34 ACs have evidence that matches the spec-defined outcome.

**Iteration**: 3 (of 3)
**Date**: 2026-10-29
**Spec**: `.specs/features/chat-resilience/spec.md`
**Diff range**: feature `3707494..HEAD`; fix of this iteration `8e8b5ce..5c80de8` (T23: `apps/web/src/features/chat/components/chat-stream.client.spec.tsx` +17 lines, plus `.specs` docs; no production code changed)
**Verifier**: independent sub-agent (author ≠ verifier). It did not edit code, tests or `spec.md`. Mutations ran only in a temporary `git worktree` under the session scratchpad (`verify-wt3`, `node_modules` symlinked, `apps/web/.env` copied). The worktree was restored with `git checkout` after each mutant and then removed with `git worktree remove --force` and `git worktree prune`. `git status --porcelain` of the real tree was empty before the sensor, empty after cleanup and empty after both gate runs, before this report was written.

---

## Gap history

| Gap                                                                                      | Iteration 1     | Iteration 2               | Iteration 3     | Evidence of closure                                                                                                                                                          |
| ---------------------------------------------------------------------------------------- | --------------- | ------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gap 1: drop before B's first SSE `message` loses every message sent during it (RECON-01) | ❌ FAIL (Major) | ✅ Closed (T19-T21)       | ✅ Closed       | `open-chat-stream.ts:50-52`, `chat-stream.client.tsx:59`; E2E `chat-resilience.spec.ts:166` `toEqual([1, 1, 1])`; the E2E probe killed N1 in iteration 2                     |
| T18 E2E masked Gap 1 with a pre-seeded SSE message                                       | ⚠️ Masks a gap  | ✅ Closed (T21)           | ✅ Closed       | `5a011db`                                                                                                                                                                    |
| Spec-precision notes 1-3 (100 sends, AC4 timing, "gravou 5")                             | ⚠️ Notes        | ✅ Resolved in spec (T19) | ✅ Resolved     | spec edits judged in iteration 2                                                                                                                                             |
| `actions/leave.ts:12` comment                                                            | ⚠️ Minor        | ✅ Closed (T22)           | ✅ Closed       | comment-only change                                                                                                                                                          |
| Gap 2: RATE-02 AC4 clause "até ... 'Tentar de novo'" untested (N9 survived)              | -               | ❌ FAIL (Minor)           | ✅ Closed (T23) | `apps/web/src/features/chat/components/chat-stream.client.spec.tsx:385` `expect(screen.queryByRole('alert')).toBeNull()` after the "Tentar de novo" click; N9 killed (below) |

### Gap 2 closure in detail

- **AC (spec.md:138)**: "WHEN a action recebe `429` THEN o `Composer` SHALL mostrar 'Você está enviando mensagens rápido demais. Aguarde alguns segundos.' até o próximo envio ou 'Tentar de novo'".
- **Test**: `apps/web/src/features/chat/components/chat-stream.client.spec.tsx:372-387`. It sends "olá" and resolves the action with `{ ok: false, reason: 'rate_limited', retryAfter: 4 }`. `:379` `expect(screen.getByRole('alert')).toHaveTextContent(RATE_LIMITED)` checks the exact text first. `:381-383` clicks the button "Tentar de novo". `:385` `expect(screen.queryByRole('alert')).toBeNull()` checks that the notice is gone. `:386` `within(bubbleOf('olá')).getByText('Enviando…')` checks that the retry is still pending, so the notice disappears because of the retry itself and not because a later response arrives.
- **Spec match**: the "next send" clause is covered by `:358-370`, and the "Tentar de novo" clause by `:372-387`. AC4 is now fully covered.
- **Mutant N9 re-run**: in `chat-stream.client.tsx`, `setRateLimited(false)` was moved from `deliver` (`:66`) to the start of `send` (`:78`). Result: `1 failed | 379 passed (380)`. The only failure was `o aviso de limite sai ao acionar "Tentar de novo" (RATE-02 AC4)`. **Killed.**
- **Test quality**: the test reuses the spec's own helpers (`controlledSend`, `type`, `bubbleOf`), maps to RATE-02 AC4 in its title and adds no production code. ✅

---

## Task Completion

| Task    | Status  | Notes                                                                                                                         |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| T1-T18  | ✅ Done | Verified in iterations 1-2                                                                                                    |
| T19-T22 | ✅ Done | Verified in iteration 2                                                                                                       |
| T23     | ✅ Done | All three `Done when` items were re-checked on their own: the spec assertion, N9 is killed (re-run here), and the gate passes |

---

## Spec-Anchored Acceptance Criteria

Paths are relative to the repo root. `api/` = `apps/api/`, `chat/` = `apps/api/src/modules/chat/`, `wf/` = `apps/web/src/features/chat/`, `e2e/` = `apps/web/e2e/`. T23 inserted 17 lines at `chat-stream.client.spec.tsx:372`. Lines cited above 372 are unchanged, and lines below it moved by +17 (only SCROLL-01 AC5 is affected). Every other file is unchanged since iteration 2, so its evidence, including the iteration 2 E2E probe, still stands.

### P2: Não perder mensagens numa queda rápida (RECON-01, RECON-02)

| AC  | Spec-defined outcome                                                                                                | `file:line` + assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Result  |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Positive-integer `Last-Event-ID` → every `seq` greater than it, ascending, before any live event                    | `wf/realtime/open-chat-stream.spec.ts:242-266` 250 missed → `queries).toEqual([{after:'1040',…},{after:'1140',…},{after:'1240',…}])`, `chunks).toEqual([RETRY, ...missed.map(chunkOf), chunkOf(live)])`                                                                                                                                                                                                                                                                                               | ✅ PASS |
| 2   | While fetching, buffer live events; write them after, skipping `seq` already written                                | `wf/realtime/chat-hub.spec.ts:104-121`, `:123-137`; `open-chat-stream.spec.ts:269-289` live `seq` already recovered written once                                                                                                                                                                                                                                                                                                                                                                      | ✅ PASS |
| 3   | Neither `Last-Event-ID` nor query `after` a positive integer → no recovery                                          | Header: `open-chat-stream.spec.ts:189-203` (`'0'`, `'-1'`, `'abc'`, `'1.5'`, `''`, overflow, `null` → `toBeNull()`), `:322-335` `'abc'` → `queries).toEqual([])`. Query: `:374-390` `?after=abc`, `?after=0`, `?after=-5`, `?after=` → `queries).toEqual([])`, `chunks).toEqual([RETRY, chunkOf(live)])`. N3 killed                                                                                                                                                                                   | ✅ PASS |
| 4   | Fetch failure → close the connection so `EventSource` retries                                                       | `open-chat-stream.spec.ts:291-303` 500 → `state.error).toBeDefined()`, `connectionCount(me.id)).toBe(0)`                                                                                                                                                                                                                                                                                                                                                                                              | ✅ PASS |
| 5   | Disconnected → "Reconectando…" above the field                                                                      | `wf/state/use-chat-events.spec.ts:151` `error` → `onStatus('reconnecting')`; `wf/components/chat-stream.client.spec.tsx:161-174` notice in `composer-slot`; E2E `e2e/chat-resilience.spec.ts:153` `getByText(t.errors.reconnecting)).toBeVisible()`                                                                                                                                                                                                                                                   | ✅ PASS |
| 6   | Reopens → hide "Reconectando…"                                                                                      | `chat-stream.client.spec.tsx:161-174` `open` → `queryByText('Reconectando…')).toBeNull()`; E2E `chat-resilience.spec.ts:163-165` `toBeHidden()`                                                                                                                                                                                                                                                                                                                                                       | ✅ PASS |
| 7   | No valid header + valid `after` → every `seq` > `after`, ascending, before live, as AC1-2; both valid → header wins | `open-chat-stream.spec.ts:339-358` no header, `?after=1040`, live published during the fetch → `queries).toEqual([{ after: '1040', limit: '100' }])`, `chunks).toEqual([RETRY, ...missed.map(chunkOf), chunkOf(live)])`. `:360-372` `Last-Event-ID: 1100` + `?after=1040` → `queries).toEqual([{ after: '1100', limit: '100' }])`, `chunks).toEqual([RETRY, ...stored.slice(-3).map(chunkOf)])`. N1, N2, N6 killed                                                                                    | ✅ PASS |
| 8   | `ChatStream` opens `/chat/stream?after=<last SSR seq>`; empty room → `/chat/stream`                                 | `chat-stream.client.spec.tsx:62-73` → `urls).toEqual(['/chat/stream?after=3'])` (last of `[1,2,3]`); `:75-81` `initialMessages: []` → `['/chat/stream']`; `:83-94` after a live `seq` 4, still one source `?after=3`; `use-chat-events.spec.ts:50-63` `?after=1040`, `:65-80` rerender with 1041 → same URL, `closed).toBe(false)`; `wf/containers/chat-room.container.spec.tsx:89-97` `?after=6`; E2E `chat-realtime.spec.ts:208-211` real URL `/\/chat\/stream\?after=\d+$/`. N4, N5, N7, N8 killed | ✅ PASS |

**Independent Test / Success Criterion 1** - `e2e/chat-resilience.spec.ts:134-181`: B enters (`:141`), no message is sent before the drop, the proxy cuts B's sockets (`:150-151`), "Reconectando…" shows (`:153`), A sends 3 (`:154-158`), B shows `[0, 0, 0]` (`:159`), network restored, notice hidden (`:163-165`), `countsOf(b.page, sent)).toEqual([1, 1, 1])` (`:166`), order `toEqual(sent)` (`:170`), `reloads).toBe(0)` (`:171`). Playwright runs one worker (`apps/web/playwright.config.ts`, `workers: 1`), so no other spec can send B a message before the drop.

**E2E probe (discrimination of the E2E itself)**: the worktree web with mutant N1 (no `after` fallback) ran with `next dev` on port 3177 against the running api; `E2E_BASE_URL=http://localhost:3177 playwright test -g "B fica offline"` → **failed** at `chat-resilience.spec.ts:166:53`, `Received [0, 0, 0]`, expected `[1, 1, 1]`. Control on the same server with the mutant reverted → **passed** (6.8 s). B on that server gets no live events at all (the api's webhooks go to the docker web), so the pass can only come from the `after` recovery: the E2E proves it.

**Stale `after` after events arrived** - the `EventSource` reconnects with the same URL, so a reconnect after a `message` carries both values. `open-chat-stream.ts:48-52` takes the header first; `open-chat-stream.spec.ts:360-372` asserts recovery from 1100 (not 1040) and writes only 1101-1103, so there is no duplicate replay of 1041-1100 and nothing after 1100 is lost. N2 (query wins) killed. A reconnect before any `message` and with nothing recovered reuses the SSR `after`, which is still correct (the reducer drops `seq` it already has, SSE-02 AC10, `chat-stream.client.spec.tsx:121-127`).

### P2: Sair ao fechar a aba (AWAY-01)

Not touched by T23. Evidence unchanged.

| AC  | Spec-defined outcome                                         | `file:line` + assertion                                                                                                                                                                                                                  | Result  |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Last SSE connection closes → leave scheduled for 30 s later  | `wf/realtime/chat-hub.spec.ts:213-229` 29 s → `not.toHaveBeenCalled()`; +1 s → `toHaveBeenCalledExactlyOnceWith({ id, token })`; E2E `e2e/chat-resilience.spec.ts:183-202`, `:201` `Date.now() - closedAt).toBeLessThanOrEqual(AWAY_MS)` | ✅ PASS |
| 2   | New connection before 30 s cancels                           | `chat-hub.spec.ts:242-251`; E2E F5 `chat-resilience.spec.ts:204-219` `toHaveCount(0)` for "saiu do chat", count unchanged                                                                                                                | ✅ PASS |
| 3   | After 30 s, `POST /participants/:id/leave` with the token    | `chat-hub.spec.ts:320-333`; `wf/session/leave-participant.spec.ts:25-47`                                                                                                                                                                 | ✅ PASS |
| 4   | At least one open connection → no leave                      | `chat-hub.spec.ts:253-268`, `:270-281`                                                                                                                                                                                                   | ✅ PASS |
| 5   | "Sair" cancels any scheduled leave                           | `wf/actions/leave.spec.ts:92-109` `cancelledAtRequest).toEqual([[PARTICIPANT_ID]])`; `chat-hub.spec.ts:283-292`                                                                                                                          | ✅ PASS |
| 6   | `401`/`404` on the scheduled leave → discarded without error | `leave-participant.spec.ts:27-28` → `'gone'`; `chat-hub.spec.ts:294-306`                                                                                                                                                                 | ✅ PASS |

### P2: Envio otimista sem duplicar (OPT-01, OPT-02)

Not touched by T23. Evidence unchanged (every cited line is above the inserted test).

| AC  | Spec-defined outcome                                      | `file:line` + assertion                                                                                                          | Result  |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | Appended at once, "enviando", generated `clientId`        | `chat-stream.client.spec.tsx:234-248` `contents()).toEqual(['primeira','terceira','olá'])`, "Enviando…", `clientId: any(String)` | ✅ PASS |
| 2   | SSE with same `clientId` replaces, no duplicate           | `chat-stream.client.spec.tsx:250-266`; `wf/state/chat-room.reducer.spec.ts:179-192`                                              | ✅ PASS |
| 3   | Action success first → replaced by returned message       | `chat-stream.client.spec.tsx:268-285`; `chat-room.reducer.spec.ts:194-202,215-225`                                               | ✅ PASS |
| 4   | Failure → "Não enviada · Tentar de novo"                  | `chat-stream.client.spec.tsx:287-312`                                                                                            | ✅ PASS |
| 5   | "Tentar de novo" resends same content and `clientId`      | `chat-stream.client.spec.tsx:314-340` `calls[1].input).toEqual(calls[0].input)`                                                  | ✅ PASS |
| 6   | Stored `clientId` → `201` existing, no insert, no webhook | `chat/services/test/messages.service.spec.ts:241-257`, `:292-310`; e2e `api/test/webhooks.e2e-spec.ts:310-344`                   | ✅ PASS |
| 7   | No `router.refresh()` after sending                       | `wf/actions/send-message.spec.ts:79-108` `refresh).not.toHaveBeenCalled()`                                                       | ✅ PASS |

### P2: Rolagem que respeita a leitura (SCROLL-01)

Not touched by T23. Evidence unchanged: `wf/state/use-stick-to-bottom.spec.ts:45-55` (AC1, 80 px), `:57-68` (AC2, 81 px), `message-list.client.spec.tsx:207-240` (AC3), `use-stick-to-bottom.spec.ts:70-93` (AC4), `chat-stream.client.spec.tsx:389-412` `main.scrollTop).toBe(3000)` (AC5; moved +17 by T23). 5/5 ✅ PASS.

### P2: Limite de envio (RATE-01, RATE-02)

| AC  | Spec-defined outcome                                                              | `file:line` + assertion                                                                                                                                                                                                                                                                                                                                                                                     | Result  |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | 5 accepted sends in the last 10 s → `429` with `Retry-After` in whole seconds     | `chat/services/test/send-rate-limiter.spec.ts:24-31` 6th at `t+9_999` → `{ ok:false, retryAfterSeconds: 1 }`; `chat/filters/test/rate-limited-exception.filter.spec.ts:37-48` `setHeader('Retry-After','3')`; e2e `api/test/chat.e2e-spec.ts:427-450`                                                                                                                                                       | ✅ PASS |
| 2   | Per participant                                                                   | `send-rate-limiter.spec.ts:81-86`; e2e `chat.e2e-spec.ts:452-464`                                                                                                                                                                                                                                                                                                                                           | ✅ PASS |
| 3   | Resend with stored `clientId` doesn't count                                       | `messages.service.spec.ts:241-257`; e2e `chat.e2e-spec.ts:466-487`                                                                                                                                                                                                                                                                                                                                          | ✅ PASS |
| 4   | `429` → Composer shows the exact text **until the next send or "Tentar de novo"** | Text: `wf/components/chat-stream.client.spec.tsx:342-356` `alert).toHaveTextContent('Você está enviando mensagens rápido demais. Aguarde alguns segundos.')`. Next send: `:358-370` `queryByRole('alert')).toBeNull()`. "Tentar de novo": `:372-387`, `:385` `queryByRole('alert')).toBeNull()` with `:386` retry still "Enviando…". N9 killed. Other failures show no notice: `:297` `it.each`, M10 killed | ✅ PASS |
| 5   | `429` → optimistic message "Não enviada · Tentar de novo"                         | `chat-stream.client.spec.tsx:355` `within(bubbleOf('olá')).getByText('Não enviada')).toBeVisible()`                                                                                                                                                                                                                                                                                                         | ✅ PASS |

**Status**: ✅ 34/34 ACs covered by assertions that match the spec-defined outcome. 0 open spec-precision gaps.

---

## Goals and Success Criteria

| Item                                                                     | Evidence                                                                                                                 | Result |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| Goal: after a drop, no message stored during the drop is missing         | RECON-01 AC1-2, AC7-8 above; E2E `chat-resilience.spec.ts:134-181` with no prior SSE message; probe killed (iteration 2) | ✅     |
| Goal: closed tab leaves the online count in 30 s (± 1 s)                 | `chat-resilience.spec.ts:183-202`; M11 (29 s) killed                                                                     | ✅     |
| Goal: own message shows at once, not duplicated                          | OPT-01 above; E2E `:221-246`                                                                                             | ✅     |
| SC: B offline, A sends, B returns and sees everything without reloading  | `chat-resilience.spec.ts:166,170-171`                                                                                    | ✅     |
| SC: B closes the tab, A sees "saiu do chat" and the count drop in ≤ 31 s | `chat-resilience.spec.ts:195-201`                                                                                        | ✅     |
| SC: no duplicate in 100 sends from 20 participants × 5 with SSE          | `chat-resilience.spec.ts:221-246`                                                                                        | ✅     |
| SC: `make gate` and `make e2e` green                                     | Gate section (`make e2e` 19/19 on the identical production code in iteration 2)                                          | ✅     |

---

## Edge Cases

- [x] Two tabs, close one → no leave: `chat-hub.spec.ts:253-268`
- [x] F5 → scheduled leave cancelled: `chat-hub.spec.ts:242-251`; E2E `chat-resilience.spec.ts:204-219`
- [x] 250 messages during the drop → all before live: `open-chat-stream.spec.ts:242-266` (header) and `:339-358` (`after`)
- [x] Own SSE event before the action's response → one message: `chat-room.reducer.spec.ts:227-240`; `chat-stream.client.spec.tsx:250-266`
- [x] 5th message within 10 s → accepted: `send-rate-limiter.spec.ts:10-14,24-25`

---

## Discrimination Sensor

Every mutant ran `vitest run --project unit src/features/chat` in the worktree (35 files, 380 tests; baseline 380/380 green before mutating).

| #   | File:line                                    | Mutation                                                                                            | Killed by                                                                                                              | Killed?   |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------- |
| N9  | `wf/components/chat-stream.client.tsx:66,78` | `setRateLimited(false)` moved from `deliver` to `send` (retry keeps the limit notice); gap 2 re-run | `chat-stream.client.spec.tsx:372` (1 failed / 379 passed)                                                              | ✅ Killed |
| M10 | `wf/components/chat-stream.client.tsx:74`    | `if (result.reason === 'rate_limited')` removed: every failure shows the limit notice               | `chat-stream.client.spec.tsx:297` `it.each` (`ok: false` and network rejection: "nenhum aviso no Composer") (2 failed) | ✅ Killed |
| M11 | `wf/realtime/chat-hub.ts:65`                 | Default leave delay `30_000` → `29_000` (AWAY-01 AC1)                                               | `chat-hub.spec.ts:213`, `:242`, `:320` (3 failed)                                                                      | ✅ Killed |
| M12 | `wf/state/use-stick-to-bottom.ts:16`         | `distance <= 80` → `distance < 80` (SCROLL-01 AC1 boundary)                                         | `use-stick-to-bottom.spec.ts:45` "a 80 px do fim" (1 failed)                                                           | ✅ Killed |

**Sensor depth**: lightweight for this iteration: the gap's mutant plus 3 fresh behavior mutants on F3 code (rate-limit notice, leave timer, scroll boundary). This adds to the 13 mutants of iteration 1 and 9 of iteration 2. No production code changed in this iteration.
**Sensor outcome**: 4/4 killed. PASS ✅

---

## Code Quality

| Principle                                                                                                              | Status                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Minimum code                                                                                                           | ✅ One test of 16 lines, using existing helpers                                |
| Surgical changes                                                                                                       | ✅ Only the `Where` of T23 (`chat-stream.client.spec.tsx`), plus `.specs` docs |
| No scope creep                                                                                                         | ✅                                                                             |
| Matches patterns                                                                                                       | ✅ Same structure as the neighbouring `o aviso de limite sai no próximo envio` |
| Spec-anchored outcome check (asserted values match spec)                                                               | ✅ Exact text asserted before, absence of `alert` after the retry              |
| Per-layer Coverage Expectation met (domain 1:1 ACs; routes happy+edge+error)                                           | ✅ Unchanged from iteration 2                                                  |
| Every test maps to a spec requirement - no unclaimed tests                                                             | ✅ New test names RATE-02 AC4                                                  |
| Documented guidelines followed: `apps/api/ARCHITECTURE.md` §10, `apps/web/ARCHITECTURE.md` §8-§9, 100% coverage config | ✅ 100% statements/branches/functions/lines in api and web                     |

---

## Gate Check

- **Gate command**: `TURBO_FORCE=true make gate`
  - **Run 1**: exit 2. 16/19 turbo tasks passed. api `test:cov` had 1 failure out of 305: `apps/api/test/webhooks.e2e-spec.ts:362` (`com o servidor desligado, POST /messages responde 201; app.close() cancela a retentativa`), with `expected { status: 'PENDING', attempts: 1 }`, received `attempts: 0`. This test comes from `6f1eb41` (F1). Neither it nor `apps/api/src/modules/webhooks/**` is in the F3 diff, and T23 changed only a web unit spec. See residual note 3.
  - **Run 2**: exit 0. 19/19 turbo tasks, 0 cached
    - api `test:cov`: 305 passed (36 files), 100%
    - web `test:cov`: 575 passed, 100%; `test:storybook`: 134 passed
    - `@repo/api-client` 3, `@repo/vitest-config` 3
  - Isolated re-run of the failing test: `vitest run test/webhooks.e2e-spec.ts -t "app.close"` 6× → 6/6 passed. It fails intermittently, and F3 did not cause it.
- **web E2E (`make e2e`)**: not re-run. In `8e8b5ce..5c80de8` the only change under `apps/` is one unit test, so no production code, E2E spec or config changed since iteration 2's `make e2e` 19/19 on the same code.
- **Test count before this iteration**: api 305, web 574 unit + 134 stories, E2E 19
- **Test count after**: api 305, web 575 unit + 134 stories, E2E 19
- **Delta**: web +1 unit (`chat-stream.client.spec.tsx:372`). No test removed or weakened
- **Skipped tests**: none
- **Failures**: none on run 2; run 1 as above (outside F3)

---

## Fix Plans

None for F3.

---

## Residual notes (not defects of F3)

1. **Empty room (RECON-01 AC8 carve-out)**: with no rendered message the stream opens without `after`, so a drop before the first `message` would not recover. A joined participant always renders its own `JOINED` message, so this only happens after the history is emptied. The real stream URL is asserted to carry `after` (`e2e/chat-realtime.spec.ts:208-211`).
2. **Pending user confirmations from iteration 1**: tasks.md still marks the `SPEC_DEVIATION`s on the F1/F2 test adaptations as "confirmar com o usuário". The verifier found them correct, and they still need the user's confirmation.
3. **Intermittent api test (pre-existing, outside F3)**: `apps/api/test/webhooks.e2e-spec.ts:355-362`. The `waitFor` returns as soon as `history.length === 1`, but Prisma's `findFirst({ include: { history: true } })` runs two queries, one for the delivery and one for the attempts. They can straddle the commit of the `recordAttempt` transaction (`apps/api/src/modules/webhooks/repositories/webhook-delivery.repository.ts:23-31`), so the test sees the attempt row with `attempts: 0`. Suggested follow-up outside F3: also wait for `row.attempts === 1` in the predicate. Not routed as an F3 fix task.
4. **Next.js 16.4.0 CLI security notice** (seen in iteration 2): the Next.js CLI printed a security advisory with an upgrade command. The verifier did not act on it, and the user should decide.

---

## Requirement Traceability Update

Recommended (the verifier did not edit `spec.md`):

| Requirement | Previous Status | New Status  |
| ----------- | --------------- | ----------- |
| RECON-01    | In Progress     | ✅ Verified |
| RECON-02    | Implemented     | ✅ Verified |
| AWAY-01     | Implemented     | ✅ Verified |
| OPT-01      | Implemented     | ✅ Verified |
| OPT-02      | Implemented     | ✅ Verified |
| SCROLL-01   | Implemented     | ✅ Verified |
| RATE-01     | Implemented     | ✅ Verified |
| RATE-02     | Implemented     | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 34/34 ACs matched the spec-defined outcome. 0 spec-precision gaps.
**Sensor**: this iteration 4/4 killed (N9 + M10-M12). Across the feature, 26 mutants were injected, 25 killed and 1 survived (N9 in iteration 2, now killed).
**Gate**: `TURBO_FORCE=true make gate` exit 0 (api 305, web 575 + 134 stories, 100%). One earlier run hit the intermittent F1 api test (note 3). `make e2e` was not re-run: there is no E2E-relevant change since its 19/19.

**What works**: the "Tentar de novo" clause of RATE-02 AC4 is now asserted and discriminating, and every behavior verified in iterations 1-2 still holds.

**Issues found**: none in F3.

**Next steps**: update the requirement statuses in `spec.md`, confirm the F1/F2 `SPEC_DEVIATION`s with the user, and decide on the Next.js notice and the intermittent api test (separate follow-up).
