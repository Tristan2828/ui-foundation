# Changelog

Releases are git tags; apps install one with
`npx shadcn@4.21.0 add Tristan2828/ui-foundation/starter#<tag>`
(`docs/consuming.md`). Before 2.0.0, tags `v1.0.0`–`v1.13.0` marked the
build and its hardening, one phase at a time — that history is in
`docs/STATUS.md` and `docs/phases/`.

## 2.0.0 — 2026-09-18 — first stable release

The first release meant to be built on. What an app gets:

- **Contract-first data layer** — `openapi.yaml` → generated types → a
  gateway that turns any backend's responses into `Page<T>` / `AppError`,
  with MSW mocks so screens run with no backend.
- **Screens** — app shell with auth (session cookies, login, registration,
  expiry handling), `DataTable` (server-side sort/filter/pagination kept in
  the URL, debounced search), `EntityForm`, and a Widgets reference entity
  covering every supported field type, including multi choice.
- **Entity plans** — new entities are built from a written plan
  (`docs/entities/<entity>.md`), never guessed. `docs/add-an-entity.md` is
  plain instructions any AI tool (or person) follows; Claude Code also has
  a `/new-entity` shortcut.
- **Guardrails** — ESLint boundaries and design tokens, a dependency
  allowlist, and `npm run verify`: types, lint, unit, contract, every
  screen's loading/empty/error/success states, and accessibility in light
  and dark mode.
- **Optional backend** — FastAPI + SQLModel + Alembic implementing the
  same contract; local Docker Postgres by default, Supabase as the cloud
  choice, and a production startup check (`docs/deploy.md`).

### Changed for apps on 1.x

Apps installed from a 1.x tag own their files; take these by hand
(`docs/consuming.md`, "Taking a later release"):

- `starter` is self-contained — before, its conventions and theme files
  came from `main`, whatever tag was installed.
- Storybook is no longer installed; accessibility is checked on real
  screens (`e2e/a11y.spec.ts`).
- `/new-entity` requires a plan file; the Step 0 `verify:fast` script
  type-checks `tests/` and `e2e/`.
- `AuthContextValue` gained `error` and `retry` (`status` can be
  `'unavailable'`); `useTableUrlState` gained multi-value filters.
- Patched primitives ship with `starter`: `button`, `badge`, `combobox`,
  and `src/hooks/use-mobile.ts`.

### Not included yet

Tracked in `docs/DEFERRED.md`, each with the condition that brings it in:
read-only entities, board views, a Notion API data source, login rate
limiting, error reporting.
