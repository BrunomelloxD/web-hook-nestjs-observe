# chat-webhooks (F2) - verification report

**Result**: PASS ✅. All 35 ACs (13 emitter, 9 receiver, 13 SSE) and 5 edge cases have evidence that matches the spec-defined outcome. Build gate, api e2e and web E2E are green. Sensor: 17/17 behavior mutants killed. Four spec-precision notes are flagged below; none is a defect.

**Iteration**: 1
**Date**: 2026-10-29
**Spec**: `.specs/features/chat-webhooks/spec.md`
**Diff range**: F0, F1 and F2 share the single commit `6f1eb41`, so the surface is the files named in the "Where" of T1-T25 plus their tests and the files those tasks' execution notes name (`webhooks.module.ts`, `chat.module.ts`, `app/chat/stream/route.ts`, `app/webhooks/chat/route.ts`, `test/webhooks.ts`, `test/fake-event-source.ts`, `docker-compose.yml`, `vitest.config.ts`, `playwright.config.ts`).
**Verifier**: independent sub-agent (author ≠ verifier). It did not edit code or tests. Mutations ran only in a temporary `git worktree` under the session scratchpad (`node_modules` symlinked, `src/generated` and `.env` copied), restored with `git checkout` inside the worktree after each mutant, then removed with `git worktree remove --force`. api mutants ran against **unit tests only**, so no mutant touched the shared database or port 4599. `git status --porcelain` of the real tree was empty before the gate and empty after the sensor cleanup (before this report was written).

---

## Task Completion

| Task   | Status  | Notes                                                                                                                                                                                                                                                                                                               |
| ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1-T25 | ✅ Done | All `Done when` boxes checked. Documented deviations (T2 migration via `migrate diff`, T7 module wiring, T9 e2e `fileParallelism: false` and dispatcher stub in `chat.e2e-spec.ts`, T16 `no-transform`, T25 `workers: 1` and F1 E2E assertion removed with user approval) were reviewed and do not weaken any F2 AC |

---

## Spec-Anchored Acceptance Criteria

Paths are relative to the repo root. `api/` = `apps/api/`, `web/` = `apps/web/`, `wh/` = `apps/api/src/modules/webhooks/`, `rt/` = `apps/web/src/features/chat/realtime/`.

### P1: A api emite webhooks assinados e confiáveis (WHOUT-01..04)

