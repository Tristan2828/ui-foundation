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

Three things ship from this repo, under one version number:

- **`@tristan2828/ui-foundation`** (`packages/ui-foundation/`), an npm
  package holding everything apps share: primitives, composites, the app
  shell and auth, the gateway's error seam, design tokens, lint rules,
  Playwright suites, and the conventions an agent follows (synced into each
  app). Apps get fixes by bumping its version.
- **`ui-foundation-backend`** (`packages/backend-foundation/`, 4.25), a pip
  package holding the backend's auth and security layer (see
  "backend-foundation" below). Apps get its fixes by bumping its pin.
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
- **Most of the backend is still copy-in.** `template/backend/` is copied
  with the template and diverges from then on, except its auth and
  security layer, which since 4.25 is a pip package (see
  "backend-foundation" below).

## Repository layout

```
packages/ui-foundation/     the npm package
  src/                      components/{ui,app}, auth/, api/, hooks/, mocks/, testing/, routes/ (login, register)
  styles/                   theme.css (tokens) + index.css (what apps import)
  eslint/                   the shared flat config
  vite/                     buildInfo(): dist/build-info.json and the build's commit/PR
  bin/ui-foundation.mjs     sync | check-contract | check-deps
  conventions/              AGENTS.md block, docs/ and agent files that `sync` writes into apps
  openapi/foundation.yaml   the part of every app's contract the package calls
  e2e/, .storybook/         Storybook accessibility + token-colour checks for every primitive
packages/backend-foundation/  the pip package ui-foundation-backend (import foundation_backend)
  src/foundation_backend/   auth, sessions, sign-in limits, TOTP, error reporting, deploy checks, OAuth
  tests/                    its pytest suite, against tests/minimal_app.py (the package alone)
template/                   the app every new app starts as (Widgets demo + reference backend)
scripts/                    create-app.sh, consume-test.sh (+ fixtures/entity-plans/)
docs/                       this repo's docs
```

npm workspaces tie the two together. The template depends on the
package by version, and in this repo that resolves to the workspace, so
the template always runs against the package as built from the same
commit. `npm install` builds the package (a root `postinstall`).

The backend half has no workspace mechanism, so it has a rule instead:
**install both editable in one pip call**,
`pip install -e packages/backend-foundation -e 'template/backend[dev]'`
(from `template/backend/`: `-e ../../packages/backend-foundation -e ".[dev]"`).
`template/backend/pyproject.toml` lists `ui-foundation-backend` unpinned,
and only that call makes it resolve to this commit's folder rather than
PyPI. `template/backend/scripts/dev.sh`, the cloud session hook and CI's
`verify-backend` all do it; there is one venv, `template/backend/.venv`.

## The layers (in an app)

```
openapi.yaml ──gen:api──▶ src/api/schema.d.ts         generated types only
     │
     ├─▶ src/mocks/                    MSW: the whole API in the browser, no backend needed
     │     └ authHandlers              ← package (/mocks)
src/api/gateway/<entity>.ts            anti-corruption layer: wire → Page<T> / AppError
     └ safeFetch, toAppError           ← package (/gateway): the only fetch path
src/routes/<entity>/use-*.ts           TanStack Query hooks over the gateway
     └ useRecordUpdate                 ← package: one record's fields saved without the form
src/routes/<entity>/*-fields          one control per field, shared by form and view (+ RichTextEditor) ← package
src/routes/<entity>/*-table            thin consumer of DataTable                 ← package
src/routes/<entity>/*-view             thin consumer of EntityView (+ Markdown)   ← package
src/routes/<entity>/*-form             thin consumer of EntityForm                ← package
src/App.tsx, src/nav.ts                routes; AppShell, LoginRoute, RegisterRoute ← package
src/main.tsx                           FoundationProviders (theme, query client, auth), DataEnvironmentBanner ← package
```

- **Contract-first.** `openapi.yaml` is the source of truth. The mocks are
  validated against it (`tests/mocks/conformance.test.ts`), and the backend
  is diffed against it (`backend/scripts/check_spec_conformance.py`).
