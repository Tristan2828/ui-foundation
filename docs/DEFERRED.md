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

## Excluded

- **npm package** — forfeits open-code editability, the reason for this stack
- **Custom primitives** — shadcn's are already yours to edit
- **Theme switcher UI** — build the token architecture, not the feature
- **SSR / SEO tooling** — irrelevant for personal database applications
