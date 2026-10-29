# chat-extras (F4) - verification report

**Result**: PASS ✅. The 3 Minor gaps from iteration 1 are closed. All 20 ACs (18 original + TYPE-01 AC12/AC13 added by T15) and the 3 edge cases have `file:line` evidence that matches the spec-defined outcome. `TURBO_FORCE=true make gate` exit 0 (on the second attempt; the first hit 3 timeouts under machine load, see Gate Check) and `make e2e` exit 0 (21/21, `2 cliques (sala com 140 mensagens)`). The sensor killed 8 of 9 mutants on the fix code. The survivor (M9, cleanup filter narrowed in the E2E harness) is test-harness code with no oracle by design, and the 60 s timeout is a slow backstop for it. It is recorded as a residual hardening note, not a gap against the spec.

**Iteration**: 2 (of 3)
**Date**: 2026-10-29
**Spec**: `.specs/features/chat-extras/spec.md`
**Diff range**: `103b9e6..8499a8a`, excluding docs-only commits `e223724`, `8e01bf6`, `934774d`, `56c9912`. Fix commits since iteration 1: `5ca4396` (T15, spec AC12/AC13), `1ce5e57` (T16), `0a5d628` (T17), `8499a8a` (T18).
**Verifier**: independent sub-agent (author ≠ verifier). It did not edit code, tests or `spec.md`. Mutations ran only in a temporary detached `git worktree` at the session scratchpad (`verify-f4b`, `node_modules` symlinked, `.env` files and `apps/api/src/generated` copied). Each mutant was reverted with `git checkout -- .` right after its run. The worktree was removed with `git worktree remove --force` and `git worktree prune`. `git status --porcelain` of the real tree was empty before the sensor and still empty after the worktree was removed. Only this report changes afterwards, plus `.specs/lessons.json` and `.specs/LESSONS.md`, which `lessons.py` writes. Another agent's worktree under `.claude/worktrees/` was not touched.

---

## Gap History

| Gap | Description                                                                     | AC / anchor                                                   | Iteration 1 | Iteration 2 | Evidence of closure                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Typing window not reset on send: the first key of a reply is throttled          | Goal 1 vs TYPE-01 AC1/AC4 + TYPE-02 AC9 → now TYPE-01 AC12/13 | ❌ Minor    | ✅ Closed   | Code: `apps/web/src/features/chat/components/composer.client.tsx:49` `lastTypingAt.current = -Infinity` in `submit()`; `apps/api/src/modules/chat/services/typing.service.ts:35-37` `reset()`; `apps/api/src/modules/chat/services/messages.service.ts:80` `this.typing.reset(actor.id)` only after a new `create` (after the replay early return at `:58` and the `P2002` return at `:78`). Tests: `composer.client.spec.tsx:220-231`, `messages.service.spec.ts:344-410`, `typing.service.spec.ts:79-94`. Mutants M1-M5, M7 killed |
| 2   | `notifyTyping` rejection unhandled in the browser                               | TYPE-01 AC1; design T6 "ignora qualquer erro"                 | ❌ Minor    | ✅ Closed   | `apps/web/src/features/chat/components/chat-stream.client.tsx:148-150` `void typing().catch(() => {})`, wired at `:181`; test `chat-stream.client.spec.tsx:578-604` `expect(unhandled).toEqual([])` + send still works. Mutant M6 killed                                                                                                                                                                                                                                                                                             |
| 3   | Pagination E2E over an unbounded shared room; does not show "clicar duas vezes" | HIST-01 Independent Test; Goal 2; SC1                         | ❌ Minor    | ✅ Closed   | `apps/web/e2e/global-setup.ts:26-53` (transactional cleanup of `e2e-web-` rows), `apps/web/playwright.config.ts:14`; `apps/web/e2e/chat-extras.spec.ts:162` `test.setTimeout(60_000)`, `:217` `expect(clicks).toBe(Math.floor(room.length / PAGE_SIZE))`. Verifier run: `2 cliques (sala com 140 mensagens)`, 13.7 s (iteration 1: 78 clicks, 39.6 s). Mutant M8 killed; M9 survived (residual note 1)                                                                                                                               |

