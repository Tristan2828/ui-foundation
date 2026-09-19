# Status

At-a-glance phase checklist. This replaces the Notion tracker this
project used during early development — everything now lives in the
repo, in one place, versioned alongside the code it describes.

**Current state:** the original plan (Phases 0–13) and the pre-reuse audit
(Phases A–E below) are done. The latest release tag is kept in one place,
the README's "Consuming this as a registry" section. How the repo works and
which checks a change needs: [`ARCHITECTURE.md`](ARCHITECTURE.md). The
standing proof of reusability is still Phase 7's: a fresh agent builds an
entity from the published registry alone (`scripts/consume-test.sh`).

For the reasoning behind any decision below, see the Decision Ledger in
[`docs/BUILD-PLAN.md`](BUILD-PLAN.md). For the full narrative of what was
built, what deviated from the plan, and what broke — one file per phase,
each written at the end of that phase's session — see
[`docs/phases/`](phases). For anything currently unresolved, see
[`docs/BLOCKERS.md`](BLOCKERS.md) (nothing open). A hosted database is set up
per app, when one needs real data — `docs/cloud-postgres.md`.

## Phase Checklist

The exit-criteria column is historical: the `check-phase-N.sh` scripts were
retired in audit Phase E (last present at `v1.10.0`). Phase 8's and 12's live
on as `scripts/check-backend-postgres.sh` and `scripts/check-cloud-postgres.sh`.

