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
   `src/api/gateway/{widgets,widget-categories}.ts`, their mocks, tests,
   specs and plan, the nav entry, and the backend's widget routers and
   migrations if you're keeping the backend. First rewrite the
   `### Reference files` section of `AGENTS.md` to name your own files for
   each pattern: the playbook copies from there once the demo is gone.
4. **Choose a data source** (below) before you need real data. The UI runs
   on MSW mocks until then.

## What's the app's, what's the package's

| The app's (in its repo) | The package's (`@tristan2828/ui-foundation`) |
|---|---|
| `openapi.yaml` (except the foundation's part: `/auth/*` and the error bodies), `src/` — routes, `nav.ts`, `App.tsx`, `main.tsx`, gateway modules, mocks — `tests/`, `e2e/`, `backend/` (except what `ui-foundation-backend` holds), `deps-allowlist.json`, `AGENTS.md` below the foundation block, `docs/` outside `docs/foundation/` | primitives (`/ui/*`), `AppShell`, `DataTable`, `EntityView` and editing in place, `EntityForm`, `Markdown`, `RichTextEditor`, `StageCircle`, `ErrorState`, `MultiChoice`, `MultiReference`, `ListEditor`, `InlineCreate`, the timed-screen parts (`SessionView`, `useSessionClock`, `useWakeLock`, the audio cues, `useMuted`), reminders (`AllowReminders`, `usePushPermission`, the `pwa()` Vite plugin and its service worker), login and register screens, auth, `Page`/`AppError`/`QuerySpec`, the gateway's `safeFetch`/`toAppError`, table-URL state, tokens and base CSS, the lint config, the Playwright suites, and what `sync` writes (the `AGENTS.md` block, `docs/foundation/`, `.claude/`/`.codex/` agent files) |

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
and the Widgets demo. Most of it is **copied in** and the app's own from
then on; a fix to that part here doesn't reach an app on its own. Its auth
and security layer (sign-in, sessions, limits, TOTP, error reporting, the
deploy checks, the SPA mount, the OAuth sign-in) is the pip package
`ui-foundation-backend` since 4.25, pinned in `backend/pyproject.toml` at
the same version as the npm package and upgraded with it
([`ARCHITECTURE.md`](ARCHITECTURE.md) "backend-foundation").

- The entity playbook covers the frontend only. A new entity's backend side
  (model, migration, router) is written by hand against the spec,
  following `backend/app/routers/widgets.py`. `npm run verify:backend`
  fails until the backend matches `openapi.yaml`.
- Setup and hosting are in the app's `docs/cloud-postgres.md` (a hosted
  database), `docs/home-lab-postgres.md` (one on a server you run) and
  `docs/deploy.md`.
- Not using it (a Notion-backed app, say)? Delete `backend/`,
  `docker-compose.yml` and the `verify:backend` script.

## Adopting the backend package (4.25)

For an app made before 4.25.0, whose `backend/app/` holds its own copies of
the files the package now owns. Do it after the app is on the npm package
4.25.0 or later, and its backend has the 4.0 sign-in files (an app on 3.x
takes "Moving a 3.x app to 4.0" below first). No migration: the tables
already exist, with the same names and columns.

1. **Pin it.** In `backend/pyproject.toml`, add
   `"ui-foundation-backend==<the npm package's version>",` to
   `dependencies`, and `pip install -e ".[dev]"` in `backend/`. If the app
   checks Python dependencies against an allowlist (`deps-allowlist.json`'s
   `python` list, 4.34), add it there.
2. **Delete the copies** the package owns: `app/db.py`,
   `app/openapi_responses.py`, `app/security.py`, `app/totp.py`,
   `app/login_limits.py`, `app/rate_window.py`, `app/error_reporting.py`,
   `app/errors.py`, `app/deploy_checks.py`, `app/spa.py`,
   `app/routers/auth.py`, `app/routers/environment.py`,
   `app/routers/client_errors.py`, `app/routers/oauth.py` and
   `scripts/set_password.py`, `scripts/enable_totp.py`,
   `scripts/disable_totp.py`. First diff each against the template at the
   tag the app came from: an app's own change to one is a fork to raise
   here, not to lose.
