# Architecture

How the ui-foundation repo is put together, which checks a change needs,
and how releases happen. Read this first in any session here, then
[`DEFERRED.md`](DEFERRED.md) (the direction and the queue) and
[`BLOCKERS.md`](BLOCKERS.md).

## What this is

Shared code for a family of small, contract-first, database-backed apps —
tables that display and edit rows — built and maintained mostly by AI
agents. Stack: Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui on Base
UI, React Router 7, TanStack Query; an optional FastAPI backend.

Two things ship from this repo, under one version number:

- **`@tristan2828/ui-foundation`** (`packages/ui-foundation/`), an npm
  package holding everything apps share: primitives, composites, the app
  shell and auth, the gateway's error seam, design tokens, lint rules,
  Playwright suites, and the conventions an agent follows (synced into each
  app). Apps get fixes by bumping its version.
- **The template** (`template/`), a working app with one demo entity
  (Widgets) and a reference backend. `scripts/create-app.sh` copies it to
  start a new app. From then on the copy is the app's own.

### Why shared code (3.0, 2026-09-28)

Until 3.0 the foundation was a shadcn registry. Apps installed files once
and owned them, so no later fix reached an app unless someone copied it in
by hand. The first real app (Game List) showed what that costs. It stayed
on `v2.1.0` through seven releases and rebuilt things that had already
shipped better here. It carried 16 declared forks, and it only caught up
through a drift check built to make the divergence visible. "Owning every
file" had meant maintaining every file twice.

The original case for a registry over npm was editability: shadcn
components belong in the repo, not in a `node_modules` black box. That
still holds for an app's *own* components. It stopped holding for the
shared layer, because nobody edits that per app on purpose. They fork it
by accident. So the shared layer is now a package, and each app keeps
only what is genuinely its own: `openapi.yaml`, routes, nav, mocks,
entities and backend.

What it costs, and how the cost is kept small:

- **An app can't edit a package component.** It configures one through
  props and slots (`AppShell`'s `nav`/`sidebarExtra`/`defaultSidebarOpen`,
  `EntityForm`'s `danger`, `LoginRoute`'s `registerPath`). Or it builds its
  own component in `src/` on top of the package's exports. Or it raises the
  change here. Every one of those props came from a real fork in Game List.
- **Lint makes the boundary hold.** Importing the package's internals, or a
  primitive the package ships from the app's own `src/components/ui/`, is
  an error. So "copy it and change it" can't happen quietly.
- **The backend is still copy-in.** `template/backend/` is copied with the
  template and diverges from then on. Sharing it is a separate decision
  ([`DEFERRED.md`](DEFERRED.md)).

## Repository layout

```
packages/ui-foundation/     the npm package
  src/                      components/{ui,app}, auth/, api/, hooks/, mocks/, testing/, routes/ (login, register)
  styles/                   theme.css (tokens) + index.css (what apps import)
  eslint/                   the shared flat config
  bin/ui-foundation.mjs     sync | check-contract | check-deps
  conventions/              AGENTS.md block, docs/ and agent files that `sync` writes into apps
  openapi/foundation.yaml   the part of every app's contract the package calls
  e2e/, .storybook/         Storybook accessibility + token-colour checks for every primitive
template/                   the app every new app starts as (Widgets demo + reference backend)
scripts/                    create-app.sh, consume-test.sh (+ fixtures/entity-plans/)
docs/                       this repo's docs
```

npm workspaces tie the two together. The template depends on the
package by version, and in this repo that resolves to the workspace, so
the template always runs against the package as built from the same
commit. `npm install` builds the package (a root `postinstall`).

## The layers (in an app)

```
openapi.yaml ──gen:api──▶ src/api/schema.d.ts         generated types only
     │
     ├─▶ src/mocks/                    MSW: the whole API in the browser, no backend needed
     │     └ authHandlers              ← package (/mocks)
src/api/gateway/<entity>.ts            anti-corruption layer: wire → Page<T> / AppError
     └ safeFetch, toAppError           ← package (/gateway): the only fetch path
src/routes/<entity>/use-*.ts           TanStack Query hooks over the gateway
src/routes/<entity>/*-table, *-form    thin consumers of DataTable / EntityForm   ← package
src/App.tsx, src/nav.ts                routes; AppShell, LoginRoute, RegisterRoute ← package
src/main.tsx                           FoundationProviders (theme, query client, auth) ← package
```