---

## Task Completion

| Task   | Status  | Notes                                                                                                                                                                        |
| ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1-T14 | ✅ Done | Unchanged since iteration 1 (see the iteration 1 evidence, which this report keeps below)                                                                                    |
| T15    | ✅ Done | AC12/AC13 appended (no renumbering), Assumptions row added. Judged legitimate precision, see below                                                                           |
| T16    | ✅ Done | `reset` runs after `create` and before `message.created`. A send rejected by RATE-01 also does not reset (`:62` throws before `:80`), which is consistent: no message stored |
| T17    | ✅ Done | -                                                                                                                                                                            |
| T18    | ✅ Done | `SPEC_DEVIATION` updated at `chat-extras.spec.ts:158-161` (12 × 10 in two rounds, RATE-01)                                                                                   |

### T15: precision, not goalpost moving

- Iteration 1 found that Goal 1 ("< 1 s depois da primeira tecla") was false for a reply typed within 3 s (web) or 2 s (api) of the previous notice, because AC9 had just cleared the notice. AC12 and AC13 **add** obligations. They require the system to notify at once after a send. No existing AC was weakened or relaxed, and AC1 and AC4 still hold between sends (`composer.client.spec.tsx:206-218`, `typing.service.spec.ts:132-148` unchanged). Goal 1 was not rewritten to fit the code. The spec now states what makes Goal 1 true.
- No other path makes the notice disappear while a window is still blocking. Without a send, the 5 s TTL (AC8) outlives both the 3 s and the 2 s windows, so the notice stays continuous. AC12/AC13 therefore close Goal 1 for every path the spec defines.
- The AC13 clause "um reenvio com `clientId` já gravado SHALL não zerar" is consistent with F3 OPT-02/RATE-01 AC3, where a replay has no side effects. It is directly tested.

### AC12/AC13 tests discriminate

- AC12: `composer.client.spec.tsx:220-231`. Key at 0, Enter at 1 000 (the field is asserted empty), key at 1 500 → `toHaveBeenCalledTimes(2)`. Without the reset this is 1 (M1 killed).
- AC13, positive: `messages.service.spec.ts:345-354` (with `clientId`) and `:356-364` (without). Real `TypingService` on the dispatcher mock, `notify` at T, `send`, `notify` at T + 1 000 → `typingDispatches()` `toBe(2)`.
- AC13, author only: `:366-375` → `toBe(1)` for another participant. `typing.service.spec.ts:87-94` covers the same at the unit level.
- AC13, replay does not reset: `:377-385`, where `findByClientId` returns stored → `toBe(1)`. The `P2002` race at `:387-398` and the `create` failure at `:400-410` → `toBe(1)`. Moving the reset before the replay check (M2) fails 3 of these tests, and resetting in the `P2002` path (M3) fails `:387`.

---

## Spec-Anchored Acceptance Criteria

### P3: Ver quem está digitando (TYPE-01, TYPE-02)

