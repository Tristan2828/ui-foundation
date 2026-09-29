# Consuming the Foundation

How an app gets this foundation, takes later fixes, and gets a backend.
Commands use the shadcn CLI version pinned in `deps-allowlist.json`.

## Starting a new app

1. **Create it** with [`create-an-app.md`](create-an-app.md) — point any AI
   tool at that file, or follow it yourself. One script
   (`scripts/create-app.sh <name> <tag>`, the same one every release is
   tested with) scaffolds Vite, Tailwind and shadcn, installs
   `starter#<tag>` and commits; then the playbook's Step 0 and a passing
   `npm run verify`.
2. **Plan your first entity** in `docs/entities/<entity>.md` (format and
   supported field types: `docs/entities/_template.md`; example:
   `docs/entities/widget.md`) — or ask your AI tool to plan it with you in
   conversation. Entities are never guessed.
3. **Build it** by having any AI tool follow `docs/add-an-entity.md` (in
   Claude Code, `/new-entity <Name>` is a shortcut). Delete the Widgets demo
   once your own entity works.
4. **Choose a data source** (below) before you need real data — the UI
   runs on MSW mocks until then.

## You own the files

From install on, every installed file is **yours**, the shadcn model:
nothing updates behind your back, and nothing else will.

The installed files fall into two groups, which matters when upgrading:

| You'll edit these (app-owned) | You normally won't (foundation-owned) |
|---|---|
| `openapi.yaml`, `src/App.tsx`, `src/components/app/app-shell.tsx` (nav), `src/mocks/handlers.ts`, `src/mocks/data.ts`, `tests/mocks/conformance.test.ts`, `e2e/shell.spec.ts`, `deps-allowlist.json`, `src/routes/widgets/**` (delete once you have your own entity) | `src/components/app/{data-table,entity-form,error-state,multi-choice,route-error-boundary}.tsx`, `src/auth/**`, `src/api/{contracts,query-client}.ts`, `src/api/transport/**`, `src/api/gateway/errors.ts`, `src/hooks/**`, `src/routes/{login,register,return-path}*`, `eslint.config.js`, `AGENTS.md`, `docs/add-an-entity.md`, `.claude/**` |

## Taking a later release

**Never re-run `add starter --overwrite` in an app that has entities.** It
replaces app-owned files too — your `openapi.yaml`, routes, nav and mocks
go back to the Widgets demo.

Instead:

0. **See where you stand:** `node scripts/check-foundation-drift.mjs`
   (`npm run check:foundation` once Step 0 has added it). It compares every
   shipped file with the release in `foundation.json`, so you know which
   files are yours before anything new arrives. Pass the new tag to preview
   the release itself: `node scripts/check-foundation-drift.mjs <new-tag>`.
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
4. Set `"tag"` in `foundation.json` to the new tag, then run the drift
   check again and `npm run verify`.

Primitives in `src/components/ui/` come from upstream shadcn at install
time (only `button`, `badge`, `combobox`, `table` and
`src/hooks/use-mobile.ts` are shipped by this registry), so the dry run may
also show upstream drift there — take it or not on its own merits.

### The drift check and `foundation.json`

`scripts/check-foundation-drift.mjs` (shipped in `starter`)
reports each shipped file as **DRIFTED** (you changed it), **MISSING** (the
release ships it, you don't have it), a **declared fork**, or **not
imported** (present, but nothing uses it — taking a file isn't adopting
it). It exits non-zero on anything drifted or missing, and stays out of
`verify` on purpose. What it treats as intentional lives in
`foundation.json`, which `create-app.sh` writes and the registry never
overwrites:

```json
{
  "tag": "v2.1.9",
  "appOwned": ["e2e/msw-contract.spec.ts"],
  "removed": { "src/routes/register.tsx": "no self-service sign-up" },
  "forked": { "src/main.tsx": "adds the app's own providers" }
}
```

The app-owned files in the table above and the Widgets demo are covered
by default, so you don't list those. Every `removed` or `forked` entry
needs a reason. The check also flags entries that stopped being true: a
declared fork that matches the release again, or a removed file that is
back. **An app created before the drift check shipped** has neither
file. The script arrives as a new file when you take a later release. Then
create `foundation.json` by hand with the tag you're actually on: the last
release you took, or the one in your first commit's message ("Scaffold
from … starter#<tag>").

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
TAG=v2.1.1   # the tag you installed starter from
curl -L "https://github.com/Tristan2828/ui-foundation/archive/refs/tags/$TAG.tar.gz" \
  | tar -xz --strip-components=1 "ui-foundation-${TAG#v}/backend" "ui-foundation-${TAG#v}/docker-compose.yml"
```

It's yours from then on, same as the frontend. Two things to know:

- **The entity playbook covers the frontend only.** A new entity's backend side
  (model, migration, router) is written by hand against the spec, following
  `backend/app/routers/widgets.py`; `backend/scripts/check_spec_conformance.py`
  fails until the backend matches `openapi.yaml`.
- Setup is in `docs/cloud-postgres.md` and deploying in `docs/deploy.md` —
  copy those too, or read them here.
