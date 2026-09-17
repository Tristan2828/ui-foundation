# Add an Entity

The most-repeated task in this system: add a full CRUD entity — spec, mocks,
gateway, tests, table, form, routes — following the patterns in
`src/routes/widgets/`. This is the human-readable version of the playbook;
`.claude/skills/new-entity/SKILL.md` is the same steps as an invocable skill
(`/new-entity <Name>`).

Do not skip steps or reorder them. Replace `<Entity>` with the PascalCase
entity name (e.g. `Invoice`) and `<entity>` with its kebab-case form
(`invoice`) throughout.

0. **Bootstrap, only if `package.json` has no `gen:api` script** (a sign
   this is the first entity added since installing the registry — the
   registry ships files and npm `dependencies`/`devDependencies`, but has
   no way to merge npm scripts into `package.json` for you). If missing,
   add exactly these six scripts:
   ```json
   "gen:api": "openapi-typescript ./openapi.yaml -o ./src/api/schema.d.ts",
   "verify:fast": "npm run gen:api && git diff --exit-code -- src/api/schema.d.ts && tsc -b && eslint . --max-warnings 0 && node scripts/check-deps.mjs && vitest run",
   "verify": "npm run verify:fast && playwright test",
   "storybook": "storybook dev -p 6006",
   "build-storybook": "storybook build",
   "preview-storybook": "vite preview --outDir storybook-static --port 6006 --strictPort"
   ```
   Then, only if `public/mockServiceWorker.js` doesn't exist yet, run
   `npx msw init public/ --save` once so the MSW service worker installed
   by `starter` actually registers. Do not add an `openapi.yaml` freeze
   check here — that discipline is specific to the ui-foundation repo's
   own frozen `Widgets` demo (see `docs/BUILD-PLAN.md` if present), not to
   a spec you are actively extending.

   Also, only if `e2e/storybook-visual.spec.ts-snapshots/` doesn't exist
   yet, run
   `npx playwright test e2e/storybook-visual.spec.ts --update-snapshots`
   once to generate this machine's own dark-mode screenshot baselines for
   every primitive's Storybook story (`src/components/ui/*.stories.tsx`).
   These are never shipped by the registry — GitHub's API can't reliably
   serve binary files to the `gh` CLI (confirmed: `gh api` corrupts PNG
   content requested via the raw-content header, independent of anything
   in this registry), and baselines are machine/OS-specific regardless
   (font rasterization differs — see `docs/BUILD-PLAN.md` Phase 3 if
   present), so shipping one machine's images to another's would be the
   wrong fix even if it worked. Commit the generated PNGs once satisfied
   they look right.
1. **Add `<Entity>` to `openapi.yaml`** — schema, list, get, create, update,
   delete. Reuse the `Page` and error components already in the spec; do
   not redefine pagination or error shapes per entity.
2. **`npm run gen:api`** to regenerate `src/api/schema.d.ts`. Never
   hand-edit it.
3. **Add gateway tests in `tests/gateway/<entity>.test.ts`, derived from
   the spec.** Use the `spec-tester` subagent for this step — it cannot
   read `src/api/gateway/` or `src/api/transport/`, so its tests assert
   what the spec promises, not what an implementation happens to do. Write
   the tests to fail first; the gateway that makes them pass does not
   exist yet.
4. **Add MSW handlers in `src/mocks/<entity>.ts`** and register them in
   `src/mocks/handlers.ts`. Extend `tests/mocks/conformance.test.ts` so the
   new handlers are validated against `openapi.yaml`, the same way
   `widgets`/`categories` already are.
5. **Add a gateway module in `src/api/gateway/<entity>.ts`** until step 3's
   tests pass. Wire → `Page<T>` / `AppError` translation only; no
   hand-written types (everything comes from `schema.d.ts`).
6. **Copy the widgets reference files, one for one, not just the two
   screens:**
   - `src/routes/widgets/use-widgets.ts`, `use-categories.ts` →
     `src/routes/<entity>/use-<entity>.ts` (TanStack Query hooks over the
     new gateway module)
   - `src/routes/widgets/widget-schema.ts` →
     `src/routes/<entity>/<entity>-schema.ts` (zod schema mirroring
     `<Entity>Create`/`<Entity>Update`, plus the form ↔ wire conversion
     functions — see `widgetToFormValues`/`formValuesToWidgetCreate` for
     the shape)
   - `src/routes/widgets/widgets-columns.tsx` →
     `src/routes/<entity>/<entity>-columns.tsx` (column defs; split any
     row-action dialogs into their own file, as
     `delete-widget-action.tsx` does — a fast-refresh hazard otherwise)
   - `src/routes/widgets/widgets-table.tsx` →
     `src/routes/<entity>/<entity>-table.tsx` — thin consumer of
     `<DataTable>` (`src/components/app/data-table.tsx`). Swap the type,
     columns, and toolbar filters; do not fork `<DataTable>` itself.
   - `src/routes/widgets/widget-form.tsx` →
     `src/routes/<entity>/<entity>-form.tsx` — thin consumer of
     `<EntityForm>` (`src/components/app/entity-form.tsx`). Swap the zod
     schema and fields; do not fork `<EntityForm>` itself.
7. **Register routes** for `/<entity>`, `/<entity>/new`,
   `/<entity>/:id/edit` in `src/App.tsx`, and add a nav entry to
   `src/components/app/app-shell.tsx`'s sidebar.
8. **Add Playwright specs for both screens**, one test per state
   (`loading`, `empty`, `error`, `validation`, `success`), forced through
   MSW overrides — see `src/mocks/e2e-hooks.ts`'s
   `window.__E2E_MSW_OVERRIDE__` protocol and
   `e2e/widgets-table.spec.ts`/`e2e/widget-form.spec.ts` for the pattern.
   States forced via a first-load init script (loading, load-time error)
   need `page.addInitScript` before navigation; states forced after the
   page is already up (a mutation's error response) can use a
   post-navigation `worker.use()` call gated on
   `waitForFunction(() => window.__msw !== undefined)`.
9. **Register the nav entry and route names** in `e2e/shell.spec.ts`'s
   `NAV_ENTRIES` so the shell smoke test covers the new screen.
10. **`npm run verify`.** Fix until it passes. Then stop — do not add
    anything beyond what this list covers; note ideas in
    `docs/DEFERRED.md` instead.

## What not to copy

- `src/api/gateway/widgets.ts`, `src/mocks/data.ts`, `src/mocks/handlers.ts`
  are demo-domain content, not foundation code — write the entity's own
  versions rather than adapting these by find-and-replace.
- `src/components/app/data-table.tsx`, `entity-form.tsx`, `error-state.tsx`,
  `app-shell.tsx` are shared composites. Extend them in place if a new
  entity needs a capability they don't have yet (a new field-type widget,
  say) — do not fork a per-entity copy.
