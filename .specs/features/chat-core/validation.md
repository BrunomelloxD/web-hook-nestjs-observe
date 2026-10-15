# chat-core (F1) - verification report

**Result**: PASS ✅. All 46 ACs and 6 edge cases have evidence that matches the spec-defined outcome. The iteration-1 gap is closed: W31 (token serialized into the RSC payload) is now killed by `apps/web/e2e/chat.spec.ts:286-337`, run against a separate scratch Next server. The `name_key` widening and the e2e robustness fix hold. Gate and E2E are green. Sensor: 44/44 killed. Six spec-precision gaps from iteration 1 remain flagged; they are not defects.

**Iteration**: 2 (after fix round 1)
**Date**: 2026-10-14
**Spec**: `.specs/features/chat-core/spec.md`
**Diff range**: `mtime > chat-theme/validation.md → working tree (2026-10-15)`. That is 117 files (excluding node_modules/.next/.turbo/coverage/dist/storybook-static/test-results/playwright-report/generated), consistent with the "Where" of T1-T38. Files touched by fix round 1 (newer than the iteration-1 report): `apps/api/test/chat.e2e-spec.ts`, `apps/api/prisma/migrations/20261015021518_widen_name_key/migration.sql`, `apps/api/prisma/schema.prisma`, `apps/web/e2e/chat.spec.ts`, `apps/api/openapi.json`, `packages/api-client/src/schema.d.ts`, `.specs/features/chat-core/tasks.md`, plus `.specs/LESSONS.md`/`lessons.json` and two `tsbuildinfo` files.
**Verifier**: independent sub-agent (author ≠ verifier). It did not edit code or tests. Mutations ran only in `scratchpad/reverify-chat-core`. api mutants ran against **unit tests only**, so no mutant wrote to the shared `web-hook` database. W31 ran against a scratch Next dev server on port 3100. SHA-256 of 309 source/test/config/doc files of the real tree was identical before the sensor and after the gate + E2E (`sha256sum -c`: all match).

---

## Fix round 1 claims

| #   | Claim                                                                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Verdict     |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1   | New E2E keeps the token and api hosts from reaching the browser; kills W31 | `apps/web/e2e/chat.spec.ts:286-337`. It collects every response body the page receives (`:293-297`), plus `/chat` as HTML (`:315-317`, `text/html`) and as RSC (`:318-320`, `text/x-component`). It asserts `body.includes(token)` is `false` (`:332`) and that neither the host api `new URL(API_URL).host` nor `api:<port>` appears (`:329-335`). The token is read from the cookie and its shape checked (`:308-312`). Baseline on the scratch server: pass. **W31 in the scratch: failed with `token sent to the browser` (`:332`)**. The fresh variants F18 (api URL prop) and F19 (token through `Composer`) were also killed.                                                                                                                                                                                         | ✅ Verified |
| 2   | `name_key` → `VARCHAR(60)`; `'İ'.repeat(20)` → 201, again → 409            | Migration SQL is one `ALTER … SET DATA TYPE VARCHAR(60)`. `apps/api/prisma/schema.prisma:20` `@db.VarChar(60)`. DB (read-only `information_schema`): `name_key` varchar 60, both migrations finished, `participants_online_name_key … WHERE (left_at IS NULL)` intact. Test `apps/api/test/chat.e2e-spec.ts:157-177`: `expect(res.status).toBe(201)`, name equal, key length 40, 1 online; again `toBe(409)`, still 1. The bound was checked by an exhaustive scan over every code point the name regex accepts. The maximum NFC+lowercase growth is 3 (U+FB2C, U+FB2D), and `'שּׁ'.repeat(20)` passes the DTO regex with a 60-code-point key, so 60 is tight and enough. Reverting to `VARCHAR(20)` needs the DB, so it was **not run (needs isolated DB)**. Fixer's evidence: `expected 500 to be 201` before the migration. | ✅ Verified |
| 3   | `400 … sem gravar` counts before/after its own request; sort comparator    | `chat.e2e-spec.ts:184-195` `before = await stored()` … `expect(await stored()).toBe(before)`. Gate passed with the 3 stray rows (`Q`, `'  e2e-api-Ana  '`, `'     '`) still in the DB, which is the case that failed in iteration 1. `:139` `.sort((a, b) => a - b)`. Lint: 0 warnings in api (the iteration-1 warning is gone)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ✅ Verified |