| AC  | Spec-defined outcome                                                                               | `file:line` + assertion                                                                                                                                                                                                                                                                                                                                                            | Result  |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | After the message commit, `message.created` with `data` = `MessageResponseDto`                     | `api/src/modules/chat/services/test/messages.service.spec.ts:174-184` `toHaveBeenCalledWith('message.created', {id, seq: 1042, type: 'USER', …})` and `dispatch.mock.calls[0][1]).toEqual(result)`; `:192` not called when the repo throws. e2e `api/test/webhooks.e2e-spec.ts:194-198` `envelope(hook)).toEqual({ type: 'message.created', …, data: res.body })`                  | ✅ PASS |
| 2   | After join/leave commit, `presence.changed` with `data = { online }`                               | `participants.service.spec.ts:126` join calls `toEqual([['message.created', JOINED dto], ['presence.changed', { online: 4 }]])`; `:228-247` leave → `LEFT`, `{ online: 0 }`, `countOnline` ordered after `leaveWithMessage`; `:105,188,198,256` no dispatch on 409/404/401/error. e2e `webhooks.e2e-spec.ts:301-305` `data: { online }` from DB count. M6 killed                   | ✅ PASS |
| 3   | `POST /messages`, `/participants`, `/participants/:id/leave` answer without waiting for delivery   | `wh/services/test/webhook-dispatcher.service.spec.ts:93-101` `dispatch(...)).toBeUndefined()`, `repository.create` and `http.post` not called until the next tick; e2e `webhooks.e2e-spec.ts:172-180` `atResponse).toEqual([])` (no hook at 201 time); `:315-317` target down → `201`. Join/leave rely on the same sync `dispatch` (see note 3)                                    | ✅ PASS |
| 4   | `POST {WEBHOOK_TARGET_URL}`, body `{ type, occurredAt, data }`, the 4 headers                      | `webhook-dispatcher.service.spec.ts:108-121` `url).toBe(TARGET_URL)`, body exact JSON, keys `['type','occurredAt','data']`; `:129-137` header keys sorted equal the 4 names, `content-type` `'application/json'`; `wh/http/test/webhook-http-client.spec.ts:125-130` method `POST`, body and headers passed unchanged; e2e `webhooks.e2e-spec.ts:181,193`                          | ✅ PASS |
| 5   | `v1,` + base64(HMAC-SHA256(key, "{id}.{ts}.{body}")), official vectors                             | `wh/signing/test/standard-webhooks.spec.ts:31-39` official vector → `toBe('v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=')` (source cited `:3-5`); `:42-51` one extra byte changes it; dispatcher `:138-140` vs an independent `createHmac` oracle. M1 killed                                                                                                                    | ✅ PASS |
| 6   | Same `webhook-id` on every attempt; new timestamp and signature                                    | `webhook-dispatcher.service.spec.ts:284-292` `h2['webhook-id']).toBe(h1[...])`, `body2).toBe(body1)`, timestamps `'1791979200'` → `'1791979201'`, signature recomputed; e2e `webhooks.e2e-spec.ts:237-252` 3 attempts, one body, each signature valid, `t2-t1 ≥ 1`, `t3-t2 ≥ 5`. M5 killed                                                                                         | ✅ PASS |
| 7   | `2xx` → `SUCCEEDED`                                                                                | `webhook-dispatcher.service.spec.ts:172-197` (200, 204, 299) `markStatus(DELIVERY_ID, 'SUCCEEDED')`, no timer; e2e `:204-210` `status SUCCEEDED, attempts: 1, lastStatus: 204`                                                                                                                                                                                                     | ✅ PASS |
| 8   | Non-2xx, connection failure or no response in 5 s → failed attempt                                 | `webhook-dispatcher.service.spec.ts:200-223` (300, 404, 500, null, timeout) record + 1 timer, no status; `webhook-http-client.spec.ts:139` `AbortSignal.timeout` called with `5000`; `:176-188` `TimeoutError` → `{ status: null, error: 'timeout' }`; `:164-173` network error. M4 killed                                                                                         | ✅ PASS |
| 9   | Failure N=1..5 → next after 1 s, 5 s, 30 s, 2 min, 10 min                                          | `webhook-dispatcher.service.spec.ts:227-241` for each delay: `delay-1` ms → still `index+1` calls; `+1` ms → `index+2`. M2 killed                                                                                                                                                                                                                                                  | ✅ PASS |
| 10  | 6th failure → `FAILED`, no more attempts                                                           | `webhook-dispatcher.service.spec.ts:243-250` attempts `[1..6]`, `markStatus(…, 'FAILED')` once, `getTimerCount()` 0, still 6 calls after 24 h; `:295-309` `maxAttempts: 1`. M3 killed                                                                                                                                                                                              | ✅ PASS |
| 11  | One `WebhookDelivery` per event; one attempt row with number, HTTP code or null, ms, error or null | `wh/repositories/test/webhook-delivery.repository.spec.ts:70-96` attempt insert + delivery update inside `tx`, never through `prisma`; `:98-119` null code + `'timeout'`; dispatcher `:148-159`, `:264-268`; e2e `webhooks.e2e-spec.ts:260-274` history `[{1,500,null},{2,500,null},{3,204,null}]`, integer `durationMs ≥ 0`; `:326-330` `statusCode: null, error: 'fetch failed'` | ✅ PASS |
| 12  | zod validation of `WEBHOOK_TARGET_URL` (URL) and `WEBHOOK_SECRET` (`whsec_` + base64) at startup   | `api/src/common/config/test/env.schema.spec.ts:48-72` missing/invalid URL `toThrow(/WEBHOOK_TARGET_URL/)`; `:76-116` 12 rejected secrets (`whsec_` only, base64url, spaces, `===`, placeholder) and 4 accepted; `app-config.service.spec.ts:22-31` getters                                                                                                                         | ✅ PASS |
| 13  | `chat` depends only on `WebhookDispatcher.dispatch(type, data)`                                    | `api/src/modules/chat/services/messages.service.ts:3,18,49` and `participants.service.ts:59,77,119-125`: only `dispatch`, no config/URL/secret import; the specs inject `{ dispatch: vi.fn() }` only (`messages.service.spec.ts:19`, `participants.service.spec.ts:30`)                                                                                                            | ✅ PASS |

### P1: O web recebe o webhook com segurança (WHIN-01..03)

