# @tristan2828/ui-foundation

[![npm](https://img.shields.io/npm/v/@tristan2828/ui-foundation)](https://www.npmjs.com/package/@tristan2828/ui-foundation)
[![release](https://github.com/Tristan2828/ui-foundation/actions/workflows/release.yml/badge.svg)](https://github.com/Tristan2828/ui-foundation/actions/workflows/release.yml)

The shared layer of a family of small, contract-first, database-backed React
apps: shadcn primitives, the `DataTable`/`EntityView`/`EntityForm`
composites, an app shell with session-cookie auth, the gateway's error seam, design tokens,
lint rules, Playwright suites, and the conventions an AI agent follows to
build on it. Apps upgrade by bumping the version.

Built for Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui on Base UI,
React Router 7 and TanStack Query. Start a new app from the template rather
than installing this by hand:
[docs/create-an-app.md](https://github.com/Tristan2828/ui-foundation/blob/main/docs/create-an-app.md).

## Entry points

| Import | What |
|---|---|
| `@tristan2828/ui-foundation` | The composites and what goes with them: `AppShell`, `DataTable`, `EntityView` (with editing in place: `EditableValue`, `editInPlace`, `inPlace`; `EditInPlaceScope` runs it on a page of the app's own), `EntityForm`, `FormDialog`, `RecordDialogRoute`, `Markdown`, `RichTextEditor` (and `preloadRichTextEditor`, `holdKeysForNextEditor`), `ErrorState`, `FoundationProviders`, `LoginRoute`, `RegisterRoute`; the hooks `useAuth`, `useTableUrlState`, `useRecordUpdate`; `createQueryClient`, `cn`; types `Page`, `AppError`, `QuerySpec`. The full list is the package's type declarations (`dist/index.d.ts`); what each part is for is in the app's `docs/foundation/` |
| `@tristan2828/ui-foundation/ui/<name>` | shadcn primitives: alert, badge, breadcrumb, button, calendar, card, checkbox, collapsible, combobox, dialog, dropdown-menu, empty, field, input, input-group, label, popover, progress, radio-group, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip |
| `@tristan2828/ui-foundation/gateway` | `safeFetch`, `toAppError`, `networkError`, `proxyAuthError` — for an app's `src/api/gateway/` only |
| `@tristan2828/ui-foundation/mocks` | MSW: `authHandlers`, `environmentHandlers`, `clientErrorHandlers`, `pushHandlers`, `resetMockAuth`, `getMockCurrentUser`, `MOCK_USER`, `startMockWorker` (mock mode's boot), `exposeMswForE2E`, among others (`dist/mocks/index.d.ts`) |
| `@tristan2828/ui-foundation/testing` | Playwright: `test` and `expect` (a page whose `goto()`/`reload()` let its `/api/` requests settle, then wait for the app's boot; `withBootWait` for a page of your own), `watchMswBypass`, `expectNoAxeViolations`, `defineA11ySuite`, `defineMockModeBannerSuite`, `defineDataEnvironmentBannerSuite`, `forceMswOverride` (`{ hold: true }` for a loading state, then `release()`), `releaseMswOverride`, `forceLoggedOut`, `waitForMswReady`, `expectDataViewsLoaded` |
| `@tristan2828/ui-foundation/eslint` | the lint rules, as a flat config: `export default [...uiFoundation()]` |
| `@tristan2828/ui-foundation/vite` | `buildInfo()` (the default export) and `pwa()`, for an app's `vite.config.ts` |
| `@tristan2828/ui-foundation/styles.css` | tokens and base styles, after `@import "tailwindcss";` |
| `@tristan2828/ui-foundation/openapi.yaml` | the part of an app's API contract the package calls: `/auth/*`, `/environment`, `/client-errors`, `/push/*` (all optional but sign-in, sign-out and `/auth/me`) and the error bodies |

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