---

## Task Completion

| Task   | Status  | Notes                                                                                                                                 |
| ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| T1-T37 | ✅ Done | Unchanged since iteration 1 except the T2 fix note (migration `widen_name_key`) and the T15 fix note (e2e cases), both verified above |
| T38    | ✅ Done | 8 chat scenarios + 4 theme scenarios = 12/12 in this run (iteration 1: 11; +1 BFF-01 scenario)                                        |

---

## Spec-Anchored Acceptance Criteria

Paths are relative to the repo root. `api/` = `apps/api/`, `web/` = `apps/web/`. Citations were re-anchored to current line numbers.

### P1: Entrar com um nome (JOIN-01, JOIN-02, JOIN-03)

| AC  | Spec-defined outcome                                                                      | `file:line` + assertion                                                                                                                                                                                                                                                        | Result                        |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 1   | One field "Seu nome", button "Entrar no chat"                                             | `web/src/features/chat/components/join-form.client.spec.tsx:27` `getAllByRole('textbox')).toHaveLength(1)`; `:28` `{ name: 'Seu nome' }`; `:33` `{ name: 'Entrar no chat' }`; wiring `web/src/app/page.spec.tsx:20`                                                            | ✅ PASS                       |
| 2   | Name < 2 or > 20 after trim → field error, no api call                                    | `web/src/features/chat/actions/join.spec.ts:55-79` (`'A'`, `' A '`, 21 chars, `''`) `expect(calls).toEqual([])` + literal message; field binding `join-form.client.spec.tsx:64-80` (`aria-describedby`). Mutant F10 killed                                                     | ⚠️ PASS, spec-precision gap 1 |
| 3   | Forbidden character → same                                                                | `join.spec.ts:59` (`'Ana!'`); `web/src/features/chat/schemas/join-form.schema.spec.ts:7,32`                                                                                                                                                                                    | ⚠️ PASS, spec-precision gap 1 |
| 4   | Invalid name → `400`                                                                      | `api/test/chat.e2e-spec.ts:179-195` `expect(res.status).toBe(400)` for 1 char, 21 chars, `!`, blank, no new row; `:197-199` missing field. Unit: A16 killed (`join-participant.dto` spec)                                                                                      | ✅ PASS                       |
| 5   | Same name online, case-insensitive → `409`                                                | `chat.e2e-spec.ts:122-130` `toBe(409)` + 1 online; `:132-143` concurrent `[201, 409]`; `:170-176` expanding name; `api/src/modules/chat/security/test/participant-token.spec.ts:40,46`. A6, F1 killed                                                                          | ✅ PASS                       |
| 6   | `409` → "Esse nome já está em uso na sala." in the field                                  | `join.spec.ts:81-93` literal; `web/e2e/chat.spec.ts:113-116` visible + `aria-invalid`. W13 killed                                                                                                                                                                              | ✅ PASS                       |
| 7   | Valid, free → `201 { id, name, token, joinedAt }`, name trimmed                           | `chat.e2e-spec.ts:95-103` `toEqual({ id: UUID, name: 'e2e-api-Ana', token: /^[A-Za-z0-9_-]{43}$/, joinedAt: ISO })`; 2/20 chars `:145-155`; lowercase-expanding 20-char name `:157-168` (iteration-1 gap 2 closed). F15 killed                                                 | ✅ PASS                       |
| 8   | Only the hash stored; raw token only in the `POST` response                               | `chat.e2e-spec.ts:110` `expect(stored.tokenHash).toBe(sha256(ana.token))`; unit `participants.service.spec` (A5 killed)                                                                                                                                                        | ✅ PASS                       |
| 9   | `JOINED`, empty content, same transaction                                                 | `chat.e2e-spec.ts:114-119`; `api/src/modules/chat/repositories/test/participant.repository.spec.ts:46`. A22 killed                                                                                                                                                             | ✅ PASS                       |
| 10  | Cookie `chat_session` httpOnly, Lax, Secure in prod, no Expires/Max-Age; redirect `/chat` | `web/src/features/chat/session/session-cookie.spec.ts:105-112` `toStrictEqual({ httpOnly: true, sameSite: 'lax', secure: false, path: '/' })` + no `maxAge`/`expires`; `:115-125` `production` → `secure: true`; `join.spec.ts:114` value + `redirect('/chat')`. W1, W4 killed | ✅ PASS                       |
| 11  | Valid session on `/` → `/chat`                                                            | `web/src/proxy.spec.ts:29-34`; `web/e2e/chat.spec.ts:199-201` `307`, `location` `'/chat'`                                                                                                                                                                                      | ✅ PASS                       |
| 12  | No valid session on `/chat` → `/`                                                         | `proxy.spec.ts:36-38`; `web/src/features/chat/containers/chat-room.container.spec.tsx:64` `redirect('/session/end')`; `web/e2e/chat.spec.ts:179-187`. F13, F17 killed                                                                                                          | ✅ PASS                       |
| 13  | Cookie present but not online → delete cookie, treat as no session                        | `web/src/features/chat/session/get-valid-session.spec.ts:48-61` → `null`; `web/src/features/chat/session/end-invalid-session.spec.ts:16`; `web/e2e/chat.spec.ts:208-252` (`Set-Cookie: chat_session=;`, `Expires=… 1970`). W9, W11, W12, F9 killed                             | ✅ PASS                       |

