# Deferred and Excluded

Out-of-scope ideas land here, never in code. See `docs/BUILD-PLAN.md` for the
full rationale behind each row.

## Deferred

| Item | Revisit when |
|---|---|
| Self-service registration | Someone other than the developer needs their own account — Phase 10 shipped login only, against a seeded user |
| Login rate limiting / lockout on repeated failed attempts | The app is exposed somewhere a brute-force attempt is a real threat model, not a personal/local deployment |
| Additional themes | A second app needs a distinct look |
| Monorepo | Two or more consuming apps share a release cycle |
| Row virtualization | A table exceeds ~5k rows |
| Error reporting | An app is actually deployed |
| Cloud Postgres (e.g. Supabase) in place of local Docker Compose Postgres | The developer wants to stop running Postgres locally, or a deployed backend needs a real hosted database — Phase 8 shipped `docker-compose.yml` for local dev per an explicit choice to do Docker first and cloud later |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `deps-allowlist.json`/`check-deps.mjs` on the npm side | The backend gains a second contributor/session where an unreviewed Python dependency is a real risk — Phase 8 pinned versions by hand with no mechanical gate |
| Storybook Controls/autodocs polish — rewrite `src/components/ui/*.stories.tsx` from static `AllVariants` renders to `args`-driven stories, add a Docs tab | The developer decides it's worth it. Two real costs, not just effort: (1) needs `@storybook/addon-docs` added to `deps-allowlist.json` — not there today, a deliberate human call per AGENTS.md's dependency hard rule; (2) the 12 stories are registry-shipped and keyed by 24 screenshot/axe baselines in `e2e/storybook-visual.spec.ts` — restructuring them risks the same win32-vs-Linux baseline churn Phases 3 and 9 both hit |

## Excluded

- **npm package** — forfeits open-code editability, the reason for this stack
- **Custom primitives** — shadcn's are already yours to edit
- **Theme switcher UI** — build the token architecture, not the feature
- **SSR / SEO tooling** — irrelevant for personal database applications
