# Deferred and Excluded

Out-of-scope ideas land here, never in code. See `docs/BUILD-PLAN.md` for the
full rationale behind each row.

## Deferred

| Item | Revisit when |
|---|---|
| Self-service registration | ~~Someone other than the developer needs their own account~~ — **triggered 2026-09-17; scoped as `docs/BUILD-PLAN.md` Phase 11.** Row removed once Phase 11 ships |
| Login rate limiting / lockout on repeated failed attempts | The app is exposed somewhere a brute-force attempt is a real threat model, not a personal/local deployment. **Still deferred as of Phase 11's scoping** — flagged there as a real gap self-service registration widens, not yet picked up |
| Additional themes | A second app needs a distinct look |
| Monorepo | Two or more consuming apps share a release cycle |
| Row virtualization | A table exceeds ~5k rows |
| Error reporting | An app is actually deployed |
| Cloud Postgres (e.g. Supabase) in place of local Docker Compose Postgres | ~~The developer wants to stop running Postgres locally, or a deployed backend needs a real hosted database~~ — **triggered 2026-09-17; scoped as `docs/BUILD-PLAN.md` Phase 12.** Row removed once Phase 12 ships |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `deps-allowlist.json`/`check-deps.mjs` on the npm side | The backend gains a second contributor/session where an unreviewed Python dependency is a real risk — Phase 8 pinned versions by hand with no mechanical gate |
| Storybook Controls/autodocs polish — rewrite `src/components/ui/*.stories.tsx` from static `AllVariants` renders to `args`-driven stories, add a Docs tab | ~~The developer decides it's worth it~~ — **decided 2026-09-17; scoped as `docs/BUILD-PLAN.md` Phase 13**, which authorizes the `@storybook/addon-docs` addition to `deps-allowlist.json` this row was blocked on. Row removed once Phase 13 ships |

## Excluded

- **npm package** — forfeits open-code editability, the reason for this stack
- **Custom primitives** — shadcn's are already yours to edit
- **Theme switcher UI** — build the token architecture, not the feature
- **SSR / SEO tooling** — irrelevant for personal database applications
