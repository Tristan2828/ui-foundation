# Architecture

The current shape of the ui-foundation repo, and the rules that keep it
working. Read this first in any session here. Why each decision was made
is in the (historical) [`BUILD-PLAN.md`](BUILD-PLAN.md) Decision Ledger and
[`phases/`](phases); what's shipped is in [`STATUS.md`](STATUS.md).

## What this is

A reusable frontend foundation for personal database-backed apps, built
and maintained mostly by AI agents, distributed as a **shadcn registry**
(this GitHub repo). Apps install it once and own the files
([`consuming.md`](consuming.md)). Stack: Vite + React 19 + TypeScript,
Tailwind v4, shadcn/ui on Base UI, React Router 7, TanStack Query. An
optional FastAPI backend (`backend/`) implements the same contract.

## Focus: what to build next, and what not to

**Near-term apps are simple: tables that display (and sometimes edit)
database rows.** The foundation is shaped around that — `DataTable`,
`EntityForm`, URL-kept table state, the contract-first gateway, MSW so a
screen can be built with no backend.

- **Two tracks, different rules** (decided 2026-09-20, after the first real
  app shipped — [`DEFERRED.md`](DEFERRED.md) "Direction"):
  - *Design language* — tokens, semantic tones, `Badge`/variant styles,
    cell patterns, typography, density, themes — **grows freely**, without
    waiting for a second app or a second use. It is what a consuming app
    cannot cheaply get right alone (contrast, both themes, consistency),
    and it is cheap to review by looking at results. Every addition still
    ships with axe contrast coverage in both themes.
  - *Structure* — composites, new registry items, backend, auth,
    infrastructure — **stays need-driven**: built against a real app's
    actual screen, not in advance. Until then it's a row in
    [`DEFERRED.md`](DEFERRED.md) with a revisit condition. The plan's own
    warning still applies here: the failure mode is building forever.
- **Built ahead of a real app — keep, but don't grow until an app needs
  it:** auth, self-service registration and per-user ownership (shipped in
  `starter`, so every app gets a login screen); the FastAPI backend and its
  cloud/deploy hardening; Storybook. Assessed as over-built for the current
  focus on 2026-09-18 — cost already paid, so not removed.
- **Known gap for this focus:** the entity playbook always builds full CRUD. A
  read-only table entity has no path yet (`DEFERRED.md`).

## The layers

```
openapi.yaml ──gen:api──▶ src/api/schema.d.ts        (generated types only)
     │
     ├─▶ src/mocks/          MSW: the whole API in the browser, no backend needed
     │
src/api/transport/           the only fetch call
src/api/gateway/             anti-corruption layer: wire → Page<T> / AppError
src/api/contracts.ts         UI-owned Page<T>, AppError, QuerySpec
src/routes/<entity>/use-*.ts TanStack Query hooks over the gateway
src/components/app/          three composites: app-shell, data-table, entity-form
                             (+ error-state, route-error-boundary, multi-choice)
src/auth/auth-provider.tsx   the only file that knows how auth works
```

- **Contract-first.** `openapi.yaml` is the source of truth. Mocks are
  validated against it (`tests/mocks/conformance.test.ts`); the backend is
  diffed against it (`backend/scripts/check_spec_conformance.py`).
- **Seal the protocol, pass the entities.** Pagination and errors are
  normalized in the gateway; entity types pass through from `schema.d.ts`.
  A backend swap changes the gateway, nothing above it (proven in Phase 8).
- **Auth** is session cookies, same-origin. The provider owns the session
  query, ends the session on any 401, clears user-scoped cache on every
  session change, and distinguishes "logged out" from "backend down".
- **Tables** keep page/sort/filters in the URL (`src/hooks/use-table-url-state.ts`).

Every one of these boundaries is enforced mechanically — see the Hard Rules
in [`../AGENTS.md`](../AGENTS.md), each of which names its check.

## The registry

`registry.json` has three items; apps install **`starter`**, which is
self-contained (it lists every file itself — `tests/registry.test.ts`
fails if it ever depends on this registry's other items, because an
unpinned registry dependency resolves to `main`, not the tag).

- **Patched primitives must ship as files.** `registryDependencies` pull
  shadcn components live from upstream at install time, so a local fix to
  one is silently lost unless the file is listed in `starter`: `button`,
  `badge`, `combobox`, `table`, `src/hooks/use-mobile.ts` today.
