# @tristan2828/ui-foundation

[![npm](https://img.shields.io/npm/v/@tristan2828/ui-foundation)](https://www.npmjs.com/package/@tristan2828/ui-foundation)
[![release](https://github.com/Tristan2828/ui-foundation/actions/workflows/release.yml/badge.svg)](https://github.com/Tristan2828/ui-foundation/actions/workflows/release.yml)

The shared layer of a family of small, contract-first, database-backed React
apps: shadcn primitives, the `DataTable`/`EntityForm` composites, an app
shell with session-cookie auth, the gateway's error seam, design tokens,
lint rules, Playwright suites, and the conventions an AI agent follows to
build on it. Apps upgrade by bumping the version.

Built for Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui on Base UI,
React Router 7 and TanStack Query. Start a new app from the template rather
than installing this by hand:
[docs/create-an-app.md](https://github.com/Tristan2828/ui-foundation/blob/main/docs/create-an-app.md).

## Entry points

| Import | What |
|---|---|
| `@tristan2828/ui-foundation` | `AppShell`, `DataTable`, `EntityForm`, `ErrorState`, `MultiChoice`, `MultiReference`, `PasswordInput`, `RouteErrorBoundary`, `FoundationProviders`, `LoginRoute`, `RegisterRoute`, `useAuth`, `useTableUrlState`, `useDebouncedValue`, `createQueryClient`, `cn`; types `Page`, `AppError`, `QuerySpec` |
| `@tristan2828/ui-foundation/ui/<name>` | shadcn primitives: badge, button, calendar, card, combobox, dialog, empty, field, input, input-group, label, popover, select, separator, sheet, sidebar, skeleton, sonner, spinner, switch, table, textarea, tooltip |
| `@tristan2828/ui-foundation/gateway` | `safeFetch`, `toAppError`, `networkError` — for an app's `src/api/gateway/` only |
| `@tristan2828/ui-foundation/mocks` | MSW: `authHandlers`, `resetMockAuth`, `getMockCurrentUser`, `MOCK_USER`, `exposeMswForE2E` |
| `@tristan2828/ui-foundation/testing` | Playwright: `defineA11ySuite`, `defineMockModeBannerSuite`, `forceMswOverride`, `forceLoggedOut`, `waitForMswReady` |
| `@tristan2828/ui-foundation/eslint` | the lint rules, as a flat config: `export default [...uiFoundation()]` |
| `@tristan2828/ui-foundation/styles.css` | tokens and base styles, after `@import "tailwindcss";` |
| `@tristan2828/ui-foundation/openapi.yaml` | the part of an app's API contract the package calls: `/auth/*` and the error bodies |

## The `ui-foundation` command

Run from an app's root:

- `ui-foundation sync` writes the conventions into the app: the rules block
  in `AGENTS.md`, `docs/foundation/`, and the agent files in `.claude/` and
  `.codex/`. Run it after every upgrade and commit what it writes.
  `sync --check` (in `verify`) fails when they differ from the installed
  version.
- `ui-foundation check-contract [openapi.yaml]` fails unless the app's spec
  contains the foundation's part unchanged. A path marked `x-optional` may
  be left out, and so may the components only such a path uses.
- `ui-foundation check-deps` fails if `package.json` names a dependency
  missing from `deps-allowlist.json`.

## Upgrading

```bash
npm install @tristan2828/ui-foundation@<version>
npx ui-foundation sync
npm run verify
```

Release notes: https://github.com/Tristan2828/ui-foundation/releases.

MIT licensed.
