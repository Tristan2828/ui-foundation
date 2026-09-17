# Phase 11 — Self-Service Registration

## What was built

- **`POST /auth/register` added to `openapi.yaml`** — another deliberate,
  reviewed unfreeze (`openapi.yaml.sha256` updated in the same commit, same
  as Phase 10's `/auth/*` additions). New `RegisterRequest` schema
  (`email`, `name`, `password`), built by `$ref`-ing `User.email`/`.name`
  and `LoginRequest.password` rather than retyping their constraints, so a
  future change to the password's `minLength` can't silently drift between
  login and register. Response set is `200` (auto-authenticated, same
  `User` body and session cookie as `/auth/login`), `422`, `500` — no `401`,
  since there is no "wrong credential" concept for registering, and a
  duplicate email is a `ValidationError` field error, not a `409`.
  `npm run gen:api` regenerated `schema.d.ts`.
- **Backend**: `app/schemas.py` gained `RegisterRequest`. `app/routers/
  auth.py`'s `login()` and the new `register()` both call a new shared
  `_start_session(user, response, session)` helper (token generation,
  `Session` row insert, cookie) — this is the literal code-reuse the plan
  asked for ("auto-login on success reuses `login()`'s session-creation
  path"), not just a similar-looking duplicate. Email uniqueness is
  enforced by hand-raising `fastapi.exceptions.RequestValidationError`
  with an `email`-field issue when a row already exists — the *shape* is
  identical to Pydantic's own auto-raised validation errors (same
  `errors.py` handler processes both), so the wire contract doesn't care
  which of the two raised it. Password hashing reuses the existing
  `security.hash_password` (PBKDF2, same as Phase 10) — zero new
  dependency, same as every prior auth phase.
- **Frontend**: `src/api/gateway/auth.ts` gained `register()` — same
  `safeFetch`/`toAppError` shape as `login()`. `auth-context.ts`/
  `auth-provider.tsx` gained a `register(email, name, password)` alongside
  `login`/`logout`, writing the returned user straight into the
  `['auth','me']` query cache exactly like `login()` does. New
  `src/routes/register.tsx` + `register-schema.ts`, built the way
  `login.tsx` was: `FieldGroup`/`Field` directly, not `EntityForm` (no
  cancel destination). One addition beyond a literal mirror of
  `RegisterRequest`: a client-only `confirmPassword` field with a zod
  `.refine` check, since a mistyped password with no confirmation is a
  real, cheaply-prevented failure mode the wire contract itself can't
  catch. `/login` gained a "Create account" link and `/register` gained a
  "Sign in instead" link (both `<Button variant="link" nativeButton={false}
  render={<Link .../>}>`, matching `widgets-table.tsx`'s existing
  Button-as-Link pattern).
- **MSW**: `src/mocks/data.ts` gained a `registeredUsers` map (seeded with
  just the dev user's email) plus `isEmailRegistered`/`registerMockUser`/
  `getCurrentMockUser`/`setCurrentMockUser`, so `/auth/me` now reflects
  whichever user is actually "logged in" in the mock session instead of
  always returning the fixed seeded user — needed once registration can
  create a second identity. `resetMockData()` resets all of it.
  `handlers.ts` gained a `POST /auth/register` handler mirroring the real
  backend's validation order (missing fields → weak password → duplicate
  email), landing on the same `{detail:[{loc,msg,type}]}` shape.
- **Tests**: `backend/tests/test_auth.py` gained a `register_client`
  fixture (no pre-seeded user, unlike `auth_client`) and five new tests
  (create+auto-login, duplicate email, weak password). `tests/mocks/
  conformance.test.ts` gained two cases validating the mock's 200/422
  register responses against `openapi.yaml`. `tests/gateway/auth.test.ts`
  is a new file, written by the `spec-tester` subagent from `openapi.yaml`
  and `contracts.ts` alone (per `AGENTS.md`'s hard rule) — it does not
  read `src/api/gateway/` and was refused nothing, since the task fully
  specified the operation's request/response shapes and this project's
  already-established gateway-function convention. Four tests: 200 success,
  422 duplicate-email → `AppError{kind:'validation', fieldErrors.email}`,
  500 → `kind:'server'`, network failure → `kind:'network'`.
  `e2e/register.spec.ts` mirrors `e2e/auth.spec.ts`'s state coverage:
  validation (duplicate email, weak password, mismatched confirmation) and
  success (redirects in, authenticated), plus a small cross-link check.
- **`scripts/check-phase-11.sh`** — thin, same shape as
  `check-phase-10.sh`: `npm run verify`, then chains onto
  `check-phase-8.sh`. Rather than re-implementing the Docker/Postgres/
  uvicorn lifecycle a second time, the two Phase 11 assertions (duplicate
  email → 422 with a populated `email` field error; a fresh registration
  can call `GET /api/widgets` immediately with no separate login step) were
  added directly into `check-phase-8.sh`'s existing live-server section,
  right after Phase 10's unauthenticated-401 check — same pattern Phase 10
  itself established. One real gotcha caught while writing that check:
  Postgres data persists across repeated local runs of `check-phase-8.sh`
  (unlike the SQLite pytest fixture, which resets every test), so the
  "fresh registration" assertion uses a `date`+`$$`-suffixed email instead
  of a fixed one — a fixed address would 422 as "already registered" on
  the script's second run.
- **`registry.json`** updated: `src/routes/register.tsx`,
  `register-schema.ts`, `tests/gateway/auth.test.ts`, and
  `e2e/register.spec.ts` added to the `starter` item's file list.

## Deviations from plan

None structural — the plan's step-by-step list in `docs/BUILD-PLAN.md`
Phase 11 was followed as written. One elaboration beyond the plan's text:
the plan said register should "reuse `login()`'s session-creation path";
this was implemented as a literal shared `_start_session` helper rather
than copy-pasted duplicate code, since the two really are the same
operation (issue a session, set the cookie) and AGENTS.md's own
anti-duplication stance ("three similar lines is better than a premature
abstraction") doesn't apply when the lines aren't just similar but
identical.

No real bugs found this phase from actually running things against real
Postgres (unlike Phases 8, 9, and 10, which each found at least one) — the
register endpoint reuses `_start_session`, which was already proven
correct (including its Postgres-specific timezone-column fix) by Phase
10's own real-backend run. The only new real-Postgres-specific risk this
phase introduced was the idempotency gotcha above, caught before it ever
became a broken CI run.

## What the next session needs to know

- `npm run verify` passed clean before opening the PR: 43 vitest (across 6
  files, up from 39) + Playwright including the 5 new
  `e2e/register.spec.ts` tests and the existing `e2e/auth.spec.ts`/
  `shell.spec.ts` suites, all unaffected. `backend/scripts/verify.sh`
  (mypy, pytest — 15 tests including the 3 new register ones, spec
  conformance) passed clean. `scripts/check-phase-11.sh` — chaining
  through `check-phase-8.sh`'s real-Postgres run, including the two new
  live-backend register assertions — passed clean.
- `docs/DEFERRED.md`'s self-service-registration row is removed (its
  stated condition for removal). The login rate-limiting/lockout row it
  flagged stays open — still not needed for a personal/local deployment,
  but now a slightly larger gap than before since anyone reaching the app
  can create their own account to brute-force against.
- Not yet tagged — this phase follows Phase 9/10's pattern (registry-
  shipped content changed, so it needs an install-test via
  `consume-test.sh --install-only` against a real pushed+tagged ref before
  it can be marked fully done, the same reason Phase 10 closed out in two
  parts). See the PR for how this session closed out.