- **Seal the protocol, pass the entities.** Pagination, errors and query
  syntax are normalised in the gateway into the UI-owned `Page<T>`,
  `AppError` and `QuerySpec`. Entity types pass through from the generated
  schema, with no hand-written domain types or mappers. A backend swap
  changes the gateway and nothing above it.
- **The contract is split.** `/auth/*`, `/environment` and the error
  envelopes are the foundation's (`openapi/foundation.yaml`), because the
  package's own code calls them. An app's spec must contain them unchanged;
  wording may differ, shapes may not (`ui-foundation check-contract`). A
  path marked `x-optional` (`/auth/register`, `/environment`) may be left
  out, with whatever only it uses. Everything else in the spec is the app's.
- **Which data the app is on** (3.19). Above the router sit two banners:
  `MockModeBanner` (MSW, from the app's build flag) and
  `DataEnvironmentBanner` (the real backend on data that isn't
  production's, from its `DATA_LABEL` via `GET /environment`). The second
  is a query like any other server read, kept across session changes
  because it's the same for every user.
- **Which build is live** (4.5). The package's Vite plugin
  (`/vite`, `buildInfo()`) writes `dist/build-info.json` on every build:
  `api` (`real`, or `mock` for an MSW bundle), the commit and the PR, and
  (4.9, `alembic`) the migrations' head revision as `schema`. The
  reference backend refuses `APP_ENV=production` unless it says `real`,
  and `AppShell`'s `version` shows the commit, linking to its PR.
- **AI chats** (4.2, off by default) reach records through `/mcp` and an OAuth 2.1
  sign-in in the reference backend (`app/routers/mcp.py`, `oauth.py`). Tools come from
  one registry of entities (`app/mcp_entities.py`) and call the entities' own router
  functions, so the API's validation and per-user scoping apply. Delete is soft only
  (`deleted_at`, with restore; 4.3, #137), never a hard delete; every write
  is logged. Stdlib only, by decision (#132): no MCP SDK.
- **Scheduled jobs** (4.7, #136) run inside the app's one process
  (`app/jobs.py`): `register_job`, started from the lifespan when
  `JOBS_ENABLED`. A Postgres advisory lock keeps a job to one run at a
  time across processes, and a run within `every` of the last skips, so
  replicas don't double up. Every run is a row in `job_runs`;
  `GET /api/jobs` and `POST /api/jobs/{name}/run` show and start them.
- **Reminders** (4.17, #167, off by default) are Web Push. The package's
  `pwa()` Vite plugin makes the app installable and writes `/push-sw.js`;
  `usePushPermission` and `AllowReminders` subscribe a device on a click.
  The reference backend sends (`app/push.py`: VAPID and RFC 8291 on
  `cryptography`, the optional `push` extra, the backend's one crypto
  dependency, by decision on #167), only to the browsers' push services,
  and the `send-reminders` job sends each due row of `reminders`.
- **Auth** is session cookies, same-origin. `AuthProvider` owns the session
  query, ends the session on any 401, clears user-scoped cache on every
  session change, and tells "logged out" apart from "backend down". Apps
  read it only through `useAuth()`, the only auth export.
- **Error reporting** (4.1) is one seam on each side, off until an app
  turns it on: the backend's `report_error` (every 500, and app code),
  which logs and, with a DSN, sends a Sentry envelope; and the package's
  reporter (`src/error-reporting/`), which posts crashes and `server`
  failures to the app's own `POST /client-errors` for the backend to
  forward. A report holds patterns and ids, never request data.
- **A small entity** (3.26) edits in its table's rows: `DataTable` runs
  the same edit-in-place store as a view, so a cell that renders an
  `EditableValue` edits where it's shown, and `InlineCreate` creates from
  a name in the toolbar. `width="content"` sizes a table of a few short
  columns to them on a wide screen.
- **Tables** keep page, sort and filters in the URL (`useTableUrlState`,
  including `setFilters`/`applyView` for saved views). A saved view can
  name its columns (`DataTable`'s `visibleColumns`); they apply while the
  filters are still that view's (`activeView`), so they add nothing to
  the URL.
- **The browser tab's title** (4.21, #186) is "<page> · <app>": `AppShell`
  gives the app and the page its nav names (matched, like the current
  entry, on each `to`'s path, so a `to` can open a saved view, #188), and
  a screen's own (`useDocumentTitle`, `EntityView`'s record) wins while
  it's mounted, whichever arrives first. The rules are one React-free
  store (`createDocumentTitles`, `use-document-title.ts`), unit tested on
  their own.
- **Grouped rows** (4.8, #135): `DataTable`'s `groupBy` heads runs of
  rows in the server's order (`byDay` for feeds and logs), one `<tbody>`
  per group with a row header, and `PillFilter` is a quick filter as
  pills, its value in the URL like the others.
- **Timed screens** (4.16, #163–#166): `SessionView` is a modal over the
  whole viewport (Base UI's dialog popup with its own classes, not
  `DialogContent` overridden), with optional real fullscreen of the whole
  page and a wake lock. `useSessionClock` reads `performance.now()` each
  frame, never sums ticks. The audio cues are Web Audio and speech
  synthesis, with no files. Each one's rules are a React-free factory
  (`createWakeLock`, `createSessionClock`, `createAudioCues`,
  `createMutedStore`), unit tested in node against fake browser APIs, and
  the hooks and functions apps import are thin bindings to the real ones.
  The browser side is `e2e/session-view.spec.ts` on the Timer story.
- **Saving without the form** (a row's switch, a quick action on the view)
  goes through `useRecordUpdate`: a PATCH that is optimistic in the
  record's detail query and every list page holding it, replaced by the
  record the server returns, and rolled back with a toast on a refusal.
  Saves of one record run in order (a TanStack mutation scope per record)
  and each request is built from the server's latest record when it's
  sent, so quick changes never lose each other.
- **Editing in place** (3.13) is that same save, not optimistic and with
  no toast: a field marked `edit` on `EntityView` turns into the form's
  own control where it's shown and saves when you leave it. The rules
  (one field at a time, a failed save keeps the draft, the leave-page
  prompt) live in one React-free store, `edit-in-place-store.ts`, unit
  tested on their own. A sub-item list edits in place too (3.25,
  `editable-list.tsx`): each item and the row being added are fields in
  that store, and its saves are changes applied to the record's latest
  list, so they build on a tick still saving. The leave prompt is React Router's `useBlocker`,
  so apps need a data router (`createBrowserRouter`), as the template
  has. Long text can **autosave** (4.4, `autosave`): the same store saves
  it a pause after typing stops, editable all the while, one save in
  flight with the next queued behind it on the latest draft, and leaving
  the page saves it before going on. `alwaysEditable` makes the editor
  the value at rest, and `inline` (4.20, #183) draws it as the read view
  (no box; `RichTextEditor`'s `inline` and `toolbar="floating"`). ProseMirror marks every Esc handled, so the editor
  says which ones none of its menus used (`escape-passthrough.ts`).

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

## backend-foundation (4.25)

Until 4.25 every app copied `template/backend/` whole, so a security fix in
sign-in reached an app only when someone remembered to copy it. Once two
apps needed the same backend fixes, the layer apps never change on purpose
became a pip package: **`ui-foundation-backend`**, import
`foundation_backend`, in `packages/backend-foundation/`, released with the
npm package under the same version
([its README](../packages/backend-foundation/README.md)).

**What's in it:** the settings it reads (`config`), the engine and session
dependency (`db`), the account tables (`users`, `sessions`,
`login_failures`, `recovery_codes`, `pending_logins`, `oauth_clients`,
`oauth_codes`, `oauth_grants`), the sign-in and error-envelope schemas
with `CamelModel` and `Page`, password and token hashing, TOTP, sign-in
limits, the rate window, error reporting and the error handlers, the
production start-up checks, the SPA mount, the routers for `/auth/*`,
`/environment`, `/client-errors` and the OAuth sign-in, the
`set_password`/`enable_totp`/`disable_totp` scripts (`python -m
foundation_backend.scripts.<name>`), the `signed_in` test helper, and
reference copies of the migrations that create its tables.

**What stays copy-in:** everything that is the app's (its entities,
models, routers, migration chain, `main.py`), plus, for now, the MCP
tools, scheduled jobs, Web Push and reminders ([`DEFERRED.md`](DEFERRED.md)
says when those move). The app's `app/config.py`, `db.py`, `models.py`,
`schemas.py`, `openapi_responses.py`, `security.py`, `errors.py` and
`spa.py` re-export the package's names, so `from app.models import User`
works as before; `config.py` adds the app's own settings after a star
import.

**One design change, `register_router`:** `routers.auth` has two routers.
`router` (login, the TOTP step, logout, me) is every app's;
`register_router` (`POST /auth/register`) is included only by an app that
lets people make their own account. An app without it leaves
`/auth/register` out of its contract (`x-optional`) and passes
`LoginRoute registerPath={null}`, as before; now it no longer has to
delete a route from a copied file to get there.

**How an app upgrades it:** bump `ui-foundation-backend==X.Y.Z` in
`backend/pyproject.toml` with the npm package, run any migrations the
changelog names for that release (the tables live in the app's own
migration chain), then `npm run verify:backend`. `create-app.sh` writes
the pin for a new app ([`consuming.md`](consuming.md) "Adopting the
backend package").

**Migrations stay the app's.** The package's `migrations/` are reference
copies (`0002_auth`, `0010_login_limits_totp`, and `0011_mcp`'s OAuth
tables as `0011_oauth`), never run from the package. `create-app.sh`
copies one into a new app only where the template has no revision of
that number, so while the template carries its own (today), it copies
nothing.

## Verification

| Gate | Runs | Covers |
|---|---|---|
| `npm run verify:fast` (root) | every change | the package: codegen drift, `tsc -b`, ESLint, allowlist, build, vitest. Then the template: codegen drift, `sync --check`, `check-contract`, `check-deps`, `tsc -b`, ESLint, vitest |
| `npm run verify` (root) | before any PR; CI (`verify`) | + the package's Storybook checks on every primitive (axe in both themes; every colour it paints resolves to a token; every icon in the design-language stories clears 3:1 against what's behind it, which axe doesn't measure), the rich-text editor's Markdown round trip on the real editor, and the template's Playwright suite (every screen's states, auth, `a11y.spec.ts` in light and dark, a phone-width project) |
| `npm run verify:backend` | backend changes; CI (`verify-backend`) | `packages/backend-foundation`'s mypy strict and pytest (SQLite, against the package alone), then the template backend's mypy strict, pytest (SQLite; the MCP/OAuth flow in `tests/test_mcp.py`), spec conformance. In CI the job then migrates a `postgres:18` service to head and runs `check_db_comments.py` (every table and column has a `COMMENT ON`) |
| `template/scripts/check-backend-postgres.sh` | backend changes (needs Docker) | all of the above + `check_db_comments.py` + a live server on real Postgres (its own throwaway compose project per checkout, on a free port, deleted after the run, so worktrees and dev databases don't collide) |
| `template/scripts/check-cloud-postgres.sh` | DB connection changes | TLS against a hosted Postgres (`CLOUD_DATABASE_URL`) |
| `scripts/consume-test.sh --install-only` | **automatic**: the `package` workflow, on every PR (a required check on `main`) | `npm pack`, then `create-app.sh` builds an app outside the repo from the tarball (installed, not linked), and that app's full `verify` and a mock-free `build:real` must pass |
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
- **A package e2e spec runs only once it's listed.** The package's
  `playwright.storybook.config.ts` names its specs in `testMatch`, so a new
  `e2e/<name>.spec.ts` is silently skipped (and `playwright test <path>`
  says "No tests found") until it's added there. Check that the run's test
  count went up. (2026-10-19: one PR's spec never ran under verify.)
- **Short of memory, run the gates one by one with fewer workers.** On a
  16 GB Windows machine with other apps open, `npm run verify`'s parallel
  Playwright runs crashed their workers (exit 3221225794), and Claude
  Code's background-shell reaper stopped the run. The same gates in
  sequence pass: the package's `verify:fast`, then `npx playwright test -c
  playwright.storybook.config.ts --workers=1` in `packages/ui-foundation/`,
  then the template's `verify:fast` and `npx playwright test --workers=1`.
  A thousand failures at once with "worker process exited unexpectedly"
  is this, not the code.

**Claude Code cloud sessions** run `.claude/hooks/session-start.sh` on
start (registered in `.claude/settings.json`; it does nothing anywhere
else). It runs `npm install`, makes `template/backend/.venv` (both backend
projects editable, in one call), and handles
a cloud image whose Playwright browsers are an older revision than the
pinned `@playwright/test`: it maps the pinned revision onto the installed
binaries in `~/.cache/ui-foundation-pw` and sets `PLAYWRIGHT_BROWSERS_PATH`
for the session, since `playwright install` isn't available there. With
the pinned revision installed, it maps nothing. Docker isn't available in
those sessions, so `check-backend-postgres.sh` can't run there
([`DEFERRED.md`](DEFERRED.md)).

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
| Milkdown for rich-text Markdown (3.13) | Its Markdown goes in and out through remark, the parser `<Markdown>` already renders with. See "The rich-text editor" below |

## The rich-text editor (3.13)

Long text written as Markdown edits as formatted text (Notion-style), on
the form and in place, through the package's `RichTextEditor`. It needed
a new dependency, so this is its case, the one the developer asked for
before it went on the allowlist (`packages/ui-foundation/deps-allowlist.json`:
`@milkdown/kit`, plus `unified` and `remark-parse`, already in the tree
through `react-markdown` and now imported directly).

**The bar:** notes are stored as Markdown, and saving must never rewrite
what the person didn't change. If no editor met that, the plan was to
stop and say so rather than ship a lossy one.

| Criterion | Milkdown 7.22 (`@milkdown/kit`) |
|---|---|
| Maintained | Releases through 2026 (7.22.2 on 2026-09-23); ProseMirror underneath, itself long-lived |
| React 19 | Framework-agnostic core, mounted by our own component; no React peer |
| Markdown round trip | remark in and out: the same parser and GFM extension `<Markdown>` renders with, so what's edited is what's shown. Faithful to meaning on every fixture (headings, nested lists, tables, links, task lists, raw HTML), but it writes its own style: `*` bullets, padded tables, `***` rules, `\` hard breaks, inline links for reference links. Hence the merge below |
| Accessible | A `role="textbox"` contenteditable with `aria-multiline`, named by `aria-label`/`aria-labelledby`; axe-clean in both themes (its Storybook story); keyboard throughout |
| Bundle | ~106 KB gzipped in the app's build, about 47 KB of it remark/micromark that `react-markdown` already ships. Loaded on first use (`React.lazy`): the view's own chunk doesn't grow |

**What closes the gap: block-by-block saving** (`src/lib/markdown-merge.ts`).
An untouched document saves back byte for byte (nothing changed → no
request at all). An edited one keeps every top-level block the person
didn't change exactly as it was written; only a changed or new block is
written by the editor, in the document's own bullet and rule marks.
Blocks are matched by what a reader sees, not how the tree is nested:
inline text as runs with their set of marks (so `[**a**](u)` is
`**[a](u)**`), a table's rows padded to its widest (3.16.2: the editor
pads short rows, and both had made every edit refuse). A block the editor
shows some other way the matching misses is written as the editor shows
it, but only if nothing in it is lost (no text, address or image). If
something would be, it's kept as written and the guard refuses (until 4.28 the editor
dropped images on load, and this was what kept them). A
guard re-parses the result and refuses to save if it would mean anything
other than what's on screen (the draft stays, with a message). Tested in
node over the editor's real output (`tests/markdown-merge.test.ts`) and
in a browser on the real editor (`e2e/rich-text-editor.spec.ts`).

**What's left of the gap:** inside a block the person edited, the
editor's style applies: a table edited gets padded cells, a reference
link in an edited paragraph becomes inline (its definition is kept).
Meaning is never lost; formatting inside the edited block may be.

**No HTML gets in:** raw HTML already in the text shows as its characters
(an uneditable chip), HTML pasted as such a chip becomes escaped text,
and Milkdown's empty-line plugin, which writes `<br />`, is left out.
Markdown pasted as plain text (3.15) is parsed by our own paste handler,
not Milkdown's clipboard plugin: that plugin inserts the parsed document
directly, past the guard, so raw HTML in pasted text would have been
saved as HTML. Ours runs the same guard. Plain text with no Markdown in
it goes in exactly as typed.

**The toolbar (3.16)** (`rich-text-toolbar.tsx`) is ARIA's toolbar
pattern: one tab stop, the arrow keys along the row, each button
`aria-pressed` for whether its format is on where the caret is, with its
shortcut in `aria-keyshortcuts` and its tooltip. A press runs a plain
ProseMirror command (`rich-text-formats.ts`), one undo step like its
shortcut, and a mouse press never takes focus from the text. It sits
inside the field's wrapper, so editing in place counts moving to it as
staying.

**The floating toolbar (3.17)** (`rich-text-floating-toolbar.tsx`) is the
same buttons for selected words only (Bold, Italic, Strikethrough, Code ·
Link), over the selection once the mouse is up. Alt+F10 reaches it (the
fixed one when it isn't showing); Esc or Tab goes back to the text, the
selection kept, and Esc hides it until the selection changes, before the
field's own Esc. It's placed against the field's element, not portaled:
above the words, below them when there's no room inside the text, so it
never covers the fixed toolbar. `toolbar="floating"` (4.20) keeps it
and the slash menu without the fixed one, for an `inline` field. Base
UI's Popover was tried first, and
its focus guards (tabbable `aria-hidden` spans while focus is outside
the popup, which for this toolbar is always) fail axe.

**The slash menu (3.18)** (`rich-text-slash.ts`, `rich-text-slash-menu.tsx`)
lists the blocks a line can become (Heading to Code block) after a "/"
typed at the start of a top-level paragraph; what follows the "/"
filters it (names and keywords: `/h2`, `/todo`). Only a typed "/" opens
it (a plugin records where; one already in the text never does), and it
closes for good once the span stops qualifying (the caret leaves it, a
space first, no match keeps it hidden). It's ARIA's combobox pattern
with the text as the input: focus never leaves the text, which names the
list (`aria-controls`) and the highlighted item (`aria-activedescendant`)
while it's open. Its keys are view props, ahead of Milkdown's keymap,
whose Enter would split the line. A pick is one transaction (one undo
brings the "/…" back). Placed against the field like the floating
toolbar, for the same reason.

**Links (3.15)** are added with Ctrl/Cmd+K, in a small box at the caret
(a `Popover` with no trigger, placed through the `anchor` the package's
`PopoverContent` takes). Only web and email addresses, a path on the site
or a heading are accepted (`src/lib/link-href.ts`): another scheme
(`javascript:`, `data:`, `file:`) is refused, so a saved link can't run
code.

**Images (4.28)** show in the editor as `<Markdown>` shows them, at most
the field's width. Until 4.28 the editor dropped every one as it loaded:
Milkdown's image node wants a string title and remark gives `null` for
none, so a small remark plugin makes it `''` (written back as none).
With the app's `upload` (`RichTextEditor`'s prop; the package knows no
endpoint), an image pasted, dropped or picked with the toolbar's Image
button is uploaded and inserted as `![](url)`
(`rich-text-image-upload.ts`). While it uploads, a placeholder is a
decoration, never part of the document, so no save (an autosave
included) ever holds one; it moves with the text, and the image goes in
where it is when the upload resolves, several in the order the files
came. A refusal (type, size: `src/lib/image-file.ts`, shared with
`ImageField`) or a failure removes it and is a toast. Milkdown's own
`plugin/upload` was the obvious choice and wasn't used: it keeps the
placeholder forever when an upload fails, and takes no part in our
paste handling. A paste uploads only when it holds files and no HTML
with words in it: an office app copies a picture of the selection with
its text, and that paste is the text. Without `upload`, none of this
runs. `ImageField` (a photo on a record) is the form's side of the same
`upload`: the value is the stored file's id.

**Written text's look (3.21)** (`prose-look.ts`), shared by the editor
and `<Markdown>`: three heading roles (`type-heading-1` to `-3`, 26, 20
and 17px over the 14px body, each with a left bar that thins by level:
5px and 3px in `--heading-bar`, 2px in `--rule`), links in `--link` as well
as underlined, a `---` divider as a 2px line in `--rule`. Headings still
render from `<h3>`; only how they look changed.

**Callouts (3.21)** (`src/lib/markdown-callout.ts`) are GitHub's alert
syntax, a quote whose first line is `[!NOTE]` (or tip, important,
warning, caution), so a note stays plain Markdown that GitHub and
Obsidian also render as a callout. remark parses one as a quote; a remark
plugin reads the marker, into a `callout` node for the editor (its own
schema, written back by a stringify handler) and into a
`<div data-callout>` for `<Markdown>`. The merge needs neither: to it a
callout is the quote it's written as. The marker is kept as written
(`[!note]` stays lower case) unless the kind changes, so an untouched
callout reads as untouched. In the editor a callout's icon is a menu of
kinds (a React widget portaled into the node view's slot,
`rich-text-node-views.ts`, `rich-text-widgets.tsx`); from the keyboard,
"/" at a line's start inside a callout lists the kinds.

**Tables (3.21)** (`rich-text-table.ts`, `rich-text-table-menu.tsx`): the
node view puts a table in a box that scrolls sideways, with Notion's
"add a row" and "add a column" bars (mouse shortcuts, out of the tab
order). Tab in the last cell adds a row; Enter goes down a column and out
of the table from its last row (Milkdown's Enter left the table from any
row); Ctrl/Cmd+Enter is the field's save, not Milkdown's "leave the
table". The toolbar's Table menu (Base UI's menu, shadcn's
`dropdown-menu`) inserts a table, rows and columns, aligns a column and
deletes. What GFM can't store isn't offered: the header row can't be
deleted or have a row put above it, a table keeps one row and one column,
there are no column widths and no line breaks inside a cell.

**Shortcuts (3.21)** (`rich-text-shortcuts.ts`) are Notion's where it has
one: Ctrl+Shift+0 to 6 and 8 turn the line into text, a heading, a list
or a code block, and Ctrl/Cmd+Shift+S strikes through. On a Mac they're
Cmd+Option and the digit, as in Notion: Cmd+Shift+3 to 5 are the system's
screenshots. Read by `event.code`, since Shift+5 types "%". Cmd+Option
counts on Apple only: Ctrl+Alt on Windows is AltGr, which types
characters. Milkdown's own (Ctrl+Alt+1, Mod+Alt+X, …) still work.

**Considered:** Tiptap 3 with `@tiptap/markdown` (maintained, React 19;
parses with marked, so what's edited could differ from what `<Markdown>`
renders), Lexical with `@lexical/markdown` (its own transformers, not
remark; tables need a transformer of your own), MDXEditor (Lexical plus
mdast, with a full editing UI of its own), BlockNote (its Markdown export
is named `blocksToMarkdownLossy`). Only Milkdown was built and measured;
the others were ruled out on how they parse or serialize Markdown, not
by measurement.

## Releasing

Releases are cut and published automatically; no step needs a person.
`.github/workflows/release.yml` runs on every push to `main` that changes
`packages/ui-foundation/`, `packages/backend-foundation/`, `template/` or
`scripts/create-app.sh`. It:

1. picks the version: the next patch after the latest `v*` tag, or the
   version in `packages/ui-foundation/package.json` if that is higher. A
   minor or major release is made by bumping it there in the PR (and
   `packages/backend-foundation/pyproject.toml` to match), and nothing is
   committed back.
2. builds and packs the npm package (`build` job), and builds the pip
   package's sdist and wheel with that version written in (`build-py`),
3. **publishes** `@tristan2828/ui-foundation@<version>` to npm through
   trusted publishing, with provenance (`publish` job; OIDC, no stored
   token), and `ui-foundation-backend==<version>` to PyPI the same way
   (`publish-py`, `pypa/gh-action-pypi-publish` pinned to a SHA),
4. tags the commit `v<version>` and creates a GitHub release, once both
   are published. The template at that tag and the packages at that
   version always belong together.
5. runs `release-smoke`: an app created from the live release, with its
   full `verify` and its backend's (`ui-foundation-backend` from PyPI),
   the one check of exactly what apps get. It writes the
   result at the top of the release notes. A failure also fails the run,
   and GitHub emails the developer. Re-run it by hand with
   `gh workflow run release-smoke.yml -f tag=v<version>`.

**What guards a release** (decided 2026-09-30; until then every version
waited for the developer's passkey approval on npm): the PR gate. Branch
protection on `main` requires a pull request and the `verify`,
`verify-backend` and `install-test` checks, with no reviewer, so every
published version has passed the install test. Beyond that, the workflow
limits what could publish a bad version:

- Only the `publish` and `publish-py` jobs can publish, and neither runs
  code from the repo or its dependency trees: no checkout, no `npm ci` or
  `pip install`, only `npm publish` of the tarball `build` packed, and the
  PyPA publish action on the files `build-py` built. The build jobs
  install the dependency trees without that permission.
- Third-party actions in every workflow are pinned to commit SHAs, and
  every workflow starts from read-only (or no) permissions.
- A version already on npm is only accepted as a re-run if its provenance
  names this commit. Otherwise `publish` fails rather than letting `tag`
  pair this commit's template with another commit's package (which happens
  when `tag` failed after a publish). Tag that commit by hand, then re-run
  all jobs. `publish-py` applies the same rule on PyPI, reading the commit
  from each file's PEP 740 provenance (its Sigstore certificate).
- No npm or PyPI token exists. The trusted publishers (GitHub Actions,
  `Tristan2828/ui-foundation`, workflow `release.yml`) are the only things
  that can publish besides the developer's own accounts.

What that gives up: a malicious change that passes the checks and gets
merged reaches every app installing `^4.x`, with no human look at the
built package. The passkey step cost one manual approval per release;
the developer chose automation over it.

**A bad release** keeps its version: npm and PyPI versions can't be
reused. Ship the fix as the next patch, and meanwhile
`npm deprecate @tristan2828/ui-foundation@<version> "<why>; use <next>"`
so installs warn (on PyPI, yank the version on pypi.org, which pins
`==<version>` still install). `release-smoke` marks its notes if it failed.

**A breaking change** to anything the package exports, or to what `sync`
writes, gets a major version, a `CHANGELOG.md` entry and upgrade steps in
[`consuming.md`](consuming.md).

**PyPI setup** (done 2026-10-21, before 4.25.0): the project
`ui-foundation-backend` was created on pypi.org as a pending trusted
publisher (repository `Tristan2828/ui-foundation`, workflow `release.yml`,
environment any). The first `publish-py` run turns it into the project's
trusted publisher. The token names the workflow file it ran in, so
`publish-py` must stay a job of `release.yml` itself, never moved into a
reusable workflow it calls.

**npm setup** (done 2026-09-28): the account `tristan2828` has passkey 2FA.
3.0.0 was published by hand, because trusted publishing can only be
configured on a package that already exists. The trusted publisher is
GitHub Actions, `Tristan2828/ui-foundation`, workflow `release.yml`. It
allowed staging only until 2026-09-30, when "allow npm publish" was turned
on. 3.1.0 was the last staged release.

Deploying an app: `template/docs/deploy.md`.
