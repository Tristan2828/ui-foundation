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
| Row virtualization | A table exceeds ~5k rows |
| Error reporting | An app is actually deployed |
| Dependency-allowlist enforcement for `backend/pyproject.toml`, mirroring `deps-allowlist.json`/`check-deps.mjs` on the npm side | The backend gains a second contributor/session where an unreviewed Python dependency is a real risk — Phase 8 pinned versions by hand with no mechanical gate |

## Excluded

- **npm package** — forfeits open-code editability, the reason for this stack
- **Custom primitives** — shadcn's are already yours to edit
- **Theme switcher UI** — build the token architecture, not the feature
- **SSR / SEO tooling** — irrelevant for personal database applications
