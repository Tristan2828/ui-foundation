# UI Foundation App

A database-backed app built on
[`@tristan2828/ui-foundation`](https://github.com/Tristan2828/ui-foundation):
the shared primitives, table and form composites, auth and design tokens
come from the package; everything in `src/` is this app's own. It starts
with a demo entity, Widgets, to copy from and then delete.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173, on mock data (MSW) — no backend needed
npm run verify         # the full gate: codegen, conventions, types, lint, unit tests, Playwright
npm run verify:fast    # the inner loop, no Playwright
```

The mock API signs you in automatically. Against the real backend:

```bash
cp backend/.env.example backend/.env    # local Docker Postgres by default
bash backend/scripts/dev.sh             # Postgres + venv + migrations + API on :8000
VITE_API=real npm run dev               # in another shell: proxies /api to the backend
```

Log in with the seeded dev user, `dev@example.com` / `dev-password-123`.
Deploying: [`docs/deploy.md`](docs/deploy.md) (with `APP_ENV=production`
the backend refuses to start while that password still works). A hosted
database: [`docs/cloud-postgres.md`](docs/cloud-postgres.md). Build for
production with `npm run build:real` — a plain `npm run build` bundles the
mock API.

## Working on it

- **Rules** for people and AI agents alike: [`AGENTS.md`](AGENTS.md). Its
  first block is the foundation's and is synced; this app's notes go below it.
- **Adding an entity:** write its plan in `docs/entities/<entity>.md`, then
  follow [`docs/foundation/add-an-entity.md`](docs/foundation/add-an-entity.md)
  (`/new-entity <Name>` in Claude Code).
- **Upgrading the foundation:**
  `npm install @tristan2828/ui-foundation@<version> && npx ui-foundation sync`,
  then `npm run verify`.
- **The backend** (`backend/`) is a FastAPI + SQLModel reference
  implementation of `openapi.yaml`, copied in with the template and yours
  from then on. A new entity's backend side is written by hand against the
  spec, following `backend/app/routers/widgets.py`;
  `npm run verify:backend` fails until it conforms.
