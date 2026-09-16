# Deferred and Excluded

Out-of-scope ideas land here, never in code. See `docs/BUILD-PLAN.md` for the
full rationale behind each row.

## Deferred

| Item | Revisit when |
|---|---|
| Storybook | 3+ custom composites, or visual regression is needed |
| Real auth | Backend language is chosen |
| Additional themes | A second app needs a distinct look |
| Monorepo | Two or more consuming apps share a release cycle |
| Row virtualization | A table exceeds ~5k rows |
| Error reporting | An app is actually deployed |
| Cloud Postgres (e.g. Supabase) in place of local Docker Compose Postgres | The developer wants to stop running Postgres locally, or a deployed backend needs a real hosted database — Phase 8 shipped `docker-compose.yml` for local dev per an explicit choice to do Docker first and cloud later |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `deps-allowlist.json`/`check-deps.mjs` on the npm side | The backend gains a second contributor/session where an unreviewed Python dependency is a real risk — Phase 8 pinned versions by hand with no mechanical gate |

## Excluded

- **npm package** — forfeits open-code editability, the reason for this stack
- **Custom primitives** — shadcn's are already yours to edit
- **Theme switcher UI** — build the token architecture, not the feature
- **SSR / SEO tooling** — irrelevant for personal database applications
