# Add an Entity

The most-repeated task in this system: add a full CRUD entity — spec, mocks,
gateway, tests, table, form, routes — following the patterns in
`src/routes/widgets/`. This file is the only copy of the steps, written for
**any AI coding tool or a person**: follow it directly ("add a Game entity
following docs/add-an-entity.md"). In Claude Code, `/new-entity <Name>` is
a shortcut that runs this same file.

Do not skip steps or reorder them. Replace `<Entity>` with the PascalCase
entity name (e.g. `Invoice`) and `<entity>` with its kebab-case form
(`invoice`) throughout.

## Before anything: the entity plan

**Never guess what an entity is.** Every field, type, option list and rule
comes from `docs/entities/<entity>.md` — the developer's plan, in the
format of `docs/entities/_template.md` (`docs/entities/widget.md` is a
filled-in example).

- **The plan file exists:** it is the approved spec. Read it in full and
  build exactly what it says — no extra fields, no invented options, no
  renamed labels. If something the build needs isn't in it, stop and ask;
  don't fill the gap yourself.
- **It doesn't exist:** don't build anything yet. Work the plan out with
  the developer — ask about purpose, each field and its type, required,
  option lists, what the table shows, sorts and filters on, and ownership
  — for as long as it takes. Write `docs/entities/<entity>.md` from the
  answers, show it, and wait for an explicit go-ahead before Step 0.
- **Either way, stop and raise it (don't improvise) if** the plan has an
  unresolved item under "Open questions", or needs a field type or screen
  shape the foundation doesn't support yet (the supported list is in the
  template). Write the case in `docs/BLOCKERS.md`.

0. **Bootstrap, only if `package.json` has no `gen:api` script** (a sign
   this is the first entity added since installing the registry — the
   registry ships files and npm `dependencies`/`devDependencies`, but has
   no way to merge npm scripts into `package.json` for you). If missing,
   add exactly these three scripts:
   ```json
   "gen:api": "openapi-typescript ./openapi.yaml -o ./src/api/schema.d.ts",
   "verify:fast": "npm run gen:api && git diff --exit-code -- src/api/schema.d.ts && tsc -b && tsc -p tsconfig.test.json && eslint . --max-warnings 0 && node scripts/check-deps.mjs && vitest run",
   "verify": "npm run verify:fast && playwright test"
   ```
   (`tsc -p tsconfig.test.json` is there because the registry can't add
   `tsconfig.test.json` to your root `tsconfig.json`'s references, so
   `tsc -b` alone never type-checks `tests/` or `e2e/`.)
   Then, only if `public/mockServiceWorker.js` doesn't exist yet, run
   `npx msw init public/ --save` once so the MSW service worker installed
   by `starter` actually registers.
1. **Add `<Entity>` to `openapi.yaml`** — schema, list, get, create, update,
   delete — exactly as the plan specifies: its fields, types, required
   fields, option lists (as enums) and length/format rules, and a list
   query parameter for each field the plan marks as a filter. Reuse the
   `Page` and error components already in the spec; do not redefine
   pagination or error shapes per entity.
2. **`npm run gen:api`** to regenerate `src/api/schema.d.ts`. Never
   hand-edit it.
3. **Add gateway tests in `tests/gateway/<entity>.test.ts`, derived from
   the spec** — `openapi.yaml` and `src/api/contracts.ts` only, never the
   code in `src/api/gateway/` or `src/api/transport/`, so the tests assert
   what the spec promises, not what an implementation happens to do. Write
   them to fail first; the gateway that makes them pass doesn't exist yet.
   - **If your tool can run an isolated subagent, use one** that can't see
     those two folders. In Claude Code that's `spec-tester`
     (`.claude/agents/spec-tester.md`), whose hook *blocks* reading them —
     the enforced version of this rule.
   - **Otherwise** write the tests yourself, now, before step 5 creates the
     gateway, and don't open either folder while writing them. It's the
     same rule, kept by discipline instead of a hook.
4. **Add MSW handlers in `src/mocks/<entity>.ts`** and register them in
   `src/mocks/handlers.ts`. Extend `tests/mocks/conformance.test.ts` so the
   new handlers are validated against `openapi.yaml`, the same way
   `widgets`/`categories` already are.
5. **Add a gateway module in `src/api/gateway/<entity>.ts`** until step 3's
   tests pass. Wire → `Page<T>` / `AppError` translation only; no
   hand-written types (everything comes from `schema.d.ts`).
6. **Copy the widgets reference files, one for one, not just the two
   screens** — shaped by the plan: table columns and sortable columns from
   its "List" column, toolbar filters from its "Filter" column, form fields
   and labels from its field table, and field types by pattern (a
   `reference` field copies Category's searchable combobox, a
   `single choice` copies Status's select, a `date-time` copies
   Available From's date picker, a `multi choice` copies Tags — the
   `<MultiChoice>` control (`src/components/app/multi-choice.tsx`) on the
   form and as a toolbar filter via `useTableUrlState`'s multi filters,
   badges in the table, and a `filters` array the gateway sends as a
   repeated parameter):
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
   `NAV_ENTRIES` so the shell smoke test covers the new screen, and add
   `/<entity>/new` to `e2e/a11y.spec.ts`'s `FORM_ROUTES` (the table page is
   picked up from the sidebar automatically; the form isn't in it).
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
