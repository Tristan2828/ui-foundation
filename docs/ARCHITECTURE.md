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
- **Auth** is session cookies, same-origin. `AuthProvider` owns the session
  query, ends the session on any 401, clears user-scoped cache on every
  session change, and tells "logged out" apart from "backend down". Apps
  read it only through `useAuth()`, the only auth export.
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
| `npm run verify` (root) | before any PR; CI (`verify`) | + the package's Storybook checks on every primitive (axe in both themes; every colour it paints resolves to a token; every icon in the design-language stories clears 3:1 against what's behind it, which axe doesn't measure), the rich-text editor's Markdown round trip on the real editor, and the template's Playwright suite (every screen's states, auth, `a11y.spec.ts` in light and dark, a phone-width project) |
| `npm run verify:backend` | backend changes; CI (`verify-backend`) | the template backend's mypy strict, pytest (SQLite), spec conformance. In CI the job then migrates a `postgres:18` service to head and runs `check_db_comments.py` (every table and column has a `COMMENT ON`) |
| `template/scripts/check-backend-postgres.sh` | backend changes (needs Docker) | all of the above + `check_db_comments.py` + a live server on real Postgres |
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

**Claude Code cloud sessions** run `.claude/hooks/session-start.sh` on
start (registered in `.claude/settings.json`; it does nothing anywhere
else). It runs `npm install`, makes `template/backend/.venv`, and handles
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
something would be, it's kept as written and the guard refuses: the
editor drops images on load. A
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
never covers the fixed toolbar. Base UI's Popover was tried first, and
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
`packages/ui-foundation/`, `template/` or `scripts/create-app.sh`. It:

1. picks the version: the next patch after the latest `v*` tag, or the
   version in `packages/ui-foundation/package.json` if that is higher. A
   minor or major release is made by bumping it there in the PR, and
   nothing is committed back.
2. builds and packs the package (`build` job),
3. **publishes** `@tristan2828/ui-foundation@<version>` to npm through
   trusted publishing, with provenance (`publish` job; OIDC, no stored
   token),
4. tags the commit `v<version>` and creates a GitHub release. The template
   at that tag and the package at that version always belong together.
5. runs `release-smoke`: an app created from the live release, with its
   full `verify`, the one check of exactly what apps get. It writes the
   result at the top of the release notes. A failure also fails the run,
   and GitHub emails the developer. Re-run it by hand with
   `gh workflow run release-smoke.yml -f tag=v<version>`.

**What guards a release** (decided 2026-09-30; until then every version
waited for the developer's passkey approval on npm): the PR gate. Branch
protection on `main` requires a pull request and the `verify`,
`verify-backend` and `install-test` checks, with no reviewer, so every
published version has passed the install test. Beyond that, the workflow
limits what could publish a bad version:

- Only the `publish` job can publish, and it runs no third-party code: no
  checkout, no `npm ci`, only `npm publish` of the tarball `build` packed.
  `build` installs the dependency tree without that permission.
- Third-party actions in `release.yml` and `release-smoke.yml` are pinned
  to commit SHAs.
- No npm token exists. The trusted publisher (GitHub Actions,
  `Tristan2828/ui-foundation`, workflow `release.yml`) is the only thing
  that can publish besides the developer's own passkey-protected account.

What that gives up: a malicious change that passes the checks and gets
merged reaches every app installing `^3.x`, with no human look at the
built package. The passkey step cost one manual approval per release;
the developer chose automation over it.

**A bad release** keeps its version: npm versions can't be reused. Ship
the fix as the next patch, and meanwhile
`npm deprecate @tristan2828/ui-foundation@<version> "<why>; use <next>"`
so installs warn. `release-smoke` marks its notes if it failed.

**A breaking change** to anything the package exports, or to what `sync`
writes, gets a major version, a `CHANGELOG.md` entry and upgrade steps in
[`consuming.md`](consuming.md).

**npm setup** (done 2026-09-28): the account `tristan2828` has passkey 2FA.
3.0.0 was published by hand, because trusted publishing can only be
configured on a package that already exists. The trusted publisher is
GitHub Actions, `Tristan2828/ui-foundation`, workflow `release.yml`. It
allowed staging only until 2026-09-30, when "allow npm publish" was turned
on. 3.1.0 was the last staged release.

Deploying an app: `template/docs/deploy.md`.