3. **Re-export** where the app imports `app.*` names, as the template's
   files at 4.25.0 do (copy them): `app/db.py`, `app/openapi_responses.py`,
   `app/security.py`, `app/errors.py` and `app/spa.py` become re-exports;
   `app/models.py` imports `User`, `Session`, `LoginFailure`,
   `RecoveryCode`, `PendingLogin`, `OAuthClient`, `OAuthCode`, `OAuthGrant`
   from `foundation_backend.models` (as `X as X`) and keeps the app's own
   models; `app/schemas.py` the same for the foundation's schemas
   (`CamelModel`, `Page`, `UserOut`, the sign-in and error bodies);
   `app/config.py` calls `load_dotenv()`, then
   `from foundation_backend.config import *`, then keeps only the app's own
   settings (`STATIC_DIR` stays the app's: its default is relative to the
   app's file). Code that turned a plain `postgresql://` or provider URL
   into asyncpg's goes too: the package does that from 4.26. Other imports of the deleted modules
   (`from app.totp import …`, `from app.routers.auth import get_current_user`)
   become `foundation_backend.…`.
4. **`main.py`** includes the package's routers:
   `from foundation_backend.routers import auth, client_errors, environment, oauth`,
   then `auth.router`, `client_errors.router` and `environment.router`
   under `/api`, `oauth.router` at the root if the app has AI chats, and
   `auth.register_router` only if people make their own accounts (an app
   without `/auth/register` in its `openapi.yaml` leaves it out; that is
   the route a copied `auth.py` used to have deleted).
   `production_problems` comes from `foundation_backend.deploy_checks`.
5. **Tests:** delete the copies of `test_auth.py`, `test_login_limits.py`,
   `test_totp.py`, `test_environment.py`, `test_deploy_checks.py`,
   `test_error_reporting.py`, `test_spa.py`, `test_signed_in.py` and
   `tests/signed_in.py` (the package runs them); import `session_cookie`
   from `foundation_backend.testing.signed_in`. A test that changes one of
   the package's settings patches `foundation_backend.config` (or the
   module that imported it), not `app.config`, whose copy the package
   never reads.
6. **Scripts and docs:** `python -m foundation_backend.scripts.set_password <email>`
   (and `enable_totp`, `disable_totp`), run from `backend/`, replace the
   deleted scripts; point the app's deploy docs at them.
7. `npm run verify:backend`, and the Postgres check if the app has one.
   The Docker image installs the package from `pyproject.toml`; check that
   it builds.

From then on, `ui-foundation-backend` moves with the npm package: bump
both to the same version, run any migration the changelog names for it,
then `npm run verify:backend`.

## Moving to the shared MCP, jobs and push (4.35)

