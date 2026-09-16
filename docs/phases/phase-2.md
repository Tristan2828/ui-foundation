# Phase 2 — Contract and Boundary

## What was built

- `openapi.yaml` — hand-written, human-reviewed and approved before any
  codegen ran. `Widget`/`Category` CRUD, with the six Phase 4 field types
  each on its own field (`categoryId` FK, `status` enum, `availableFrom`
  datetime, `assigneeEmail` nullable, `price` decimal-as-string,
  `description` long text). Wire pagination (`offset`/`limit` in,
  `{items,total}` out) deliberately does not match the UI's `Page<T>`, and
  errors mirror FastAPI's default shapes (422 → `{"detail":[...]}` ,
  else → `{"detail": string}`), since FastAPI is the planned Phase 8
  backend.
- `src/api/schema.d.ts` — generated via `openapi-typescript`, wired as the
  real `gen:api` script (Phase 1 left it as a no-op placeholder).
- `src/api/contracts.ts` — `Page<T>`, `AppError`, `QuerySpec`, exactly as
  specified in the plan.
- `tests/gateway/widgets.test.ts` + `tests/gateway/categories.test.ts` —
  written by a fresh, isolated agent *before* the gateway/transport
  implementation existed (temporal isolation; see Deviations below for why
  not the real `spec-tester` subagent). 18 tests covering pagination
  translation, all five `AppError` kinds, and the 204/`void` delete case.
- `src/api/transport/index.ts` — a small hand-rolled `apiFetch(path, init)`
  wrapper, not `openapi-fetch` (see Deviations).
- `src/api/gateway/errors.ts`, `widgets.ts`, `categories.ts` — the ACL.
  Every function resolves with a UI-owned shape or throws `AppError`;
  nothing above the gateway sees a wire-shaped response.
- `src/mocks/` — `data.ts` (in-memory store, 3 seeded widgets across all
  three statuses, one with a null `assigneeEmail`), `handlers.ts` (all six
  operations, with FastAPI-shaped 422s on real validation failures),
  `browser.ts` / `server.ts`.
- `tests/mocks/conformance.test.ts` — loads `openapi.yaml` via `js-yaml` and
  validates every handler's actual response against its declared schema
  with `openapi-response-validator`, resolving both schema-level and
  response-level `$ref`s (see Deviations).
- `src/main.tsx` — wired `QueryClientProvider` and MSW worker startup,
  gated on `VITE_API !== 'real'` rather than `import.meta.env.DEV` (see
  Deviations) — this is Phase 8's own flag, built a few phases early
  because Phase 2's own exit criterion needed it.
- ESLint: `no-restricted-imports` (transport boundary, auth boundary — the
  latter inert until Phase 3 builds `src/auth/`), `no-restricted-syntax`
  (bare `fetch`), `@tanstack/eslint-plugin-query` flat config. Verified
  both restrictions actually fail lint on fixtures, not just that the rules
  exist.
- `e2e/msw-contract.spec.ts` — proves MSW serves `Page<Widget>`-shaped data
  through the real (Playwright preview) browser with no backend process,
  by waiting on `navigator.serviceWorker.ready` then fetching from inside
  the page.
- `scripts/check-openapi-freeze.mjs` + `openapi.yaml.sha256`, wired into
  `verify:fast` — the Phase 2 spec freeze (see Deviations for why a hash
  lock instead of a git-tag diff).
- `scripts/check-phase-2.sh` — cumulative with `check-phase-1.sh`.

## Deviations from the plan

