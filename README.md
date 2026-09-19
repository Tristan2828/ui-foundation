# UI Foundation

![verify](https://github.com/Tristan2828/ui-foundation/actions/workflows/verify.yml/badge.svg)

A reusable UI foundation for personal database-backed apps, built and maintained primarily by AI coding agents.

This foundation is explicitly not trying to be polished. It's trying to be reusable — see the Decision Ledger in the (historical) build plan for why. "Reusable" is proven by a Fresh UI Build (`scripts/consume-test.sh`, first done in Phase 7): a fresh agent with no memory of this repo builds a new entity screen entirely from the published registry, with zero edits here.

## Contents

- [Stack](#stack)
- [Status](#status)
- [For humans](#for-humans)
- [For agents](#for-agents)
- [Backend (Phase 8, optional)](#backend-phase-8-optional)
- [Consuming this as a registry](#consuming-this-as-a-registry)
- [Contributing](#contributing)
- [License](#license)

## Stack

| Layer | Technology |
| --- | --- |
| Build tool | Vite |
| Framework | React 19 + TypeScript |
| Styling | Tailwind v4 |
| Components | shadcn/ui (Base UI primitives) |
| Distribution | GitHub shadcn registry |
| Backend | FastAPI + SQLModel + PostgreSQL — added after the UI has proven the contract on its own (Phase 8) |

## Status

| What | Where |
| --- | --- |
| At-a-glance phase checklist | [`docs/STATUS.md`](docs/STATUS.md) |
| Full narrative per phase | [`docs/phases/`](docs/phases) |
| How it fits together, and which checks a change needs | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| The original build plan and decision ledger (historical) | [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) |

## For humans

```bash
npm install
npm run dev            # http://localhost:5173
npm run verify         # full gate: types, lint, dependency allowlist, unit tests, Playwright
npm run verify:fast    # inner loop, no Playwright
```

> [!NOTE]
> Don't review this code by reading it — that's not how it's meant to be checked. `npm run verify` passing is the only thing that certifies a change is good; see "Verification" in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## For agents

Any AI coding tool works here. Start with [`AGENTS.md`](AGENTS.md) — the cross-tool instruction file (Codex, Cursor, Copilot, Gemini CLI and others read it; `CLAUDE.md` imports it for Claude Code). It has every hard rule and names the mechanical check that enforces it. The most common task — adding a new entity end to end — is plain instructions at [`docs/add-an-entity.md`](docs/add-an-entity.md), starting from a plan in [`docs/entities/`](docs/entities); Claude Code also has a `/new-entity <Name>` shortcut to it.

## Backend (Phase 8, optional)

The UI runs fully on MSW with no backend at all. `backend/` is a FastAPI + SQLModel + Alembic implementation of `openapi.yaml`, for testing the contract against a real database:

```bash
cp backend/.env.example backend/.env   # local Docker Postgres by default — no account needed
bash backend/scripts/dev.sh             # Docker Postgres + venv + migrations + API, http://localhost:8000

# in another shell, from the repo root:
VITE_API=real npm run dev     # proxies /api to the backend
```

Log in with the seeded dev user: `dev@example.com` / `dev-password-123`. Deploying for real? Follow [`docs/deploy.md`](docs/deploy.md) — with `APP_ENV=production` the backend refuses to start while that password still works.

The backend's database is the local Docker Compose Postgres by default (needs Docker running). `backend/scripts/dev.sh` starts it, creates the venv, installs, runs `alembic upgrade head` and starts `uvicorn --reload` in one call, idempotently — safe to re-run. **Supabase is the cloud choice** for an app that needs real, shared or deployed data: [`docs/cloud-postgres.md`](docs/cloud-postgres.md) covers switching, including the pooler port and root-CA gotchas. `scripts/check-backend-postgres.sh` always uses the local database, so automated runs never write test users into a cloud one. For the backend's own verify gate (mypy + pytest + spec conformance), see `backend/scripts/verify.sh`.

See [`docs/phases/phase-8.md`](docs/phases/phase-8.md) for what's built.

Widgets are private to the user who created them (categories are shared). If you serve the built SPA from FastAPI (`npm run build:real` — a plain `npm run build` bundles the mocks — then run the backend), deep links like `/widgets/3/edit` fall back to `index.html` for client-side routing.

## Consuming this as a registry

Latest tag is `v2.1.0` (2.0.0 was the first stable release — [`CHANGELOG.md`](CHANGELOG.md)). Use the shadcn CLI version pinned in [`deps-allowlist.json`](deps-allowlist.json):

```bash
npx shadcn@4.21.0 add Tristan2828/ui-foundation/starter#v2.1.0
```

**Starting a new app?** Point any AI tool at [`docs/create-an-app.md`](docs/create-an-app.md) — it stands the app up and verifies it, ready for your first entity plan. Installed files are yours from then on. To take a later release safely (never `--overwrite` an app with entities), or to get the backend, see [`docs/consuming.md`](docs/consuming.md).

## Contributing

Invite-only for now — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branch/PR/verify workflow.

## License

[MIT](LICENSE)