### P1: Ver a sala e o histórico (ROOM-01, ROOM-02)

| AC  | Spec-defined outcome                                                                 | `file:line` + assertion                                                                                                                                                                                  | Result                        |
| --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1   | SSR of the last 50, ascending `seq`                                                  | `web/e2e/chat.spec.ts:254-284` `expect(contents).toEqual(sent.slice(10))` from server HTML; `chat-room.container.spec.tsx:75` limit 50                                                                   | ✅ PASS                       |
| 2   | `MessageList` scrolled to the last message                                           | `web/src/features/chat/components/message-list.client.spec.tsx:82-106` scroller `scrollTop` = `scrollHeight`                                                                                             | ✅ PASS                       |
| 3   | Header: "Sala geral", "{N} pessoas online" (N = total), avatar, name, toggle, "Sair" | `chat-room.container.spec.tsx:94-107` heading `'Sala geral'`, `'7 pessoas online'` (total ≠ items.length), `'Bruno'`, `'Sair'`; `web/src/features/chat/components/chat-header.spec.tsx:22,31`. F2 killed | ✅ PASS                       |
| 4   | N = 1 → "1 pessoa online"                                                            | `chat-room.container.spec.tsx:109`                                                                                                                                                                       | ✅ PASS                       |
| 5   | Own `USER` vs others by `author.id`                                                  | `chat-room.container.spec.tsx:121,137`; `message-list.client.spec.tsx:37,54`; `web/e2e/chat.spec.ts:132,142`. W24, F14 killed                                                                            | ✅ PASS                       |
| 6   | `JOINED`/`LEFT` → "{nome} entrou/saiu do chat" via `SystemMessage`                   | `message-list.client.spec.tsx:21`; `web/src/features/chat/chat.dictionary.spec.ts:31`; `web/e2e/chat.spec.ts:155` literal `saiu do chat`                                                                 | ✅ PASS                       |
| 7   | Empty room → dictionary empty state                                                  | `chat-room.container.spec.tsx:152`; `message-list.client.spec.tsx:15`                                                                                                                                    | ✅ PASS                       |
| 8   | No cursor → `limit` highest `seq`, ascending                                         | `chat.e2e-spec.ts:241-261` `[seqs[2], seqs[3]]`; `api/src/modules/chat/repositories/test/message.repository.spec.ts:30`. A10 killed                                                                      | ✅ PASS                       |
| 9   | `before` → `limit` highest below cursor, ascending                                   | `chat.e2e-spec.ts:263-273` `['m2','m3']`; `message.repository.spec.ts:48`. A9 killed                                                                                                                     | ✅ PASS                       |
| 10  | `after` → `limit` lowest above cursor, ascending                                     | `chat.e2e-spec.ts:275-285`; `message.repository.spec.ts:62`. F7 killed                                                                                                                                   | ✅ PASS                       |
| 11  | `before`+`after`, or `limit` outside 1..100 → `400`                                  | `chat.e2e-spec.ts:287-305` `toBe(400)`; unit A12, A13 killed                                                                                                                                             | ✅ PASS                       |
| 12  | `seq` is a JSON number                                                               | `chat.e2e-spec.ts:256` `typeof seq` `'number'`; `api/src/app/test/openapi.spec.ts:107`; `api/src/modules/chat/mappers/test/message.mapper.spec.ts:31`. A20 killed                                        | ✅ PASS                       |
| 13  | api down → route error page with retry                                               | `get-valid-session.spec.ts:80` throws; `web/src/app/chat/error.spec.tsx:6-19` text + `retry` called once                                                                                                 | ⚠️ PASS, spec-precision gap 1 |