- **`spec-tester` subagent is not invokable in this harness.** This Claude
  session runs in an environment with a fixed built-in agent roster
  (confirmed via `claude-code-guide`: not stock Claude Code CLI) that does
  not discover `.claude/agents/*.md` at all. `spec-tester.md` itself is
  correctly written (frontmatter deny-hook, per the plan's warning). Used
  temporal isolation instead for this phase's gateway tests: a fresh
  `general-purpose` agent, no session memory, given only `openapi.yaml` +
  `contracts.ts` + `schema.d.ts`, instructed not to read
  `src/api/gateway/`/`src/api/transport/` — which held only `.gitkeep`
  files at the time, so there was nothing to find regardless. Logged in
  `docs/BLOCKERS.md` as a standing item for whoever sets up the unattended
  phase loop, since that loop assumes stock Claude Code's `Task` tool.
- **Added `js-yaml` to `deps-allowlist.json`**, not previously listed.
  Needed because `openapi-typescript`'s public API only emits TypeScript
  source, not a JSON-serializable resolved document, and the
  mock-conformance tests need the raw spec at runtime. Per the Hard Rule
  this should normally mean writing `docs/BLOCKERS.md` and stopping the
  session — but since this was an attended session with the operator
  present, I asked directly instead of ending the session; still recorded
  the addition here for the audit trail the rule is protecting.
- **Dropped `openapi-fetch`** (initially installed, per the plan's "least
  code" suggestion) in favor of a hand-rolled `apiFetch`. Root cause:
  `openapi-fetch` builds a `Request` object internally and calls
  `fetch(request)`; Node's global `Request` constructor throws on a
  relative URL (`new Request('/api/widgets')` → `Failed to parse URL`),
  unlike a browser, which resolves relative URLs against the page origin.
  With `baseUrl: '/api'`, this made `openapi-fetch` throw inside vitest
  before the gateway tests' mocked `fetch` was ever reached — unrelated to
  and unfixable via any custom `fetch` option, since the failure happens
  during `openapi-fetch`'s own `Request` construction. A small hand-rolled
  wrapper sidesteps the issue entirely and was, in the end, less code than
  shimming around it.
- **MSW's relative-path handler patterns (`http.get("/api/widgets", ...)`)
  silently don't match requests under vitest**, even though the identical
  pattern works in a plain Node script outside vitest. Root-caused via a
  minimal repro (confirmed on both msw 2.12.14 and current 2.15.0 — not a
  version regression). Fixed by using MSW's documented origin-agnostic
  wildcard pattern (`http.get("*/api/widgets", ...)`) instead, which works
  in both vitest and the real browser/Playwright path. All handlers in
  `src/mocks/handlers.ts` use the wildcard form.
- **Mock-conformance tests resolve response-level `$ref`s by hand.**
  `js-yaml` parses `openapi.yaml` as plain data with no `$ref` resolution.
  Schema-level refs (e.g. `HTTPErrorBody`) are handled fine by passing
  `components` straight to `openapi-response-validator`, which resolves
  them via ajv — but `openapi.yaml`'s error responses (404/401/422/500) are
  themselves declared as `$ref: "#/components/responses/..."`, one level
  up from the schema, which needed a small manual JSON-pointer resolver in
  the test file before the schema underneath was reachable.
- **MSW is gated on `VITE_API === 'real'`, not `import.meta.env.DEV`.**
  Playwright's `webServer` (per the Phase 1 fix) runs against a *built,
  previewed* production bundle, where `DEV` is `false` — a dev-only gate
  would have made MSW invisible to `e2e/msw-contract.spec.ts` entirely.
  `VITE_API` is the exact flag the plan already names for Phase 8
  (`VITE_API=real` against a running backend), so this isn't a new
  mechanism, just building that one a few phases early since Phase 2's own
  exit criterion needed a way to prove MSW works with no backend running.
- **Spec freeze is a committed sha256 hash (`openapi.yaml.sha256`), not a
  git-tag diff.** The plan says "unchanged from the Phase 2 tag," but
  creating and pushing a tag wasn't something to do unilaterally
  mid-session without the operator's awareness. A hash lock enforces the
  identical guarantee (drift fails `verify:fast` until the lock file is
  deliberately updated in the same commit) without requiring out-of-band
  git tag coordination, and works the same in a shallow CI checkout as
  locally.
- **`openapi.yaml` was not yet committed at the time it was edited during
  this session** (Phases 0-1 were already committed on `main` before this
  session started; this phase's new work, including `openapi.yaml`, was
  committed at the end of the session — see below). One in-session mistake
  worth recording: I appended a throwaway line to the live `openapi.yaml`
  while testing the freeze-check script's failure path, and
  `git checkout -- openapi.yaml` couldn't undo it because the file hadn't
  been committed *yet* at that point (no baseline to restore from). I
  caught this from the harness's own file-change notification and fixed it
  by hand; `check-openapi-freeze.mjs` then confirmed the hash matched
  again, so the file is intact. Lesson for next time: commit a new file
  before running destructive-looking experiments against it, or `git
  checkout` won't be able to save you.

## Verification

`npm run verify` passes (28 vitest tests across gateway/mocks, 2 Playwright
specs). `scripts/check-phase-2.sh`: **PASS** (calls `check-phase-1.sh`
first, per the plan's cumulative-script convention).

Confirmed by hand, not just by the scripts existing:
- A fixture importing from `src/api/transport/` fails lint.
- A fixture calling bare `fetch(...)` outside `transport/`/`tests/`/`e2e/`
  fails lint.
- `check-openapi-freeze.mjs` actually fails on a modified `openapi.yaml`
  (and passes again once restored).

## What the next session needs to know

- Next up: Phase 3 (App Shell). `openapi.yaml` is frozen until v1.1.0 —
  don't add a field type "while you're in there" for a Phase 3/4 screen;
  it isn't needed for the shell anyway.
- Phase 2's work is committed at the end of this session (see the commit
  this report ships in). Phases 0-1 were already committed beforehand.
- `docs/BLOCKERS.md` has one open item: `spec-tester` cannot be invoked as
  a real subagent in this harness. Doesn't block Phase 3 (no gateway tests
  needed there), but will resurface whenever `/new-entity` or a future
  phase needs isolated test-writing again.
- `src/auth/` doesn't exist yet — the `no-restricted-imports` auth rule in
  `eslint.config.js` is inert (matches nothing) until Phase 3 creates
  `auth-provider.tsx`. Confirm the rule actually fires once that file
  exists, the same way the transport rule was confirmed this phase.
- If MSW handlers are added to or edited in a future phase, use the
  `"*/api/..."` wildcard pattern, not a bare `"/api/..."` relative path —
  the latter silently no-ops under vitest (see Deviations). This cost real
  debugging time this phase; don't rediscover it.
