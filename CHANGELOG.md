# Changelog

Notable releases and what an app must do to take them. Every merge that
changes the package or the template also stages a patch release on npm,
which goes live when the developer approves it; those are listed on the
[releases page](https://github.com/Tristan2828/ui-foundation/releases).

## 3.1.0 — findings from moving Game List onto 3.0

Additive: nothing to change in an app to take it. Each item names the
Game List workaround it makes removable.

- **Collapsed sidebar clicks** (#51): on the icon rail, a hidden
  `SidebarGroupLabel` no longer takes clicks meant for the last entry of
  the group above it. Any `AppShell` with a `sidebarExtra` group hit this.
  Drop a local `group-data-[collapsible=icon]:pointer-events-none` on your
  own labels.
- **`check-contract` and optional paths** (#52): a component reachable only
  from an `x-optional` path the app leaves out may be left out too. An app
  without `/auth/register` no longer needs an unused `RegisterRequest`.
- **`defineMockModeBannerSuite` in real mode** (#53): new optional
  `mockMode`, defaulting to `process.env.VITE_API !== 'real'`. Against the
  real backend the suite asserts the banner is *absent*. The template's
  `check-backend-postgres.sh` now runs it in its real-mode pass. To do the
  same in an app, select it by title
  (`VITE_API=real npx playwright test --grep "no mock-mode banner"`), not
  by file: Playwright locates a package suite's tests in the package, so
  `playwright test e2e/mock-mode-banner.spec.ts` finds none.
- **`getMockCurrentUser()`** from `/mocks` (#54): the user the mock
  session is signed in as, or `null` when signed out. For an app's own
  handlers that act as the signed-in user, in place of `MOCK_USER`, which
  is wrong after a mock registration.

## 3.0.0 — shared code

The foundation is now an npm package, `@tristan2828/ui-foundation`, and apps
upgrade by bumping its version. Until 2.x, apps installed a copy of every
file and kept it. The first real app shows why that stopped working: it
fell seven releases behind and ended up with 16 local forks
(`docs/ARCHITECTURE.md` "Why shared code").

- **The package** holds everything apps share: the shadcn primitives
  (`@tristan2828/ui-foundation/ui/<name>`), `AppShell`, `DataTable`,
  `EntityForm`, `ErrorState`, `MultiChoice`, `PasswordInput`, the login and
  register screens, auth (`useAuth`), `Page`/`AppError`/`QuerySpec`, the
  gateway's `safeFetch`/`toAppError` (`/gateway`), MSW auth handlers and
  the e2e override (`/mocks`), the Playwright a11y and mock-banner suites
  (`/testing`), the lint config (`/eslint`) and tokens with base styles
  (`/styles.css`).
- **`ui-foundation sync`** writes the conventions into an app: a marked
  block at the top of `AGENTS.md`, `docs/foundation/` (the entity playbook
  and design docs), and the agent files. `sync --check`,
  `check-contract` (the app's spec must keep the foundation's `/auth/*` and
  error shapes) and `check-deps` run in every app's `verify:fast`.
- **The template** (`template/`) replaces the shadcn registry's `starter`
  item. `create-app.sh` copies it at a release tag and pins the package at
  the same version. There's no Vite scaffold, `shadcn init` or manual
  Step 0 any more.
- **From the first app's forks**, now configuration:
  `AppShell`'s `title`, `nav`, `sidebarExtra` and `defaultSidebarOpen`
  (the sidebar's cookie is read back); the collapsed-rail footer and a
  top-centre `Toaster` are built in; `EntityForm`'s `danger` slot;
  `LoginRoute`'s `registerPath` (`null` for an app without sign-up).
- **Checks:** Storybook accessibility and token-colour checks now cover
  every primitive the package ships, not only the patched ones. Lint
  rejects importing the package's internals, or one of its primitives from
  the app's own `src/components/ui/`.
- **Removed:** the shadcn registry (`registry.json`), the drift check and
  `foundation.json` (a package can't drift), and the per-phase history docs
  (`BUILD-PLAN.md`, `STATUS.md`, `docs/phases/`, all in git history).

**Apps on 2.x:** follow `docs/consuming.md` "Moving a 2.x app onto the
package". Registry tags `v1.0.0`–`v2.1.x` still install as before.

## 2.x — the registry, in use (2026-09-18 → 2026-09-28)

- **2.0.0**, the first stable release: contract-first data layer (OpenAPI →
  generated types → gateway → `Page<T>`/`AppError`, MSW mocks), the app
  shell with session auth, `DataTable` (URL-kept state, debounced search),
  `EntityForm`, entity plans, the lint and verify gates, and the optional
  FastAPI backend.
- **2.1.x**: `create-an-app.md` and `create-app.sh`; the two-track
  direction; semantic tones, the cell-pattern catalogue and the
  column-options step; automatic releases; the mock-mode banner,
  `PasswordInput` and `build:real`; categorical colour slots; the drift
  check; `setFilters`/`applyView`, `pinLastColumn` and the binary MSW
  override, brought back from the first real app.

## 1.x — the build (2026-09-15 → 2026-09-18)

Tags `v1.0.0`–`v1.13.0` marked the original build (scaffold, tokens,
contract, shell, reference screens, registry, the first fresh-agent build,
backend, Storybook, real auth, registration, cloud Postgres), then a
pre-reuse audit and the first real project's gaps (entity plans,
multi-select). The history is in git.