- **Binary files can't ship** (the `gh` CLI corrupts them).
- **Apps can see their own drift.** `starter` ships
  `scripts/check-foundation-drift.mjs`, which compares each shipped file
  with the tag in the app's `foundation.json` (written by `create-app.sh`,
  never shipped). The app's own decisions (app-owned files, removals and
  forks, each with a reason) live in that JSON, not in the script, so the
  script itself never drifts. `consume-test.sh` asserts that a fresh app
  reads as in sync, and that an edited file doesn't.
- **New apps** are created by `scripts/create-app.sh` (instructions for
  any AI: [`create-an-app.md`](create-an-app.md)); `consume-test.sh` runs
  the same script, so a release that breaks app creation fails its tests.
- Anything a consumer must edit that the registry can't (npm scripts) is
  Step 0 of [`add-an-entity.md`](add-an-entity.md) — the only copy of the
  entity playbook, plain instructions for any AI tool (Claude Code's
  `/new-entity` is a shortcut to it).
- **Entities are never guessed.** The playbook builds from a plan file,
  `docs/entities/<entity>.md` (format: [`entities/_template.md`](entities/_template.md)),
  and plans one with the developer when it's missing. The template's
  supported-type list is the contract: anything outside it stops the
  build instead of being improvised.

## Verification

| Gate | Runs | Covers |
|---|---|---|
| `npm run verify:fast` | every change | codegen drift, `tsc -b`, ESLint (boundaries, tokens, filenames), dependency allowlist, vitest |
| `npm run verify` | before any PR; CI | + Playwright (every screen's states, auth, `a11y.spec.ts` in light and dark, and a phone-width project) and the Storybook checks on the patched primitives — axe, and that every colour they paint resolves to a token (`playwright.storybook.config.ts`) |
| `npm run verify:backend` | backend changes; CI | mypy strict, pytest (SQLite), spec conformance |
| `scripts/check-backend-postgres.sh` | backend changes (needs Docker) | all of the above + a live server on real Postgres |
| `scripts/check-cloud-postgres.sh` | DB connection changes | TLS against a hosted Postgres (`CLOUD_DATABASE_URL`) |
| `scripts/consume-test.sh --install-only <sha>` | **automatic** — the `registry` workflow, on any PR touching a path `registry.json` ships | a fresh app installs, type-checks (incl. shipped tests), lints, and gets the files of *that* ref |
| `scripts/consume-test.sh <sha> <Entity>` — the **Fresh UI Build** | **on demand**, not a release gate — run it when the playbook or a composite changes in a way that could confuse a fresh agent | a brand-new agent, with no memory of this repo, builds an entity from the registry alone (given its plan file); its `verify` passes |

Rules learned the hard way (each cost a phase to find):

- **Always test a ref by commit SHA or tag, never a branch** — GitHub's raw
  CDN caches for five minutes.
- **A Fresh UI Build PASS counts only after reading its transcript** — confirm the
  agent used the version under test and reported no workarounds.
- **A new test counts only after a negative control** — remove the fix,
  watch the test fail, restore.
- **SQLite passing proves nothing about Postgres** — timestamp columns in
  particular; `check-backend-postgres.sh` writes through the ORM for this.

## Releasing

Changes go through a PR (`main` is protected: `verify` + `verify-backend`
and a review). **Releasing is otherwise automatic**, as of 2026-09-27 —
there is no manual tag, no re-run, no README bump:

- On the PR, the `registry` workflow runs
  `consume-test.sh --install-only` against the PR's **head SHA**, but only
  when `scripts/registry-paths-changed.mjs` says a shipped path changed.
  That script derives the path list from `registry.json`, so a newly
  shipped file is covered as soon as it is listed.
- On merge, the `tag` workflow cuts the next patch tag and a GitHub
  release, again only when a shipped path changed since the last tag. A
  minor or major bump is still deliberate: push that tag by hand and the
  workflow carries on from it, since the next version comes from
  `git describe`, not from a number committed in a file.
- The README links the latest release instead of naming a version, so
  nothing has to be committed back to `main` — the workflow only pushes a
  tag, which branch protection does not block.

What made the old post-merge re-run redundant: the PR already
install-tested that exact tree, and a tag on the merge commit points at the
same tree. Deploying an app: [`deploy.md`](deploy.md).