### P1: Enviar mensagem (SEND-01, SEND-02)

| AC  | Spec-defined outcome                                                              | `file:line` + assertion                                                                                                                                            | Result                        |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 1   | Enter in "Escreva uma mensagem…" sends                                            | `web/src/features/chat/components/composer.client.spec.tsx:31` placeholder; `:39` `send` with `{ content, clientId: uuid }`                                        | ✅ PASS                       |
| 2   | Shift+Enter → line break, no send                                                 | `composer.client.spec.tsx:78`                                                                                                                                      | ✅ PASS                       |
| 3   | "Enviar" button sends                                                             | `composer.client.spec.tsx:53`                                                                                                                                      | ✅ PASS                       |
| 4   | Empty after trim → no send, button disabled                                       | `composer.client.spec.tsx:88` `toBeDisabled()`. F16 killed                                                                                                         | ✅ PASS                       |
| 5   | > 1000 chars → block, dictionary error                                            | `composer.client.spec.tsx:107` alert literal, disabled; `:121` 1000 OK. F12 killed                                                                                 | ⚠️ PASS, spec-precision gap 1 |
| 6   | Action → `POST /api/v1/chat/messages` `{ content, clientId }` + token from cookie | `web/src/features/chat/actions/send-message.spec.ts:79-110` exact `calls` (method, path, token, body). W17 killed                                                  | ✅ PASS                       |
| 7   | Empty after trim or > 1000 → `400`                                                | `chat.e2e-spec.ts:363-377` 1001, `''`, `'   '`, missing → `400`, count unchanged; 1000 OK `:355-361`. F8, A17 killed                                               | ✅ PASS                       |
| 8   | Token missing/unknown/left → `401` (messages and leave)                           | `chat.e2e-spec.ts:379-416`; leave `:431-436`, `:476-485`; `api/src/modules/chat/guards/test/participant-token.guard.spec.ts:30,41,51,66,80`. A1, A2, A3, F6 killed | ✅ PASS                       |
| 9   | Valid → `USER`, trimmed, token's participant, `201 MessageResponseDto`            | `chat.e2e-spec.ts:320-346` `toEqual({… type: 'USER', content: 'olá, mundo', author: { id: bia.id … } })` + stored row. F4 killed                                   | ✅ PASS                       |
| 10  | Success → clear field, new message at the end                                     | `composer.client.spec.tsx:134`; `send-message.spec.ts:108` `refresh` once; `web/e2e/chat.spec.ts:125-133`                                                          | ✅ PASS                       |
| 11  | Action gets `401` → delete cookie, redirect `/`                                   | `send-message.spec.ts:113-126` jar `['theme']`, `redirect('/')`. W19 killed                                                                                        | ✅ PASS                       |
| 12  | Never render `content` as HTML                                                    | `chat-room.container.spec.tsx:163-180` literal text, `querySelector('img, b')` `null`                                                                              | ✅ PASS                       |

### P1: Sair da sala (LEAVE-01)

