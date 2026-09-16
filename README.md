# UI Foundation

![verify](https://github.com/Tristan2828/ui-foundation/actions/workflows/verify.yml/badge.svg)

A reusable UI foundation for personal database-backed apps, built and maintained primarily by AI coding agents.

**Stack:** Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (Base UI primitives) · **Distribution:** private GitHub shadcn registry · **Backend:** FastAPI + SQLModel + PostgreSQL, added after the UI has proven the contract on its own (Phase 8).

This foundation is explicitly not trying to be polished. It's trying to be reusable — see the Decision Ledger in the build plan for why. "Reusable" is proven by Phase 7: a fresh agent with no memory of this repo builds a new entity screen entirely from the published registry, with zero edits here.

## Status

Current phase and what's next: see the latest report in [`docs/phases/`](docs/phases). Full plan, decision ledger, architecture, and exit criteria for every phase: [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md).

## For humans

```bash
npm install
npm run dev          # http://localhost:5173
npm run verify        # full gate: types, lint, dependency allowlist, unit tests, Playwright
npm run verify:fast   # inner loop, no Playwright
```

Don't review this code by reading it — that's not how it's meant to be checked. `npm run verify` passing is the only thing that certifies a change is good; see "Verification Strategy" in the build plan.

## For agents

Start with [`AGENTS.md`](AGENTS.md) (imported by `CLAUDE.md` for Claude Code). It has every hard rule and names the mechanical check that enforces it. The most common task — adding a new entity end to end — is documented at `docs/add-an-entity.md` and shipped as an invocable skill once Phase 6 lands.

## Backend (Phase 8, optional)

The UI runs fully on MSW with no backend at all. `backend/` is a FastAPI +
SQLModel + Alembic implementation of `openapi.yaml`, for testing the
contract against a real database:

```bash
docker compose up -d                                   # Postgres only
cd backend
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"
.venv/Scripts/alembic upgrade head
.venv/Scripts/uvicorn app.main:app --reload             # http://localhost:8000
.venv/Scripts/python -m mypy app && .venv/Scripts/python -m pytest

# in another shell, from the repo root:
VITE_API=real npm run dev                               # proxies /api to the backend
```

See `docs/phases/phase-8.md` for what's built and `docs/DEFERRED.md` for
the planned cloud-Postgres (Supabase) alternative to the local Docker
Compose Postgres.

## Consuming this as a registry

Once a version is tagged (Phase 6+):

```bash
npx shadcn@<pinned> add Tristan2828/ui-foundation/starter#v1.0.0
```

Requires `gh auth login`, or `GH_TOKEN` set to a fine-grained PAT with read-only Contents access, since this is a private repo.

## License

Private and unpublished. Not intended for use outside this owner's own projects.
