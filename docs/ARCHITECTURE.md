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

When apps install files once and own them (a shadcn registry, as this was
before 3.0), no later fix reaches an app unless someone copies it in by
hand, and "owning every file" means maintaining every file twice.

Editability, shadcn components in the repo and not in a `node_modules`
black box, still holds for an app's *own* components. It doesn't hold for
the shared layer, because nobody edits that per app on purpose. They fork
it by accident. So the shared layer is a package, and each app keeps
only what is genuinely its own: `openapi.yaml`, routes, nav, mocks,
entities and backend.

What it costs, and how the cost is kept small:

- **An app can't edit a package component.** It configures one through
  props and slots, builds its own component in `src/` on top of the
  package's exports, or raises the change here (the app rules' "Changing
  the Foundation", `packages/ui-foundation/conventions/AGENTS.md`).
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
  src/                      components/{ui,app}, lib/, auth/, api/, gateway.ts, hooks/, error-reporting/, mocks/, testing/, fixtures/, routes/ (login, register)
  styles/                   theme.css (tokens) + index.css (what apps import)
  eslint/                   the shared flat config
  vite/                     buildInfo(): dist/build-info.json and the build's commit/PR
  bin/ui-foundation.mjs     sync | check-contract | check-deps
  conventions/              AGENTS.md block, docs/ and agent files that `sync` writes into apps
  openapi/foundation.yaml   the part of every app's contract the package calls
  e2e/, src/fixtures/       the fixtures harness (e2e/harness/) and the accessibility + token-colour checks on every primitive
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
**install both editable in one pip call**, into the one venv,
`template/backend/.venv`
([the backend package's README](../packages/backend-foundation/README.md)
"In this repo" has the command and why).

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
- **The contract is split.** `/auth/*`, `/environment`, `/client-errors`,
  `/push/*` and the error envelopes are the foundation's
  (`openapi/foundation.yaml`), because the package's own code calls them.
  An app's spec must contain them unchanged; wording may differ, shapes may
  not (`ui-foundation check-contract`). A path marked `x-optional` (all but
  `/auth/login`, `/auth/logout` and `/auth/me`) may be left out, with
  whatever only it uses. Everything else in the spec is the app's.
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
  sign-in in the backend package (`foundation_backend.routers.mcp`, `oauth`). Tools come from
  one registry of entities (`app/mcp_entities.py`) and call the entities' own router
  functions, so the API's validation and per-user scoping apply. Delete is soft only
  (`deleted_at`, with restore; 4.3, #137), never a hard delete; every write
  is logged. Stdlib only, by decision (#132): no MCP SDK.
- **Scheduled jobs** (4.7, #136) run inside the app's one process
  (`foundation_backend.jobs`): `register_job`, started from the lifespan when
  `JOBS_ENABLED`. A Postgres advisory lock keeps a job to one run at a
  time across processes, and a run within `every` of the last skips, so
  replicas don't double up.
- **Reminders** (4.17, #167, off by default) are Web Push. The package's
  `pwa()` Vite plugin makes the app installable and writes `/push-sw.js`;
  `usePushPermission` and `AllowReminders` subscribe a device on a click.
  The backend package sends (`foundation_backend.push`: VAPID and RFC 8291 on
  `cryptography`, the optional `push` extra, the backend's one crypto
  dependency, by decision on #167), only to the browsers' push services,
  and the `send-reminders` job sends each due row of `reminders`.
- **Repeating schedules** (4.95, #326) are one rule on both sides: the
  contract's `Recurrence` (an RFC 5545 RRULE without DTSTART, a start
  day, times of day, an IANA zone, from completion or not), an
  `x-optional` component an app's schemas reference. The package's
  `lib/recurrence.ts` (npm `rrule`) and `foundation_backend.recurrence`
  (python-dateutil) walk only the days, as midnights with no zone, then
  put each day's times on them in the zone, so neither library's time
  zone handling is used and a DST change can't move a time. Both read
  one fixture (`packages/ui-foundation/tests/fixtures/recurrence-cases.json`);
  a second (`recurrence-shapes.json`) pins rule shapes' days for both
  suites.
- **Auth** is session cookies, same-origin. `AuthProvider` owns the session
  query, ends the session on any 401, clears user-scoped cache on every
  session change, and tells "logged out" apart from "backend down". Apps
  read it only through `useAuth()`, the only way to read auth state.
- **Error reporting** (4.1) is one seam on each side, off until an app
  turns it on: the backend's `report_error` (every 500, and app code),
  which logs and, with a DSN, sends a Sentry envelope; and the package's
  reporter (`src/error-reporting/`), which posts crashes and `server`
  failures to the app's own `POST /client-errors` for the backend to
  forward. A report holds patterns and ids, never request data.
- **Tables** keep page, sort and filters in the URL (`useTableUrlState`,
  including `setFilters`/`applyView` for saved views). A saved view can
  name its columns (`DataTable`'s `visibleColumns`); they apply while the
  filters are still that view's (`activeView`), so they add nothing to
  the URL.
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
  tested on their own. The leave prompt is React Router's `useBlocker`,
  so apps need a data router (`createBrowserRouter`), as the template
  has.
- **Each composite's own design** (dialogs, a record's tabs and facts
  rail, views and filters, grouped rows, timed screens, a proxy's sign-in,
  autosave and the in-place presets) is in the header comment of its file
  under `packages/ui-foundation/src/`; how an app uses each is in
  `packages/ui-foundation/conventions/docs/`.

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
  design language, cell patterns, column options, the entity-plan template,
  timed screens, reminders),
- `.claude/skills/new-entity/`, `.codex/skills/new-entity/`,
  `.claude/agents/spec-tester.md` and its hook,
- `CLAUDE.md` (`@AGENTS.md`), once, if missing.

`sync --check` runs in every app's `verify:fast`, so an upgrade that skipped
`sync`, or a local edit to a synced file, fails the gate. In this repo,
`template/` is an app like any other. After changing anything in
`conventions/`, run `npm run sync` and commit what it writes.

Every convention doc over 300 lines opens with an index (4.34, #232):
each section and each of the playbook's numbered steps, with the lines
it spans, so an agent reads the index and then only those lines. It is
written from the headings by `npm run docs:index` in the package
(`scripts/doc-index.mjs`), never by hand, and the package's `verify:fast`
fails when one is stale. After editing a doc there: `docs:index`, then
`sync`.

## backend-foundation (4.25)

The layer of the backend that apps never change on purpose is a pip
package, so a security fix in sign-in reaches an app with a version bump
and not a copy: **`ui-foundation-backend`**, import `foundation_backend`,
in `packages/backend-foundation/`, released with the npm package under the
same version.

Its modules, what stays the app's own, how an app uses and upgrades it,
and why `register_router` is a separate router are in
[its README](../packages/backend-foundation/README.md). Moving an older
app onto it is [`consuming.md`](consuming.md) "Adopting the backend
package". `create-app.sh` writes the pin for a new app.

**Migrations stay the app's.** The package's `migrations/` are reference
copies, never run from the package
([its README](../packages/backend-foundation/src/foundation_backend/migrations/README.md)).

## Verification

| Gate | Runs | Covers |
|---|---|---|
| `npm run verify:fast` (root) | every change | the package: codegen drift, the docs' index, `tsc -b`, ESLint, allowlist, build, vitest. Then the template: codegen drift, `sync --check`, `check-contract`, `check-deps`, `tsc -b`, ESLint, vitest |
| `npm run verify` (root) | before any PR; CI (`verify`, in parts: below) and on every push to `main` before a release | + the package's fixtures checks on every primitive (axe in both themes; every colour it paints resolves to a token; every icon in the design-language fixtures clears 3:1 against what's behind it, which axe doesn't measure), the rich-text editor's Markdown round trip on the real editor, and the template's Playwright suite (every screen's states, auth, `a11y.spec.ts` in light and dark, a phone-width project) |
| `npm run verify:backend` | backend changes; CI (`verify-backend`), on PRs and on `main` | `packages/backend-foundation`'s mypy strict and pytest (SQLite, against the package alone), then the template backend's mypy strict, pytest (SQLite; the MCP/OAuth flow in `tests/test_mcp.py`), spec conformance. In CI the job then migrates a `postgres:18` service to head and runs `check_db_comments.py` (every table and column has a `COMMENT ON`) |
| `template/scripts/check-backend-postgres.sh` | backend changes (needs Docker) | all of the above + `check_db_comments.py` + a live server on real Postgres (its own throwaway compose project per checkout, on a free port, deleted after the run, so worktrees and dev databases don't collide) |
| `template/scripts/check-cloud-postgres.sh` | DB connection changes | TLS against a hosted Postgres (`CLOUD_DATABASE_URL`) |
| `scripts/consume-test.sh --install-only` | **automatic**: the `package` workflow, on every PR (a required check on `main`) | `npm pack`, then `create-app.sh` builds an app outside the repo from the tarball (installed, not linked), and that app's full `verify` and a mock-free `build:real` must pass |
| `scripts/consume-test.sh <Entity>`, the **Fresh UI Build** | on demand, when the playbook or a composite changes in a way that could confuse a fresh agent | a brand-new agent with no memory of this repo builds an entity in such an app from its plan; its `verify` passes |

**How CI runs them** (`.github/workflows/verify.yml` and `package.yml`;
the reasons for each choice are in their comments):

- **Required on `main`:** `verify`, `verify-backend` and `install-test`
  ("Releasing", "What guards a release").
- **`verify` runs `npm run verify` in parts at once.** `checks` runs the
  package's `verify:fast`, then the template's whole `verify`.
  `harness 1` to `harness 4` each run a quarter of the fixtures harness's
  `chromium` project (`--shard`), building the harness themselves.
  `harness-perf` runs its `phone` project, then the typing budget (`perf`)
  alone on that runner: it is CPU-throttled, and other specs on the same
  CPU would be measured with it. The
  `verify` job, the required check, passes only when every
  part's result is `success`: a part that failed, was skipped or was
  cancelled turns it red.
- **The parts must add up to `npm run verify`.**
  `.github/scripts/check-ci-split.mjs` (in `harness-perf`) fails if the
  root's or the package's `verify` script isn't the one the parts were cut
  from, or if a harness project is in none of its three runs, or in two
  (`HARNESS_SHARDED`, `HARNESS_PHONE`, `HARNESS_PERF`). A step added to
  either `verify` script, or a new harness project, needs the matching
  change in `verify.yml`.
- **Docs-only changes skip.** Every required job starts, and each part's
  step after checkout, `.github/scripts/docs-only.sh`, reads the change's files: a PR's
  from the pulls API (a renamed file counts on both names), a push's from
  `git diff` against the push's `before`. When every path is under
  `docs/`, under the root's `.claude/`, or a root `*.md`, the job's later
  steps are skipped and it passes. Anything else runs everything: another
  path, an empty list, a list that may be short (the API lists at most
  3,000 files), an event it doesn't know, a release. A list it can't read
  fails the job. Markdown anywhere else is shipped, synced or a script's
  input (`scripts/fixtures/entity-plans/`), so it runs everything.
  `.github/scripts/docs-only.test.sh` holds its cases.
- **A newer push to a PR cancels its older runs** of `verify` and
  `package`. Never on `main`.
- **Playwright's system packages come from the Actions cache**
  (`.github/actions/with-apt-cache`, in every `verify` part and around
  `install-test`'s `consume-test.sh`). A stale cache is safe:
  apt checks each file against its index and fetches what's missing.

Rules learned the hard way:

- **A new check counts only after a negative control** (`AGENTS.md` "Scope
  and stopping").
- **A Fresh UI Build PASS counts only after reading its transcript**:
  confirm the agent used the version under test and reported no
  workarounds.
- **SQLite passing proves nothing about Postgres**, timestamp columns in
  particular. `check-backend-postgres.sh` writes through the ORM for this.
- **Mock mode survives a worker restart, and a page's `goto()`/`reload()`
  settle its `/api/` first** ([`consuming.md`](consuming.md) "End-to-end
  tests on the mocks"). `template/e2e/msw-boot.spec.ts` restarts the
  worker over CDP, and `template/e2e/msw-leave-after-save.spec.ts` holds
  the next document to force a request sent while unloading.
- **Gate MSW on the literal `import.meta.env.VITE_API` check** in
  `main.tsx`. The bundler folds only that exact form, so behind an imported
  constant `build:real` still ships MSW (`consume-test.sh` asserts it).
- **Test a commit, not a branch.** Scripts and workflows take a SHA or a
  tag, so every result belongs to one immutable tree.
- **A package e2e spec runs only once it's listed.** The package's
  `playwright.harness.config.ts` names its specs in `testMatch`, so a new
  `e2e/<name>.spec.ts` is silently skipped (and `playwright test <path>`
  says "No tests found") until it's added there. Check that the run's test
  count went up.
- **Short of memory, run with fewer workers.** `PW_WORKERS=1 npm run
  verify` (or `PW_WORKERS=50%`) sets both Playwright configs' worker
  count. A thousand failures at once with "worker process exited
  unexpectedly" is this, not the code.
- **The package's specs build axe from `e2e/axe.ts`**, never from
  `@axe-core/playwright` directly (4.121). Its `analyze()` first waits out
  the page's transitions, as `expectNoAxeViolations` does, so a menu or
  hover tint isn't measured mid-fade.

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
the form and in place, through the package's `RichTextEditor`, built on
Milkdown (`@milkdown/kit`, with `unified` and `remark-parse` imported
directly; `packages/ui-foundation/deps-allowlist.json`). It is loaded on
first use (`React.lazy`, through `rich-text-load.ts`), so a view's own
chunk doesn't grow; an app whose first screen is an editor starts that
load as it starts with `preloadRichTextEditor()`, which never throws.
Editing in place is run by `EntityView`, `DataTable`, or, on a page of
the app's own, `EditInPlaceScope` (cell pattern 18).

**The bar:** notes are stored as Markdown, and saving must never rewrite
what the person didn't change. Milkdown is faithful to meaning but writes
its own style (`*` bullets, padded tables, `***` rules, `\` hard breaks,
inline links for reference links). Hence the merge below.

**What closes the gap: block-by-block saving** (`src/lib/markdown-merge.ts`).
An untouched document saves back byte for byte (nothing changed → no
request at all). An edited one keeps every top-level block the person
didn't change exactly as it was written; only a changed or new block is
written by the editor, in the document's own bullet and rule marks.
Blocks are matched by what a reader sees, not how the tree is nested:
inline text as runs with their set of marks (so `[**a**](u)` is
`**[a](u)**`), a table's rows padded to its widest. A block the editor
shows some other way the matching misses is written as the editor shows
it, but only if nothing in it is lost (no text, address or image). If
something would be, it's kept as written and the guard refuses. A
guard re-parses the result and refuses to save if it would mean anything
other than what's on screen (the draft stays, with a message). Tested in
node over the editor's real output (`tests/markdown-merge.test.ts`) and
in a browser on the real editor (`e2e/rich-text-editor.spec.ts`).

**What's left of the gap:** inside a block the person edited, the
editor's style applies ([`DEFERRED.md`](DEFERRED.md)). Meaning is never
lost.

**No HTML gets in:** raw HTML already in the text shows as its characters
(an uneditable chip), HTML pasted as such a chip becomes escaped text,
and Milkdown's empty-line plugin, which writes `<br />`, is left out.
Markdown pasted as plain text (3.15) is parsed by our own paste handler,
not Milkdown's clipboard plugin: that plugin inserts the parsed document
directly, past the guard, so raw HTML in pasted text would have been
saved as HTML. Ours runs the same guard. Plain text with no Markdown in
it goes in exactly as typed.

**Highlight and full screen (4.48)**
(`rich-text-highlight-menu.tsx`, `src/lib/markdown-highlight.ts`).
*Highlight* is a `highlight` mark with a colour, stored as plain Markdown:
`==words==` (amber, the default) and `=={green}words==` (`yellow`,
`green`, `red`). HTML was never an option: `<Markdown>` shows raw HTML as
its characters and the editor refuses to write any. *Full screen* is the
field itself made `fixed inset-0`, not a dialog or the Fullscreen API:
the editor stays mounted so nothing is lost, and popovers and toasts,
which portal to the body, stay above it (the Fullscreen API's top layer
would hide them).

**On a touch screen** the bars give way to one pinned to the keyboard
(`rich-text-keyboard-bar.tsx`). The harness runs the editor specs on a
second Playwright project, `phone` (Pixel 7); a laptop-only test skips
itself there with `isMobile`.

**Links (3.15)**: only web and email addresses, a path on the site or a
heading are accepted (`src/lib/link-href.ts`): another scheme
(`javascript:`, `data:`, `file:`) is refused, so a saved link can't run
code. Paste goes through the same rule (`rich-text-paste.ts`).

**Paste's shapes** (`rich-text-paste.ts`): before ProseMirror reads a
paste's HTML, Word's `mso-list` paragraphs become nested lists, a Notion
(`ul.to-do-list`) or GitHub (a checkbox input) to-do a task item, and
`language-*` on code the block's language. These are written against
payloads made to match what those apps put on the clipboard; real ones
vary by version.

**A refused edit is never saved quietly.** The merge guard's refusal
stops `onChange`, so a form holds the last text that could be saved.
The editor marks itself `aria-invalid` and, given no `onProblem`, says
why inside the field; the template's form binds `onProblem` to the
field's error and refuses submit while it stands (add-an-entity.md).

**Images (4.28)** show in the editor as `<Markdown>` shows them, at most
the field's width.
With the app's `upload` (`RichTextEditor`'s prop; the package knows no
endpoint), an image pasted, dropped or picked with the toolbar's Image
button is uploaded and inserted as `![](url)`
(`rich-text-image-upload.ts`). While it uploads, a placeholder is a
decoration, never part of the document, so no save (an autosave
included) ever holds one. Milkdown's own
`plugin/upload` was the obvious choice and wasn't used: it keeps the
placeholder forever when an upload fails, and takes no part in our
paste handling. `ImageField` (a photo on a record) is the form's side of
the same `upload`: the value is the stored file's id.

**Callouts (3.21)** (`src/lib/markdown-callout.ts`) are GitHub's alert
syntax, a quote whose first line is `[!NOTE]` (or tip, important,
warning, caution), so a note stays plain Markdown that GitHub and
Obsidian also render as a callout. The merge needs nothing: to it a
callout is the quote it's written as.

**Folding by headings (4.54)** (`src/lib/markdown-fold.ts`,
`rich-text-fold.ts`, `notes-outline.tsx`, `src/hooks/fold-store.ts`):
only a toggle heading folds (`src/lib/markdown-toggle.ts`,
`rich-text-toggle-heading.ts`): Notion's `{toggle="true"}` at a heading's
end. Folding is the reader's, never the text's: what's
folded is a set of heading ids (level and words, `2:Beds`, numbered when
repeated) kept in localStorage under the key, so the Markdown and the
merge never see it.

**Tables (3.21; grips and looks 4.62)** (`rich-text-table.ts`,
`rich-text-table-grips.tsx`, `src/lib/markdown-table.ts`, styles/index.css
"Tables in written text").
What GFM can't store isn't offered: the header row can't be deleted,
moved or have a row put above it, and there are no line breaks inside a
cell. What it can store is reused rather than adding
syntax (the developer's choice, 2026-11-04): a cell's colour is its whole
text in one highlight (`=={green}$4.99==`), a header column is a first
column of bold cells, and a sort rewrites the rows (what the editor shows
is what it saves; one undo step).

**Page links (4.73)** (`src/lib/page-link.ts`, `page-link.tsx`,
`rich-text-page-links.ts`, `page-trail.tsx`): child pages in notes, to any
depth, without blocks. The developer ruled out a block editor, drag
handles and any change to how notes are stored (2026-11-07), so a page is
an ordinary Markdown link, `[Title](/notes/12/pages/3)`, and the merge
needs nothing. The app answers `pageLink(href)` (title, removed,
`onRestore`) for each link, or `null`; the package never knows where
pages live or whose they are, so a page's own note takes the same props.

**Everything else** (the toolbars, the slash menu, typing rules, keyboard
shortcuts, the phone's bar, full screen's focus, written text's look) is
in the header comment of its file: `src/components/app/rich-text-*.ts(x)`,
`milkdown-editor.tsx`, `prose-look.ts` and `src/lib/markdown-*.ts`, with
`e2e/rich-text-*.spec.ts` on the real editor.

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
`.github/workflows/release.yml` runs on every push to `main`. It verifies
the pushed tree, and **releases only when the version in
`packages/ui-foundation/package.json` is past the latest `v*` tag** (#231,
since 4.34) and something under `packages/ui-foundation/`,
`packages/backend-foundation/`, `template/` or `scripts/create-app.sh`
changed since that tag. A PR that finishes a feature, or a fix an app needs now,
bumps it (and `packages/backend-foundation/pyproject.toml` and its
README's pin to match): a patch, a minor or a major. Its merge releases
everything merged since the last tag as that one version, under one
`CHANGELOG.md` entry with one "How an app adopts it". A merge with no
bump (a step of a feature that isn't finished, a Dependabot update)
releases nothing and goes out with the next bump; a Dependabot security
fix an app needs now gets a patch bump pushed to its PR. Why: an app reads
every release it hasn't applied. Run by hand (`gh workflow run release.yml`),
it releases `main` as it is, for a forgotten bump: at the bumped version,
or the next patch after the latest tag. It:

1. decides the version as above. Nothing is committed back.
2. **verifies `main`** (its `verify` job calls `verify.yml`): every part
   of `npm run verify` and the backend's gate, on the merged tree. Nothing
   builds or publishes until it passes. Every push runs it, released or
   not, so a red `main` is seen; a docs-only push skips it as a PR would,
   but a release always runs all of it (`full`). Why: branches needn't be
   up to date, so two PRs green on their own could otherwise be published
   merged before anything had tested them together.
3. builds and packs the npm package (`build` job), and builds the pip
   package's sdist and wheel with that version written in (`build-py`),
4. **publishes** `@tristan2828/ui-foundation@<version>` to npm through
   trusted publishing, with provenance (`publish` job; OIDC, no stored
   token), and `ui-foundation-backend==<version>` to PyPI the same way
   (`publish-py`, `pypa/gh-action-pypi-publish` pinned to a SHA),
5. tags the commit `v<version>` and creates a GitHub release, once both
   are published. The template at that tag and the packages at that
   version always belong together.
6. runs `release-smoke`: an app created from the live release, with its
   full `verify` and its backend's (`ui-foundation-backend` from PyPI),
   the one check of exactly what apps get. It writes the
   result at the top of the release notes. A failure also fails the run,
   and GitHub emails the developer. Re-run it by hand with
   `gh workflow run release-smoke.yml -f tag=v<version>`.

**Several PRs ready at once: one release PR.** Open PRs that add to the
same shared lines conflict again after each merge, and each fix costs
another CI run. The shared lines are `CHANGELOG.md`'s `## Unreleased`, a
doc's index block and its `template/docs/foundation/` copy, and the spec
list in `playwright.harness.config.ts`. When several PRs are green
together, fold them into one release PR instead:

1. In a worktree of its own, branch `claude/release-<version>` from
   `origin/main`, then `git merge` each PR's branch into it, oldest first.
   Each PR's own CI is green first, so a failure on the release branch
   comes from the combination.
2. Resolve the conflicts once:
   - `CHANGELOG.md`: keep every entry.
   - A doc's index: take either side, then run `node scripts/doc-index.mjs`
     in `packages/ui-foundation` and copy each conventions doc over its
     `template/docs/foundation/` copy.
   - The harness spec list: keep both sides' specs.
3. Check that every line each branch added is in the result. Taking one
   side of a conflict in a doc can drop body text, not just index lines.
4. Bump the version as above: `packages/ui-foundation/package.json`, its
   `package-lock.json` entry, `packages/backend-foundation/pyproject.toml`
   and its README's pin. Then turn `## Unreleased` into the version's
   section, with one "How an app adopts it" for all of it.
5. Open it as one PR. When its checks pass, squash-merge it. Then close
   each folded PR with a note naming the release PR. GitHub shows them
   as Closed, not Merged, even though their code shipped, so the note
   says why.

This takes one CI run and one pass at the conflicts, instead of one per
PR. A single PR that's ready on its own still bumps and merges by itself.

**What guards a release:** the PR gate, then `main`'s own verify. Branch protection on `main` requires a pull request
and the `verify`, `verify-backend` and `install-test` checks, with no
reviewer and without requiring the branch to be up to date, so every
published version's PR passed the install test, and the merged tree
passed `verify` and `verify-backend` before publishing (`install-test` isn't
run again on `main`; `release-smoke` checks the live release after). Releases
run one at a time (`concurrency: release`). A push that lands while one
runs waits, and GitHub keeps only the newest waiting run, so a push can go
unverified on `main` on its own. No release is lost: `decide` compares
the version with the latest tag, so the newest run releases everything
merged since it. Beyond that, the workflow limits what could publish a bad
version:

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
built package.

**A bad release** keeps its version: npm and PyPI versions can't be
reused. Ship the fix as the next patch (bump the patch number in the
fix's PR; it can go out the same day), and meanwhile
`npm deprecate @tristan2828/ui-foundation@<version> "<why>; use <next>"`
so installs warn (on PyPI, yank the version on pypi.org, which pins
`==<version>` still install). `release-smoke` marks its notes if it failed.

**A breaking change** to anything the package exports, or to what `sync`
writes: `AGENTS.md` "The rules".

**`publish-py` stays in `release.yml`.** PyPI's trusted publisher is
repository `Tristan2828/ui-foundation`, workflow `release.yml`,
environment any. The token names the workflow file it ran in, so
`publish-py` must stay a job of `release.yml` itself, never moved into a
reusable workflow it calls. (`release.yml` calls `verify.yml` the other way
round: the verify is the reusable part, and both publishing jobs stay in
`release.yml`.)

Deploying an app: `template/docs/deploy.md`.
