# Building an App on the Foundation

How an app starts, takes later releases, changes the foundation, and gets
a data source. For the design behind it, see
[`ARCHITECTURE.md`](ARCHITECTURE.md).

## Starting a new app

1. **Create it** with [`create-an-app.md`](create-an-app.md): point any AI
   tool at that file, or follow it yourself. One script copies the template
   at a release tag, installs the package at that version, and commits.
2. **Plan your first entity** in `docs/entities/<entity>.md` (format and
   supported field types: `docs/foundation/entity-plan-template.md`;
   example: `docs/entities/widget.md`), or ask your AI tool to plan it with
   you. Entities are never guessed.
3. **Build it** by having any AI tool follow
   `docs/foundation/add-an-entity.md` (in Claude Code, `/new-entity <Name>`).
   Delete the Widgets demo once your own entity works: `src/routes/widgets/`,
   `src/api/gateway/{widgets,categories}.ts`, their mocks, tests, specs and
   plan, the nav entry, and the backend's widget router and migrations if
   you're keeping the backend.
4. **Choose a data source** (below) before you need real data. The UI runs
   on MSW mocks until then.

## What's the app's, what's the package's

| The app's (in its repo) | The package's (`@tristan2828/ui-foundation`) |
|---|---|
| `openapi.yaml` (except the foundation's part: `/auth/*` and the error bodies), `src/` — routes, `nav.ts`, `App.tsx`, `main.tsx`, gateway modules, mocks — `tests/`, `e2e/`, `backend/`, `deps-allowlist.json`, `AGENTS.md` below the foundation block, `docs/` outside `docs/foundation/` | primitives (`/ui/*`), `AppShell`, `DataTable`, `EntityForm`, `ErrorState`, `MultiChoice`, `MultiReference`, login and register screens, auth, `Page`/`AppError`/`QuerySpec`, the gateway's `safeFetch`/`toAppError`, table-URL state, tokens and base CSS, the lint config, the Playwright suites, and what `sync` writes (the `AGENTS.md` block, `docs/foundation/`, `.claude/`/`.codex/` agent files) |

The app's column changes whenever the app wants. The package's column
changes only through a release, which reaches every app.

## Taking a later release

```bash
npm install @tristan2828/ui-foundation@<version>
npx ui-foundation sync     # rewrites the AGENTS.md block, docs/foundation/, agent files
npm run verify
```

Read the release notes between your version and the new one first
(https://github.com/Tristan2828/ui-foundation/releases, and
[`CHANGELOG.md`](../CHANGELOG.md) for anything major). Releases publish
automatically on merge, and each one's notes open with its `release-smoke`
result: a fresh app created from that release, verified. Take a release
whose notes say it passed. A failed or still-running one says so there. Patch and minor
releases don't change what the package exports in a breaking way. A major
one lists its upgrade steps in the changelog.

`verify` makes the upgrade complete. `sync --check` fails until `sync` has
run, `check-contract` fails if the foundation's part of the contract
changed, and the lint rules and types flag whatever the release changed.

## Changing the foundation

When an app needs something the package doesn't do:

1. **Configure it.** The composites take props and slots for the variations
   apps have actually needed. Check the type declarations before assuming a
   change is needed.
2. **Raise it for the foundation** if another app would want it too. Open
   an issue or a PR against `packages/ui-foundation` in this repo. Once the
   release ships, the app upgrades and builds its screen on it. This is how
   Game List's forks became `setFilters`/`applyView`, `pinLastColumn`, the
   binary MSW override and `EntityForm`'s `danger` slot.
3. **Build on top of it** if it is genuinely the app's alone: a new
   component in the app's `src/` that uses the package's exports. Never a
   modified copy of a package file. Lint rejects importing the package's
   internals, or a primitive it ships from anywhere but the package.

A primitive the package doesn't ship: `npx shadcn@<tools.shadcn> add <name>`
into the app's `src/components/ui/`, as usual. If shadcn also writes a
primitive the package does ship (because the new one depends on it), delete
that copy and point the import at the package. Lint names every such
import.

## Choosing a data source: Postgres or the Notion API

The UI doesn't care. It talks to `openapi.yaml` through the gateway, and
either option serves that same contract. Decide per project.

| | Postgres (the reference backend) | Notion API |
|---|---|---|
| Source of truth | This app's database | Your Notion database — Notion stays the editor |
| Status | Built and tested (`backend/`, below) | **Not built yet**, deferred until a project picks it (`DEFERRED.md`) |
| Good when | The web app replaces the spreadsheet/database; you want speed, real queries, per-user data | You still want to edit in Notion, or other tools (e.g. AI refresh jobs) already write to it |
| Watch out for | A one-time import if the data lives elsewhere today | Notion's API rate limit (about 3 requests/second), its query limits for filtering and sorting, and mapping Notion property types to the spec |

Either way there is a backend. The Notion integration token is a secret,
and Notion's API can't be called from a browser, so a Notion-backed app
needs a thin server that holds the token and translates Notion ↔
`openapi.yaml`. The frontend is identical in both cases; only what sits
behind `/api` changes.

## The backend

Every app starts with `backend/`, a FastAPI + SQLModel + Alembic reference
implementation of the template's `openapi.yaml`: auth, per-user ownership
and the Widgets demo. Unlike the frontend package, it is **copied in** and
the app's own from then on. A fix to the reference backend here doesn't
reach an app on its own.

- The entity playbook covers the frontend only. A new entity's backend side
  (model, migration, router) is written by hand against the spec,
  following `backend/app/routers/widgets.py`. `npm run verify:backend`
  fails until the backend matches `openapi.yaml`.
- Setup and hosting are in the app's `docs/cloud-postgres.md` and
  `docs/deploy.md`.
- Not using it (a Notion-backed app, say)? Delete `backend/`,
  `docker-compose.yml` and the `verify:backend` script.

## Moving a 2.x app onto the package (3.0)

Apps created before 3.0 installed the shadcn registry and hold their own
copy of every foundation file. Moving one onto the package means deleting
those copies and importing the package instead. Do it as one change, on a
branch, with the app's `verify` green before and after.

1. **Allow and install the package.** Add `@tristan2828/ui-foundation` to
   `deps-allowlist.json`, then `npm install @tristan2828/ui-foundation@^3`.
2. **Carry forks over as configuration first.** Go through the app's
   `foundation.json` `forked` map (or its drift-check script's `FORKED`) and
   find each fork's replacement in 3.0. A fork with no replacement is either
   the app's own (build it on top of the package, step 3 of "Changing the
   foundation") or worth raising upstream before migrating.
   - `app-shell.tsx`: the nav moves to `src/nav.ts` and is passed as
     `<AppShell title nav sidebarExtra defaultSidebarOpen />`.
     `sidebarExtra` holds extra sidebar groups (external links, say).
     Reading back the sidebar cookie, the collapsed-rail footer and a
     top-centre `Toaster` are built in.
   - No self-service sign-up: render `<LoginRoute registerPath={null} />`,
     drop the `/register` route and `e2e/register.spec.ts`. The package's
     `register()` stays but goes unused, and `/auth/register` may be left
     out of `openapi.yaml`, along with `RegisterRequest` (from 3.1.0;
     `check-contract` requires only what the paths the app has reach).
   - `entity-form.tsx` delete-on-edit: `EntityForm`'s `danger` slot.
3. **Delete the foundation's files from the app.** Every file the package
   now provides:
   - `src/components/ui/` primitives the package ships (see its README).
     Keep any the app added itself.
   - `src/components/app/`, `src/components/theme-provider.tsx`,
     `src/auth/`, `src/hooks/`, `src/api/contracts.ts`,
     `src/api/query-client.ts`, `src/api/transport/`,
     `src/api/gateway/{errors,auth}.ts`, `src/mocks/e2e-hooks.ts`,
     `src/styles/theme.css`, `src/routes/{login,login-schema,register,register-schema,return-path}.ts(x)`
   - their unit tests (`tests/return-path.test.ts`, `tests/gateway/auth.test.ts`, …)
   - `scripts/check-deps.mjs`, `scripts/check-foundation-drift.mjs`,
     `foundation.json`, and the old copied `docs/add-an-entity.md`,
     `docs/design-language.md`, `docs/cell-patterns.md`,
     `docs/column-options.md`, `docs/entities/_template.md`
4. **Point the imports at the package**, starting from the template at the
   same tag for each file's shape:
   - `@/components/ui/<name>` → `@tristan2828/ui-foundation/ui/<name>`
   - composites, `useAuth`, `useTableUrlState`, `useDebouncedValue`,
     `createQueryClient`, `Page`/`AppError`/`QuerySpec` →
     `@tristan2828/ui-foundation`
   - the gateway's `./errors` → `@tristan2828/ui-foundation/gateway`
   - `src/index.css`: `@import "tailwindcss";` then
     `@import "@tristan2828/ui-foundation/styles.css";`, plus the app's own
     rules after them
   - `src/main.tsx`: `<FoundationProviders mockMode={IS_MOCK_MODE}>`, and
     `exposeMswForE2E(worker)` from `@tristan2828/ui-foundation/mocks`.
     Keep the *literal* `import.meta.env.VITE_API === 'real'` check around
     the MSW import, or `build:real` still bundles MSW
   - `src/mocks/`: spread `authHandlers` into the handler list and call
     `resetMockAuth()` from the app's reset. The app's own copy of the auth
     handlers and user store goes
   - `src/lib/utils.ts`: `export { cn } from '@tristan2828/ui-foundation'`
     (for primitives the app adds with shadcn)
   - `eslint.config.js`: `import uiFoundation from '@tristan2828/ui-foundation/eslint'`
     and `export default [...uiFoundation()]`
   - `e2e/a11y.spec.ts` and `e2e/mock-mode-banner.spec.ts`: the
     `defineA11ySuite` / `defineMockModeBannerSuite` calls from
     `@tristan2828/ui-foundation/testing`, each inside the file's own
     `test.describe(...)` so the spec can be selected by file (see the
     template's specs). `e2e/global.d.ts` becomes one
     line: `import '@tristan2828/ui-foundation/testing'`
5. **Scripts.** Replace `node scripts/check-deps.mjs` in `verify:fast` with
   `ui-foundation sync --check && ui-foundation check-contract && ui-foundation check-deps`,
   and drop `check:foundation`. The template's `package.json` has the exact
   lines.
6. **Sync the conventions.** `npx ui-foundation sync`. It puts the
   foundation block at the top of `AGENTS.md`. Delete the older copy of the
   foundation's sections below it, keeping only the app's own notes.
7. **`npm run verify`.** Lint names every import still pointing at a
   deleted file, `check-contract` names any drift in `/auth/*` or the error
   bodies, and the Playwright suite proves the screens still work.

## Before 3.0: apps on the registry

Tags `v1.0.0` to `v2.1.x` were a shadcn registry
(`npx shadcn add Tristan2828/ui-foundation/starter#<tag>`). Those tags still
install exactly as they did. For how 2.x apps took releases, read this file
at a 2.x tag.