| AC  | Spec-defined outcome                                                                         | `file:line` + assertion                                                                                                                                                                                                                                               | Result                         |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | Raw body, signature over those bytes, constant-time compare                                  | `rt/handle-chat-webhook.spec.ts:243-251` non-canonical JSON signed as sent → `204`; `rt/verify-webhook.spec.ts:143-150` `timingSafeEqual` called with the decoded digests; `:33-35` official vector `{ ok: true }`. M9, M10 killed                                    | ✅ PASS                        |
| 2   | Missing or wrong signature → `401`, no publish                                               | `handle-chat-webhook.spec.ts:285-329` (missing, other secret) `status).toBe(401)`, `chunks).toEqual([])`, `warn` with reason and id only, body not in the log; `verify-webhook.spec.ts:57-68,96-120`. M8 killed                                                       | ✅ PASS                        |
| 3   | `                                                                                            | now − ts                                                                                                                                                                                                                                                              | > 300 s`→`401`, no publish     | `verify-webhook.spec.ts:72-87` 300 s past/future `{ ok: true }`, 301 s past/future `reason: 'timestamp'`; `handle-chat-webhook.spec.ts:301-308` 301 s → `401`, no chunk. M7 killed | ✅ PASS |
| 4   | Body outside a known `{ type, occurredAt, data }` → `400`, no publish                        | `handle-chat-webhook.spec.ts:346-372` non-JSON, unknown type, `data` without `seq` → `400`, `chunks).toEqual([])`; schema `web/src/features/chat/schemas/webhook-envelope.schema.spec.ts:29-62+`                                                                      | ✅ PASS                        |
| 5   | `webhook-id` among the last 1000 → `204`, no publish                                         | `handle-chat-webhook.spec.ts:268-278` both `204`, `chunks).toEqual([messageChunk])` once; `rt/recent-ids.spec.ts:182-205` 1000 kept, 1001st evicts the 1st, 1002nd the 2nd. M11 killed                                                                                | ✅ PASS                        |
| 6   | Valid and new → publish to hub, `204`                                                        | `handle-chat-webhook.spec.ts:218-241` `204` and the exact SSE chunk for `message` and `presence`                                                                                                                                                                      | ✅ PASS                        |
| 7   | No network call before answering                                                             | `handle-chat-webhook.spec.ts:206-208,225` MSW `request:start` list `toEqual([])` (plus `onUnhandledRequest: 'error'` in setup)                                                                                                                                        | ✅ PASS                        |
| 8   | zod validation of `WEBHOOK_SECRET` at startup                                                | `web/src/lib/env.spec.ts:28-50` missing/malformed → `Variáveis de ambiente inválidas … WEBHOOK_SECRET`; `web/src/instrumentation.spec.ts:6-20` `register()` on `nodejs` rejects; `:29-40` edge/build skip                                                             | ✅ PASS                        |
| 9   | `make install` creates the `.env` files with one random 32-byte secret shared by api and web | `Makefile:10` `randomBytes(32)`, `Makefile:71` `sed` of `<webhook-secret>`. Re-checked by the verifier in a scratch copy: `make env` created 3 files, api and web `WEBHOOK_SECRET` identical, regex OK, decodes to 32 bytes. No automated test (infra, matrix "none") | ⚠️ PASS, spec-precision note 4 |

### P1: O navegador recebe eventos por SSE (SSE-01..03)

