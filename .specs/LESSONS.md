# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When jsdom hides a side effect's payload (such as cookie attributes), spy on the setter and assert the exact payload written.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-tests` · harmful: 0
- features: chat-theme
- evidence: validation.md S7 apps/web/src/components/ui/theme-toggle.client.tsx:38 (web-tests)
- last seen: 2026-10-14T20:24:43Z

### L-002 - Assert which icon each visual state renders, not only its label and visibility classes.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-components` · harmful: 0
- features: chat-theme
- evidence: validation.md S9 apps/web/src/components/ui/theme-toggle.client.tsx:45 (web-components)
- last seen: 2026-10-14T20:24:43Z

### L-003 - A test-environment sentinel must compare against a value independent of the config it is checking.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `test-config` · harmful: 0
- features: chat-theme
- evidence: validation.md S11 apps/web/vitest.config.ts:55 (test-config)
- last seen: 2026-10-14T20:24:43Z

### L-004 - Literal-color lint rules must also reject white and black palette classes.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `lint` · harmful: 0
- features: chat-theme
- evidence: validation.md S30 apps/web/scripts/check-conventions.mjs:59 (lint)
- last seen: 2026-10-14T20:24:43Z

### L-005 - State in the spec whether placeholder text must meet AA contrast.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-a11y` · harmful: 0
- features: chat-theme
- evidence: validation.md spec-precision gap 3 (text/muted on bg/subtle 4.16:1) (spec-a11y)
- last seen: 2026-10-14T20:24:43Z

### L-006 - Reconcile every detail shown in design frames with the spec's component props before Execute.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-design` · harmful: 0
- features: chat-theme
- evidence: validation.md spec-precision gap 1 (SystemMessage time in frames) (spec-design)
- last seen: 2026-10-14T20:24:43Z

### L-007 - Pass per-project values to Vitest browser projects with provide/inject, not Vite define.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `test-config` · harmful: 0
- features: chat-theme
- evidence: apps/web/vitest.config.ts:56 SPEC_DEVIATION define leaked (test-config)
- last seen: 2026-10-14T20:24:43Z

### L-008 - Assert that a parent passes the spec-named field into a child's derived prop, not only the child's own mapping.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-components` · harmful: 0
- features: chat-theme
- evidence: validation.md N5 (apps/web/src/features/chat/components/message-bubble.tsx:31) (web-components)
- last seen: 2026-10-14T20:43:52Z

### L-009 - Test cookie parsing with a look-alike cookie name so an unanchored match fails.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-tests` · harmful: 0
- features: chat-theme
- evidence: validation.md N11, N16 (apps/web/src/lib/theme.ts:17, theme-toggle.client.tsx:19) (web-tests)
- last seen: 2026-10-14T20:43:52Z

### L-010 - Literal-color lint rules must cover every Tailwind color utility prefix and arbitrary named colors.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `lint` · harmful: 0
- features: chat-theme
- evidence: validation.md P2-P10 (apps/web/scripts/check-conventions.mjs:62-64) (lint)
- last seen: 2026-10-14T20:43:52Z

### L-011 - Assert spec-quoted UI strings as literals, not by reading the expected value back from the dictionary under test.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-tests` · harmful: 0
- features: chat-theme
- evidence: validation.md M24, M25, M28 (apps/web/src/features/chat/chat.dictionary.ts:29-30, chat-header.tsx:39) (web-tests)
- last seen: 2026-10-14T21:23:36Z

### L-012 - Assert that secrets such as session tokens and internal api URLs are absent from the server-rendered HTML and RSC payload, not only from browser requests.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-e2e` · harmful: 0
- features: chat-core
- evidence: validation.md W31 (apps/web/src/features/chat/containers/chat-room.container.tsx:29) (web-e2e)
- last seen: 2026-10-15T01:48:46Z

### L-013 - Size a column that stores a transformed value for the longest output of the transform, since Unicode lowercasing can lengthen a string.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api-schema` · harmful: 0
- features: chat-core
- evidence: validation.md Fix 2 (JOIN-02 AC7, apps/api/prisma/schema.prisma name_key VarChar(20)) (api-schema)
- last seen: 2026-10-15T01:48:46Z

### L-014 - State in the spec the exact text of every user-facing error message, or name the dictionary key that owns it.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `spec-copy` · harmful: 0
- features: chat-core
- evidence: validation.md spec-precision gap 1 (JOIN-01 AC2-3, SEND-01 AC5, ROOM-01 AC13) (spec-copy)
- last seen: 2026-10-15T01:48:46Z

### L-015 - Give proxy code its own feature entry module that has no server-only, env or action imports.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `web-proxy` · harmful: 0
- features: chat-core
- evidence: apps/web/src/proxy.ts:2 SPEC_DEVIATION routing.ts entry (web-proxy)
- last seen: 2026-10-15T01:48:46Z

### L-016 - Plan a test for every file the 100 percent coverage gate loads before the consumer that would exercise it exists.
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `test-plan` · harmful: 0
- features: chat-core
- evidence: tasks.md T4/T7 SPEC_DEVIATION (apps/api/src/modules/chat/test/test-fixtures.spec.ts, dtos/response/test/chat-response-dtos.spec.ts) (test-plan)
- last seen: 2026-10-15T01:48:46Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