| AC  | Spec-defined outcome                                                   | `file:line` + assertion                                                                                                                                                | Result  |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | "Sair" → `POST /participants/:id/leave` with token, delete cookie, `/` | `web/src/features/chat/actions/leave.spec.ts:49-75` exact call + jar `['theme']` + `redirect('/')`; `chat-room.container.spec.tsx:197`; `web/e2e/chat.spec.ts:148-151` | ✅ PASS |
| 2   | Own token → `leftAt` + `LEFT` in one transaction, `204`                | `chat.e2e-spec.ts:461-474`; `participant.repository.spec.ts:94`. F3 killed                                                                                             | ✅ PASS |
| 3   | Unknown `:id` → `404`                                                  | `chat.e2e-spec.ts:447-453`; unit A8 killed                                                                                                                             | ✅ PASS |
| 4   | Token of another participant → `401`                                   | `chat.e2e-spec.ts:438-445`; unit A7 killed                                                                                                                             | ✅ PASS |
| 5   | api call fails → still delete cookie and redirect                      | `leave.spec.ts:49-75` for `401`, `500`, network error. F11 killed                                                                                                      | ✅ PASS |
| 6   | Name freed after leaving                                               | `chat.e2e-spec.ts:487-492`; `web/e2e/chat.spec.ts:158-161`                                                                                                             | ✅ PASS |

### P1: O navegador nunca chama a api (BFF-01)

| AC  | Spec-defined outcome                                 | `file:line` + assertion                                                                                                                                                  | Result  |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1   | api called only from server-only code                | `web/e2e/chat.spec.ts:163-169` no browser request to the api host, all same-origin; `web/src/lib/api.ts:1` `import 'server-only'` (enforced by `next build` in the gate) | ✅ PASS |
| 2   | Never expose the api URL or the token to the browser | `web/e2e/chat.spec.ts:322-336` `expect(body.includes(token)).toBe(false)` and the same for both api hosts, over HTML, RSC and every response. W31, F18, F19 killed       | ✅ PASS |

### Edge cases

| Edge case                                | Evidence                                                                      | Result  |
| ---------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| "Ana"/"ANA" at the same time → 201 + 409 | `chat.e2e-spec.ts:132-143` `toEqual([201, 409])` (numeric sort)               | ✅ PASS |
| " Ana " → "Ana"                          | `chat.e2e-spec.ts:95-108`                                                     | ✅ PASS |
| Content exactly 1000 → accepted          | `chat.e2e-spec.ts:355-361`                                                    | ✅ PASS |
| Content 1001 → `400`                     | `chat.e2e-spec.ts:364`                                                        | ✅ PASS |
| Name exactly 2 or 20 → accepted          | `chat.e2e-spec.ts:145-155`; plus a 20-char name with a 40-char key `:157-177` | ✅ PASS |
| `before` not a positive integer → `400`  | `chat.e2e-spec.ts:297-299` (-1, 0, abc)                                       | ✅ PASS |

**Status**: ✅ All ACs covered, ⚠️ spec-precision gaps flagged (carried over, not defects).

### Spec-precision gaps (unchanged from iteration 1)

1. User-facing error texts (`errors.nameInvalid`, `errors.joinFailed`, `errors.messageTooLong`, `errors.send`, `room.loadError`/`room.retry`): asserted as literals, but the spec does not own them.
2. Error bodies for `400`/`401`/`404`/`409`: the spec fixes only the status; tests assert `status` + `body.statusCode`.
3. Query error messages ("Falha ao carregar …"): internal, asserted as literals.
4. An empty cookie value counts as absent in the proxy, and a malformed one counts as present (AD-002); the spec is silent.
5. The `<Suspense>` fallback has no spec text.
6. Redirect `Location`: absolute in unit, relative in E2E; the spec says only "redirecionar".

---

## Discrimination Sensor

**Sensor depth**: P0-expanded (auth/session/cursor/DTO), manual. Scratch = rsync of the repo. api mutants: `npx vitest run --project unit` (159 tests, **no DB access**). web mutants: `npx vitest run --project unit` (366). The scratch baseline was green on both. BFF mutants: separate `next dev -p 3100` from the scratch `apps/web` with the scratch `.env` (`API_URL` = host api on `localhost:3333`), then `E2E_BASE_URL=http://localhost:3100 playwright test e2e/chat.spec.ts -g BFF-01`. Turbopack rejects symlinked `node_modules` that leave its root, so the web-side `node_modules` were real copies inside the scratch (not hardlinks). The scratch server was stopped afterwards (port 3100 free).

