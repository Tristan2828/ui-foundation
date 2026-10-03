# Changelog

Notable releases and what an app must do to take them. Every merge that
changes the package or the template also publishes a patch release to
npm, with its `release-smoke` result in the notes; those are listed on the
[releases page](https://github.com/Tristan2828/ui-foundation/releases).

## 3.10.0 — a read-only view of one record

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook, plan template, cell patterns and `AGENTS.md` block. Nothing
existing changes: an app adds a view entity by entity, when it wants one.

- **New composite: `EntityView`,** the read-side partner of `EntityForm`.
  A title with `badges` beside it, an `actions` slot, and `sections` of
  label/value rows (`fields`) or of one block each (`content`, for long
  text or a sub-record list). It owns the loading skeleton, a not-found
  state (a 404, another user's record included: "Not found", a way back
  to the list, no retry) and the error state with retry. An empty value
  (`null`, `''`, `false`, `[]`) shows the field's `emptyLabel`, the plan's
  "not set" label, never a blank.
- **New component: `Markdown`.** Long text written as Markdown, rendered
  in the design language's type roles and tokens: headings (starting at
  `<h3>`, under the page's own), lists, task lists, GitHub tables (on the
  package's `Table`), links (opening in a new tab), code and quotes. Raw
  HTML is never rendered: it shows as the characters typed. The package
  owns `react-markdown` and `remark-gfm` (new dependencies of the
  package, not of apps). Its Storybook story is axe- and token-checked in
  both themes.
- **`defineA11ySuite` takes `viewRoutes`** (optional): each entity's
  view, checked in both themes once `EntityView` has loaded.
- **The template's Widgets demo has a view** (`/widgets/:id`,
  `src/routes/widgets/widget-view.tsx`, `e2e/widget-view.spec.ts`), and
  the demo now has the shape the playbook builds: the Name column links to
  the view (new cell pattern 16), the row actions are gone (Edit and
  Delete live in the view's header), saving or cancelling the form returns
  to the view, and creating opens the new widget's view. Description is
  Markdown, shown on the view and no longer a table column. Values shared
  by the table and the view live in `widget-format.ts`.

### How an app adds a view to an entity

1. **Plan it.** Add a `## View screen` section to
   `docs/entities/<entity>.md` (the format is in
   `docs/foundation/entity-plan-template.md`): the title field, the badge
   fields, the sections and their fields in order, and a "not set" label
   for each optional field. Add `view` to its `Screens` line, and mark any
   long text that is Markdown.
2. **Share the cell rendering.** Move the badge variant maps and
   formatters from `<entity>-columns.tsx` into `<entity>-format.ts`, so
   the table and the view render each value the same way (the template's
   `widget-format.ts`).
3. **Build `<entity>-view.tsx` on `EntityView`,** copying
   `widget-view.tsx`: the record from your detail query, names for its
   references from the same lookup by id the table uses (a reference whose
   entity has a view links to it), sub-records read-only, `<Markdown>` for
   Markdown long text, and `Edit` plus your delete action in `actions`.
   Route it at `/<entity>/:id` in `src/App.tsx`.
4. **Point the table at it.** The title column becomes a link to the view
   (cell pattern 16) and the row-actions column goes; move the delete
   dialog into the view's header with an `onDeleted` that navigates to the
   list.
5. **Return the form to it.** Save and Cancel on an edit go to
   `/<entity>/:id`, creating goes to the new record's view, each with
   `{ replace: true }`. Put the saved record in the detail cache on create
   and update (`setQueryData`), and drop it on delete (`removeQueries`), as
   `use-widgets.ts` does.
6. **Specs.** A view spec with its states (loading, not found, error and
   retry, success, the sparse record's "not set" labels) and flows (title
   link, Edit, Cancel, save, create, delete), copied from
   `e2e/widget-view.spec.ts` and added to the `mobile-chrome` project.
   Add the full and sparse records' views to `e2e/a11y.spec.ts`'s
   `viewRoutes`. Specs that opened the form from a row's Edit button, or
   expected a save to land on the list, now go through the view.
7. **Reference files.** Add rows for the view and for the shared values
   to your `AGENTS.md`'s `### Reference files`, as the template's has.

New entities get all of this from the playbook (`/new-entity`), which now
builds list, view, create, edit and delete.

## 3.9.0 — labelled multi choices; a demo that can't collide

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook, plan template and `AGENTS.md` block.

- **`MultiChoice` takes `getLabel`.** `getLabel?: (value: T) => string`,
  the same shape as `MultiReference`'s, names each option on its chip, in
  the dropdown and for typed-text matching, while `onValueChange` still
  emits wire values. It defaults to the value itself, so existing uses
  are unchanged. The template's Tags are the reference: one
  `WIDGET_TAG_LABELS` record feeds `getLabel` and the table's badges.
  **If your app shows an enum through `MultiReference` or a custom picker
  only to get labels** (static options, a local search), switch it back
  to `MultiChoice` with `getLabel`.
- **The playbook can outlive the demo.** `add-an-entity.md` now defers to
  a `### Reference files` section in the app's `AGENTS.md` (below the
  foundation block) that names the app's own file for each pattern. The
  template's `AGENTS.md` has it filled in for the Widgets demo. **Before
  your app deletes the demo** (or now, if it already has), write that
  section with your own files.