| Phase | Status | Exit criteria | Notes |
|---|---|---|---|
| 0 — Session Zero | Done (2026-09-15) | `check-phase-0.sh` passes | `AGENTS.md`/`CLAUDE.md`, `deps-allowlist.json`, `check-deps.mjs`, `spec-tester` subagent + deny hook, repo created & pushed |
| 1 — Scaffold and Tokens | Done (2026-09-15) | `check-phase-1.sh` passes | Vite scaffold, Tailwind v4, shadcn init (Base UI/Nova), two-layer `theme.css`, token lint rule, CI green |
| 2 — Contract and Boundary | Done (2026-09-16) | `check-phase-2.sh` passes | `openapi.yaml` (all 6 field types, frozen via sha256 lock), hand-rolled transport + gateway (`openapi-fetch` dropped — incompatible with Node's `Request` under vitest), MSW mocks + conformance tests, gateway tests via temporal isolation (`spec-tester` subagent wasn't invokable in this harness at the time — since confirmed working, see `docs/BLOCKERS.md`'s resolved entries) |
| 3 — App Shell | Done (2026-09-16) | `check-phase-3.sh` passes | Sidebar/header shell, auth stub, per-route error boundaries, kitchen-sink (11 primitives), nav+axe+dark-mode-screenshot e2e coverage. CI green — Linux baselines sourced from CI's own artifact output (no Docker needed at the time) |
| 4 — Reference Screens | Done (2026-09-16) | `check-phase-4.sh` passes | `widgets-table`/`widget-form` built on `data-table`/`entity-form` composites (+ `error-state`). Found and fixed a project-wide bug: `tsc --noEmit` had been a total no-op since Phase 1 (solution-style tsconfig needs `-b`) |
| 5 — Tokens (palette) | Done (2026-09-16) | `check-phase-5.sh` passes | Kept the existing primitive palette as the deliberate v1 choice (not a new brand). Fixed `Badge`'s `destructive` variant (tinted → solid, matching `Button`'s Phase 3 fix) and a real dark-mode contrast bug the fix surfaced. Added a dark-mode axe pass + a `theme.css` token set-equality vitest |
| 6 — Registry | Done (2026-09-16) | `check-phase-6.sh` passes | `registry.json` (conventions/theme/starter), `new-entity` skill, tagged `v1.0.0` — install-tested in a fresh Vite app, not just schema-validated. Found & fixed two real bugs: `registry:component` silently flattens subdirectories, and `starter` was missing `react-router` as a declared dependency |
| 7 — Dogfood | Done (2026-09-16) | `check-phase-7.sh` passes | Fresh agent, no memory of this repo, built a full CRUD entity (Invoice) end to end via `/new-entity` from the published registry alone — 54 vitest + 41 Playwright, zero foundation edits. Found & fixed 5 real bugs along the way (see `docs/phases/phase-7.md`). Tagged `v1.1.0` — **this is the project's definition of done** |
| 8 — Backend (optional) | Done (2026-09-17) | `check-phase-8.sh` passes | FastAPI + SQLModel + Alembic against `openapi.yaml`, zero changes to `src/api/gateway` or `src/api/transport`. Found & fixed 4 real bugs once run against real Postgres (see `docs/phases/phase-8.md`). Not tagged — touches no registry-shipped path |
| 9 — Storybook (optional) | Done (2026-09-17) | `check-phase-9.sh` passes | Kitchen-sink route retired everywhere (dev route, `registry.json`'s `starter` item, Phase 3/5 permanent checks, `consume-test.sh`) once its own Phase 1 deferral condition was met. Full replacement, not additive — see `docs/phases/phase-9.md` for the internal-only-vs-full-replacement tradeoff. Registry-shipped content changed, so this *is* tagged (`v1.2.0`) |
| 10 — Real Auth (optional) | Done (2026-09-17) | `check-phase-10.sh` passes | Closed the "Real auth" deferral now that Phase 8 picked the backend. Session cookies (stdlib-only: PBKDF2 password hashing, `secrets`-generated tokens, a server-side sessions table), login only against a seeded user — no self-service registration. `/auth/login`, `/auth/logout`, `/auth/me` added to `openapi.yaml` (a deliberate, reviewed unfreeze — see `openapi.yaml.sha256`); widgets/categories now require a session on the backend, not just the UI. Registry-shipped content changed (auth boundary, app shell, mocks, new login screen) — `registry.json` updated, install-tested, tagged `v1.3.0`. See `docs/phases/phase-10.md` for the bugs the real run found |
| 11 — Self-Service Registration (optional) | Done (2026-09-17) | `check-phase-11.sh` passes | Closed the "self-service registration" row in `docs/DEFERRED.md`. `POST /auth/register` added to `openapi.yaml` (another deliberate, reviewed unfreeze); duplicate email is a 422 field error, not a 409; registering auto-logs in via the same session-creation path `login()` uses. `/register` screen built the way `/login` was (`FieldGroup`/`Field`, not `EntityForm`), plus a client-only password-confirmation field. Registry-shipped content changed — `registry.json` updated, install-tested, tagged `v1.4.0`. See `docs/phases/phase-11.md` |
| 12 — Cloud Postgres Support (optional) | Done (2026-09-18) | `check-phase-12.sh` passes | Closed the "Cloud Postgres" row in `docs/DEFERRED.md`. Additive `DATABASE_SSL`/`DATABASE_SSL_CA_FILE` support (`backend/app/config.py`'s `database_connect_args()`, shared by `db.py` and `migrations/env.py`); local Docker Compose stays the default. Verified end-to-end against a real free-tier Supabase project — found and fixed two real bugs invisible from any static check (see `docs/phases/phase-12.md`): Supabase's "direct connection" host is IPv6-only (use the pooler's session-mode port instead), and its Postgres cert chains to a private root CA needing explicit pinning. Not tagged — touches no registry-shipped path, same as Phase 8 |
| 13 — Storybook Controls/Autodocs Polish (optional) | Done (2026-09-18) | `check-phase-13.sh` passes | Closed the "Storybook Controls/autodocs polish" row in `docs/DEFERRED.md`. Added `@storybook/addon-docs` (registered in `.storybook/main.ts`, `tags: ['autodocs']` in `preview.ts`). Rewrote all 12 `src/components/ui/*.stories.tsx` from static multi-instance `AllVariants` renders to a single `args`-driven `Default` export with `argTypes` Controls. Only 4 of the 12 (badge, button, input, separator) actually changed visual output — the rest kept identical default content, so their screenshot baselines were untouched. Registry-shipped content changed — `registry.json` needed no path changes (every story file was already individually listed), tagged `v1.5.0`, install-tested. See `docs/phases/phase-13.md` |

## Post-v1.5.0 Maintenance

Review-driven fixes, not a phase — backend-only, no registry-shipped path
changed, so not tagged. `check-phase-8.sh` (now `check-backend-postgres.sh`) passes (now also asserting
per-user ownership against real Postgres).

- **Per-user widget ownership** — Phase 11's self-service registration let
  any account read and edit every widget. Migration `0003` adds
  `widgets.owner_id` (existing rows go to the seeded dev user); the router
  scopes every query to the session's user, and another user's widget is a
  404. Categories stay shared. No `openapi.yaml` change.
- **SPA deep-link fallback** — `backend/app/spa.py`: the single-deployable
  setup 404'd on a refresh of any client route but `/`.
- **Case-insensitive emails** — normalized to lowercase on login/register
  (and existing rows in `0003`).
- **Expired-session cleanup** — deleted when presented, and pruned per user
  on login.
- **Supabase is the dev database default** — `backend/.env.example` and
  `backend/scripts/dev.sh` now assume a hosted Postgres
  (`docs/cloud-postgres.md`). Docker Compose stays for offline work
  (`dev.sh --local`) and for `check-backend-postgres.sh`, which always forces it so
  automated runs never write test users into Supabase.

## Dependency Upgrades

Full narrative and lessons for this and the section above:
[`docs/phases/maintenance-2026-09-18.md`](phases/maintenance-2026-09-18.md).

One PR per major, each verified with `npm run verify`, both builds, and
`consume-test.sh --install-only` on the branch.

- **In-range minor/patch** (#9) — not tagged.
- **zod 3 → 4** (#10) — `required_error` replaced by an `error` function;
  `.email()` → `.pipe(z.email())`. `tests/form-schemas.test.ts` pins every
  message and passes on both versions. `registry.json` now pins
  `zod@^4.6.5` (unversioned resolved to zod 3 in a fresh app). Tagged
  `v1.6.0`, install-tested.
- **vite 7 → 8, @vitejs/plugin-react 5 → 6** — matches `deps-allowlist.json`'s
  `tools.vite`. No registry-shipped path changed, so not tagged.
- **eslint 9 → 10** (+ `@eslint/js` 10, `globals` 17,
  `eslint-plugin-react-refresh` 0.5) — no config changes needed; every
  custom rule re-checked against a deliberate-violation probe file. The
  shipped `eslint.config.js` is unchanged, so not tagged.
- **TypeScript 5.9 → 6.0** — the last JS-based release, the bridge to 7.
  Removed the deprecated `baseUrl` from the tsconfigs (TS 6 errors on it;
  `paths` resolves relative to the tsconfig without it), including the
  registry-shipped `tsconfig.test.json` — tagged `v1.7.0` after merge.
  openapi-typescript's peer range is still `^5.x`, so `package.json`
  `overrides` points its `typescript` at ours; generated `schema.d.ts` is
  byte-identical. **TypeScript 7 is deferred** — see `docs/DEFERRED.md`.

## Pre-Reuse Audit

Five remediation phases, one PR each — plan and status in
[`docs/AUDIT-2026-09-18.md`](AUDIT-2026-09-18.md).

- **Phase A — registry consumer gaps** (#18) — `starter` is self-contained
  (it had always installed `conventions`/`theme` files from `main`, not
  the requested tag); ships `@storybook/addon-docs` and the patched
  `use-mobile.ts`; consumers type-check `tests/`/`e2e/`; consumer-safe
  `AGENTS.md`. Proven by a full Fresh UI Build pinned to a commit SHA. Tagged
  `v1.8.0`, install-tested. See `docs/phases/audit-phase-a.md`.
- **Phase B — auth robustness** (#20) — user-scoped query cache cleared on
  every session change; a mid-session 401 returns to `/login`; return-to
  after login; backend outage is not "logged out". Tagged `v1.9.0`.
- **Phase C — backend correctness and deploy safety** (#21) — widget
  create/update 500'd on real Postgres (fixed); a plain `npm run build`
  shipped the mocks (`npm run build:real`); `APP_ENV=production` startup
  guard; `docs/deploy.md`. Backend-only, not tagged.
- **Phase D — consumer lifecycle and data table** (#22) — `docs/consuming.md`
  (safe upgrades, getting the backend); table state in the URL, debounced
  search, page clamp, `aria-sort`. Tagged `v1.10.0`.
- **Phase E — pruning** — one playbook copy; `ARCHITECTURE.md` in front of
  the now-historical `BUILD-PLAN.md`; `check-phase-*.sh` retired; `openapi.yaml`
  freeze dropped; Storybook out of `starter` with screenshots only for the
  patched primitives, replaced by `e2e/a11y.spec.ts` on the real screens
  (which found three real violations, fixed). See `docs/phases/audit-phase-e.md`.

## After the Audit: First Real Project

Mapping the developer's Notion "Multiplayer Game List" onto the foundation
exposed two gaps; both closed the same day (2026-09-18).

- **Phase F — entity plans** (#26, `v1.12.0`) — `/new-entity` builds only
  from a plan file, `docs/entities/<entity>.md` (template and a Widget
  example ship with `starter`), and plans with the developer when there
  isn't one — never guesses. Also: the full new-app setup and a
  Postgres-vs-Notion-API choice in `docs/consuming.md` (the Notion adapter
  is deferred). See `docs/phases/phase-f-entity-plans.md`.
- **Phase G — multi-select** (#27, `v1.13.0`) — multi choice as a
  demonstrated field type: Widget `tags`, `<MultiChoice>` on the form and
  as a table filter, a `widget_tags` join table (migration `0004`). Found
  and fixed an array-field gap in the gateway's error mapping and an
  unlabelled chip button upstream. See `docs/phases/phase-g-multi-select.md`.

## Decision Ledger (highlights)

Full ledger with rationale in `docs/BUILD-PLAN.md`.

- **Primitives:** Base UI (shadcn default since July 2026), not Radix
- **Framework:** Vite SPA (not Next.js) — avoids RSC boundary issues
- **Router:** React Router v7
- **Distribution:** GitHub repo (public as of Phase 10) as shadcn registry (not npm) — keeps components open-code/editable
- **Backend:** FastAPI + SQLModel + Postgres, built *after* Phase 7, against a contract the UI already proved
- **Verification:** everything is a script (`verify:fast` / `verify`); nothing is "looks right"

Pinned tool versions live in [`deps-allowlist.json`](../deps-allowlist.json) (npm side) and [`backend/pyproject.toml`](../backend/pyproject.toml) (Python side) — not repeated here to avoid a second place they can drift out of sync.