| Criterion                                                    | Spec-defined outcome                                  | `file:line` + assertion                                                                                                                                                                                                       | Result  |
| ------------------------------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1 Composer → `notifyTyping` at most once per 3 s           | ≤ 1 call per 3 s while there are keystrokes           | `composer.client.spec.tsx:206-218` `toHaveBeenCalledTimes(1)` then `(2)` at 3 000 ms; blank does not call; no timers; E2E `apps/web/e2e/chat-extras.spec.ts:140-151`; rejection handled `chat-stream.client.spec.tsx:578-604` | ✅ PASS |
| AC2 valid token → `204` + `typing.started` with exact `data` | `204`, signed webhook `{ participant: { id, name } }` | `apps/api/test/typing.e2e-spec.ts:167-186` `.expect(204)`, `envelope(hook)` `toEqual(...)`                                                                                                                                    | ✅ PASS |
| AC3 invalid token → `401`                                    | `401`                                                 | `apps/api/test/typing.e2e-spec.ts:200-208` `.expect(401)`                                                                                                                                                                     | ✅ PASS |
| AC4 < 2 s → `204` without webhook                            | `204`, no new delivery                                | `apps/api/test/typing.e2e-spec.ts:210-225` `deliveriesOf` `toHaveLength(1)`; boundary `typing.service.spec.ts` (1 999 / 2 000 ms)                                                                                             | ✅ PASS |
| AC5 one attempt                                              | `maxAttempts: 1`; `FAILED` with `attempts = 1`        | `apps/api/test/typing.e2e-spec.ts:227-244` `attempts: 1`, `history` length 1                                                                                                                                                  | ✅ PASS |
| AC6 `event: typing` without `id:`                            | exact chunk                                           | `apps/web/src/features/chat/realtime/chat-hub.spec.ts:61-76` `toEqual([chunk])`; recovery buffer drop `:156-175`                                                                                                              | ✅ PASS |
| AC7 own event ignored                                        | nothing shown                                         | `chat-room.reducer.spec.ts:354-361` `next` `toBe(state)`                                                                                                                                                                      | ✅ PASS |
| AC8 5 s, restarting                                          | visible at 4 999, gone at 5 000; extends to 9 s       | `chat-stream.client.spec.tsx:448-483`; E2E `chat-extras.spec.ts:128-135`                                                                                                                                                      | ✅ PASS |
| AC9 USER message removes author                              | removed at once                                       | `chat-room.reducer.spec.ts:403-413` `toEqual(['Carlos'])`                                                                                                                                                                     | ✅ PASS |
| AC10 two names                                               | "{a} e {b} estão digitando…"                          | `chat-stream.client.spec.tsx:507-516`                                                                                                                                                                                         | ✅ PASS |
| AC11 three or more                                           | "Várias pessoas estão digitando…"                     | `chat-stream.client.spec.tsx:518-528`                                                                                                                                                                                         | ✅ PASS |
| AC12 send restarts the Composer's 3 s window                 | next key after a send → `notifyTyping` at once        | `apps/web/src/features/chat/components/composer.client.spec.tsx:220-231` `expect(onTyping).toHaveBeenCalledTimes(2)`                                                                                                          | ✅ PASS |
| AC13 stored USER message clears the api's 2 s entry          | next `POST /typing` dispatches; replay does not reset | `apps/api/src/modules/chat/services/test/messages.service.spec.ts:353,363` `typingDispatches()).toBe(2)`; `:374,384,397,409` `toBe(1)`; `typing.service.spec.ts:84,93`                                                        | ✅ PASS |

Line numbers for AC1-AC11 are those verified in iteration 1. Those test files changed only by the T16/T17 insertions: `chat-stream.client.spec.tsx` gained 28 lines at `:578`, after all AC7-AC11 citations, and `composer.client.spec.tsx` gained 13 lines at `:220`, after AC1's `:206-218`.

### P3: Carregar mensagens anteriores (HIST-01)

| Criterion                                         | Spec-defined outcome            | `file:line` + assertion                                                                                                                                           | Result  |
| ------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| AC1 50 → button                                   | shown; 49 → none                | `chat-room.reducer.spec.ts:458-471`; `message-list.client.spec.tsx:287`                                                                                           | ✅ PASS |
| AC2 `before=<min seq>&limit=50`, ascending insert | exact query                     | `actions/load-older-messages.spec.ts:48-60`; `chat-stream.client.spec.tsx` (HIST-01 block, `toHaveBeenCalledExactlyOnceWith(51)`); E2E `chat-extras.spec.ts:206`  | ✅ PASS |
| AC3 same message stays visible                    | `scrollTop` += added height     | `message-list.client.spec.tsx:398-424` `toBe(1600)`; story `message-list.client.stories.tsx:266-297`                                                              | ✅ PASS |
| AC4 loading disabled "Carregando…"                | disabled + text                 | `message-list.client.spec.tsx:330`; E2E `chat-extras.spec.ts:197`                                                                                                 | ✅ PASS |
| AC5 < 50 → hidden                                 | hidden                          | `chat-room.reducer.spec.ts:497-513`; E2E loop exit `chat-extras.spec.ts:194`                                                                                      | ✅ PASS |
| AC6 failure → button + error                      | dictionary text, button enabled | `chat-stream.client.spec.tsx` (HIST-01 block, `{ ok: false }` and rejection); `chat-room.reducer.spec.ts:473-482`; E2E `chat-extras.spec.ts:199` `toHaveCount(0)` | ✅ PASS |
| AC7 no duplicates                                 | each `seq` once                 | `chat-room.reducer.spec.ts:529-538`; E2E `chat-extras.spec.ts:209-213` whole list `toEqual` api USER list                                                         | ✅ PASS |