- **The demo's referenced entity is `WidgetCategory`,** not `Category`:
  schema `WidgetCategory`, path `/widget-categories`, table
  `widget_categories` (migration 0009), gateway
  `src/api/gateway/widget-categories.ts`, hooks `use-widget-categories.ts`.
  An app whose own entity is a Category no longer collides with the demo.
  Template only: an existing app's copy is its own, and nothing changes
  unless you want it to.
- **`create-app.sh` proves the new lockfile passes `npm ci`.** After its
  `npm install` it runs `npm ci`, and if npm rejects the lock it just
  wrote, runs `npm install` once more and checks again (npm 11.7.0 wrote
  one `npm ci` rejected). **If your app's CI or deploy fails `npm ci`**
  on a lock you never edited, run `npm install` once and commit the
  rewritten `package-lock.json`.

## 3.8.0 — flip a yes/no from the table row

Docs and template only; no package code changed. Run
`npx ui-foundation sync` after the bump.

- **A `yes/no` can be flipped straight from its row.** Plans mark it
  `column, toggle`. The template's In Stock column is the reference (cell
  pattern 15): a `Switch` that saves that one field on its own, updates
  every cached list page at once, and puts the value back with a toast if
  the save fails.

## 3.7.0 — computed fields; stable table columns

Docs and template only; no package code changed. Run
`npx ui-foundation sync` after the bump.

- **Computed fields are supported.** Entity plans can now say `computed`:
  a read-only value the server works out from other data on every read
  (a status derived from related records, a count). The template's Widget
  gains `checklistState` (Progress: none / open / complete, from its
  checklist) as the reference: one SQL expression drives the filter and
  sort across pages, a Python mirror gives each row its value, and a test
  proves the two agree.
- **Fix in the template's widgets table: cells no longer remount when
  category names arrive.** Its columns were rebuilt from the names, which
  load after the rows, and TanStack's `flexRender` treats each `cell` as a
  component, so every cell remounted about 30ms after first paint (focus
  lost; an intermittent failure in the pinned-column e2e tests). Columns
  are now built once and names reach the cells through context. **If your
  app builds columns from data that loads later** (names for reference
  ids, usually), do the same: see the template's
  `src/routes/widgets/category-names.tsx` and the playbook's "Keep column
  definitions stable".
- **Fix in the template's `e2e/msw-contract.spec.ts`:** the binary-body
  test now also waits for `window.__msw`, not only for a controlled page.
  The override is installed after the worker starts, so an image requested
  in between occasionally reached the dev server. Copy the one added
  `waitForFunction` line if your app has this spec.

## 3.6.0 — sub-records edited on the parent's form

Additive, with one small change to error keys (below). Run
`npx ui-foundation sync` after the bump for the updated playbook and plan
template.

- **Sub-records are supported.** Entity plans gain a `## Sub-records`
  section: a list of small items that belong to one record and are edited
  on its form (a checklist, a set of links). The template's Widget gains
  `checklist` (`{text, done}` items) as the reference to copy: add, tick,
  reorder and remove on the form, saved with the widget, and a
  `1/2 done` count in the table.