| #   | File:line                                                        | Mutation                                                             | Killed?                                                        |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| W31 | `web/src/features/chat/containers/chat-room.container.tsx:29`    | `valid.session` (raw token) spread as a prop on client `MessageList` | ✅ Killed (E2E `chat.spec.ts:332` "token sent to the browser") |
| A1  | `api/src/modules/chat/guards/participant-token.guard.ts:22`      | Strip `Bearer ` / text after a space                                 | ✅ Killed (guard spec `:66`)                                   |
| A2  | `participant-token.guard.ts:22`                                  | Fall back to `Authorization`                                         | ✅ Killed (guard spec `:80`)                                   |
| A3  | `api/src/modules/chat/repositories/participant.repository.ts:57` | Token lookup drops `leftAt: null`                                    | ✅ Killed (repo spec `:136`)                                   |
| A5  | `api/src/modules/chat/services/participants.service.ts:30`       | Stored hash ≠ `hashToken(token)`                                     | ✅ Killed                                                      |
| A6  | `api/src/modules/chat/security/participant-token.ts:15`          | Name key case-sensitive                                              | ✅ Killed (4 tests)                                            |
| A7  | `participants.service.ts:48`                                     | Leave ownership check removed                                        | ✅ Killed                                                      |
| A8  | `participants.service.ts:45`                                     | Leave 404 check removed                                              | ✅ Killed                                                      |
| A9  | `api/src/modules/chat/repositories/message.repository.ts:33`     | `before` inclusive                                                   | ✅ Killed                                                      |
| A10 | `message.repository.ts:38`                                       | Latest page not reversed                                             | ✅ Killed (2 tests)                                            |
| A12 | `api/src/modules/chat/services/messages.service.ts:22`           | `before`+`after` accepted                                            | ✅ Killed                                                      |
| A13 | `api/src/modules/chat/dtos/request/list-messages.query.ts:16`    | `@Max(101)`                                                          | ✅ Killed                                                      |
| A16 | `api/src/modules/chat/dtos/request/join-participant.dto.ts:7`    | Name `{1,20}`                                                        | ✅ Killed (2 tests)                                            |
| A17 | `api/src/modules/chat/dtos/request/trim-string.ts:5`             | No trim                                                              | ✅ Killed (7 tests)                                            |
| A20 | `api/src/modules/chat/mappers/message.mapper.ts:9`               | `seq` as string                                                      | ✅ Killed (4 tests)                                            |
| A22 | `participant.repository.ts:28`                                   | Join writes `USER`                                                   | ✅ Killed                                                      |
| W1  | `web/src/features/chat/session/session-cookie.ts:41`             | `secure: true` always                                                | ✅ Killed (4 tests)                                            |
| W4  | `session-cookie.ts:39`                                           | `httpOnly: false`                                                    | ✅ Killed                                                      |
| W9  | `web/src/proxy.ts:11`                                            | Empty cookie counts (`cookies.has`)                                  | ✅ Killed                                                      |
| W11 | `web/src/features/chat/session/get-valid-session.ts:19`          | `me` = last online item                                              | ✅ Killed (3 tests)                                            |
| W12 | `web/src/features/chat/session/end-invalid-session.ts:7`         | `clearSession()` removed                                             | ✅ Killed                                                      |
| W13 | `web/src/features/chat/actions/join.ts:33`                       | `409` branch checks `400`                                            | ✅ Killed                                                      |
| W17 | `web/src/features/chat/actions/send-message.ts:29`               | Header carries participant id                                        | ✅ Killed                                                      |
| W19 | `send-message.ts:33`                                             | `401` redirects without clearing the cookie                          | ✅ Killed                                                      |
| W24 | `chat-room.container.tsx:29`                                     | `meId` from first online item                                        | ✅ Killed                                                      |
| F1  | `participant-token.ts:15`                                        | **fresh**: drop `normalize('NFC')`                                   | ✅ Killed (NFD/NFC "Érica" `:46`)                              |
| F2  | `participants.service.ts:39`                                     | **fresh**: `total` = length + 1                                      | ✅ Killed                                                      |
| F3  | `participant.repository.ts:45`                                   | **fresh**: leave writes `JOINED`                                     | ✅ Killed (repo spec `:94`)                                    |
| F4  | `messages.service.ts:41`                                         | **fresh**: `clientId` always `null`                                  | ✅ Killed                                                      |
| F5  | `list-messages.query.ts:17`                                      | **fresh**: default `limit` 100                                       | ✅ Killed                                                      |
| F6  | `participant-token.guard.ts:30`                                  | **fresh**: `request.participant` not set                             | ✅ Killed (guard spec `:89`)                                   |
| F7  | `message.repository.ts:25`                                       | **fresh**: `after` inclusive (`gte`)                                 | ✅ Killed (repo spec `:62`)                                    |
| F8  | `api/src/modules/chat/dtos/request/send-message.dto.ts:22`       | **fresh**: `@MaxLength(999)`                                         | ✅ Killed (2 tests)                                            |
| F9  | `get-valid-session.ts:19`                                        | **fresh**: id match inverted (`!==`)                                 | ✅ Killed (3 tests)                                            |
| F10 | `join.ts:21`                                                     | **fresh**: invalid names reach the api                               | ✅ Killed (5 tests)                                            |
| F11 | `web/src/features/chat/actions/leave.ts:18`                      | **fresh**: `catch` → `finally` (network error escapes)               | ✅ Killed (`leave.spec.ts` network case)                       |
| F12 | `web/src/features/chat/schemas/message.schema.ts:5`              | **fresh**: `MAX_CHARS = 1001`                                        | ✅ Killed (4 tests)                                            |
| F13 | `proxy.ts:20`                                                    | **fresh**: matcher drops `/`                                         | ✅ Killed (2 tests)                                            |
| F14 | `web/src/features/chat/components/message-list.client.tsx:58`    | **fresh**: `own` inverted                                            | ✅ Killed (4 tests)                                            |
| F15 | `join.ts:30`                                                     | **fresh**: untrimmed form value sent                                 | ✅ Killed                                                      |
| F16 | `web/src/features/chat/components/composer.client.tsx:29`        | **fresh**: `empty` without trim                                      | ✅ Killed (2 tests)                                            |
| F17 | `chat-room.container.tsx:19`                                     | **fresh**: invalid session → `/` (cookie kept)                       | ✅ Killed                                                      |
| F18 | `chat-room.container.tsx:29`                                     | **fresh (E2E)**: `process.env.API_URL` as a `MessageList` prop       | ✅ Killed (`localhost:3333 sent to the browser`)               |
| F19 | `chat-room.container.tsx:30`                                     | **fresh (E2E)**: token as a `Composer` prop                          | ✅ Killed (`token sent to the browser`)                        |
| -   | `apps/api/prisma/schema.prisma:20`                               | `name_key` back to `VARCHAR(20)`                                     | Not run (needs isolated DB); fixer's evidence: `500` ≠ `201`   |

