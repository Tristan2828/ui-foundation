# Deferred and Excluded

Out-of-scope ideas land here, never in code. See `docs/BUILD-PLAN.md` for the
full rationale behind each row.

## Deferred

| Item | Revisit when |
|---|---|
| Login rate limiting / lockout on repeated failed attempts | The app is exposed somewhere a brute-force attempt is a real threat model, not a personal/local deployment. **Still deferred as of Phase 11** (docs/phases/phase-11.md) — flagged there as a real gap self-service registration widens, not yet picked up |
| Additional themes | A second app needs a distinct look |
| Monorepo | Two or more consuming apps share a release cycle |
| TypeScript 7 (native compiler) | typescript-eslint, openapi-typescript and Storybook's react-docgen-typescript all support it. TS 7's package exposes no classic JS API (`require('typescript')` has only `version`), and all three are built on that API — typescript-eslint caps at `<6.1` even in its v9 alpha. The tsconfigs are already TS 7-clean (no `baseUrl`, which TS 7 drops). When revisiting, also drop the `openapi-typescript` → `typescript` entry in `package.json`'s `overrides` once openapi-typescript's own peer range covers the installed TypeScript |
| Read-only entity path in the playbook (`/new-entity` for a list/detail table with no create, edit or delete — today it always builds full CRUD, and the near-term focus is display tables; see `docs/ARCHITECTURE.md` "Focus") | The first real app needs a read-only table. Build it against that app's actual screen, not in advance |
| Notion API as a data source — a thin backend that serves `openapi.yaml` from a Notion database instead of Postgres (the choice is documented in `docs/consuming.md`) | A real project picks Notion as its source of truth. Build it against that project's actual database and property types, not a hypothetical one |
| Row virtualization | A table exceeds ~5k rows |
| `AppError` kinds for 403 (`forbidden`) and 409 (`conflict`) — today both render as the generic `server` error | A backend actually returns either. None does now: another user's widget is a deliberate 404 and a duplicate email is a 422. Considered and not built in audit Phase D (`docs/phases/audit-phase-d.md`) |
| Error reporting | An app is actually deployed |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `deps-allowlist.json`/`check-deps.mjs` on the npm side | The backend gains a second contributor/session where an unreviewed Python dependency is a real risk — Phase 8 pinned versions by hand with no mechanical gate |
| Column-level documentation convention for the Postgres backend — `COMMENT ON TABLE`/`COMMENT ON COLUMN` on every table, required whenever a column's meaning isn't obvious from its name/type. No existing convention (zero `COMMENT ON` usage anywhere in `backend/` today) and no mechanical check. Found while planning a Game List app whose `game_ratings` table needs to be understood by a second, context-free agent with direct read-write Postgres access and no view of `openapi.yaml` or this repo | That app's migration actually ships `COMMENT ON` for real (its own plan documents the convention and a Row-Level Security policy alongside it); once proven there, decide whether it graduates to a Hard Rule with a mechanical check across `backend/`, the way other Hard Rules are enforced |

## Excluded

- **npm package** — forfeits open-code editability, the reason for this stack
- **Custom primitives** — shadcn's are already yours to edit
- **Theme switcher UI** — build the token architecture, not the feature
- **SSR / SEO tooling** — irrelevant for personal database applications
