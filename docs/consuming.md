# Consuming the Foundation

How an app gets this foundation, takes later fixes, and gets a backend.
Commands use the shadcn CLI version pinned in `deps-allowlist.json`.

## Install once, then you own the files

```bash
npx shadcn@4.21.0 add Tristan2828/ui-foundation/starter#<tag>
```

Always pin a tag. Then run `/new-entity <Name>` (or follow
`docs/add-an-entity.md`) — its Step 0 adds the npm scripts the registry
can't. From here on, every installed file is **yours**, the shadcn model:
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