- **New composite:** `ListEditor` (row chrome: move up, move down, remove,
  and an Add button; the item fields are the app's).
- **New primitive:** `@tristan2828/ui-foundation/ui/checkbox` (shadcn's, on
  Base UI), with Storybook axe and token checks in both themes.
- **Error keys for items in a list of objects.** A 422 at
  `["body", "checklist", 2, "text"]` is now keyed
  `fieldErrors["checklist.2.text"]`, react-hook-form's path, so it lands on
  that row. It used to be keyed `"text"`. Nothing else moves: a plain
  field, an item of a list of values (`["body", "tags", 0]` → `tags`) and a
  nested object with no list in its path keep their keys. If your app
  matched the old `"text"`-style key for such errors, match the path
  instead.

## 3.5.0 — the multi-reference field type

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook and plan template.

- **Multi reference is a supported field type.** Entity plans can now say
  `multi reference → <Entity>`: links to any number of records of another
  entity. The template's Widget gains `extraCategoryIds` as the reference
  to copy: chips with a searchable dropdown on the form, names as badges
  in the table, and an any-of filter sent as a repeated parameter.
- **New composite:** `MultiReference`, `MultiChoice`'s sibling for record
  ids. It never guesses a name: the app passes `getLabel`, fed by a lookup
  by id on the referenced entity (`GET /categories?ids=...` in the
  template), so a saved pick is named even when the current search doesn't
  return it.
- **Nothing to change in an existing app.** The Widget changes are in the
  template only (migration `0007_widget_extra_categories.py`, the
  `/categories` `ids` parameter, and the matching spec, mock, gateway and
  screen changes).

## 3.4.0 — the yes/no field type

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook, plan template and cell patterns.

- **Yes/no is a supported field type.** Entity plans can now say
  `yes/no` (a boolean that is always yes or no, with a default). The
  template's Widget gains `inStock` as the reference to copy: a `Switch`
  on the form, cell pattern 12 (now proven) in the table, and an
  either/yes/no toolbar filter sent as `inStock=true|false`. A yes/no that
  can also be unset is still unsupported.
- **New primitive:** `@tristan2828/ui-foundation/ui/switch` (shadcn's, on
  Base UI), with Storybook axe and token checks in both themes.
- **Nothing to change in an existing app.** The Widget changes are in the
  template only; an app that kept the Widgets demo can ignore them, or copy
  migration `0006_widget_in_stock.py` and the matching spec, mock, gateway
  and screen changes if it wants the reference running locally.

## 3.3.0 — typography roles, table density, four new cell patterns

Additive. Nothing looks different until an app opts in. Run
`npx ui-foundation sync` after the bump for the new docs.

- **Typography roles:** `type-page-title`, `type-section-title`,
  `type-body`, `type-label` and `type-caption`. Each sets size, line height
  and weight from `--type-*` tokens. The values match what the package
  already used, so `EntityForm`'s title, `DataTable`'s pagination text and
  `AppShell`'s user name now use roles with no visible change. To adopt
  them, replace pairs like `text-lg font-semibold` on your own headings
  with the role (`type-page-title`), and never combine a role with
  `text-*`/`font-*` size or weight classes
  (`docs/foundation/design-language.md` "Typography").
- **Table density:** set `data-density="compact"` or `"comfortable"` on
  any ancestor of a table. It's a token set, not a prop, so `DataTable`'s
  API is unchanged. The table primitive's padding now reads
  `--table-cell-px`, `--table-cell-py` and `--table-head-height`, whose
  defaults equal the old fixed values.
- **Cell patterns 11–14**, marked *Unproven* (written ahead of a real
  column): number or currency, boolean, progress bar, avatar and name. If
  you use one, note it in the entity's plan and report back what worked.

## 3.2.0 — the info tone; comments on every database column

Additive. `npx ui-foundation sync` after the bump writes the new Hard Rule
and design-language text.

- **Info tone.** A fourth semantic tone for *notice this* with no verdict
  (in progress, new, scheduled): `--info`, `--info-foreground`,
  `--info-text`, Tailwind's `bg-info`/`text-info-text`/`border-info-text`,
  and `Badge` variants `info`, `outline-info` and `tinted-info`. Measured
  and axe-checked in both themes like the other three.
  `docs/foundation/design-language.md` says when to use it. One catch: its
  blue sits near category slots 1, 6 and 8, so a table that shows an info
  badge keeps its categories off those three.
- **New Hard Rule: every database table and column has a `COMMENT ON`.**
  It applies to an app with a Postgres backend. The backend is copy-in, so
  bring the check across by hand:
  1. Copy `backend/scripts/check_db_comments.py` from the template.
  2. In `scripts/check-backend-postgres.sh`, run it after `alembic upgrade
     head` (copy the two lines from the template).
  3. Add it to the mypy line in `backend/scripts/verify.sh`.
  4. Run it once. It lists every table and column with no comment. The
     template's own tables (`users`, `sessions`, and `categories`/`widgets`
     if you kept them) are commented in the template's
     `migrations/versions/0005_schema_comments.py`; copy the parts you
     need into a new migration of your own, numbered after your latest.
- **3.1.2** (released with no entry here): at phone width the sidebar
  sheet now closes when one of its links navigates, and the first Escape
  closes it even with focus on a nav link. Copy the template's
  `e2e/mobile-sidebar.spec.ts` and its two `playwright.config.ts` lines to
  cover it in your app.

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
  `check-backend-postgres.sh` now runs it in its real-mode pass; add
  `e2e/mock-mode-banner.spec.ts` to yours.
- **Selecting a suite's spec by file** now works, with a one-line change in
  the app: wrap each `defineA11ySuite` / `defineMockModeBannerSuite` call
  in the spec's own `test.describe('…', () => { … })`. Playwright locates a
  test where `test()` is called, which for a suite is the package, so
  until now `playwright test e2e/mock-mode-banner.spec.ts` ran no tests.
  With the app's own describe around it, the file argument matches. The
  template's `e2e/a11y.spec.ts` and `e2e/mock-mode-banner.spec.ts` show it.
- **`check-backend-postgres.sh`** creates `logs/` before starting uvicorn.
  The folder is gitignored, so in a fresh clone the log redirect failed and
  uvicorn never started. Copy the line into your app's script.
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