- **Contract-first.** `openapi.yaml` is the source of truth. The mocks are
  validated against it (`tests/mocks/conformance.test.ts`), and the backend
  is diffed against it (`backend/scripts/check_spec_conformance.py`).
- **Seal the protocol, pass the entities.** Pagination, errors and query
  syntax are normalised in the gateway into the UI-owned `Page<T>`,
  `AppError` and `QuerySpec`. Entity types pass through from the generated
  schema, with no hand-written domain types or mappers. A backend swap
  changes the gateway and nothing above it.
- **The contract is split.** `/auth/*` and the error envelopes are the
  foundation's (`openapi/foundation.yaml`), because the package's own code
  calls them. An app's spec must contain them unchanged; wording may differ,
  shapes may not (`ui-foundation check-contract`). Everything else in the
  spec is the app's.
- **Auth** is session cookies, same-origin. `AuthProvider` owns the session
  query, ends the session on any 401, clears user-scoped cache on every
  session change, and tells "logged out" apart from "backend down". Apps
  read it only through `useAuth()`, the only auth export.
- **Tables** keep page, sort and filters in the URL (`useTableUrlState`,
  including `setFilters`/`applyView` for saved views).

Every boundary is enforced mechanically: see the Hard Rules in
[`conventions/AGENTS.md`](../packages/ui-foundation/conventions/AGENTS.md),
each of which names its check.

## Conventions and `sync`

The rules and playbooks an agent follows in an app live in
`packages/ui-foundation/conventions/`. `ui-foundation sync` writes them into
the app:

- the block between `<!-- ui-foundation:start -->` and `:end` in `AGENTS.md`
  (the app's own notes go below it),
- `docs/foundation/`, which sync owns entirely (the entity playbook,
  design language, cell patterns, column options, the entity-plan template),
- `.claude/skills/new-entity/`, `.codex/skills/new-entity/`,
  `.claude/agents/spec-tester.md` and its hook,
- `CLAUDE.md` (`@AGENTS.md`), once, if missing.

`sync --check` runs in every app's `verify:fast`, so an upgrade that skipped
`sync`, or a local edit to a synced file, fails the gate. In this repo,
`template/` is an app like any other. After changing anything in
`conventions/`, run `npm run sync` and commit what it writes.

## Verification

| Gate | Runs | Covers |
|---|---|---|
| `npm run verify:fast` (root) | every change | the package: codegen drift, `tsc -b`, ESLint, allowlist, build, vitest. Then the template: codegen drift, `sync --check`, `check-contract`, `check-deps`, `tsc -b`, ESLint, vitest |
| `npm run verify` (root) | before any PR; CI (`verify`) | + the package's Storybook checks on every primitive (axe in both themes; every colour it paints resolves to a token) and the template's Playwright suite (every screen's states, auth, `a11y.spec.ts` in light and dark, a phone-width project) |
| `npm run verify:backend` | backend changes; CI | the template backend's mypy strict, pytest (SQLite), spec conformance |
| `template/scripts/check-backend-postgres.sh` | backend changes (needs Docker) | all of the above + a live server on real Postgres |
| `template/scripts/check-cloud-postgres.sh` | DB connection changes | TLS against a hosted Postgres (`CLOUD_DATABASE_URL`) |
| `scripts/consume-test.sh --install-only` | **automatic**: the `package` workflow, on any PR touching the package, the template or the scripts | `npm pack`, then `create-app.sh` builds an app outside the repo from the tarball (installed, not linked), and that app's full `verify` and a mock-free `build:real` must pass |
| `scripts/consume-test.sh <Entity>`, the **Fresh UI Build** | on demand, when the playbook or a composite changes in a way that could confuse a fresh agent | a brand-new agent with no memory of this repo builds an entity in such an app from its plan; its `verify` passes |

Rules learned the hard way (each cost a phase to find):

- **A new check counts only after a negative control**: break the thing,
  watch the check fail, restore it.
- **A Fresh UI Build PASS counts only after reading its transcript**:
  confirm the agent used the version under test and reported no
  workarounds.
- **SQLite passing proves nothing about Postgres**, timestamp columns in
  particular. `check-backend-postgres.sh` writes through the ORM for this.
- **Gate MSW on the literal `import.meta.env.VITE_API` check** in
  `main.tsx`. The bundler folds only that exact form, so behind an imported
  constant `build:real` still ships MSW (`consume-test.sh` asserts it).
- **Test a commit, not a branch.** Scripts and workflows take a SHA or a
  tag, so every result belongs to one immutable tree.

## Decisions that still hold

| Decision | Why |
|---|---|
| shadcn/ui on Base UI | Open-code primitives an AI can read. Base UI is shadcn's default, so it's what the CLI, docs and `llms.txt` describe |
| Vite SPA, not Next.js | Server features would duplicate the backend, and RSC boundaries are a top source of AI errors |
| React Router 7, TanStack Query | Densest training data; all server state in one cache |
| Contract-first OpenAPI + anti-corruption gateway | The protocol is sealed, so a backend is one implementation of a contract the app owns, and the UI builds with no backend at all |
| FastAPI + SQLModel reference backend | Least code per entity and the best OpenAPI story. mypy strict replaces the compiler |
| Session cookies | Same-origin deployment (FastAPI serves the SPA), stdlib-only, no token storage |
| Two-layer design tokens | Primitives, then semantic tokens. Multi-theme stays nearly free because components only ever see the semantic layer |
| Verification, not inspection | The developer reviews results, not code. A check that can't run in CI doesn't count |
| Every rule has a mechanical enforcer | Agents route around rules they don't see the point of; a rule only in AGENTS.md is a wish |
| Exact tool versions, never `@latest` | Many fresh sessions over weeks must run the same tools |
| Shared package + template (3.0) | See "Why shared code" above |

## Releasing

Releasing is automatic: `.github/workflows/release.yml` runs on every push
to `main` that changes `packages/ui-foundation/`, `template/` or
`scripts/create-app.sh`. It then:

1. picks the version: the next patch after the latest `v*` tag, or the
   version in `packages/ui-foundation/package.json` if that is higher. A
   minor or major release is made by bumping it there in the PR, and
   nothing is committed back.
2. publishes `@tristan2828/ui-foundation@<version>` to npm through trusted
   publishing (OIDC, with provenance; no stored token),
3. tags the commit `v<version>` and creates a GitHub release. The template
   at that tag and the package at that version always belong together,
4. creates an app from the published release (`create-app.sh`, package from
   npm) and runs its `verify` — the one check of exactly what apps get.

`main` needs no review and no passing checks (one developer). A push
straight to `main` is released without the install test, which runs only
on pull requests (`package` workflow). So open a PR for any change to the
package or the template.

**A breaking change** to anything the package exports, or to what
`sync` writes, gets a major version, a `CHANGELOG.md` entry and upgrade
steps in [`consuming.md`](consuming.md).

**One-time npm setup**, done by the developer before the first automatic
release. npm lets trusted publishing be configured only on a package that
already exists:

1. Create the npm account `tristan2828` (with 2FA).
2. Publish 3.0.0 once by hand from a clean checkout of the release commit:
   `npm ci && npm publish -w @tristan2828/ui-foundation` (the package's
   `prepack` builds it). Then push the tag: `git tag v3.0.0 && git push
   origin v3.0.0`.
3. On npmjs.com → the package → Settings → Trusted Publisher: GitHub
   Actions, repository `Tristan2828/ui-foundation`, workflow `release.yml`.
   Then set "Publishing access" to require trusted publishing (no tokens).

Deploying an app: `template/docs/deploy.md`.