**Result**: 44/44 killed (25 re-runs incl. W31, 19 fresh). PASS ✅

Isolation: no api mutant touched the database (unit project only). The BFF E2E runs created one `e2e-web-…` participant each and left through its own `afterAll`. A read-only query after the run shows only the 3 known stray rows plus the user's own participants online. The scratch file was restored from its copy (hash equal) before the final baseline re-run. The real-tree SHA-256 (309 files) matched.

---

## Code Quality

| Principle                                                                                                        | Status                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Minimum code                                                                                                     | ✅ The fix is one migration line, one schema attribute with its reasoning comment, and two test changes       |
| Surgical changes                                                                                                 | ✅ Only the files named in the fix notes changed (mtime list above); `openapi.json`/`schema.d.ts` regenerated |
| No scope creep                                                                                                   | ✅                                                                                                            |
| Matches patterns                                                                                                 | ✅ `EXPANDING_NAME` joins `cleanup()` the same way `SHORT_NAME` does (`chat.e2e-spec.ts:39-50`)               |
| Spec-anchored outcome check                                                                                      | ✅ (precision gaps flagged)                                                                                   |
| Per-layer Coverage Expectation met                                                                               | ✅ every route: happy + edge + `400`/`401`/`404`/`409`; 100% in api, web, api-client, vitest-config           |
| Every test maps to a spec requirement                                                                            | ✅ new tests map to JOIN-02 AC5/AC7 and BFF-01 AC2                                                            |
| Documented guidelines followed: `apps/api/ARCHITECTURE.md`, `apps/web/ARCHITECTURE.md`, `packages/vitest-config` | ✅ lint 0 warnings / 0 errors in every workspace                                                              |