| AC  | Spec-defined outcome                                                                               | `file:line` + assertion                                                                                                                                                                                                                                                                                                                                 | Result                         |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | No valid session → `401`                                                                           | `rt/open-chat-stream.spec.ts:56-64` `status).toBe(401)`, `connectionCount()` 0                                                                                                                                                                                                                                                                          | ✅ PASS                        |
| 2   | `200`, `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, registered in hub  | `open-chat-stream.spec.ts:68-81` `200`, `'text/event-stream'`, `'no-cache, no-transform'`, `'no'`, `connectionCount(me.id)` 1; `rt/sse.spec.ts:157-165`                                                                                                                                                                                                 | ⚠️ PASS, spec-precision note 1 |
| 3   | `message.created` → every open connection gets `event: message`, `id:` = `seq`, `data:` = DTO JSON | `rt/chat-hub.spec.ts:28-39` both connections `toEqual(['id: 7\nevent: message\ndata: {…}\n\n'])`; `open-chat-stream.spec.ts:96-110` reaches the stream. M13 killed                                                                                                                                                                                      | ✅ PASS                        |
| 4   | `presence.changed` → `event: presence`, `data: {"online":N}`, no `id:`                             | `chat-hub.spec.ts:41-49` `toEqual(['event: presence\ndata: {"online":3}\n\n'])`. M14 killed                                                                                                                                                                                                                                                             | ✅ PASS                        |
| 5   | `: heartbeat` every 25 s                                                                           | `open-chat-stream.spec.ts:112-129` nothing at 24 999 ms, one at 25 000, two at 50 000; `sse.spec.ts:151-154`. M16 killed                                                                                                                                                                                                                                | ✅ PASS                        |
| 6   | Browser closes → removed from hub                                                                  | `open-chat-stream.spec.ts:133-146` abort → `connectionCount()` 0, stream done, no timer; `:148-161` `cancel`; `:163-174` already aborted. M15 killed                                                                                                                                                                                                    | ✅ PASS                        |
| 7   | Route dynamic, never cached or prerendered                                                         | `make gate` `next build` output: `├ ƒ /chat/stream` (and `└ ƒ /webhooks/chat`); `open-chat-stream.ts:12` reads `cookies()` via `getValidSession()`. Build output, no unit assertion                                                                                                                                                                     | ⚠️ PASS, spec-precision note 2 |
| 8   | `ChatStream.client` is the only component opening an `EventSource`, to `/chat/stream`              | `web/src/features/chat/components/chat-stream.client.spec.tsx:58-68` one source, url `/chat/stream`, closed on unmount; `state/use-chat-events.spec.ts:16-47`; `containers/chat-room.container.spec.tsx:54-70` one connection through the container. Grep: only `chat-stream.client.tsx` and `use-chat-events.ts` reference `EventSource` outside tests | ✅ PASS                        |
| 9   | New `seq` inserted in ascending order                                                              | `state/chat-room.reducer.spec.ts:29-88` end/middle/start/empty/out-of-order `seqs(next)).toEqual([…])`; `chat-stream.client.spec.tsx:71-83` `['primeira','segunda','terceira','quarta']`                                                                                                                                                                | ✅ PASS                        |
| 10  | `seq` already present → ignored                                                                    | `chat-room.reducer.spec.ts:90-106` same state reference for seq 1/3/5; `chat-stream.client.spec.tsx:86-101`. M17 killed                                                                                                                                                                                                                                 | ✅ PASS                        |
| 11  | `presence` → header "{online} pessoas online"                                                      | `chat-stream.client.spec.tsx:118-125` `getByText('4 pessoas online')`; reducer `:120-129`; E2E `web/e2e/chat-realtime.spec.ts:124-133`                                                                                                                                                                                                                  | ✅ PASS                        |
| 12  | Native `EventSource` reconnection, no polling code                                                 | `state/use-chat-events.spec.ts:101-117` after `error` + 60 s: one instance, not closed, `getTimerCount()` 0, no `fetch`; server sends `retry: 3000` (`open-chat-stream.spec.ts:85-94`)                                                                                                                                                                  | ✅ PASS                        |
| 13  | No `setInterval`, recurring `setTimeout` or periodic requests for messages/presence                | E2E `web/e2e/chat-realtime.spec.ts:192-206` 30 s idle: `b.requests.slice(before)).toEqual([])`, one `/chat/stream`; `:138-140` no reload, one stream per page; `send-message.spec.ts:108` `refresh).not.toHaveBeenCalled()`. Grep: the only timer outside tests is the server heartbeat (`open-chat-stream.ts:30`), required by AC5                     | ✅ PASS                        |

**Status**: ✅ All 35 ACs covered. ⚠️ 4 spec-precision notes.

### Spec-precision notes

1. **`Cache-Control` value (SSE-01 AC2).** The spec says `no-cache`; the code and the test assert `no-cache, no-transform` (design.md, T16 note). The `no-cache` directive is present, so the outcome holds. The spec should state the full header value.
2. **"Dynamic, never prerendered" (SSE-01 AC7)** is proven by the `next build` route table (`ƒ`), not by a test that fails on regression. A build-output check in CI would make it a sensor.
3. **"Without waiting" for `/participants` and `/leave` (WHOUT AC3).** Only `POST /messages` has an e2e timing assertion. Join/leave inherit it from the synchronous `dispatch` (unit spec `:93-101`); they do await one `countOnline()` read, which the spec allows (premise "lida depois do commit").
4. **Makefile secret (WHIN-03 AC9)** has no automated test by design (Test Coverage Matrix: infra, none). Verified manually by the verifier this run.

---

## Edge Cases

- [x] Target down when the message is stored → `201` and background retry: `api/test/webhooks.e2e-spec.ts:309-330` (`201`, delivery `PENDING`, attempt 1 `statusCode: null`, `error: 'fetch failed'`)
- [x] Same webhook twice → message shown once: `handle-chat-webhook.spec.ts:268-278` (published once) + `chat-stream.client.spec.tsx:86-93` (rendered once)
- [x] No open SSE connection → `204`, event dropped: `handle-chat-webhook.spec.ts:254-264`
- [x] Body changed by one byte → `401`: `handle-chat-webhook.spec.ts:309-316`; `verify-webhook.spec.ts:98`
- [x] Browser disconnects while the hub writes → only that connection removed: `chat-hub.spec.ts:51-68` (`write` called once, other connection gets both chunks, `connectionCount()` 1)

---

## Discrimination Sensor

Scratch: `git worktree add --detach <scratchpad>/wt HEAD`; every `node_modules` symlinked from the real tree; `apps/api/src/generated` and the `.env` files copied. Scratch baseline: api targeted unit 63 passed; web targeted unit 87 passed. A harness (`mutate.py`) applied each mutation as an exact single-occurrence string replacement (asserted count = 1), ran the covering unit specs, and restored the file with `git checkout` inside the worktree. The worktree was then removed and pruned; `git worktree list` shows only the main tree; real-tree `git status --porcelain` was empty, matching the baseline.

| #   | Mutation                                                               | File:line                                                            | AC               | Killed?                                                 |
| --- | ---------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------- | ------------------------------------------------------- |
| M1  | HMAC input `"{id}.{ts}.{body}"` → `"{id}.{body}.{ts}"`                 | `wh/signing/standard-webhooks.ts:23`                                 | WHOUT AC5        | ✅ Killed (3: official vector, header test, retry test) |
| M2  | Retry delay `RETRY_DELAYS_MS[number - 1]` → `[number]`                 | `wh/services/webhook-dispatcher.service.ts:122`                      | WHOUT AC9        | ✅ Killed (3)                                           |
| M3  | `number >= maxAttempts` → `>` (7 attempts)                             | `wh/services/webhook-dispatcher.service.ts:118`                      | WHOUT AC10       | ✅ Killed (2)                                           |
| M4  | 2xx bound `status < 300` → `<= 300`                                    | `wh/services/webhook-dispatcher.service.ts:101`                      | WHOUT AC7-8      | ✅ Killed (`300 conta como falha`)                      |
| M5  | Timestamp computed once per delivery, reused on retries                | `wh/services/webhook-dispatcher.service.ts:80`                       | WHOUT AC6        | ✅ Killed (`repete o webhook-id …`)                     |
| M6  | `presence.changed` dispatched before `message.created`                 | `apps/api/src/modules/chat/services/participants.service.ts:119-125` | WHOUT AC2        | ✅ Killed (join + leave)                                |
| M7  | Timestamp tolerance `> 300` → `>= 300`                                 | `rt/verify-webhook.ts:32`                                            | WHIN AC3         | ✅ Killed (300 s past/future)                           |
| M8  | Signature list `.some` → `.every`                                      | `rt/verify-webhook.ts:50`                                            | WHIN AC1-2       | ✅ Killed (3)                                           |
| M9  | `timingSafeEqual` → `Buffer.equals` (not constant-time)                | `rt/verify-webhook.ts:52-53`                                         | WHIN AC1         | ✅ Killed (`timingSafeEqual` spy)                       |
| M10 | Verify over `JSON.stringify(JSON.parse(rawBody))` instead of raw bytes | `rt/handle-chat-webhook.ts:26`                                       | WHIN AC1, edge 4 | ✅ Killed (2: raw-bytes test, one-byte-more test)       |
| M11 | Dedupe removed (`if (!recentIds.has(id))` → `if (true)`)               | `rt/handle-chat-webhook.ts:45`                                       | WHIN AC5, edge 2 | ✅ Killed                                               |
| M12 | Hub keeps a connection whose `write` threw                             | `rt/chat-hub.ts:46`                                                  | SSE AC6, edge 5  | ✅ Killed                                               |
| M13 | Hub fan-out stops after the first connection (`break`)                 | `rt/chat-hub.ts:43`                                                  | SSE AC3          | ✅ Killed                                               |
| M14 | `presence` event written with `id: 0`                                  | `rt/chat-hub.ts:25`                                                  | SSE AC4          | ✅ Killed (4)                                           |
| M15 | Stream cleanup no longer unsubscribes from the hub                     | `rt/open-chat-stream.ts:37`                                          | SSE AC6          | ✅ Killed (2: cancel, already-aborted)                  |
| M16 | Heartbeat `setInterval` → one-shot `setTimeout`                        | `rt/open-chat-stream.ts:30`                                          | SSE AC5          | ✅ Killed (4)                                           |
| M17 | Reducer `lowerBound` `<` → `<=` (duplicate `seq` inserted)             | `apps/web/src/features/chat/state/chat-room.reducer.ts:22`           | SSE AC9-10       | ✅ Killed (5, incl. `ChatStream` spec)                  |

**Sensor depth**: expanded (≥5; covers signing, retry schedule, status classification, web signature verification, dedupe, hub fan-out, SSE stream lifecycle, browser ordering).
**Result**: 17/17 killed - PASS ✅

---

## Code Quality

| Principle                                                                                                                                      | Status                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Minimum code                                                                                                                                   | ✅                                                                      |
| Surgical changes                                                                                                                               | ✅                                                                      |
| No scope creep (no `Last-Event-ID`, typing, outbox, subscription table)                                                                        | ✅                                                                      |
| Matches patterns (repository contract + Prisma impl, `globalThis` singletons per AD-003, feature barrel)                                       | ✅                                                                      |
| Spec-anchored outcome check (asserted values match spec)                                                                                       | ✅ (4 notes)                                                            |
| Per-layer Coverage Expectation met (unit 100% api and web; e2e happy + retry + target-down)                                                    | ✅                                                                      |
| Every test maps to a spec requirement - no unclaimed tests                                                                                     | ✅ (extra tests map to Done-when items: log fields, shutdown, `retry:`) |
| Documented guidelines followed: `apps/api/ARCHITECTURE.md` §10, `apps/web/ARCHITECTURE.md` §8-§9, `packages/vitest-config/src/index.ts` (100%) | ✅                                                                      |

---

## Gate Check

- **Build gate**: `TURBO_FORCE=true make gate` → exit 0. Turbo 19/19 tasks, 0 cached. api `test:cov` 282 passed, 100% all metrics. web `test:cov` 497 passed, 100%. web `test:storybook` 122 passed. Lint 0 warnings, 0 errors. `next build`: `├ ƒ /chat/stream`, `└ ƒ /webhooks/chat`.
- **api Full**: `npm run test:e2e --workspace=apps/api` → exit 0, 3 files, 51 tests passed (includes `webhooks.e2e-spec.ts`).
- **E2E**: `make e2e` → exit 0, 15/15 passed. `chat-realtime.spec.ts`: p95 A → B = 99 ms over 20 messages (min 75, max 100); 30 s idle with no new request.
- **Test count**: api 282, web 497 unit / 122 stories, matching T25's recorded totals. No skips.
- **Failures**: none.

---

## Fix Plans

None.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status  |
| ----------- | --------------- | ----------- |
| WHOUT-01    | Implemented     | ✅ Verified |
| WHOUT-02    | Implemented     | ✅ Verified |
| WHOUT-03    | Implemented     | ✅ Verified |
| WHOUT-04    | Implemented     | ✅ Verified |
| WHIN-01     | Implemented     | ✅ Verified |
| WHIN-02     | In Tasks        | ✅ Verified |
| WHIN-03     | In Tasks        | ✅ Verified |
| SSE-01      | In Tasks        | ✅ Verified |
| SSE-02      | In Tasks        | ✅ Verified |
| SSE-03      | In Tasks        | ✅ Verified |

(The verifier does not edit `spec.md`; the orchestrator applies this table.)

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 35/35 ACs matched the spec outcome; 4 spec-precision notes (none a defect)
**Sensor**: 17/17 mutations killed
**Gate**: make gate exit 0 (api 282, web 497 + 122 stories, 100% coverage); api e2e 51/51; make e2e 15/15

**What works**: signed Standard Webhooks delivery with the exact retry schedule and per-attempt history; web receiver that verifies the raw bytes in constant time, rejects stale or tampered webhooks and dedupes ids; in-memory hub fan-out to SSE with heartbeat and cleanup; browser list ordered by `seq` without duplicates; no polling (p95 99 ms locally).

**Next steps**: update the traceability statuses in `spec.md`; optionally tighten the spec wording behind notes 1-4.
