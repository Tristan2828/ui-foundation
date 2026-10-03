# Add an Entity

The most-repeated task in this system: add a full CRUD entity — spec, mocks,
gateway, tests, table, form, routes — following the patterns in
`src/routes/widgets/`. This file is the only copy of the steps, written for
**any AI coding tool or a person**: follow it directly ("add a Game entity
following docs/foundation/add-an-entity.md"). In Claude Code,
`/new-entity <Name>` is a shortcut that runs this same file. It is synced
from `@tristan2828/ui-foundation` — don't edit it here.

Do not skip steps or reorder them. Replace `<Entity>` with the PascalCase
entity name (e.g. `Invoice`) and `<entity>` with its kebab-case form
(`invoice`) throughout.

## Before anything: the entity plan

**Never guess what an entity is.** Every field, type, option list and rule
comes from `docs/entities/<entity>.md` — the developer's plan, in the
format of `docs/foundation/entity-plan-template.md` (`docs/entities/widget.md`
is a filled-in example while the Widgets demo is still here).

- **The plan file exists:** it is the approved spec. Read it in full and
  build exactly what it says — no extra fields, no invented options, no
  renamed labels. If something the build needs isn't in it, stop and ask;
  don't fill the gap yourself.
- **It doesn't exist:** don't build anything yet. Work the plan out with
  the developer — ask about purpose, each field and its type, required,
  option lists, what the table shows, sorts and filters on, and ownership
  — for as long as it takes. Write `docs/entities/<entity>.md` from the
  answers, show it, and wait for an explicit go-ahead before step 1.
- **Either way, stop and raise it (don't improvise) if** the plan has an
  unresolved item under "Open questions", or needs a field type or screen
  shape the foundation doesn't support yet (the supported list is in the
  template). Write the case in `docs/BLOCKERS.md`.

1. **Add `<Entity>` to `openapi.yaml`** — schema, list, get, create, update,
   delete — exactly as the plan specifies: its fields, types, required
   fields, option lists (as enums) and length/format rules, and a list
   query parameter for each field the plan marks as a filter. Reuse the
   `Page` and error components already in the spec; do not redefine
   pagination or error shapes per entity, and leave the foundation's part
   of the spec (`/auth/*`, the error bodies) alone — `ui-foundation
   check-contract` fails verify if it changes.
2. **`npm run gen:api`** to regenerate `src/api/schema.d.ts`. Never
   hand-edit it.
3. **Add gateway tests in `tests/gateway/<entity>.test.ts`, derived from
   the spec** — `openapi.yaml` and the UI contracts (`Page<T>`, `AppError`,
   `QuerySpec`) only, never the code in `src/api/gateway/`, so the tests assert
   what the spec promises, not what an implementation happens to do. Write
   them to fail first; the gateway that makes them pass doesn't exist yet.
   - **If your tool can run an isolated subagent, use one** that can't see
     those two folders. In Claude Code that's `spec-tester`
     (`.claude/agents/spec-tester.md`), whose hook *blocks* reading it —
     the enforced version of this rule.
   - **Otherwise** write the tests yourself, now, before step 5 creates the
     gateway, and don't open that folder while writing them. It's the
     same rule, kept by discipline instead of a hook.
4. **Add MSW handlers in `src/mocks/<entity>.ts`** and register them in
   `src/mocks/handlers.ts`. **Include one deliberately sparse row** whose
   every optional field is empty at once (see `Blank Slate` in
   `src/mocks/data.ts`). Rows that all populate every field are the reason
   an "empty value" path goes untested: nothing ever loads a record with a
   field unset, so an em dash that never renders, or a form control showing
   a raw sentinel instead of a "not set" label, passes `verify` unnoticed.
   One row costs nothing and step 8 asserts it. Extend `tests/mocks/conformance.test.ts` so the
   new handlers are validated against `openapi.yaml`, the same way
   `widgets`/`categories` already are.
5. **Add a gateway module in `src/api/gateway/<entity>.ts`** until step 3's
   tests pass, built on `safeFetch`/`toAppError` from
   `@tristan2828/ui-foundation/gateway` (see `src/api/gateway/widgets.ts`).
   Wire → `Page<T>` / `AppError` translation only; no hand-written types
   (everything comes from `schema.d.ts`).
6. **Copy the widgets reference files, one for one, not just the two
   screens** — shaped by the plan: table columns and sortable columns from
   its "List" column, toolbar filters from its "Filter" column, form fields
   and labels from its field table, and field types by pattern (a
   `reference` field copies Category's searchable combobox, a
   `single choice` copies Status's select, a `date-time` copies
   Available From's date picker, a `yes/no` copies In Stock — a `Switch`
   (`@tristan2828/ui-foundation/ui/switch`) in a horizontal `Field` with
   its label beside it on the form, cell pattern 12 (the word Yes/No) in
   the table, and a three-way toolbar `Select` (either / yes / no) whose URL
   value is `'true'`/`'false'` and whose `filters` value is a real boolean,
   so `false` reaches the wire — and a `multi choice` copies Tags — the
   `<MultiChoice>` control from the foundation on the
   form and as a toolbar filter via `useTableUrlState`'s multi filters,
   badges in the table, and a `filters` array the gateway sends as a
   repeated parameter — and a `multi reference` copies Extra Categories:
   the `<MultiReference>` control on the form and as a toolbar filter, an
   array of ids on the wire, a repeated any-of list filter, and names from
   a **lookup by id** on the referenced entity
   (`GET /categories?ids=1&ids=3`, `getCategoriesByIds`,
   `useCategoriesByIdsQuery`). Add that `ids` parameter to the referenced
   entity's list endpoint if it lacks one. Never name a picked id from
   search results alone: a saved pick the current search doesn't return
   would show without a name. The table looks up every id on its page in
   one request; the backend rejects an unknown id as a 422 on the field,
   never a foreign-key 500 — and each **sub-records** list copies
   Checklist: an array of item objects on the wire, read and written
   whole and in order (no item ids), a child table with a `position`
   column, react-hook-form's `useFieldArray` feeding the foundation's
   `<ListEditor>` inside a `FieldSet`/`FieldLegend` on the form, each row's
   controls named by position ("Item 2 text"), a per-item `FieldError`
   (a server 422 at `["body", "checklist", 2, "text"]` arrives as
   `fieldErrors["checklist.2.text"]` and binds to that row), and a summary
   in the table, never the items — and a `computed` field copies
   Progress (`checklistState`): `readOnly` in `openapi.yaml` and absent
   from `<Entity>Create`/`<Entity>Update`, one SQL expression in the
   router that the filter and sort use (correlated `EXISTS`, or a scalar
   subquery for a count, so they hold across pages), a Python mirror on
   the model for the value each row reads back with, a test that the two
   agree for every value, the mocks recomputing it on every write and
   ignoring any client-sent value, a read-only column and a filter, and
   nothing on the form):

   **Keep column definitions stable.** Build them once
   (`useMemo(() => build<Entity>Columns(), [])`) from nothing that loads
   later. TanStack's `flexRender` treats each column's `cell` as a
   component, so rebuilt columns remount every cell: focus is lost and the
   table flickers when, say, reference names arrive after the rows. Data
   that arrives later reaches the cells through context, as
   `category-names.tsx` does for category names.
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
     `src/routes/<entity>/<entity>-table.tsx` — thin consumer of the
     foundation's `<DataTable>`. Swap the type, columns, and toolbar
     filters.
   - `src/routes/widgets/widget-form.tsx` →
     `src/routes/<entity>/<entity>-form.tsx` — thin consumer of the
     foundation's `<EntityForm>` (its `danger` slot takes an edit-only
     delete). Swap the zod schema and fields.

   **`<SelectValue>` shows the value, not the label.** Base UI renders the
   raw *value*, and `placeholder` only applies when the value is `null`.
   Any `Select` whose "nothing chosen" state is a sentinel rather than
   `null` therefore displays that sentinel on screen unless you pass the
   children function. This bit every `Select` in the first app built on
   this foundation. Two cases, both needing it:

   - **A toolbar filter**, where "no filter" is `'all'` — copied straight
     from `widgets-table.tsx`, which now carries the shape to copy: a
     label constant read by both the trigger and its `<SelectItem>`.
   - **An optional `single choice` field**, which Widget has no example of
     (its `status` is required and its `categoryId` is a combobox). A Base
     UI `Select` item's value cannot be `''`, so the field's own unset
     value is remapped through a sentinel:

     ```tsx
     const UNSET = '__unset__'
     const UNSET_LABEL = 'Not set'   // the plan's "not set" label
     // ...
     <Controller
       control={form.control}
       name="priority"
       render={({ field }) => (
         <Select
           value={field.value === '' ? UNSET : field.value}
           onValueChange={(value) => field.onChange(value === UNSET ? '' : value)}
         >
           <SelectTrigger id="<entity>-priority">
             {/* Without this the trigger reads the literal "__unset__" */}
             <SelectValue>{(value) => (value === UNSET ? UNSET_LABEL : value)}</SelectValue>
           </SelectTrigger>
           <SelectContent>
             <SelectItem value={UNSET}>{UNSET_LABEL}</SelectItem>
             {PRIORITIES.map((option) => (
               <SelectItem key={option} value={option}>{option}</SelectItem>
             ))}
           </SelectContent>
         </Select>
       )}
     />
     ```

     The zod schema keeps `''` as the unset value and converts it to
     `null` on the way to the wire, the way `widget-schema.ts` already
     handles a blank `assigneeEmail`. Step 8's specs must assert the
     **unset** display, not only a picked one — a select whose enum values
     equal their labels passes either way, which is exactly how this
     shipped unnoticed.

   **Choosing how each column looks.** The plan says what a field *means*,
   not how its cell should render. For most columns plain text is right and
   there is nothing to decide. Where there is:

   - [`cell-patterns.md`](cell-patterns.md) is the catalogue — icon + label,
     icon in a badge, icon-only with a tooltip, enum → tone-mapped badge,
     clustered multi-value, link button, relative date, ordinal scale,
     summary + popover — each with the parts a first attempt gets wrong.
     They are markup to copy, not components to import.
   - If the developer doesn't have a preference, don't pick for them and
     don't guess: follow [`column-options.md`](column-options.md) to build
     a short page of numbered options over the same sample rows, and let
     them choose. That is how every pattern in the catalogue was picked.
   - Any colour involved: [`design-language.md`](design-language.md). Most
     values should stay grey, and colour is never the only signal.
