# UI Foundation

![verify](https://github.com/Tristan2828/ui-foundation/actions/workflows/verify.yml/badge.svg)

A reusable UI foundation for personal database-backed apps, built and maintained primarily by AI coding agents.

This foundation is explicitly not trying to be polished. It's trying to be reusable — see the Decision Ledger in the build plan for why. "Reusable" is proven by Phase 7: a fresh agent with no memory of this repo builds a new entity screen entirely from the published registry, with zero edits here.

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
| Full plan, decision ledger, architecture, exit criteria | [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) |

## For humans

```bash
npm install
npm run dev            # http://localhost:5173
npm run verify         # full gate: types, lint, dependency allowlist, unit tests, Playwright
npm run verify:fast    # inner loop, no Playwright
```

> [!NOTE]
> Don't review this code by reading it — that's not how it's meant to be checked. `npm run verify` passing is the only thing that certifies a change is good; see "Verification Strategy" in the build plan.

## For agents

Start with [`AGENTS.md`](AGENTS.md) (imported by `CLAUDE.md` for Claude Code). It has every hard rule and names the mechanical check that enforces it. The most common task — adding a new entity end to end — is documented at [`docs/add-an-entity.md`](docs/add-an-entity.md) and shipped as the `/new-entity <Name>` skill.

## Backend (Phase 8, optional)

The UI runs fully on MSW with no backend at all. `backend/` is a FastAPI + SQLModel + Alembic implementation of `openapi.yaml`, for testing the contract against a real database:

```bash
bash backend/scripts/dev.sh   # Postgres (Docker) + venv + migrations + API, http://localhost:8000

# in another shell, from the repo root:
VITE_API=real npm run dev     # proxies /api to the backend
```

Log in with the seeded dev user: `dev@example.com` / `dev-password-123` (`backend/.env.example` — override `SEED_USER_EMAIL`/`SEED_USER_PASSWORD` before this ever runs against a real deployment).

`backend/scripts/dev.sh` does what used to be five manual commands (`docker compose up`, create/activate a venv, `pip install -e`, `alembic upgrade head`, `uvicorn --reload`) in one call, idempotently — safe to re-run. For the backend's own verify gate (mypy + pytest + spec conformance), see `backend/scripts/verify.sh`.

See [`docs/phases/phase-8.md`](docs/phases/phase-8.md) for what's built. To run against a hosted Postgres (e.g. Supabase) instead of the local Docker Compose one, see [`docs/cloud-postgres.md`](docs/cloud-postgres.md).

Widgets are private to the user who created them (categories are shared). If you serve the built SPA from FastAPI (`npm run build`, then run the backend), deep links like `/widgets/3/edit` fall back to `index.html` for client-side routing.

## Consuming this as a registry

Latest tag is `v1.5.0`. Use the shadcn CLI version pinned in [`deps-allowlist.json`](deps-allowlist.json):

```bash
npx shadcn@4.21.0 add Tristan2828/ui-foundation/starter#v1.5.0
```

## Contributing

Invite-only for now — see [`CONTRIBUTING.md`](CONTRIBUTING.md) for the branch/PR/verify workflow.

## License

[MIT](LICENSE)