4.35 moves the template's MCP tools, scheduled jobs, Web Push and
reminders into `ui-foundation-backend` (#230), as 4.25 did for sign-in.
Nothing changes on the wire or in the database, so an app that keeps its
own copies keeps working; it just stops getting their fixes. To take
them (in `backend/`):

1. **Pin it.** `ui-foundation-backend==4.35.0` (with `[push]` if the app
   sends reminders, or keep its own push extra), then `pip install -e ".[dev]"`.
2. **Delete the copies** the package now owns: `app/mcp_tools.py`,
   `app/routers/mcp.py`, `app/jobs.py`, `app/routers/jobs.py`,
   `app/push.py`, `app/reminders.py`, `app/routers/push.py`,
   `scripts/check_jobs_live.py`, `scripts/generate_vapid_keys.py`,
   `scripts/send_test_push.py`, and the tests `tests/test_jobs.py`,
   `tests/test_push.py`, `tests/test_reminders.py` (the package runs
   them). Keep a test of the app's own jobs, and `tests/test_mcp.py` for
   its own entities.
3. **Re-export** the four tables from `foundation_backend.models` in
   `app/models.py` (`McpAuditEntry`, `JobRunRecord`, `PushSubscription`,
   `Reminder`) and delete their classes; the same for the job and push
   schemas in `app/schemas.py`. Delete `JOBS_ENABLED`, `JOB_RUNS_KEEP_DAYS`,
   `PUSH_*` and `VAPID_*` from `app/config.py` (its star import brings
   them). A test that monkeypatches one patches `foundation_backend.config`.
4. **`app/mcp_entities.py`** keeps only the app's entities: import
   `ListArgs`, `McpEntity` and `register_entities` from
   `foundation_backend.mcp`, delete the class definitions and
   `check_entities`, and end with `register_entities(ENTITIES)`.
5. **`app/main.py`**: import `jobs`, `push`, `reminders` from
   `foundation_backend`, the routers from `foundation_backend.routers`
   (`jobs`, `mcp`, `push`), and `app.mcp_entities` once so its entities
   are registered. The template's `main.py` at the 4.35.0 tag is the
   reference. A job of the app's own imports `register_job` from
   `foundation_backend.jobs`.
6. **Scripts:** `scripts/verify.sh`'s mypy list loses the moved scripts;
   `check-backend-postgres.sh` runs `python -m
   foundation_backend.scripts.check_jobs_live`; `docs/deploy.md`'s VAPID
   and test-push commands are `python -m foundation_backend.scripts.<name>`.
7. No migration: the tables are the same. `npm run verify:backend`.

## Adding AI chats (MCP) to a 4.x app

4.2 adds an MCP endpoint to the reference backend. The package and the
contract don't change, so an app without a backend, or one that doesn't
want chats reaching its data, does nothing. Otherwise (the backend is
copied in, so by hand):

1. From the template at the 4.2.0 tag, copy `app/mcp_entities.py`,
   `app/mcp_tools.py`, `app/rate_window.py`, `app/routers/mcp.py`,
   `app/routers/oauth.py`, `scripts/check_mcp_live.py` and
   `tests/test_mcp.py`. Add migration `0011_mcp.py`, renumbered onto the
   app's own chain.
2. Apply the changes to `app/models.py` (four tables), `app/config.py`
   (the `MCP_*` settings), `app/main.py` (the two routers, and the new
   `production_problems` arguments) and `app/deploy_checks.py`.
3. Rewrite `ENTITIES` in `app/mcp_entities.py` for the app's own
   entities: for each, its router functions, `out`, `title`, `summary`,
   `filters`, `sorts`, `relations` and the create/update schemas, and
   `path` (4.6) for an entity whose pages sit under a section
   (`/media/channels`). Leave
   out `create` and `update` for an entity chats should only read. Update
   `tests/test_mcp.py`'s expectations to match.
4. Read the template's `docs/deploy.md` "AI chats (MCP)", set
   `MCP_ENABLED=true` and `MCP_PUBLIC_URL`, and let the MCP paths through
   any access proxy.
5. `npm run verify:backend`.

## Moving a 3.x app to 4.0 (sign-in limits and two-step sign-in)

4.0 changes the foundation's part of the contract (`POST /auth/login`), so
`check-contract` fails until the app's spec has it. Do it as one change:

1. **Upgrade and sync:** `npm install @tristan2828/ui-foundation@^4.0.0`,
   then `npx ui-foundation sync`.
2. **The contract.** From
   `node_modules/@tristan2828/ui-foundation/openapi/foundation.yaml`, copy
   into the app's `openapi.yaml`: `/auth/login`'s new `202` and `429`
   responses, `maxLength: 1024` on `LoginRequest.password`, and the
   `LoginNextStep` schema and `RateLimitedError` response. For two-step
   sign-in also copy the `/auth/login/totp` path with `TotpLoginRequest` and
   `SignInExpiredError` (the path is `x-optional`: an app whose backend has
   no second step may leave all three out). Then `npm run gen:api`.
3. **The app's code**, where tsc points:
   - `useAuth().login` now resolves to a `SignInResult`
     (`signed-in`, `totp` or `restart`), not `void`, and the context has
     `submitTotp`. `LoginRoute` handles both steps; an app's own sign-in
     screen must handle `totp`. A hand-built `AuthContextValue` (a story, a
     test) needs `login` to return `{ status: 'signed-in' }` and a
     `submitTotp`.
   - `AppError` has a new kind, `rate_limited`, with `retryAfterSeconds`. A
     `Record<AppError['kind'], …>` needs an entry for it.
   - `ApiResponse` (from `/gateway`) has `headers`. A test fake that builds
     one needs them. `toAppError` takes them as an optional third argument;
     pass `res.headers` for a 429's `retryAfterSeconds`.
4. **The backend** (copied in, so by hand). `verify:backend`'s conformance
   check fails until the backend documents the 202 and the 429. From the
   template at the 4.0.0 tag, copy `app/login_limits.py`, `app/totp.py`,
   `scripts/enable_totp.py` and `scripts/disable_totp.py`. Then apply the
   changes to `app/routers/auth.py`, `app/models.py`, `app/schemas.py`,
   `app/config.py`, `app/openapi_responses.py` and `app/errors.py` (which
   now keeps an `HTTPException`'s headers, so the 429 gets `Retry-After`).
   Add migration `0010_login_limits_totp.py`, renumbered onto the app's
   own chain, and the tests `tests/test_login_limits.py` and
   `tests/test_totp.py`. The changes are in `CHANGELOG.md` 4.0.0.
5. **Deploy:** `alembic upgrade head`, and read the template's
   `docs/deploy.md` "Sign-in limits" (uvicorn's `--proxy-headers`, the
   lockout trade-off) and "Two-step sign-in" (the scripts, recovery, and
   encrypted backups). Then turn TOTP on per account with
   `scripts/enable_totp.py`.
6. `npm run verify` and `npm run verify:backend`.

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

## Adding soft delete to a 4.x app

4.3 makes the Widget reference soft-delete and adds `delete` and `restore`
to MCP. The package doesn't change; an app adopts it per entity, by hand,
and only for entities whose plan says "soft-deleted":

1. A migration adding a nullable, commented `deleted_at timestamptz`
   (`0012_widget_soft_delete.py`), and the field on the model.
2. In the router: DELETE sets it, a `restore` POST clears it, the list
   filters on it (`deleted` parameter), and the get/update lookup treats a
   deleted record as missing (`_get_or_404`).
3. In `openapi.yaml`: the `deleted` parameter and the `restore` operation;
   then `npm run gen:api`, the gateway's `restore`, a restore mutation, the
   mocks, and an Undo on the delete toast.
4. For MCP: set `delete` and `restore` on the entity's `McpEntity`, add
   `deleted` to its filters, and copy `tool_delete` / `tool_restore` and
   their definitions from `app/mcp_tools.py`.
5. `npm run verify` and `npm run verify:backend`.