7. **Register routes** for `/<entity>`, `/<entity>/new`,
   `/<entity>/:id/edit` in `src/App.tsx`, and add a nav entry to
   `src/nav.ts`.
8. **Add Playwright specs for both screens**, one test per state
   (`loading`, `empty`, `error`, `validation`, `success`), forced through
   MSW overrides — `forceMswOverride`, `waitForMswReady` and the
   `window.__msw` handle from `@tristan2828/ui-foundation/testing`, and
   `e2e/widgets-table.spec.ts`/`e2e/widget-form.spec.ts` for the pattern.
   States forced via a first-load init script (loading, load-time error)
   need `page.addInitScript` before navigation; states forced after the
   page is already up (a mutation's error response) can use a
   post-navigation `worker.use()` call gated on
   `waitForFunction(() => window.__msw !== undefined)`. To stub what an
   `<img>` loads (a cover or avatar cell), give the override `bodyBase64`
   and `contentType` instead of `body` — a JSON body makes the image fire
   `onError` — and stub it through the override, never `page.route`,
   which cannot see requests the MSW service worker makes
   (`e2e/msw-contract.spec.ts` has an example).
9. **Register the nav entry and route names** in `e2e/shell.spec.ts`'s
   `NAV_ENTRIES` so the shell smoke test covers the new screen, and add
   `/<entity>/new` to `e2e/a11y.spec.ts`'s `formRoutes` (the table page is
   picked up from the sidebar automatically; the form isn't in it).
10. **`npm run verify`.** Fix until it passes. Then stop — do not add
    anything beyond what this list covers; note ideas in the app's
    backlog instead.

## What not to copy

- `src/api/gateway/widgets.ts`, `src/mocks/data.ts`, `src/mocks/handlers.ts`
  are demo-domain content — write the entity's own versions rather than
  adapting these by find-and-replace.
- The composites (`DataTable`, `EntityForm`, `ErrorState`, `AppShell`)
  are the foundation's and shared by every app. If a new entity needs a
  capability they don't have (a new field-type widget, say), don't copy
  one into `src/` to change it: raise it for the foundation (AGENTS.md
  "Changing the Foundation") and build the screen once the release ships.
