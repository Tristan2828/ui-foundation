# Phase 10 — Real Auth

## What was built

- **Session-cookie auth, stdlib-only, zero new dependency** on either
  side. Backend: `app/security.py` (PBKDF2-HMAC-SHA256 password hashing,
  `secrets.token_urlsafe` session tokens, sha256-at-rest token hashing so a
  DB dump can't be replayed as a live session), `User`/`Session` table
  models, `app/routers/auth.py` (`POST /auth/login`, `POST /auth/logout`,
  `GET /auth/me`, and the `get_current_user` dependency). `widgets.py` and
  `categories.py` now gate their whole router on that dependency — the
  backend enforces auth now, not just the UI.
- **Login only, against one seeded user** (`SEED_USER_EMAIL`/
  `SEED_USER_PASSWORD`, defaulting to `dev@example.com` /
  `dev-password-123` — see `backend/.env.example`) — no self-service
  registration, matching this repo's "personal database application"
  framing (see `docs/DEFERRED.md`).
- **Contract**: `/auth/login`, `/auth/logout`, `/auth/me`, `User`,
  `LoginRequest` added to `openapi.yaml` — a deliberate, reviewed unfreeze
  (`openapi.yaml.sha256` updated in the same commit, per
  `scripts/check-openapi-freeze.mjs`'s own instructions; the freeze held
  "until v1.1.0," the repo is at v1.2.0). `npm run gen:api` regenerated
  `schema.d.ts`.
- **Frontend**: `src/api/gateway/auth.ts` (same `safeFetch`/`toAppError`
  shape as every other gateway module); `auth-provider.tsx` rewritten from
  the Phase 3 `FAKE_USER` stub to a real `useQuery(['auth','me'])` +
  `login`/`logout` mutuating that query's cache — TanStack Query, not
  `useEffect`, per the hard rule. `AppShell` now has three states (loading
  skeleton, redirect to `/login` if unauthenticated, the existing shell
  otherwise) plus a logout control in the sidebar footer. New
  `src/routes/login.tsx` + `login-schema.ts` — built from the mandated
  `FieldGroup`/`Field` primitives directly, not the `EntityForm` composite
  (that's specifically create/edit-an-entity chrome with a Cancel button; a
  login screen has no cancel destination).
- **MSW defaults to authenticated** (`src/mocks/data.ts`'s
  `isAuthenticated` flag) — this is what let every existing widgets/shell
  Playwright spec and Storybook story pass unmodified. New
  `e2e/auth.spec.ts` covers login success/failure, the unauthenticated
  redirect, and logout, using the same `window.__E2E_MSW_OVERRIDE__`
  pre-navigation override pattern as `widgets-table.spec.ts`.
- **Registry-shipped content changed** (unlike Phase 8): `src/auth/**`,
  `app-shell.tsx`, `main.tsx`, the mocks, plus the new login screen and
  `gateway/auth.ts` are all already, or newly, part of `registry.json`'s
  `starter` item. Updated and locally validated
  (`shadcn registry validate`).
- `scripts/check-phase-10.sh` — thin: `npm run verify`, then chains onto
  `check-phase-8.sh` for the real-Postgres proof (now also asserting an
  unauthenticated `GET /api/widgets` returns 401).

## Deviations from plan

The plan document (`C:\Users\trist\.claude\plans\rustling-prancing-avalanche.md`
at authoring time) assumed a route-level axe check on `/login` "matching
every other screen's coverage" — re-checking the actual e2e suite before
writing it showed that assumption was stale: Phase 9 moved all a11y
coverage into per-primitive Storybook stories, and no route-level spec
(`shell.spec.ts`, `widgets-table.spec.ts`, `widget-form.spec.ts`) does its
own axe check anymore. Dropped the axe assertion from `e2e/auth.spec.ts`
to match the actual current convention, not the stale assumption.

**Four real bugs found only by actually running things — none visible
from `tsc`, ESLint, or the SQLite-backed pytest suite, all in this repo's
established pattern (Phases 3/7/8/9 all found bugs the structural checks
couldn't see):**

1. `categories.py`'s `list_categories` route still declared
   `responses=SERVER_ERROR` after the router gained
   `dependencies=[Depends(get_current_user)]` — `check_spec_conformance.py`
   (backend/scripts/verify.sh) caught the mismatch immediately: FastAPI's
   generated spec now has a real 401 response the hand-declared
   `responses=` dict didn't document. Fixed with a `LIST_RESPONSES =
   {**UNAUTHORIZED, **SERVER_ERROR}`, matching `widgets.py`'s own pattern.
2. `login()`'s response serialization failed with
   `ResponseValidationError` (id/email/name all coming back empty) —
   `session.commit()` expires every object in the SQLAlchemy session,
   including `user`, which the handler only *read*, not modified. The
   existing `create_widget` handler already had the fix
   (`session.refresh(widget)` after `commit()`) — I hadn't noticed that
   convention until hitting the same failure myself. Same fix applied.
3. `get_current_user`'s expiry comparison
   (`user_session.expires_at < datetime.now(timezone.utc)`) raised
   `TypeError: can't compare offset-naive and offset-aware datetimes`
   under the SQLite-backed pytest fixture — SQLite has no real
   timezone-aware column type, so a `DateTime(timezone=True)` column
   silently round-trips as naive there (same bug class Phase 8 already
   hit once with asyncpg/raw strings — recorded in memory as a lesson,
   and it recurred here because a *different* file exercises it). Fixed
   by normalizing to UTC-aware in application code before comparing,
   rather than trusting the driver.
4. **The real one — only visible against actual Postgres, not SQLite**:
   `POST /auth/login` returned a bare 500 the first time it ran against a
   real database. `Session.expires_at: datetime` (no explicit
   `sa_column`) gets SQLModel's default *timezone-naive* column mapping at
   the ORM level, independent of what the Alembic migration's DDL actually
   declares (`sa.DateTime(timezone=True)`) — the ORM mapping, not the live
   schema, is what SQLAlchemy uses to decide how to bind parameters, so it
   tried to bind a tz-aware Python `datetime` against a column it believed
   was naive, and asyncpg refused. Fixed with an explicit
   `Field(sa_column=Column(DateTime(timezone=True), nullable=False))` so
   the ORM's understanding matches the migration. **Note for later**:
   `Widget.available_from` has the exact same latent mismatch (no explicit
   `sa_column`, `timezone=True` only in the migration's DDL) — it has
   never actually failed because nothing has ever POSTed a widget against
   real Postgres end to end (`check-phase-8.sh` only runs the
   MSW-independent read-only specs). Not fixed here — out of this phase's
   scope (Phase 8's code, already tagged) — flagged in case a future
   session adds a real-backend widget-creation test and hits it.

**`scripts/check-phase-8.sh` had two assertions that would have failed
forever after this phase**, and needed retiring rather than working
around: "registry-shipped paths unchanged since v1.1.0" and
"`src/api/gateway`/`transport` unchanged since v1.1.0". Both were one-time
claims about *Phase 8's own diff* (already proven and recorded in
`docs/phases/phase-8.md`), not standing regression tests — Phase 10
legitimately changes both (a new `gateway/auth.ts`, registry-shipped auth
UI). Removed them, same reasoning Phase 9 used when it rewrote
`check-phase-3.sh`/`check-phase-5.sh`'s kitchen-sink assertions instead of
leaving them permanently red. Also fixed `check-phase-8.sh`'s uvicorn
health-check loop, which used `curl -f` (fails on any non-2xx) against
`/api/categories` — now that endpoint correctly requires auth, `curl -f`
would have looped until timeout on every future run, mistaking "the
backend is up and correctly rejecting me" for "not ready yet."

## What the next session needs to know

- **Merged, tagged, install-tested — this phase is fully done.** Per the
  developer's explicit choice (given the branch-protection-vs-direct-push
  tension flagged in a previous session's memory), this went through a PR
  (`phase-10-auth` → `main`, PR #2) instead of a direct push, for the
  first time in this project's history for a phase's own work. `main`
  requires 2 status checks (`verify`, `verify-backend`) and 1 approving
  review; the developer has admin bypass rights but chose not to use them
  — both checks passed in CI, the developer reviewed/approved and merged,
  then tested the login flow themselves locally against MSW and confirmed
  it works.
- Tagged `v1.3.0` on the merge commit and ran
  `scripts/consume-test.sh --install-only v1.3.0`: **PASS** — a fresh Vite
  app installing `Tristan2828/ui-foundation/starter#v1.3.0` from the real
  GitHub repo (not local disk) type-checks clean. This is the actual proof
  the registry-shipped side works, not just `registry validate`'s schema
  check.
- Local proof that also exists: `npm run verify` (37 vitest + 55
  Playwright, MSW-backed) and `scripts/check-phase-10.sh` (chains through
  `check-phase-8.sh`'s real-Postgres run, including a fresh
  `POST /auth/login` → `GET /auth/me` → `GET /api/widgets` round trip
  against actual Postgres) both passed clean before the PR was opened.
- `docs/DEFERRED.md` gained two new rows this phase created rather than
  resolved: self-service registration, and login rate-limiting/lockout.
  Neither is needed for a personal/local deployment; revisit conditions
  are stated there.
