---
name: new-entity
description: This skill should be used when the user asks to "add an entity", "add a new entity", "scaffold a CRUD screen", "add a resource screen", or names a new domain object (e.g. "add Invoice") that needs a spec, gateway, mocks, table, and form built following this repo's widgets reference pattern.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Add a full CRUD entity end to end: spec, mocks, gateway, tests, table,
form, routes. The entity name is given as this skill's argument — if none
was given, ask for one before proceeding. Derive the PascalCase form
(`<Entity>`, e.g. `Invoice`) and kebab-case form (`<entity>`, e.g.
`invoice`) from it.

Do not skip steps. Do not reorder them. Do not add anything beyond what
this list covers — note extra ideas in `docs/DEFERRED.md` instead of
building them.

0. Bootstrap, only if `package.json` has no `gen:api` script (a sign this
   is the first entity added since installing the registry — it ships
   files and npm dependencies, but cannot merge npm scripts into
   `package.json`). If missing, add:
   `"gen:api": "openapi-typescript ./openapi.yaml -o ./src/api/schema.d.ts"`,
   `"verify:fast": "npm run gen:api && git diff --exit-code -- src/api/schema.d.ts && tsc -b && eslint . --max-warnings 0 && node scripts/check-deps.mjs && vitest run"`,
   `"verify": "npm run verify:fast && playwright test"`,
   `"storybook": "storybook dev -p 6006"`,
   `"build-storybook": "storybook build"`,
   `"preview-storybook": "vite preview --outDir storybook-static --port 6006 --strictPort"`.
   Then, only if the root `tsconfig.json`'s `references` array has no
   `{ "path": "./tsconfig.test.json" }` entry, add one (the registry ships
   that file but can't edit your root `tsconfig.json`; without it `tsc -b`
   never type-checks `tests/` or `e2e/`). Then, only if
   `public/mockServiceWorker.js` doesn't exist yet, run
   `npx msw init public/ --save` once. Do not add an openapi.yaml freeze
   check — that's specific to this repo's own frozen `Widgets` demo, not
   to a spec you are actively extending. Also, only if
   `e2e/storybook-visual.spec.ts-snapshots/` doesn't exist yet, run
   `npx playwright test e2e/storybook-visual.spec.ts --update-snapshots`
   once to generate this machine's own dark-mode screenshot baselines for
   every primitive's Storybook story — these are never shipped by the
   registry (the `gh` CLI corrupts binary files fetched from GitHub, and
   baselines are machine/OS-specific regardless). Commit the generated
   PNGs.
1. Add `<Entity>` to `openapi.yaml` — schema, list, get, create, update,
   delete. Reuse the existing `Page` and error components; do not
   redefine pagination or error shapes per entity.
2. Run `npm run gen:api` to regenerate `src/api/schema.d.ts`. Never
   hand-edit generated types.
3. Write gateway tests in `tests/gateway/<entity>.test.ts`, derived from
   the spec, using the `spec-tester` subagent (it cannot read
   `src/api/gateway/` or `src/api/transport/`, so its tests assert what
   the spec promises, not what an implementation happens to do). Expect
   them to fail first — the gateway that makes them pass does not exist
   yet.
4. Add MSW handlers in `src/mocks/<entity>.ts`, register them in
   `src/mocks/handlers.ts`, and extend `tests/mocks/conformance.test.ts`
   to validate them against `openapi.yaml`.
5. Add a gateway module in `src/api/gateway/<entity>.ts` until step 3's
   tests pass. Wire → `Page<T>` / `AppError` translation only.
6. Copy the widgets reference files one for one — not just the two
   screens:
   - `src/routes/widgets/use-widgets.ts` (and any sibling hooks like
     `use-categories.ts`) → `src/routes/<entity>/use-<entity>.ts`
   - `src/routes/widgets/widget-schema.ts` →
     `src/routes/<entity>/<entity>-schema.ts` — zod schema mirroring
     `<Entity>Create`/`<Entity>Update`, plus form ↔ wire conversion
     functions
   - `src/routes/widgets/widgets-columns.tsx` →
     `src/routes/<entity>/<entity>-columns.tsx` — split row-action
     dialogs into their own file (fast-refresh hazard otherwise)
   - `src/routes/widgets/widgets-table.tsx` →
     `src/routes/<entity>/<entity>-table.tsx` — thin consumer of
     `<DataTable>` (`src/components/app/data-table.tsx`); swap type,
     columns, toolbar filters, never fork the composite
   - `src/routes/widgets/widget-form.tsx` →
     `src/routes/<entity>/<entity>-form.tsx` — thin consumer of
     `<EntityForm>` (`src/components/app/entity-form.tsx`); swap the zod
     schema and fields, never fork the composite
7. Register routes for `/<entity>`, `/<entity>/new`, `/<entity>/:id/edit`
   in `src/App.tsx`, and add a nav entry to
   `src/components/app/app-shell.tsx`'s sidebar.
8. Add Playwright specs for both screens, one test per state (`loading`,
   `empty`, `error`, `validation`, `success`), forced through MSW
   overrides per `src/mocks/e2e-hooks.ts`'s
   `window.__E2E_MSW_OVERRIDE__` protocol — see
   `e2e/widgets-table.spec.ts` / `e2e/widget-form.spec.ts` for the
   pattern. States needed on first load use `page.addInitScript` before
   navigation; states forced after the page is already up use a
   post-navigation `worker.use()` call gated on
   `waitForFunction(() => window.__msw !== undefined)`.
9. Add the new route(s) to `e2e/shell.spec.ts`'s `NAV_ENTRIES`.
10. Run `npm run verify`. Fix until it passes. Then stop.

## What not to copy

`src/api/gateway/widgets.ts`, `src/mocks/data.ts`, and
`src/mocks/handlers.ts`'s widget-specific handlers are demo-domain
content — write the new entity's own versions. `data-table.tsx`,
`entity-form.tsx`, `error-state.tsx`, and `app-shell.tsx` are shared
composites — extend them in place if a capability is missing, never fork
a per-entity copy.

See `docs/add-an-entity.md` for the same steps in prose form.