**Status**: ✅ All 20 ACs covered. Every asserted value matches the spec outcome. No spec-precision gaps remain.

---

## Goals, Independent Tests and Success Criteria

| Item                                                                                          | Evidence                                                                                                                                                                                                                     | Result |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Goal 1: notice < 1 s after the first key                                                      | First key: E2E `chat-extras.spec.ts:125-129`. First key after a send: AC12 + AC13 (web and api windows restart). Without a send, the TTL outlives both windows (see T15 above)                                               | ✅     |
| Goal 2: every message reachable                                                               | E2E `chat-extras.spec.ts:209-213`: after clicking until the button disappears, the whole room's USER list equals the api's, in `seq` order. `:206`: the 120 in creation order                                                | ✅     |
| Independent Test HIST-01 ("120 mensagens, clicar duas vezes, ver as 120, sem o botão no fim") | Clean room: 140 messages (120 USER + 13 JOINED from this test + 2 from the typing test + 5 non-E2E) → 2 clicks, logged and asserted through `floor(total/50)` at `:217`. The loop ends only when the button is gone (`:194`) | ✅     |
| SC1 E2E green                                                                                 | `make e2e` 21/21                                                                                                                                                                                                             | ✅     |
| SC2 no new periodic request                                                                   | E2E `chat-extras.spec.ts:138-151` (unchanged)                                                                                                                                                                                | ✅     |
| SC3 `make gate` and `make e2e` green                                                          | below                                                                                                                                                                                                                        | ✅     |

### Click-count formula `floor(total / 50)`

The UI shows the button while the last page had 50 items. That covers the initial page (`hasMore = initial.length === 50`) and each click (`items.length === 50`). The room has N ≥ 50 messages of all types, and `room.length` counts all types, the same unit the pages use:

- N not a multiple of 50: the initial page holds 50, and each click brings 50 until the remainder of `N mod 50` (1-49) hides the button. Clicks = ⌈(N − 50)/50⌉ = ⌈N/50⌉ − 1 = ⌊N/50⌋. Example: 140 → 50 | 50 | 40 → 2 clicks.
- N a multiple of 50: the last full page leaves the button visible, and one more click returns 0 and hides it (edge case "exatamente 50"). Clicks = (N − 50)/50 + 1 = N/50 = ⌊N/50⌋. Examples: 50 → 1, 100 → 2, 150 → 3.

The formula is correct at every boundary. The formula proposed in the iteration 1 fix plan, `ceil((total − 50)/50)`, would have been wrong at multiples of 50 (150 → 2, but 3 is correct). The author's `floor` fixed that. One residual risk: `room.length` is read after the clicks, so a message arriving between B's page render and `allMessages` would shift N. That only matters across a multiple of 50, and with `workers: 1` nothing else writes to the room during this test.

### E2E global setup safety (`apps/web/e2e/global-setup.ts`)

- **Target database**: `E2E_DATABASE_URL` or `DATABASE_URL` from `apps/api/.env` = `postgresql://postgres:postgres@localhost:5435/web-hook`. This is the same database the compose stack serves (root `.env` `POSTGRES_DB=web-hook`, `POSTGRES_PORT=5435`). The cleanup therefore hits the room the E2E reads.
- **Participant filter**: `:31-34` `SELECT id FROM participants WHERE starts_with(name, $1)` with `$1 = 'e2e-web-'`. This is an exact, case-sensitive and parameterized prefix. `starts_with` has none of `LIKE`'s `_`/`%` wildcard pitfalls. Every web E2E file uses the same `PREFIX = 'e2e-web-'` (`chat.spec.ts:15`, `chat-realtime.spec.ts:12`, `chat-resilience.spec.ts:15`, `chat-extras.spec.ts:14`).
- **Dependent rows**: every other delete is keyed on those ids only:
  - `webhook_deliveries` where `payload #>> '{data,author,id}'` or `'{data,participant,id}'` is in the id set (`:36-41`). The envelope stored by `webhook-dispatcher.service.ts:50-62` is `{ type, occurredAt, data }`, so the paths are right.
  - Attempts go by `onDelete: Cascade` (`schema.prisma`, `WebhookDeliveryAttempt.delivery`).
  - `messages` where `participant_id = ANY(ids)`, then the participants themselves (`:42-45`).
  - With an empty id set, `= ANY('{}')` deletes nothing. `presence.changed` deliveries, which name no participant, are left alone.
