# Add an Entity

The most-repeated task in this system: add a full CRUD entity — spec, mocks,
gateway, tests, table, view, form, routes — following the patterns in
`src/routes/widgets/`. This file is the only copy of the steps, written for
**any AI coding tool or a person**: follow it directly ("add a Game entity
following docs/foundation/add-an-entity.md"). In Claude Code,
`/new-entity <Name>` is a shortcut that runs this same file. It is synced
from `@tristan2828/ui-foundation` — don't edit it here.

Do not skip steps or reorder them. Replace `<Entity>` with the PascalCase
entity name (e.g. `Invoice`) and `<entity>` with its kebab-case form
(`invoice`) throughout.

## The reference files

The steps name the template's Widgets demo as the code to copy:
`src/routes/widgets/`, `src/api/gateway/widgets.ts` and
`widget-categories.ts`, their mocks and tests. An app deletes the demo
once its own entity works, and from then on those names point at nothing.
So the app's `AGENTS.md`, below the foundation block, has a
**`### Reference files`** section: for each pattern (a table, a form, a
reference field, a multi choice and the rest), the app's own file to copy.

- **That section exists:** it wins. Wherever a step below names a demo
  file, copy the file the section names for that pattern instead. A
  pattern it doesn't list, and the demo is gone: stop and ask which file
  to copy. Never rebuild a pattern from this file's prose alone.
- **It doesn't, and the demo is still here:** copy the demo, as written.
- **When the app removes the demo:** write the section first, naming the
  file that now holds each pattern the demo showed. The template's own
  `AGENTS.md` has the section, filled in for the demo, as the shape.

The demo's referenced entity is `WidgetCategory` (`/widget-categories`,
the `widget_categories` table), named for its widget so it never collides
with an app's own entity. An app whose entity is a Category builds it
alongside the demo with no rename.

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
- **The plan's "Screens" line names a view** (`list, view, create, edit,
  delete`), and its "View screen" section says what the view shows. A plan
  written before the view existed has neither: ask the developer whether
  to add them before step 1. The reference files build the table *with* a
  view, where Edit and Delete live, so the table has no row actions.

1. **Add `<Entity>` to `openapi.yaml`** — schema, list, get, create, update,
   delete — exactly as the plan specifies: its fields, types, required
   fields, option lists (as enums) and length/format rules, and a list
   query parameter for each field the plan marks as a filter. Reuse the
   `Page` and error components already in the spec; do not redefine
   pagination or error shapes per entity, and leave the foundation's part
   of the spec (`/auth/*`, `/environment`, the error bodies) alone — `ui-foundation
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
   `widgets`/`widget-categories` already are.
5. **Add a gateway module in `src/api/gateway/<entity>.ts`** until step 3's
   tests pass, built on `safeFetch`/`toAppError` from
   `@tristan2828/ui-foundation/gateway` (see `src/api/gateway/widgets.ts`).
   Wire → `Page<T>` / `AppError` translation only; no hand-written types
   (everything comes from `schema.d.ts`).
6. **Copy the reference files, one for one, not just the two screens**
   (the Widgets demo's, or the ones the app's `### Reference files` names) — shaped by the plan: table columns and sortable columns from
   its "List" column, toolbar filters from its "Filter" column, form fields
   and labels from its field table, and field types by pattern (a
   `reference` field copies Category's searchable combobox, a
   `single choice` copies Status's select — each option shows its label,
   never its wire value, from one `Record<value, label>`
   (`WIDGET_STATUS_LABELS`) read by the options, the trigger (through
   `<SelectValue>`'s children, which otherwise shows the raw value), the
   toolbar filter and every badge — a `date-time` copies
   Available From's date picker, a `yes/no` copies In Stock — a `Switch`
   (`@tristan2828/ui-foundation/ui/switch`) in a horizontal `Field` with
   its label beside it on the form, cell pattern 12 (the word Yes/No) in
   the table, and a three-way toolbar `Select` (either / yes / no) whose URL
   value is `'true'`/`'false'` and whose `filters` value is a real boolean,
   so `false` reaches the wire — and a `multi choice` copies Tags — the
   `<MultiChoice>` control from the foundation on the
   form and as a toolbar filter via `useTableUrlState`'s multi filters,
   badges in the table, and a `filters` array the gateway sends as a
   repeated parameter; each option shows its label, never its wire value
   (`quick_win` reads "Quick win"): one `Record<value, label>`
   (`WIDGET_TAG_LABELS`) feeds `MultiChoice`'s `getLabel` and the badges — and a `multi reference` copies Extra Categories:
   the `<MultiReference>` control on the form and as a toolbar filter, an
   array of ids on the wire, a repeated any-of list filter, and names from
   a **lookup by id** on the referenced entity
   (`GET /widget-categories?ids=1&ids=3`, `getWidgetCategoriesByIds`,
   `useWidgetCategoriesByIdsQuery`), and `searching` from the search
   query's `isPlaceholderData` so Enter waits for the results that match
   what was typed. Add that `ids` parameter to the referenced
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

   **A `yes/no` marked `toggle`** copies In Stock's cell
   (`in-stock-toggle.tsx`, cell pattern 15): a `Switch` in its own
   component that PATCHes the one field through `useSaveWidgetField`, the
   entity's wrapper of the foundation's `useRecordUpdate` (the row and the
   record's view update at once and go back if the save is refused, with
   a toast naming the row and the server's reason; the lists refetch
   after). Its specs cover a flip that saves, the keyboard, and a failed
   save putting the switch back. Copy `useSaveWidgetField` whenever the
   plan has a `toggle` or any quick action, and only then.
   - `src/routes/widgets/use-widgets.ts`, `use-widget-categories.ts` →
     `src/routes/<entity>/use-<entity>.ts` (TanStack Query hooks over the
     new gateway module)
   - `src/routes/widgets/widget-schema.ts` →
     `src/routes/<entity>/<entity>-schema.ts` (zod schema mirroring
     `<Entity>Create`/`<Entity>Update`, plus the form ↔ wire conversion
     functions — see `widgetToFormValues`/`formValuesToWidgetCreate` for
     the shape. A Markdown long text is checked with `refine`, never
     trimmed, like Widget's `description`: a trim rewrites text nobody
     touched, a leading indent that makes a code block or the text's
     own ending)
   - `src/routes/widgets/widget-format.ts` →
     `src/routes/<entity>/<entity>-format.ts` (the lookups and formatters
     both the columns and the view render values with: badge variant maps,
     date and number formatters, the done-count)
   - `src/routes/widgets/widgets-columns.tsx` →
     `src/routes/<entity>/<entity>-columns.tsx` (column defs: the plan's
     title field is a link to the record's view, cell pattern 16, and
     there is no row-actions column)
   - `src/routes/widgets/widgets-table.tsx` →
     `src/routes/<entity>/<entity>-table.tsx` — thin consumer of the
     foundation's `<DataTable>`. Swap the type, columns, and toolbar
     filters. More than three filters (search, saved views aside): keep
     the most used in the toolbar and put the rest inside
     `<SecondaryFilters>`, as the template does with Extra Categories,
     Progress and In Stock. Pass it each filter that's on as an
     `ActiveFilter` (its chip text and how to take it off) and an
     `onClear` that clears them all in one `setFilters` call.
   - `src/routes/widgets/widget-view.tsx` →
     `src/routes/<entity>/<entity>-view.tsx` — thin consumer of the
     foundation's `<EntityView>`. Swap the title, badges and sections for
     the plan's "View screen" (below).
   - `src/routes/widgets/widget-quick-actions.tsx` →
     `src/routes/<entity>/<entity>-quick-actions.tsx`, **only when the
     plan's "View screen" lists `Quick actions`**: one component per
     control the plan names (below).
   - `src/routes/widgets/widget-fields.tsx` →
     `src/routes/<entity>/<entity>-fields.tsx`: **one control per field
     the plan edits in place** (`Edit in place`), shared by the form
     (through a `Controller`) and the view (through `editInPlace`), and
     the Markdown long text's `RichTextEditor` (on the form whether or
     not it edits in place), given a `placeholder` and `maxLength` (the
     schema's limit, one constant both read, like Widget's
     `DESCRIPTION_MAX_LENGTH`). Every other field's control stays inline in
     the form, as `widget-form.tsx`'s Category, Tags and Available From
     do. No `Edit in place` line and no Markdown long text: no fields
     file.
   - `src/routes/widgets/delete-widget-action.tsx` →
     `src/routes/<entity>/delete-<entity>-action.tsx` (Delete in the
     view's header: the confirm dialog, then `onDeleted` leaves for the
     list; its own file, a fast-refresh hazard otherwise)
   - `src/routes/widgets/widget-form.tsx` →
     `src/routes/<entity>/<entity>-form.tsx` — thin consumer of the
     foundation's `<EntityForm>` (its `danger` slot takes an edit-only
     delete). Swap the zod schema and fields. Every way out lands on a
     view (below).

   **The view** is the read-only page for one record, at `/<entity>/:id`
   (apart from the plan's quick actions and fields edited in place, if it
   lists any).
   `<EntityView>` owns its loading skeleton, its not-found state (another
   user's record is the same plain 404, with a way back to the list and
   no retry) and its error state with retry. The screen supplies what the
   plan's "View screen" section lists:

   - **Title and badges.** The plan's title field is the page's `<h1>`.
     Its badge fields sit beside it, each the same `Badge` and variant map
     as its table cell. Edit (a `Button` rendering a `Link` to
     `/<entity>/:id/edit`) and the delete action go in `actions`.
   - **Sections**, one per row of the plan's section table, in order.
     Fields are label/value rows (`fields`), labelled as on the form. A
     section that holds one long text or one sub-record list is a block
     (`content`) with no label of its own, since a label would only repeat
     the heading.
   - **Every value renders the way its table cell does**: badges, names
     of linked records, a done-count, from the shared lookups in
     `<entity>-format.ts`. Never re-derive one for the view.
   - **An empty value is passed through as it is** (`null`, `''`, or
     `list.length > 0 && …`), and `EntityView` shows the field's
     `emptyLabel`, the plan's "not set" label, never a blank. A yes/no is
     never empty: it reads Yes or No (cell pattern 12).
   - **A reference links to the referenced record's view** when that
     entity has one: the name, from the same lookup by id the table uses,
     inside `<Link to={`/<other>/${id}`}>`. Without a view, the plain name
     (Widget's categories have none).
   - **Sub-records are read-only** unless the plan's `Quick actions`
     names the list: the done-count, then each item in order with its
     state as a glyph and words, never a checkbox. Widget's checklist is
     a quick action, so this is the markup to use (the shape Widget's
     view had before it was):

     ```tsx
     <div className="flex flex-col gap-2">
       <p className="type-caption tabular-nums text-muted-foreground">{checklistDoneCount(items)}</p>
       <ul aria-label="Checklist items" className="flex flex-col gap-1.5">
         {items.map((item, index) => (
           <li key={index} className="flex items-start gap-2">
             {item.done ? (
               <CircleCheckIcon role="img" aria-label="Done" className="mt-0.5 size-4 shrink-0 text-success-text" />
             ) : (
               <CircleIcon role="img" aria-label="Not done" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
             )}
             <span className={item.done ? 'text-muted-foreground' : undefined}>{item.text}</span>
           </li>
         ))}
       </ul>
     </div>
     ```

     A list of links: each an
     `<a target="_blank" rel="noreferrer">` with an `ExternalLinkIcon`
     and a visually hidden "(opens in a new tab)".
   - **Long text the plan marks Markdown** renders through the
     foundation's `<Markdown>`: headings, lists, tables, callouts
     (`> [!NOTE]`) and links, links opening in a new tab; raw HTML shows
     as the characters typed, never as markup. The app needs no Markdown dependency of its own. Plain
     long text renders as text (`whitespace-pre-line` keeps its line
     breaks).
   - **Quick actions: only the fields the plan's `Quick actions` line
     names**, each a control that saves on its own (cell pattern 17,
     `widget-quick-actions.tsx`). A `yes/no` is a
     `Switch` with its words (`WidgetInStockSwitch`); a sub-record list's
     yes/no item field is a checkbox per item in a named group
     (`ChecklistItems`), whose change is a function of the record
     (`(current) => ({ checklist: ... })`) so quick ticks build on each
     other. Each control calls `useSave<Entity>Field(id)` itself and shows
     its own "Saving" spinner; nothing is disabled. A control goes where
     the field already shows (`badges`, a field's `value`, a section's
     `content`): `EntityView` needs nothing new. **With no `Quick actions`
     line, every value is read-only** and there is no quick-actions file:
     the view is exactly the read-only one above.
   - **Edit in place: only the fields the plan's `Edit in place` line
     names** (cell pattern 18). Each becomes `editInPlace({ kind, value,
     control, schema, save })` (`widgetEdits` in `widget-view.tsx`):
     `value` is what the form's control starts from, `control` is the
     shared control from `<entity>-fields.tsx` given the props it's
     handed (`readOnly={props.disabled}`, `aria-label={props.label}`,
     `aria-describedby={props.describedBy}`), `schema` is the form's own
     rule (`<entity>FormSchema.shape.<field>`), and `save` is
     `useEdit<Entity>Field(id).mutateAsync({ <field>: value })` (copy
     `useEditWidgetField`: the single-field save with `optimistic: false,
     toastOnError: false`). `kind` follows the control: `text` (one line;
     a number or integer too), `long-text` (Markdown, `RichTextEditor`
     with `autoFocus` and `onProblem={props.onProblem}`), `choice` (a
     select or a single reference: its list opens with the field,
     `defaultOpen`, non-modal, `onChange={(v) => props.commit(v)}`,
     `onOpenChange={(open) => !open && props.cancel()}`; a yes/no switch
     commits on change), `multi` (a multi reference; `isEqual` comparing
     ids as a set). A field gets `edit`, a `content` section gets `edit`,
     the title gets `titleEdit={{ label, ...edit }}`, and a header badge
     wraps itself in `<EditableValue label edit layout="inline">`. The
     shown value stays exactly as before. **With no `Edit in place` line,
     nothing is editable in place** and none of this is copied. Never a
     computed field or a sub-record list.

   **The table opens the view, and the form returns to it.** The title
   column's link is the way in (a `yes/no` marked `toggle` stays in its
   row). Saving an edit, or cancelling one, goes back to the record's view;
   creating opens the new record's view (the id the create returns);
   cancelling a create goes back to the list. Each navigates with
   `{ replace: true }`, so Back from the view doesn't reopen the form. The
   create and update mutations put the saved record into its detail cache
   (`setQueryData`), so the view shows the save at once, and the delete
   mutation drops it (`removeQueries`), so the view it leaves never
   refetches a record that's gone (`use-widgets.ts`).

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
7. **Register routes** for `/<entity>`, `/<entity>/new`, `/<entity>/:id`
   (the view) and `/<entity>/:id/edit` in `src/App.tsx`, and add a nav
   entry to `src/nav.ts`.
8. **Add Playwright specs for all three screens**, one test per state
   (`loading`, `empty`, `error`, `validation`, `success`), forced through
   MSW overrides — `forceMswOverride`, `waitForMswReady` and the
   `window.__msw` handle from `@tristan2828/ui-foundation/testing`, and
   `e2e/widgets-table.spec.ts`/`e2e/widget-form.spec.ts`/
   `e2e/widget-view.spec.ts` for the pattern. The view's states are
   loading, not found (a 404: "Not found", the way back, no retry), error
   (a failed load, then Try again recovering) and success (every section,
   each value as its cell shows it), plus the sparse record showing its
   "not set" labels and no blank value. Its flows: the table's title link
   opens it, saving and cancelling the form return to it, creating opens
   the new record's view, and Delete confirms then lands on the list.
   Each quick action gets its own tests (copy `quick action: …` in
   `e2e/widget-view.spec.ts`): the change shows and the PATCH carries it
   (a list item sends the whole list), a server-side effect shows once the
   save answers if the plan has one, a refused save (an MSW override
   answering 422 with the reason on the field) goes back with the toast,
   the "Saving" spinner shows while nothing is disabled, and, for a
   list, two quick changes both land. Fields edited in place get their
   own spec (copy `e2e/widget-edit-in-place.spec.ts`): only the plan's
   fields offer it; each kind saves (Enter, a pick, Ctrl/Cmd+Enter,
   leaving) with the PATCH it should send and "Saving…" while it waits;
   unchanged sends nothing; Esc restores; the schema's refusal is never
   sent; a 422 (an MSW override, the reason on the field) and a 500 stay
   open with the draft and the reason; opening a second field saves the
   first, or doesn't open if that fails; and leaving the page with
   unsaved text asks first. Add it to `mobile-chrome`'s `testMatch`. If
   the plan has Markdown long text, a test forces a record whose text has
   a heading, a list, a table, a link and raw HTML, and asserts the HTML
   shows as text. Add the view's spec to `playwright.config.ts`'s
   `mobile-chrome` `testMatch`, with a test that at phone width each
   label sits above its value and nothing scrolls sideways.
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
   `NAV_ENTRIES` so the shell smoke test covers the new screen, add
   `/<entity>/new` to `e2e/a11y.spec.ts`'s `formRoutes`, and add the view
   of a full record and of the sparse one to its `viewRoutes` (the table
   page is picked up from the sidebar automatically; the form and the view
   aren't in it). With fields edited in place, copy `e2e/a11y.spec.ts`'s
   "editing in place" block for them: a field open, saving and refused,
   the rich-text editor, an open list, and the leave prompt, in both
   themes.
10. **`npm run verify`.** Fix until it passes. Then stop — do not add
    anything beyond what this list covers; note ideas in the app's
    backlog instead.

## What not to copy

- `widget-quick-actions.tsx`, its `quick action: …` specs and
  `useSaveWidgetField` unless the plan has a `Quick actions` line (or,
  for the hook, a `yes/no` marked `toggle`). Copy only the controls for
  the fields the line names: a plan naming only its yes/no gets the
  switch, and the checklist's checkboxes are left out.
- `widgetEdits`, `useEditWidgetField`, `widget-edit-in-place.spec.ts` and
  the in-place a11y block unless the plan has an `Edit in place` line,
  and then only for the fields it names.

- The saved-views row in `widgets-table.tsx` (`VIEWS`, the "Saved views"
  button group and `visibleColumns`) unless the plan's List screen lists
  saved views. When it does, copy it: `useTableUrlState`'s third argument
  takes the views, `activeView` says which one the filters are, and that
  view's `columns` go to `DataTable`'s `visibleColumns` (the table's own
  default list when no view is active, or `undefined` for every column).
- `src/api/gateway/widgets.ts`, `src/mocks/data.ts`, `src/mocks/handlers.ts`
  are demo-domain content — write the entity's own versions rather than
  adapting these by find-and-replace.
- The composites (`DataTable`, `EntityForm`, `EntityView`, `Markdown`,
  `ErrorState`, `AppShell`) are the foundation's and shared by every app. If a new entity needs a
  capability they don't have (a new field-type widget, say), don't copy
  one into `src/` to change it: raise it for the foundation (AGENTS.md
  "Changing the Foundation") and build the screen once the release ships.
