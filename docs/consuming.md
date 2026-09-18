# Consuming the Foundation

How an app gets this foundation, takes later fixes, and gets a backend.
Commands use the shadcn CLI version pinned in `deps-allowlist.json`.

## Starting a new app

In an empty folder for the new repo (Git Bash on Windows). This is the
same setup `scripts/consume-test.sh` runs and verifies on every release.

1. **Scaffold Vite** (the version pinned in `deps-allowlist.json`):
   ```bash
   npm create vite@8.3.0 my-app -- --template react-ts
   cd my-app && npm install
   npm install tailwindcss @tailwindcss/vite
   ```
2. **Add Tailwind and the `@` alias**, which `shadcn init` requires:
   - `vite.config.ts`: add `tailwindcss()` to `plugins`, and
     `resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } }`.
   - `tsconfig.json` and `tsconfig.app.json`: add
     `"compilerOptions": { "paths": { "@/*": ["./src/*"] } }`.
   - `src/index.css`: first line `@import "tailwindcss";`.
3. **Initialize shadcn and install the foundation** (always pin a tag —
   the latest is in the README):
   ```bash
   npx shadcn@4.21.0 init -t vite -b base -p nova -y
   npx shadcn@4.21.0 add Tristan2828/ui-foundation/starter#<tag> --yes --overwrite
   npx msw init public/ --save
   git init && git add -A && git commit -m "Scaffold from ui-foundation <tag>"
   ```
   `--overwrite` is right here, on a fresh scaffold — and never again
   afterwards (see "Taking a later release").
4. **Plan your first entity** in `docs/entities/<entity>.md` (format and
   supported field types: `docs/entities/_template.md`; example:
   `docs/entities/widget.md`) — or run `/new-entity <Name>` without one and
   plan it in conversation. `/new-entity` never guesses fields.
5. **`/new-entity <Name>`** builds it. Its Step 0 adds the npm scripts the
   registry can't (`gen:api`, `verify:fast`, `verify`). Delete the Widgets
   demo once your own entity works.
6. **Choose a data source** (below) before you need real data — the UI
   runs on MSW mocks until then.

## You own the files

From install on, every installed file is **yours**, the shadcn model:
nothing updates behind your back, and nothing else will.

The installed files fall into two groups, which matters when upgrading:

| You'll edit these (app-owned) | You normally won't (foundation-owned) |
|---|---|
| `openapi.yaml`, `src/App.tsx`, `src/components/app/app-shell.tsx` (nav), `src/mocks/handlers.ts`, `src/mocks/data.ts`, `tests/mocks/conformance.test.ts`, `e2e/shell.spec.ts`, `deps-allowlist.json`, `src/routes/widgets/**` (delete once you have your own entity) | `src/components/app/{data-table,entity-form,error-state,route-error-boundary}.tsx`, `src/auth/**`, `src/api/{contracts,query-client}.ts`, `src/api/transport/**`, `src/api/gateway/errors.ts`, `src/hooks/**`, `src/routes/{login,register,return-path}*`, `eslint.config.js`, `AGENTS.md`, `docs/add-an-entity.md`, `.claude/**` |

## Taking a later release

**Never re-run `add starter --overwrite` in an app that has entities.** It
replaces app-owned files too — your `openapi.yaml`, routes, nav and mocks
go back to the Widgets demo.

Instead:

1. Read what changed between your tag and the new one:
   `https://github.com/Tristan2828/ui-foundation/compare/<your-tag>...<new-tag>`
   (`docs/phases/` in that diff explains each change).
2. Preview, without writing anything:
   ```bash
   npx shadcn@4.21.0 add Tristan2828/ui-foundation/starter#<new-tag> --dry-run
   ```
   It lists every file as new, overwrite or identical.
3. For each **foundation-owned** file marked overwrite, inspect it
   (`-` is your copy, `+` is the release):
   ```bash
   npx shadcn@4.21.0 add Tristan2828/ui-foundation/starter#<new-tag> --diff src/auth/auth-provider.tsx
   ```
   Take the new version if you haven't changed that file; merge by hand if
   you have. Ignore app-owned files unless the release notes say otherwise.
4. `npm run verify`.

Primitives in `src/components/ui/` come from upstream shadcn at install
time (only `button`, `badge` and `src/hooks/use-mobile.ts` are shipped by
this registry), so the dry run may also show upstream drift there — take
it or not on its own merits.

## Choosing a data source: Postgres or the Notion API

The UI doesn't care: it talks to `openapi.yaml` through the gateway, and
either option serves that same contract. Decide per project.

| | Postgres (the reference backend) | Notion API |
|---|---|---|
| Source of truth | This app's database | Your Notion database — Notion stays the editor |
| Status | Built and tested (`backend/`, below) | **Not built yet** — deferred until a project picks it (`DEFERRED.md`) |
| Good when | The web app replaces the spreadsheet/database; you want speed, real queries, per-user data | You still want to edit in Notion, or other tools (e.g. AI refresh jobs) already write to it |
| Watch out for | A one-time import if the data lives elsewhere today | Notion's API rate limit (about 3 requests/second), its query limits for filtering and sorting, and mapping Notion property types to the spec |

Either way there is a backend: the Notion integration token is a secret
and Notion's API can't be called from a browser, so a Notion-backed app
needs a thin server holding the token and translating Notion ↔
`openapi.yaml`. The frontend is identical in both cases — only what sits
behind `/api` changes.

## Getting the backend

The registry ships the frontend only. `backend/` (FastAPI + SQLModel +
Alembic) is a reference implementation of the same `openapi.yaml`, with
auth, per-user ownership and the Widgets demo. Copy it from the same tag:

```bash
TAG=v1.9.0   # the tag you installed starter from
curl -L "https://github.com/Tristan2828/ui-foundation/archive/refs/tags/$TAG.tar.gz" \
  | tar -xz --strip-components=1 "ui-foundation-${TAG#v}/backend" "ui-foundation-${TAG#v}/docker-compose.yml"
```

It's yours from then on, same as the frontend. Two things to know:

- **`/new-entity` covers the frontend only.** A new entity's backend side
  (model, migration, router) is written by hand against the spec, following
  `backend/app/routers/widgets.py`; `backend/scripts/check_spec_conformance.py`
  fails until the backend matches `openapi.yaml`.
- Setup is in `docs/cloud-postgres.md` and deploying in `docs/deploy.md` —
  copy those too, or read them here.