- **Transaction**: `BEGIN` / `COMMIT` with `ROLLBACK` on any error (`:30,46-48`), and `client.end()` in `finally`. If some other table referenced a participant with `RESTRICT`, the transaction would roll back and the run would fail loudly. It would not delete partially.
- **Empirical check**: a snapshot of the non-`e2e-web-` rows was taken right before and right after `make e2e`.
  - Participants were 2 before and 2 after, with the same md5 of `id||name`.
  - Messages were 5 before and 5 after, with the same md5 of `id||content`.
  - Deliveries naming no `e2e-web-` participant (older than 1 h) went from 1 446 to 1 449. They grew only because the 1 h window slid; none were deleted.
- **Residual risk**: a real user who picks a name starting with `e2e-web-` would be deleted on the next `make e2e`. That is acceptable for a dev database and the same contract the api e2e uses (`apps/api/test/typing.e2e-spec.ts:116-135`). It is worth one line in the README.
- **Not run by design**: widening the filter (for example dropping the `WHERE`) would delete user data, so that mutant was reasoned about, not executed. No automated test guards the filter's width; the guard is code review plus the exact-prefix query.

---

## Edge Cases

- [x] Room with exactly 50 messages → button, click brings 0 and hides it: `chat-room.reducer.spec.ts:515-527`. The E2E formula also handles multiples of 50 (see above).
- [x] Live messages during the fetch: `chat-room.reducer.spec.ts:540-552`; `message-list.client.spec.tsx:426-462`.
- [x] Typing participant leaves → gone within 5 s: TTL `chat-stream.client.spec.tsx:448-470`.

---

## Discrimination Sensor

Depth: expanded (≥ 5 requested on the fix code). The unit mutants ran with `npx vitest run --project unit <dir>` in the scratch worktree. The E2E mutants ran `npx playwright test e2e/chat-extras.spec.ts -g "120 mensagens"` from the scratch worktree against the running stack, after `make e2e` had finished, so the main stack's run was not disturbed.

