# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Specify/Design)

Corroborated across multiple features. Safe to apply as guidance.

### L-022 - Check every success criterion against the limits the same spec introduces before confirming the spec
- signal: `spec_precision_gap` · recurrence: 2 feature(s) · scope: `spec` · harmful: 0
- features: chat-resilience, chat-extras
- evidence: spec.md Success Criteria '100 envios seguidos' vs RATE-01 AC1 (spec) (+1 more)
- last seen: 2026-10-29T18:10:33Z

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

### L-017 - When the design adds directives to a header the spec names, write the full header value into the spec AC.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `specs` · harmful: 0
- features: chat-webhooks
- evidence: validation.md note 1 SSE-01 AC2 apps/web/src/features/chat/realtime/sse.ts:9 (specs)
- last seen: 2026-10-29T14:53:19Z

### L-018 - Back build-time route properties such as dynamic rendering with an automated check of the build output, not a one-off log line.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web-routes` · harmful: 0
- features: chat-webhooks
- evidence: validation.md note 2 SSE-01 AC7 apps/web/src/features/chat/realtime/open-chat-stream.ts:12 (web-routes)
- last seen: 2026-10-29T14:53:19Z

### L-019 - When an AC lists several endpoints, give each endpoint its own e2e assertion of the outcome.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `api-e2e` · harmful: 0
- features: chat-webhooks
- evidence: validation.md note 3 WHOUT AC3 apps/api/test/webhooks.e2e-spec.ts:172-180 (api-e2e)
- last seen: 2026-10-29T14:53:19Z

### L-020 - Cover generated shared secrets in env setup with a scripted check that both env files match and pass the schema.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `infra` · harmful: 0
- features: chat-webhooks
- evidence: validation.md note 4 WHIN-03 AC9 Makefile:10 (infra)
- last seen: 2026-10-29T14:53:19Z

### L-021 - When an AC is conditioned on a protocol trigger such as a header, add an AC and an E2E for the case where the trigger is absent, so the goal holds without it
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `realtime` · harmful: 0
- features: chat-resilience
- evidence: validation.md Gap 1; apps/web/src/features/chat/realtime/open-chat-stream.ts:48 (realtime)
- last seen: 2026-10-29T16:40:55Z

### L-023 - An E2E must not add setup steps that the success criterion does not state, since they can hide the uncovered case
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: chat-resilience
- evidence: apps/web/e2e/chat-resilience.spec.ts:145-149 pre-seeded SSE message (e2e)
- last seen: 2026-10-29T16:40:55Z

### L-024 - When a spec edit adds a condition to an AC, add a test for that condition in the same change
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `spec-tests` · harmful: 0
- features: chat-resilience
- evidence: validation.md N9; apps/web/src/features/chat/components/chat-stream.client.tsx:66; RATE-02 AC4 (spec-tests)
- last seen: 2026-10-29T17:11:41Z

### L-025 - When polling a row with included relations after a transactional write, wait on the parent's updated fields too, since include runs separate queries that can straddle the commit
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `api-e2e` · harmful: 0
- features: chat-resilience
- evidence: validation.md Gate run 1; apps/api/test/webhooks.e2e-spec.ts:355-362 (api-e2e)
- last seen: 2026-10-29T17:19:09Z

### L-026 - Catch the rejection of every fire-and-forget Server Action call on the client, since the transport can fail even when the action swallows its own errors
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `web-client` · harmful: 0
- features: chat-extras
- evidence: validation.md Gap 2; apps/web/src/features/chat/components/chat-stream.client.tsx:175 (web-client)
- last seen: 2026-10-29T18:10:33Z

### L-027 - An E2E that pages through shared data must keep that data bounded, or its runtime grows with every run
- signal: `spec_deviation` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: chat-extras
- evidence: validation.md Gap 3; apps/web/e2e/chat-extras.spec.ts:153-194 (e2e)
- last seen: 2026-10-29T18:10:33Z

### L-028 - When an E2E relies on a setup step to bound its data, assert the bound itself (size or count), not only a formula derived from the current data
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: chat-extras
- evidence: validation.md M9 apps/web/e2e/global-setup.ts:7 (e2e)
- last seen: 2026-10-29T19:12:48Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
