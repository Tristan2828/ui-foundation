# UI Foundation

[![npm](https://img.shields.io/npm/v/@tristan2828/ui-foundation)](https://www.npmjs.com/package/@tristan2828/ui-foundation)
[![verify](https://github.com/Tristan2828/ui-foundation/actions/workflows/verify.yml/badge.svg)](https://github.com/Tristan2828/ui-foundation/actions/workflows/verify.yml)
[![release](https://github.com/Tristan2828/ui-foundation/actions/workflows/release.yml/badge.svg)](https://github.com/Tristan2828/ui-foundation/actions/workflows/release.yml)

Shared code for small, contract-first, database-backed web apps (tables of
rows, sometimes with editing), built and maintained mostly by AI coding
agents.

- **[`@tristan2828/ui-foundation`](packages/ui-foundation)**, an npm package
  with everything apps share: shadcn primitives, the `DataTable`,
  `EntityView` and `EntityForm` composites, an app shell with session-cookie auth, the
  gateway's error seam, design tokens, lint rules, Playwright suites, and
  the conventions an agent follows (synced into each app). Apps get fixes
  by bumping its version.
- **[The template](template)**, a working app with one demo entity and a
  FastAPI reference backend. It is what every new app starts as, and is the
  app's own from then on.

Stack: Vite, React 19, TypeScript, Tailwind v4, shadcn/ui on Base UI,
React Router 7, TanStack Query; FastAPI + SQLModel + PostgreSQL behind an
OpenAPI contract the app owns. The UI runs fully on MSW mocks with no
backend at all.

**→ [Latest release](https://github.com/Tristan2828/ui-foundation/releases/latest)**
· [Changelog](CHANGELOG.md)

## Using it

| To | Read |
|---|---|
| Start a new app (any AI tool, or by hand) | [`docs/create-an-app.md`](docs/create-an-app.md) |
| Upgrade an app, change the foundation from an app, pick a data source, move a 2.x app onto the package | [`docs/consuming.md`](docs/consuming.md) |
| See what the package exports | [`packages/ui-foundation/README.md`](packages/ui-foundation/README.md) |

Upgrading an app is:

```bash
npm install @tristan2828/ui-foundation@<version>
npx ui-foundation sync
npm run verify
```

## Working on the foundation

```bash
npm install                             # workspaces; builds the package
npx playwright install --with-deps chromium
npm run dev                             # the template on http://localhost:5173, mock API
npm run verify                          # the full gate — what CI runs
```

Agents start at [`AGENTS.md`](AGENTS.md). It is the cross-tool instruction
file (Codex, Cursor, Copilot, Gemini CLI and others read it; `CLAUDE.md`
imports it for Claude Code).

> [!NOTE]
> Don't review this code by reading it. `npm run verify` passing is what
> certifies a change; see "Verification" in
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

| Doc | What |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | how it fits together, why it's shared code, the gates, releasing |
| [`docs/DEFERRED.md`](docs/DEFERRED.md) | the direction (what gets built and what waits) and the queue |
| [`docs/OPERATOR.md`](docs/OPERATOR.md) | the developer's judgment calls |
| [`docs/BLOCKERS.md`](docs/BLOCKERS.md) | open items needing a decision or an action |

Invite-only for now. Every change goes through a PR: `main` requires one,
with its `verify`, `verify-backend` and `install-test` checks green. A
merge that touches the package or the template publishes a release to npm
on its own (`docs/ARCHITECTURE.md` "Releasing").

## License

[MIT](LICENSE)