| Mutation | File:line                                                          | Description                                                               | Killing test(s)                                                                                                                     | Killed?     |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| M1       | `apps/web/src/features/chat/components/composer.client.tsx:49`     | Removed the composer reset in `submit()`                                  | `composer.client.spec.tsx:220` (1 failed / 111)                                                                                     | ✅ Killed   |
| M2       | `apps/api/src/modules/chat/services/messages.service.ts:56`        | `reset` moved to the top of `send` (also resets on replay, race, failure) | `messages.service.spec.ts:377`, `:387`, `:400` (3 failed / 151)                                                                     | ✅ Killed   |
| M3       | `apps/api/src/modules/chat/services/messages.service.ts:77`        | `reset` also on the `P2002` replay path                                   | `messages.service.spec.ts:387` (1 failed)                                                                                           | ✅ Killed   |
| M4       | `apps/api/src/modules/chat/services/typing.service.ts:36`          | `reset` clears every participant (`lastAccepted.clear()`)                 | `typing.service.spec.ts:87`, `messages.service.spec.ts:366` (2 failed)                                                              | ✅ Killed   |
| M5       | `apps/api/src/modules/chat/services/messages.service.ts:80`        | Removed `this.typing.reset(actor.id)`                                     | `messages.service.spec.ts:345`, `:356` (2 failed)                                                                                   | ✅ Killed   |
| M6       | `apps/web/src/features/chat/components/chat-stream.client.tsx:149` | Dropped the `.catch` (`void typing()`)                                    | `chat-stream.client.spec.tsx:578` (1 failed / 111)                                                                                  | ✅ Killed   |
| M7       | `apps/api/src/modules/chat/services/messages.service.ts:80`        | Resets the wrong key (`reset(content)` instead of the author's id)        | `messages.service.spec.ts:345`, `:356` (2 failed)                                                                                   | ✅ Killed   |
| M8       | `apps/web/e2e/chat-extras.spec.ts:217`                             | Click count off by one (`floor(total/50) + 1`)                            | E2E: `Expected: 3, Received: 2` (`2 cliques (sala com 138 mensagens)`)                                                              | ✅ Killed   |
| M9       | `apps/web/e2e/global-setup.ts:7`                                   | Cleanup filter narrowed (`'e2e-web-NOMATCH-'`: deletes nothing)           | none: passed with `5 cliques (sala com 284 mensagens)`, 13.9 s. The self-consistent formula has no oracle for "the room is bounded" | ❌ Survived |
| (M10)    | `apps/web/e2e/global-setup.ts:32`                                  | Filter widened (no `WHERE`)                                               | not executed: it would delete user data in the dev database. Reasoned: no test would fail                                           | n/a         |

**Sensor outcome**: 9 mutants were run on the fix code. 8 were killed and 1 (M9) survived. Every product-code mutant (M1-M7) and the click-count mutant (M8) were killed. M9 is in test-harness code. Its only detector is the 60 s timeout, which an unbounded room would hit after roughly 8-10 runs (≈ 440 messages per full run). It is recorded as residual note 1 with a one-line hardening, not as a spec gap: the spec and the T18 Done-when set no requirement that the harness detect its own cleanup failure. The M8/M9 runs left `e2e-web-` rows in the dev database, and the next `make e2e` global setup removes them.

---

## Code Quality

| Principle                                   | Status                                                                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Minimum code / no scope creep               | ✅ T16: 1 line in the web, a 3-line `reset` plus 1 call in the api. T17: a 3-line helper. T18: a 53-line setup plus `pg` dev dependency (same version as the api) |
| Surgical changes                            | ✅ Only the files named in tasks.md                                                                                                                               |
| Matches patterns                            | ✅ `.catch` like `deliver`/`loadOlder`; cleanup mirrors `apps/api/test/typing.e2e-spec.ts:116-135`                                                                |
| Spec-anchored outcome check                 | ✅                                                                                                                                                                |
| Per-layer coverage                          | ✅ AC13 is domain logic (service unit with the real `TypingService`); AC12 is a component unit test; the E2E covers the end-to-end paging                         |
| Every test maps to an AC / edge / Done-when | ✅                                                                                                                                                                |
| Guidelines                                  | `apps/api/ARCHITECTURE.md` §10, `apps/web/ARCHITECTURE.md` §8-§9, `packages/vitest-config/src/index.ts` (100% coverage, met)                                      |

---

## Gate Check

- **Gate command**: `TURBO_FORCE=true make gate`
  - Attempt 1: **exit 2**. Three 5 s timeouts (`apps/api/src/app/test/openapi.spec.ts:7`, `apps/api/test/webhooks.e2e-spec.ts:310`, `:355` `waitFor`) at load average 33.9 on 12 cores, while another agent was working in a separate worktree. None of them is in F4 code.
  - Attempt 2, immediately after: **exit 0**, 19/19 turbo tasks, 0 cached, 1 m 42 s.
    - api `test:cov`: **325 passed** (39 files), 100% coverage.
    - web `test:cov`: **639 passed** (58 files), 100% coverage; `test:storybook`: **152 passed** (34 files).
    - `@repo/api-client` 3, `@repo/vitest-config` 3.
    - No skipped tests.
- **E2E**: `make e2e` → **exit 0**, **21 passed** (4.0 min, 1 worker).
  - `chat-extras.spec.ts:120` (typing): 10.7 s.
  - `chat-extras.spec.ts:154` (paging): 13.7 s, `2 cliques (sala com 140 mensagens)`. This matches the author's two runs (13.9 s / 13.6 s), so 3 consecutive runs show the same click count.
- **Test count**:

  | Suite       | Iteration 1 | Iteration 2 | Change                                                 |
  | ----------- | ----------- | ----------- | ------------------------------------------------------ |
  | api         | 317         | 325         | +8 (6 `MessagesService` AC13, 2 `TypingService` reset) |
  | web unit    | 637         | 639         | +2 (AC12, unhandled rejection)                         |
  | web stories | 152         | 152         | none                                                   |
  | E2E         | 21          | 21          | none                                                   |

  No test was removed or weakened. The paging E2E replaced "loop until the button is gone" with the same loop plus an exact click-count assertion, and the timeout went from 300 s to 60 s.

---

## Residual notes (not gaps against F4 ACs)

1. **E2E harness has no oracle for a bounded room (M9)**: if the global setup stops deleting, for example because the prefix changed in one place, the paging E2E still passes and only gets slower until the 60 s timeout. One-line hardening: `expect(room.length).toBeLessThan(150)` (or `expect(clicks).toBe(2)`) next to `chat-extras.spec.ts:217`, or have `global-setup.ts` assert that 0 `e2e-web-` participants remain after `COMMIT`.
2. **Global setup deletes any participant named `e2e-web-…`**: a real dev user with that prefix loses their rows on the next `make e2e`. Document it in the README.
3. **`toSse` non-exhaustive** (`apps/web/src/features/chat/realtime/chat-hub.ts:35-48`): any `HubEvent` type without a branch falls through to `event: presence`. Make it a `switch` with a `never` default so a future event type fails the typecheck.
4. **Dev HMR stale `ChatHub`** (`chat-hub.ts`, `getChatHub()` on `globalThis`): under `next dev`, old instances keep old code after edits to the hub. Production and `make e2e` rebuilds are unaffected. Optional dev-only hardening: replace the global when `!(hub instanceof ChatHub)`.
5. **Typing / message webhook ordering**: `typing.started` and `message.created` are independent deliveries. A `typing` notice for the next reply can arrive before the author's previous `message.created`, which AC9 then clears, so the notice comes back only at the next 3 s notify. The reverse case (a stale `typing` after the message) was noted in iteration 1. Neither is covered by an AC.
6. **Gate sensitivity to load**: three api tests use the default 5 s timeout and fail under heavy concurrent load (attempt 1). Not F4 code.

---

## Lessons lens

- **L-026** (catch fire-and-forget Server Action rejections) and **L-027** (bound the data an E2E pages through): both fixes applied, and neither signal recurs.
- New signal: **surviving mutant M9** (test-harness cleanup without an oracle for its own effect). Recorded as a candidate lesson via `lessons.py` (scope `e2e`).
- **L-022** (success criteria vs the spec's own limits): T15 resolved it the right way, by adding ACs rather than relaxing the goal. Not a new recurrence.

---

## Requirement Traceability Update

| Requirement | Previous Status (iteration 1) | New Status  |
| ----------- | ----------------------------- | ----------- |
| TYPE-01     | ❌ Needs Fix (Gap 1, Gap 2)   | ✅ Verified |
| TYPE-02     | ✅ Verified                   | ✅ Verified |
| HIST-01     | ✅ Verified (Gap 3)           | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 20/20 ACs matched the spec outcome; 0 spec-precision gaps
**Sensor**: 9 injected on the fix code, 8 killed, 1 survived (M9, test harness, residual note 1); M10 reasoned, not run
**Gate**: `TURBO_FORCE=true make gate` exit 0 (api 325, web 639 + 152 stories, 100%) on the second attempt; `make e2e` exit 0 (21 passed, 2 clicks / 140 messages)

**What works**:

- A send restarts both typing windows: the Composer's 3 s and the api's 2 s per author. A replay, the `P2002` race and a failed `create` do not restart them.
- A browser-side transport failure of `notifyTyping` is swallowed.
- The paging E2E runs on a bounded room, with the exact click count, in about 14 s. Its transactional cleanup touches only `e2e-web-` rows and the rows tied to them.

**Next steps**:

- Update the spec traceability statuses to Verified.
- Optional follow-ups: residual notes 1-3.