---

## Gate Check

- **Gate command**: `TURBO_FORCE=true make gate` → **exit 0**, `Tasks: 19 successful, 19 total`, `Cached: 0 cached`.
  - api: 206 passed (29 files: 159 unit + 46 `chat.e2e-spec.ts` + 1 `app.e2e-spec.ts`), coverage 100%
  - web: 366 passed (42 files), coverage 100%; Storybook 118 passed (32 files)
  - `@repo/api-client` 3 passed (100%); `@repo/vitest-config` 3 passed (100%)
  - lint: 0 warnings, 0 errors (all workspaces)
- **E2E**: `make e2e` → **exit 0**, 12 passed (8 `chat.spec.ts` + 4 `theme.spec.ts`), 0 skipped.
- **Stack afterwards**: `web-hook-database-1`, `web-hook-api-1`, `web-hook-web-1` all `Up (healthy)`. `make e2e` rebuilt api/web via `compose up -d --build --wait`. No `core-*` container was touched.
- **Test count**: iteration 1 → 2: api 205 → 206 (+1 expanding-name case), web 366 → 366, stories 118 → 118, E2E 11 → 12 (+1 BFF-01). Nothing deleted or weakened. The `400 … sem gravar` change replaces an absolute `0` with a before/after delta: it still fails if the request writes the row, and no longer fails on rows it did not write.
- **Failures / skips**: none.

---

## Advisory findings (not counted toward the verdict)

1. **Process deviation by the fixer**: the T38 fix note says W31 was applied "temporariamente na árvore real" (the compose web container hot-reloads `src/`). The file was restored and `sha256sum -c` passed, and this Verifier's hash check confirms the tree is consistent. It still breaks the "never mutate the real tree" rule. A scratch Next server on another port (as done here) is practical.
2. The e2e case covers a 40-code-point key (`'İ'×20`), not the 60-code-point worst case (`'שּׁ'×20`). The 60 bound was proven by exhaustive scan, not exercised against Postgres.
3. Iteration-1 advisories still stand: a forged cookie with another online participant's id renders the room (send/leave still `401`), consistent with the spec's definition of a valid session. Two concurrent `leave` calls can write two `LEFT` messages.
4. The 3 stray participants (`Q`, `'  e2e-api-Ana  '`, `'     '`) from the iteration-1 sensor are still in the DB and were left for the user. They no longer break any test.
5. Several iteration-1 line citations (e.g. `session-cookie.spec.ts:195-216`) pointed past the end of their files. They were re-anchored here.

---

## Requirement Traceability Update

| Requirement | Previous Status            | New Status  |
| ----------- | -------------------------- | ----------- |
| JOIN-01     | ✅ Verified                | ✅ Verified |
| JOIN-02     | ⚠️ Verified, Fix 2 (minor) | ✅ Verified |
| JOIN-03     | ✅ Verified                | ✅ Verified |
| ROOM-01     | ✅ Verified                | ✅ Verified |
| ROOM-02     | ✅ Verified                | ✅ Verified |
| SEND-01     | ✅ Verified                | ✅ Verified |
| SEND-02     | ✅ Verified                | ✅ Verified |
| LEAVE-01    | ✅ Verified                | ✅ Verified |
| BFF-01      | ❌ Needs Fix (Fix 1, AC2)  | ✅ Verified |
| CLEAN-01    | ✅ Verified                | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 46/46 ACs and 6/6 edge cases match the spec outcome; 6 spec-precision gaps flagged (carried over).
**Sensor**: 44 mutations injected, 44 killed, 0 survived (1 more not run: needs an isolated DB).
**Gate**: `make gate` exit 0 (api 206, web 366, stories 118, 100% coverage, 0 lint warnings); `make e2e` exit 0 (12 passed).

**What works**: everything from iteration 1, plus a discriminating BFF-01 AC2 test (token and both api hosts, across HTML, RSC and every response), `name_key` sized for the true worst case, and an e2e that no longer depends on foreign DB rows.

**Issues found**: none blocking. See advisories.

**Next steps**: the user removes the 3 stray rows when convenient. Optionally give the spec owner the 6 precision gaps.
