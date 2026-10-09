# Changelog

Notable releases and what an app must do to take them. Every merge that
changes the package or the template also publishes a patch release to
npm, with its `release-smoke` result in the notes; those are listed on the
[releases page](https://github.com/Tristan2828/ui-foundation/releases).

## 3.27.0 — categorical colours that are easy to tell apart

The twelve `--category-*` slots keep their names and get new colours
(issue #108). No class, token or export changes, so nothing is required
beyond the upgrade. Run `npx ui-foundation sync` for the updated design
language.

The old slots were eight hues 25° apart at one lightness plus deeper
shades of four of them: about five colours a person would name
differently, with four blues and teals. The new ones are twelve named
colours from the whole hue circle, varied in lightness and chroma as well
as hue, picked from an options page of candidates. The closest pair went
from ΔE 8.8 to 17.9 (CIEDE2000), and the first six stay apart for readers
with deuteranopia or protanopia (before, slots 1 and 2 merged for them).

| Slot | Before | Now |
|---|---|---|
| 1 | blue | blue |
| 2 | purple | orange |
| 3 | olive | green |
| 4 | teal | purple |
| 5 | pink | pink |
| 6 | blue-violet | brown |
| 7 | yellow-green | teal |
| 8 | cyan-blue | red |
| 9 | deep teal | gold |
| 10 | plum | navy |
| 11 | deep olive | lime |
| 12 | deep violet | magenta |

- **Near info** is now slot 1 only (was 1, 6 and 8).
- **Red, orange, brown and green are slots now.** A category is a tinted
  glyph beside its name, not a badge; design-language.md says where to keep
  them apart from tones (not in a column that shows tone badges).
- **The distinctness test** measures CIEDE2000 instead of OKLab distance,
  holds every pair to 15, and holds the first six to 10 under simulated
  deuteranopia and protanopia.
- **Storybook** `patterns/CategoricalColour` names each slot's colour, and
  a new `SideBySide` story shows both themes at once, under normal vision
  and the two simulations.

**Upgrading:** nothing is required. An app whose people chose a colour by
what it looked like keeps their choice's slot, so it shows the new colour
in the table above. If the app labels its colours by name ("Teal" for
`category-4`), relabel them from the "Now" column. One that lists its
slots for people to pick from may want to reorder the list.

## 3.26.0 — small entities edited in their rows; tables sized to their columns

Additive: a new optional `width` prop on `DataTable`, a new `InlineCreate`
export, and editing in place inside any `DataTable`. No existing prop or
export changes, and a table that doesn't opt in looks and behaves as
before. Run `npx ui-foundation sync` for the updated cell patterns,
playbook and plan template.

- **Edit a small entity in its rows** (issue #105, option 3 of the
  options page). `DataTable` now runs the same edit-in-place store as
  `EntityView`, so a cell that renders an `<EditableValue>` edits where
  it's shown: one cell at a time, Enter or a pick saves, Esc gives up, a
  refusal (a 422's field error) stays in the cell with what was typed,
  focus returns to the cell's pencil, and leaving the page with a cell
  half typed asks first. No pencil column, no edit route.
- **`InlineCreate`**: a name box and Add for a table's toolbar. Enter
  creates the record (the rest at their defaults), the box empties and
  keeps the caret, a status line says what was added, and a blank or
  taken name says why under the box.
- **`DataTable` `width="content"`** (issue #104, option 4): a table of a
  few short columns takes the width they need, at least 36rem, with its
  toolbar and pagination, once its area is 80rem wide or more. Narrower
  (a 1280 screen, a phone) it's the full width as always. Loading, empty
  and error after a load keep the width it last had, so paging and
  filtering don't move it; the first load can.
- **Docs:** cell pattern 18 gains "In a table's rows" and
  "`width="content"`"; the plan template a `Screens: list, edited in the
  row` shape and an optional List screen `Width`; the playbook says what
  that shape builds (no view, no form). The template has no small entity,
  so the worked example is Storybook `app/DataTable` ("Edit in the rows",
  "Content width").

**Upgrading:** nothing is required. To move a small entity off its edit
page: drop its edit route and pencil, make each column's cell an
`EditableValue` over its field's control and save (stable columns,
`getRowId`), put `InlineCreate` in the toolbar in place of New, and
replace the form's specs with the cell's (cell pattern 18, "In a table's
rows").

## 3.25.0 — lists edited in place, twelve colour slots, one hover

Additive: a new `kind: 'list'` for `editInPlace`, two optional props on
`ListEditor`, four new colour slots. No existing prop or export changes.
Run `npx ui-foundation sync` for the updated cell patterns, design
language, playbook and plan template.

- **A sub-item list edits in place on the view** (issue #102):
  `editInPlace({ kind: 'list', value, schema, save, renderItem,
  renderShown, newItem, itemName, addLabel })` as a `content` section's
  `edit`. Each item reads as `renderShown` (a done box still ticks it);
  clicking it, or its pencil, opens the form's own row (`renderItem`);
  Enter or leaving saves, Esc gives up. "Add item" at the end opens a new
  row, and Enter saves it and opens the next, so a run of items goes in
  from the keyboard. Move and remove are `ListEditor`'s buttons, with
  its names, each one save; the caret follows the moved item. `save`
  takes a change, applied to the record's latest list when it's sent, so
  it builds on a tick still saving. The list's schema checks each change
  as the list it would make, and a refusal shows under the item (or
  under the list, for a move or remove) with nothing changed. Works in
  the rail and the main column. New types `EditInPlaceList`,
  `EditInPlaceListOptions`, `EditListItemProps`. Storybook
  `app/EntityView` "Lists" shows a checklist and a links list.
- **`ListEditor`** takes `add` (a node in place of its Add button) and
  `disabled` (its buttons wait); `onAdd` is optional with `add`.
- **Editing in place, small fixes found building the list:** a click on a
  label, a checkbox or a switch inside a shown value no longer opens it
  (the box does its own thing), and opening a field no longer puts the
  caret on a checkbox's hidden native input before the field's text box.
- **Twelve categorical colour slots** (issue #101): `--category-9` to
  `--category-12` (`text-category-9` …), deeper shades of four of the
  first eight's hues (teal, plum, olive, violet) in both themes, since
  the hues between the tones are spent. None is near info's blue. A unit
  test holds every pair of slots at least as far apart as the first
  eight were (`tests/category-slots.test.ts`), and Storybook
  `patterns/CategoricalColour` shows every slot on the page and on a
  card, with the glyph check measuring each against both in both themes.
  `design-language.md` says when past eight is worth it.
- **`DataTable`: a pinned last column no longer lights up on row hover**
  (issue #103). It stays pinned, opaque and striped; only the pinned
  first column marks the hovered row. A table that pins only its last
  column gets the plain row hover of an unpinned table.
- **The template:** Widget's Checklist is edited in place (its row shared
  with the form as `WidgetChecklistItemFields`), and its item text no
  longer ticks the box (it edits the item; the box is named "Done:
  <text>" as before).

**Upgrading:** nothing is required. An app whose specs assert the pinned
last column's hover style, or click a checklist item's text to tick it,
updates them. To edit a sub-record list in place, follow cell pattern 18,
"A list of sub-items". To offer the new colours, widen the colour enum
(contract and CHECK) to `category-12` and add the whole class names to
the slot → class map.

## 3.24.0 — a record's view with a right rail

Additive: one new optional prop on `EntityView` and on its sections, no
existing prop or export changes. The default one-column view is
unchanged. Run `npx ui-foundation sync` for the updated playbook and
plan template.

- **`EntityView` `layout="rail"`** (issue #99), for a record with long
  content. The page takes the content area's whole width (no
  `max-w-4xl`), sections marked `placement: 'rail'` go in a 22rem column
  on the right, and the rest fill the main column beside it from the
  top, so long Markdown starts under the header and a wide table gets
  the room. The rail stays in view while the main column scrolls, but
  only while it fits the window: a taller one scrolls with the page, so
  its end is never stuck below the fold. Two columns from a view 56rem
  (896px) wide, measured on the view itself (a container query), so an
  open sidebar counts; narrower, one column in the order header → rail →
  main. That is also the DOM order at every width, so reading and tab
  order match the screen. The rail is an `<aside>` named "<title>
  details" (`railLabel` to change it). Its fields stack label above
  value while the rail is narrow. Editing in place, the leave prompt and
  the loading skeleton (a main block and a rail block) follow the
  layout. New types `EntityViewLayout` and `EntityViewPlacement`.
- **Storybook `app/EntityView`** renders both layouts, with axe and the
  token check in both themes, and `e2e/entity-view.spec.ts` pins the
  rail at 1280, 2289 and 393px: beside the main column, a wide Markdown
  table unsqueezed at 2289px, stickiness only while it fits, tab order,
  the landmark and editing in place.
- **The template's Widget view uses the rail** (Details in it; Description
  and Checklist in the main column), so the playbook's reference shows
  it and the template's a11y suite checks it in both themes.
- **The plan template** has an optional `Layout: rail` line and a
  Placement column for the sections; the playbook says to drop `layout`
  and `placement` from the copied view when the plan has no `Layout`.

To adopt it in an app: pass `layout="rail"` to the view's `EntityView`,
mark the short sections `placement: 'rail'` (summary, fields, links),
and update any spec that relied on section order on a wide screen: the
rail's sections now come first in the DOM.

## 3.23.0 — a count that links to the related records

Additive: one new component, no existing prop or export changes. Run
`npx ui-foundation sync` for the updated cell patterns, design language
and plan template.

- **New component `CountLink`, cell pattern 20: a count linking to the
  related records** (issue #97). A parent's table showing how many
  records of another entity point at each row (open Tasks per Project),
  each count a link to that list filtered to the row (`count`, `to`,
  `label`; `to` is `/tasks?project=<id>`, the query string
  `useTableUrlState` reads). The component
  settles what one app had to decide alone: the link underlined at rest
  in `text-foreground`, a plain `0` that isn't a link, and an accessible
  name that's the count, then `label` (`3 open tasks in Kitchen
  remodel`). The pattern adds what stays the app's: the count applying
  the same default filters as the list it opens (said in the field's
  `description` in `openapi.yaml`), a server-side numeric sort with a
  stable tiebreak, and an index on the foreign key it counts. Storybook
  renders it (`app/CountLink`), with axe in both themes and its names,
  keyboard order and navigation pinned.
- **Design language: a link in a table cell is never `text-link`.**
  `--link` is for written text; a cell's link is foreground and
  underlined (patterns 16 and 20).
- **The plan template**: a `computed` count says whether its column links
  to the records it counts, and which of them it counts.

An app that already built this cell: replace its own link with
`CountLink`, passing what its `aria-label` said after the count as
`label`, and delete its link class.

## 3.22.0 — tables with many filters, and three table fixes

One new composite and three fixes, from the reporting app's tables.
Nothing changes until an app adopts `SecondaryFilters`; the fixes apply
on upgrade. Run `npx ui-foundation sync` for the updated playbook.

- **`SecondaryFilters`: less-used filters behind a "Filters" button**
  (issue #93). A table with many filters wrapped its toolbar to several
  rows and started a third of the way down a laptop screen (past a whole
  phone screen). Keep the most-used filters in the toolbar and put the
  rest inside `<SecondaryFilters active={…} onClear={…}>`: a button with
  the count of those that are on, opening them in a popover (a bottom
  sheet on a phone), and a chip beside it for each one that's on, with a
  remove button, plus "Clear filters". It holds no state: `active`
  (`ActiveFilter[]`: `{ id, label, onRemove }`) comes from the URL like
  every filter, so the count and chips follow reloads, saved views and
  shared links.
- **`useTableUrlState`'s `setFilters` takes multi-value filters too** (a
  list, `[]` clears), so "clear filters" is one URL update. Additive.
- **Fixed: on a phone, a pinned first column covered every other
  column** (#91). It sized to its longest value, wider than the screen,
  and the rest scrolled underneath it. Below `md` its content is now
  capped at 45% of the table's width and wraps. Wide screens are
  unchanged.
- **Fixed: the zebra stripe stopped at pinned columns** (#92). Even rows'
  pinned cells now paint the stripe pre-mixed onto the page (new token
  `--table-stripe`), still opaque so scrolled columns can't show through.
- **Fixed: `MultiChoice` and `MultiReference` stood twice as tall as
  their neighbours** when their chips fit on one line with little room
  to spare (#94): the empty text box wrapped onto a line of its own. With
  chips in, it now takes only what's left of their line until it has
  focus.

### How an app adopts `SecondaryFilters`

1. In `<entity>-table.tsx`, wrap the less-used filters (each still with
   its own label) in `<SecondaryFilters>`, placed in the toolbar's filter
   row after the ones that stay.
2. Build `active` from the same filter values the query uses: one
   `ActiveFilter` per filter that's on, its `label` what the chip says
   ("Out of stock", "Progress: In progress") and `onRemove` clearing it.
3. `onClear`: one `setFilters({ … })` setting each of them to `''` (or
   `[]` for a multi-value one).

The template's `widgets-table.tsx` is the worked example.

## 3.21.0 — rich text: headings, callouts, tables, Notion's keys

Additive: no prop or export changes, nothing for an app to do but bump
the version and run `npx ui-foundation sync` (the playbook's rich-text
lines are updated). Everything below is in `RichTextEditor` and
`<Markdown>` alike. From a review of the editor in use.

- **Headings a reader can tell apart.** `#`, `##` and `###` are 26, 20
  and 17px over the 14px body (new type roles `type-heading-1` to `-3`);
  Heading 1 has a rule under it. Until now `#` and `##` looked the same.
  The toolbar's buttons are now **Heading 1, Heading 2, Heading 3** (were
  Heading and Subheading): an app test that finds them by name needs the
  new names.
- **Callouts**, Notion's coloured boxes, as GitHub's alert syntax:
  `> [!NOTE]` (or `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`). Plain
  Markdown, so a note stays readable anywhere; a quote without the marker
  is still a quote. In the editor: the toolbar's Callout, "/callout" (and
  "/warn", "/tip", …), and the callout's icon is a menu of kinds with
  Remove callout.
- **Links are blue** as well as underlined (new token `--link`).
- **The divider (`---`) is a 2px line** in a stronger grey (new token
  `--rule`), with room around it. "/divider" and the toolbar's Divider put
  one in.
- **Tables:** a header row on the muted fill, a line between every cell,
  wrapping cells, rounded and scrolling sideways when wide. In the editor:
  "/table" and the toolbar's Table menu insert one; Tab in the last cell
  adds a row; Enter goes down a column (it used to leave the table from
  any row); bars under and beside a table add a row or a column; the
  Table menu inserts rows above or below and columns left or right,
  aligns a column (written as `:---:`), and deletes a row, a column or the
  table. Ctrl/Cmd+Enter in a table now saves the field like everywhere
  else.
- **Notion's shortcuts:** Ctrl+Shift+1/2/3 headings, +4 task list,
  +5 bulleted list, +6 numbered list, +8 code block, +0 back to text
  (Cmd+Option and the digit on a Mac); Ctrl/Cmd+Shift+S strikethrough.
  Milkdown's own keys still work. Each button's tooltip and
  `aria-keyshortcuts` name the new keys.
- **Fixed:** in `<Markdown>`, a bullet list followed by task items (one
  Markdown list) lost its bullets and put each task's box on a line of
  its own.
- **New primitive: `@tristan2828/ui-foundation/ui/dropdown-menu`**
  (shadcn's, on Base UI), behind the Table and callout menus, axe-checked
  open in both themes. An app that ran `shadcn add dropdown-menu` itself:
  lint now flags its copy (the package ships one), so import the package's
  and delete its own.

## 3.20.1 — `create-app.sh` installs the tag's own version

Script and CI only; no package code changed. Apps already made need
nothing.

- **`create-app.sh <name> <tag>` now installs the package at exactly
  that tag's version** (still saved as `^X.Y.Z`, so patches arrive with
  `npm update`). It used to install the caret range as-is, which npm
  resolves to the newest release: an app made from any tag but the
  latest got a newer package than its template, and `sync --check`
  failed (`differs: AGENTS.md`). Only the latest tag worked.
- **release-smoke waits for the release's tarball**, not just its
  listing on npm. 3.17.0, 3.18.0 and 3.20.0 were marked "Don't upgrade
  apps onto it" because the smoke's `npm install` got a 404 on the
  tarball moments after publishing; their code wasn't at fault (3.20.0's
  re-run passed). Re-run on 3.17.0 and 3.18.0, they then hit the
  `create-app.sh` bug above, fixed here.

## 3.20.0 — `MultiReference` waits for its search

A fix that needs one prop from the app. Run `npx ui-foundation sync` for
the updated playbook.

- **Enter in a `MultiReference` no longer acts on the last search's
  results.** Until the app's search for what was typed answers, the list
  still shows the previous results, the first one highlighted. Enter
  picked that one, and if it was already picked (the list opens on every
  record, picked ones included), **Enter removed it**: type fast, press
  Enter, and a saved pick could be gone. Queued in DEFERRED as "Enter
  picks nothing"; reproducing it showed the removal.
- **New optional prop `searching`**: true while the options don't answer
  what's typed yet. Enter does nothing meanwhile (a click still picks,
  and the arrow keys still move), the list is `aria-busy`, and once the
  results arrive their first is highlighted and Enter picks it.

### How an app adopts it

1. **Pass `searching` to every `MultiReference`**, from its search query:
   `searching={optionsQuery.isPlaceholderData}` (with the playbook's
   `placeholderData: (previous) => previous`). Without it the old
   behaviour stays, the removal included. The template does it on the
   Extra Categories field and its table filter.
## 3.19.0 — a banner for data that isn't production's

Additive: nothing changes until an app renders the banner. Apps already
made don't have the backend half (`template/backend/` is copy-in); the
steps below add it.

- **`DataEnvironmentBanner`**, above the router like `MockModeBanner`, on
  every route including `/login`: "**Dev data:** changes here don't reach
  production", whenever the backend says its data isn't production's.
  Locally, an app on a `dev` branch of its hosted database looks exactly
  like the deployed one; this says which one you're in.
  - The label is the backend's: `DATA_LABEL` in `backend/.env`, served
    unauthenticated at `GET /api/environment` as `{ "dataLabel": "dev" }`
    (`null` when unset). `dev` shows "Dev data", `local` "Local data".
  - Nothing for `null`, nothing while it loads, nothing if the request
    fails or the backend doesn't serve the path. In mock mode the mock
    handler answers `null`, so only the mock banner shows.
  - One request per page load, never refetched, kept across log in and
    out. Nothing on screen hides it.
  - The info fill, apart from the mock banner's warning fill. axe-clean in
    both themes, on its own (Storybook) and on the template's screens with
    both banners showing.
- **Contract:** `/environment` and its `DataEnvironment` schema are in
  `openapi/foundation.yaml`, marked `x-optional`: `check-contract` passes
  an app without them, and checks the shape of an app with them.
- **`environmentHandlers`** (`/mocks`): the mock, answering `null`.
- **`defineDataEnvironmentBannerSuite({ routes })`** (`/testing`): absent
  in mock mode; a label forced through MSW shows on every route, apart
  from the mock banner, axe-clean in light and dark. Under
  `VITE_API=real` it expects `process.env.DATA_LABEL` (the banner, or
  none when unset).
- **The template's backend:** `DATA_LABEL` in `app/config.py` and
  `.env.example` (`local`, for the docker-compose database), the
  `/environment` router, and `APP_ENV=production` refusing to start with a
  label set. `check-backend-postgres.sh` runs with `DATA_LABEL=local` and
  checks the banner against the real backend.

### How an app adopts it

1. **Contract.** Copy `/environment` and `components.schemas.DataEnvironment`
   from the template's `openapi.yaml` into the app's, then `npm run gen:api`.
2. **Backend.** Copy from the template's `backend/`: the `DATA_LABEL`
   lines of `app/config.py`, `DataEnvironmentOut` in `app/schemas.py`,
   `app/routers/environment.py` (and its `include_router` in
   `app/main.py`), and `tests/test_environment.py`. Optionally the
   `data_label` check in `app/deploy_checks.py` with its test, passing
   `data_label=DATA_LABEL` from `main.py`'s lifespan.
3. **Mocks.** Spread `environmentHandlers` from
   `@tristan2828/ui-foundation/mocks` into `src/mocks/handlers.ts`, beside
   `authHandlers`.
4. **Render it.** In `src/main.tsx`, `<DataEnvironmentBanner />` as the
   first child of `<FoundationProviders>`, before `<App />`.
5. **Spec.** `e2e/data-environment-banner.spec.ts` from the template: the
   suite with the same routes as the mock-mode banner's.
6. **Set it where the data is disposable.** `DATA_LABEL=dev` in the local
   `backend/.env` when it points at a dev branch (`DATA_LABEL=local` for
   the docker-compose database). Leave it unset in production.

## 3.18.1 — the template's dev and test ports

Template and docs only; no package code changed. Apps already made keep
their ports (their `vite.config.ts` is their own); nothing to do on the
bump.

- **New apps serve on :5180 (`npm run dev`) and test on :4180**, not
  Vite's defaults (5173, 4173), with `strictPort`: another Vite app on
  the same machine is likely on the defaults, and Playwright reuses
  whatever answers on the test port, so `verify` could test the wrong
  app. A busy port is now an error, not a silent move to the next one.
  For one run elsewhere: `npm run dev -- --port 5181`.
  - **To do the same in an existing app** (optional): copy the
    `DEV_PORT`/`PREVIEW_PORT` lines and the `port`/`strictPort` settings
    from the template's `vite.config.ts`, and the port in
    `playwright.config.ts` (`baseURL`, `webServer`).
- **The template's VS Code "Storybook" task is gone.** It ran a
  `storybook` script the template hasn't had since Storybook moved into
  the package (3.0). Delete it from an app's `.vscode/tasks.json` too.
- **This repo: `npm run storybook`** at the root starts the package's
  Storybook on :6006.

## 3.18.0 — the slash menu

Additive, but visible: **every `RichTextEditor` with toolbars gains the
slash menu on the bump.** `toolbar={false}` leaves it out with them. Run
`npx ui-foundation sync` for the updated cell patterns.

- **"/" at a line's start lists the blocks the line can become**:
  Heading, Subheading, Bulleted list, Numbered list, Task list, Quote,
  Code block (the toolbar's block formats, with their icons).
  - Typing filters by name or keyword (`/num`, `/h2`, `/todo`); with no
    match the list hides and the text is just text. Enter or Tab picks:
    the "/…" goes and the line becomes the block, in one undo step.
  - Only a "/" *typed* at the start of a top-level paragraph opens it:
    not mid-line, not in a list, quote or code block, and never a "/"
    already in the text (a path like `/usr/bin`).
  - **Keyboard and screen readers:** ARIA's combobox pattern with the
    text as the input. Focus never leaves the text; while the list is
    open the text names it (`aria-controls`, `aria-autocomplete="list"`)
    and the highlighted item (`aria-activedescendant`). The arrow keys
    move the highlight, round the ends.
  - **Mouse:** a click picks; it never takes focus from the text.
  - **Editing in place:** Enter in the list picks rather than saving; Esc
    closes the list and keeps what was typed, and the next Esc gives up
    the edit. Ctrl/Cmd+Enter still saves.
  - axe-clean in both themes, and its icons clear 3:1 (the glyph check).

### How an app adopts it

1. **Nothing to add.** Where `toolbar={false}` was passed, there's no
   slash menu.
2. **Specs** that type a line starting with "/" and then press Enter (a
   path, say) get a block instead of a new line when what follows the
   "/" matches a block's name (`/quote`); press Esc first.

## 3.17.0 — a floating toolbar over selected words

Additive, but visible: **every `RichTextEditor` with a toolbar gains the
floating one on the bump.** `toolbar={false}` leaves out both. Run
`npx ui-foundation sync` for the updated cell patterns.

- **A floating toolbar over selected words**: Bold, Italic,
  Strikethrough, Code · Link, the same buttons as the fixed toolbar
  (pressed while on, each naming its shortcut). The fixed toolbar stays.
  - Shows once words are selected and the mouse is up (not while a drag
    is still choosing them). Not in a code block, read-only, or while the
    link box is open.
  - Above the words, or below them when there's no room inside the text
    (the first line), so it never covers the fixed toolbar. It sits
    inside the field, not in a portal, and scrolls with the text.
  - **Keyboard:** Alt+F10 in the text reaches it (the fixed toolbar when
    it isn't showing; the editor names the key in `aria-keyshortcuts`).
    The arrow keys, Home and End move along it; Enter formats and gives
    focus back. Esc or Tab goes back to the text with the words still
    selected (a button's open tooltip takes the first Esc).
  - **Mouse:** a press never takes focus from the text.
  - **Editing in place:** it's part of the field, so moving to it doesn't
    save. **Esc with words selected now hides the floating toolbar
    first; the next Esc gives up the edit**, as an open list does.
  - axe-clean in both themes, and its icons clear 3:1 on the popover
    surface (the glyph check).

### How an app adopts it

1. **Nothing to add.** Where `toolbar={false}` was passed, neither
   toolbar shows.
2. **Specs** that select words and then press Esc to give up an edit in
   place need a second Esc. Specs that select words and then click just
   below or above them may now hit the floating toolbar. Find its
   buttons by name
   (`getByRole('toolbar', { name: 'Format selection' }).getByRole('button', { name: 'Bold', exact: true })`).

## 3.16.2 — two rich-text fixes

Fixes only. **Apps need nothing beyond the bump** (no `sync`, no code).

- **Documents the editor tidies on load save again.** A table with a row
  shorter than its header, or marks nested another way (bold inside a
  link: `[**a**](u)`), made *every* edit to that document refuse to save
  ("This text can't be saved without changing parts you didn't edit").
  The editor shows such a block its own way (padded cells,
  `**[a](u)**`), and the save didn't recognise it as the same block. Now
  it does: an edit elsewhere keeps the block exactly as written. A block
  the editor shows some other way it isn't recognised in is written as
  the editor shows it, rather than refusing, as long as nothing in it is
  lost. If something would be (the editor doesn't show images), the save
  still refuses, so an image is never deleted.
- **The toolbar's `aria-controls` no longer names a missing element.**
  It pointed at the editable element from its first paint, a moment
  before the editor made that element, which axe flags as a critical
  `aria-valid-attr-value` (intermittently, on timing). It's set once the
  editor exists.
- **The editable text has ProseMirror's required `white-space: pre-wrap`**,
  so a space typed at the end of a line is a space, not `&nbsp;`, and the
  console warning is gone.

## 3.16.1 — labelled single choices in the template

Template and docs only; no package code changed. Run
`npx ui-foundation sync` after the bump for the updated playbook and plan
template.

- **The template's Status shows labels** (Draft, Active, Archived), not
  wire values, on the form's select (options and trigger), the toolbar
  filter, the column's badge and the view's. One `WIDGET_STATUS_LABELS`
  record feeds them all, the way `WIDGET_TAG_LABELS` does for Tags. **If
  your app copied Status** for values that aren't fit to show
  (`quick_win`), do the same. A `<SelectValue>` needs a children function
  for the trigger, or it shows the raw value.
- **Plans give a label per single-choice option** whose wire value isn't
  fit to show, as for a multi choice.

## 3.16.0 — the rich-text editor's toolbar

Additive, but visible: **every `RichTextEditor` gains a formatting
toolbar on the bump.** Pass `toolbar={false}` to keep one without it.
Run `npx ui-foundation sync` for the updated cell patterns.

- **A fixed toolbar above the text**, in five groups: Bold, Italic,
  Strikethrough, Code · Heading, Subheading · Bulleted list, Numbered
  list, Task list · Quote, Code block · Link (the 3.15 link box).
  - Each button is pressed while its format is on where the caret is,
    and a press turns it off again. Lists switch type in place
    (bulleted ↔ numbered ↔ tasks).
  - Each names its shortcut in a tooltip (⌘B on Apple, Ctrl+B elsewhere)
    and in `aria-keyshortcuts`.
  - **Keyboard:** one tab stop (Shift+Tab from the text), the arrow keys,
    Home and End along the row; Enter or Space formats and gives focus
    back to the text.
  - **Mouse:** a press never takes focus from the text, so the selection
    stays and a phone's keyboard doesn't close.
  - **Read-only** (while a save is in flight), every button is disabled.
  - **Editing in place:** the toolbar is part of the field, so moving to
    it doesn't save; Ctrl/Cmd+Enter and Esc work from it as from the text.
  - axe-clean and token-only in both themes; its icons clear 3:1 (the
    glyph check).
- **The editor always has an id** (the app's, or its own), so the toolbar
  can name what it controls (`aria-controls`).
- **Read-only text is muted; the toolbar isn't** (its disabled buttons
  say so). The field's border and ring still animate; its text colour no
  longer does.
- **The template's Widget description** has the toolbar, on the form and
  in place. A new spec covers formatting in place without saving early.
- Queued in `docs/DEFERRED.md`: a floating toolbar and a slash menu (the
  developer wants both after this one), images, and one finding: inside a
  list item, Tab and Shift+Tab indent and outdent the item (Milkdown's
  list keys) rather than leave the text.

### How an app adopts it

1. **Nothing to add:** the toolbar appears on every editor. Where a value
   is short enough that it's noise, pass `toolbar={false}`.
2. **Specs** that Tab through a form now meet one more stop before the
   editor (the toolbar), and specs that count a screen's buttons count
   twelve more per open editor. Find toolbar buttons by name
   (`getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name: 'Bold', exact: true })`).
3. **Delete any toolbar** the app built over the editor.

## 3.15.0 — the rich-text editor: links, Markdown paste, keyboard tasks, placeholder, count

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook and cell patterns. An app's editors gain the new keys and paste
on the bump; the placeholder and the count appear once it passes them.

- **Links: Ctrl/Cmd+K.** On selected words it opens a small box at the
  caret for the address; Enter applies. On an existing link it edits it,
  with Remove link. With nothing selected the address goes in as its
  own text. Web and email addresses only (`example.com` becomes
  `https://example.com`, `name@example.com` a `mailto:`; a path or
  `#heading` is kept); `javascript:`, `data:` and any other scheme are
  refused with a message. Until now the editor had no way to add a link
  short of pasting one from a web page.
- **Markdown pasted as plain text arrives formatted** (`## Notes`,
  `**bold**`, lists, tables), and raw HTML in it still arrives as text.
  Plain text with no Markdown in it goes in exactly as typed (a paste's
  leading space used to be dropped). A paste from a web page is
  unchanged. A copy out of the editor is Markdown.
- **Ctrl/Cmd+Shift+Enter ticks the task item the caret is in** (its
  checkbox was mouse-only). Ctrl/Cmd+Enter stays the save.
- **`RichTextEditor` takes `placeholder`** (shown while the document is
  empty, `aria-placeholder` for screen readers) **and `maxLength`**: from
  80% of it, "1,650 of 2,000 characters" shows under the editor and
  describes it, turning to "12 characters over the limit of 2,000" in the
  destructive text tone. Typing isn't stopped; the schema still refuses
  the save.
- **`PopoverContent` takes `anchor`**, Base UI's: a popover with no
  trigger of its own, placed at an element or a point.
- **Checked, no change: Ctrl/Cmd+Enter inside a table.** The table also
  binds it ("leave the table"); a new spec confirms it saves the field
  once, adding nothing.
- **The template's Widget description** has the placeholder ("Describe
  the widget") and the count, against `DESCRIPTION_MAX_LENGTH`, one
  constant the schema and the editor both read.
- Queued in `docs/DEFERRED.md`: the fixed toolbar (next, 3.16), a
  floating toolbar and a slash menu after it, and images.

### How an app adopts it

1. **Links, paste, the task key:** nothing beyond the bump. Specs that
   paste plain text into an editor now get formatted Markdown.
2. **Placeholder and count:** pass `placeholder` and `maxLength` to each
   `RichTextEditor`, the limit from one constant the zod schema also uses
   (Widget's `DESCRIPTION_MAX_LENGTH` in `widget-schema.ts`). Delete any
   counter the app built beside the editor.

## 3.14.0 — stage circles, pressed icons, icon groups, and a rich-text fix

Additive. Run `npx ui-foundation sync` after the bump for the updated
cell patterns, design language and playbook. Nothing in an app looks
different until it adopts a pattern; the fix applies on the bump.

Raised by a real app that built five of these for itself; each is now
generic, here for every app, with its accessibility and contrast checked
in both themes.

- **Fixed: the rich-text editor added a trailing newline.** Editing the
  *last* block of a Markdown value saved it with a `\n` on the end
  (`"First line."` edited to `"First line. More."` saved as
  `"First line. More.\n"`). A save now ends the way the original ended,
  whichever block was edited, so it changes only what was typed
  (`mergeMarkdown` in `src/lib/markdown-merge.ts`).
- **The template's Markdown long text is checked, not trimmed.** Widget's
  `description` schema used `.trim()`, which rewrote what nobody touched
  (a leading indent that makes a code block, the text's own ending), and
  had been hiding the bug above on Widget. It's now
  `.refine((value) => value.trim() !== '', ...)`, and the playbook says to
  write a Markdown long text that way.
- **New component: `StageCircle`** (new cell pattern 19). An ordered
  status as a small circle beside the word that fills as the record moves
  on: `stage={0}` dashed, `1`–`3` a quarter to three quarters filled,
  `'complete'` solid with a tick, `'exit'` struck through. `tone` is
  `muted` (the default), `info`, `success`, `warning` or `destructive`,
  always the `*-text` shade. Pattern 19 says when to use it (an ordered
  lifecycle toward *done*) and when pattern 5's tone badge is still right
  (no order, or an end that isn't *done*: Widget's Status keeps its badge,
  and the pattern says why).
- **New primitive: `@tristan2828/ui-foundation/ui/toggle`** (shadcn's, on
  Base UI), with `icon-xs` (24px) and `icon-sm` sizes added, matching
  `Button`'s.
- **Cell pattern 15 gains a variant: a pressed icon inside another
  value's cell** (a "focus" flag that exists only while the status is
  "doing"). An `aria-pressed` `Toggle`, named for its row, faint when off
  and filled in `destructive-text` when on (the pattern says why that tone
  means "flagged", not "error"), saved through `useRecordUpdate` with the
  "Saving" slot beside it, rendered only while the owning value allows it.
  Also a quick action on the view (pattern 17's table).
- **Cell pattern 10 gains a second example: a dependency list.** A
  computed summary in the cell ("Ready", "2 holds"), every related record
  in the popover grouped by kind, held in `foreground` with its reason and
  clear in `muted`, each kind with its glyph; a row that links nothing
  renders plain text, not a button; the popup needs an `aria-label`
  (axe fails an unnamed dialog).
- **Cell pattern 4 gains a multi-value variant: several values as icons,
  every name in one tooltip** on a focusable `role="img"` group, "…" for
  a value still loading, each icon beside its name where there's room.
  Plus a testing note: read the open tooltip with
  `[data-slot=tooltip-content][data-open]`, since a closing one stays in
  the DOM for a moment. And pattern 4's trigger now gets a focus ring.
- **A glyph contrast check.** axe measures text only, so the package's
  Storybook now measures every icon in its design-language stories
  against what's behind it, failing below WCAG's 3:1 non-text minimum in
  either theme. It covers the stage circle in every tone, the pressed
  icon's faint off state (`text-muted-foreground/80` is the faintest that
  passes, 3.2:1 in light mode; `/70` fails at 2.7:1) and all eight
  category slots, which no gate measured before. `design-language.md`
  has a new "Glyphs and icons: 3:1" section.
- **Not built: an "icon from a fixed set" field type.** It's structure,
  and one app needs it so far; it's in `docs/DEFERRED.md` with its
  trigger (a second app plans an icon field).

### How an app adopts each

1. **The newline fix:** nothing beyond the bump. If the app trimmed a
   Markdown long text's value to work around it, or trims one in its form
   schema, replace the `.trim().min(1, ...)` with
   `.refine((value) => value.trim() !== '', ...)` (Widget's `description`
   in `widget-schema.ts`).
2. **The stage circle:** import `StageCircle` from the package, map the
   status in `<entity>-format.ts` as
   `Record<Status, { stage: StageCircleStage; tone?: StageCircleTone }>`,
   and render `<StageCircle {...STATUS_STAGE[status]} />` beside the word
   (pattern 19). Delete the app's own SVG stage-circle component and its
   path data.
3. **The pressed icon in a cell:** replace the app's own pressed icon
   button with the package's `Toggle` at `size="icon-xs"`, copying
   pattern 15's variant (its class string and the
   `group-aria-pressed/toggle:fill-current` icon). Keep its save
   (`useRecordUpdate`) and "Saving" slot. If its off state was fainter
   than `text-muted-foreground/80`, it was below 3:1: take the pattern's.
   An app that installed shadcn's `toggle` into `src/components/ui/` gets
   a lint error after the bump: delete that copy and import
   `@tristan2828/ui-foundation/ui/toggle`.
4. **The dependency list:** nothing to replace; pattern 10's second
   example is the reference for an app's own. Name its popover
   (`aria-label` on `PopoverContent`) if it doesn't yet.
5. **Icons with one tooltip:** check an app's own icon group against
   pattern 4's variant (one tooltip, a `role="img"` trigger with a focus
   ring, "…" while loading), and change any spec reading
   `[data-slot=tooltip-content]` to add `[data-open]`. The group stays the
   app's own component: its icon and colour maps are its data.
6. **The icon field type:** nothing yet. An app that built one keeps it;
   it's the reference when a second app needs one.

## 3.13.0 — editing in place on the view

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook, plan template and cell patterns. A view whose plan names no
fields to edit in place is unchanged: every value stays read-only, and
quick actions work as in 3.12.

The rule behind every part of it: nothing typed is ever lost.

- **A value on the view can turn into its form control and save when you
  leave it** (new cell pattern 18, "Editable value"). `EntityView` takes
  `edit` on a field or a `content` section and `titleEdit` for the title;
  a header badge wraps itself in the new `<EditableValue>`. Make each with
  `editInPlace({ kind, value, control, schema, save })`:
  - **Start:** click the value (a link inside it still navigates), or
    tab to its pencil ("Edit <label>") and press Enter. Hover and focus
    show it's editable.
  - **Save:** leave it (click or tab elsewhere), Enter (one line),
    Ctrl/Cmd+Enter (long text, or any kind), or pick a choice. Esc puts
    the saved value back. Unchanged closes with no request; a value the
    form's schema refuses never leaves the browser.
  - **Saving:** the control stays, read-only, with "Saving…" under it,
    until the server agrees. Not optimistic: the view shows the record
    the server returned, side effects included.
  - **Refused** (a 422, any other `AppError`, no answer): it stays open
    with exactly what was typed and the reason under it, a 422's field
    error word for word. No toast, nothing reverts; leaving again
    retries, Esc gives up.
  - **One field at a time:** opening another saves the open one first;
    if that fails, the open one stays and the other doesn't open.
  - **Leaving the page** with unsaved text asks "Discard your changes?"
    (React Router's `useBlocker`: the app needs a data router, as the
    template has); closing the tab asks through `beforeunload`.
- **New component: `RichTextEditor`.** Long text written as Markdown,
  edited as formatted text (Notion-style) and saved as Markdown: an
  untouched document comes back byte for byte, and an edited one keeps
  every block the person didn't change exactly as written. Raw HTML
  shows as text and nothing pasted adds markup. It loads on first use
  (~106 KB gzipped, its own chunk). New package dependencies:
  `@milkdown/kit`, and `unified`/`remark-parse`, already installed
  through `react-markdown`. The case for the editor is in
  `docs/ARCHITECTURE.md` "The rich-text editor".
- **`useRecordUpdate` takes `optimistic` and `toastOnError`** (both
  default `true`). Editing in place uses `false` for both: the value
  shows once saved, and a refusal comes back through `mutateAsync`.
- **`MultiReference` takes `readOnly` and `aria-describedby`.**
- **`expectNoAxeViolations` takes `{ disableRules, exclude }`**, and
  `/testing` exports `POPUP_FOCUS_GUARDS`, for checking a page with a
  list open (`e2e/a11y.spec.ts` shows when each applies).
- **Fixed: form errors in dark mode were below AA contrast.** `FieldError`
  and an invalid `Field`'s label painted the destructive fill colour
  (4.15:1 on the dark page); they now use `--destructive-text`, the
  tone's text shade, like every other tone used as text. No app change.
- **Quick actions are for one click now.** A status picked from a list
  edits in place (pattern 18) instead of being a quick action (pattern
  17 no longer lists it). A 3.12 status quick action keeps working; move
  it when convenient.
- **The template's Widget view edits Name, Status, Price, Description
  (rich text) and Extra Categories in place**, with each control in
  `widget-fields.tsx`, shared with the form (whose Description is now
  the rich-text editor too). `useEditWidgetField` is the save;
  `e2e/widget-edit-in-place.spec.ts` covers each kind, a 422, a 500, no
  answer, one-at-a-time and the leave prompt; `e2e/a11y.spec.ts` checks
  a field open, saving, refused, the editor, an open list and the leave
  prompt in both themes.

### How an app edits fields in place

1. **Plan it.** In `docs/entities/<entity>.md`'s "View screen", add
   `- Edit in place: title, status, notes` naming the fields, with any
   rule the server enforces on one and any side effect.
2. **Share each field's control** between the form and the view, in
   `src/routes/<entity>/<entity>-fields.tsx` (copy the matching one from
   Widget's `widget-fields.tsx`; a Markdown long text uses
   `RichTextEditor`), and switch the form to it through a `Controller`.
3. **Add the save**: copy `useEditWidgetField` into `use-<entity>.ts`
   (`useRecordUpdate` with `optimistic: false, toastOnError: false`).
4. **Mark the fields** on the view, copying `widgetEdits` in
   `widget-view.tsx`: `editInPlace({ kind, value, control, schema:
   <entity>FormSchema.shape.<field>, save: (v) => edit.mutateAsync({ <field>: v }) })`
   on the field (`edit`), the section (`edit`), the title (`titleEdit`)
   or a badge (`<EditableValue>`).
5. **Test it** like `e2e/widget-edit-in-place.spec.ts`, and add the
   in-place block of `e2e/a11y.spec.ts`. Specs that find the view's Edit
   button by name need `exact: true` now: `getByRole('button', { name:
   'Edit', exact: true })`, since each editable value has an "Edit
   <label>" button.

## 3.12.0 — quick actions on the view

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook, plan template and cell patterns. A view whose plan lists no
quick actions is unchanged: every value stays read-only, as in 3.10.

- **New hook: `useRecordUpdate`,** one record's fields saved on their own,
  without the form. A PATCH that shows at once everywhere the record is
  cached (its detail query, which the view shows, and every list page
  holding it), then takes the record the server returns, so a server-side
  effect (a computed field, a flag the change cleared) shows at once. A
  refusal rolls back and toasts "Couldn't update <name>: <reason>", the
  reason being the server's (the 422's message on the field sent, else
  `AppError.message`). Saves of one record run one at a time, and each
  request is built from the server's latest record when it's sent, so
  a change can be a function of the record (`(task) => ({ checklist:
  ... })`) and two quick ticks of a whole-list field both land. The lists
  refetch once the last save settles. It's the save editing in place
  will build on.
- **New cell pattern 17, "Quick action on the view":** read-only is the
  default, and only the fields the plan names become controls: a
  `single choice` as a `Select` showing its tone badge, a `yes/no` as a
  `Switch` with its words, a sub-record list's yes/no as a checkbox per
  item in a named group (`Done: <item text>`). Each control shows its own
  "Saving" spinner and disables nothing. `EntityView` needs no new prop:
  controls go in `badges`, a field's `value` or a section's `content`.
- **The plan template's "View screen" takes a `Quick actions:` line**,
  and the playbook copies the quick-action controls only when a plan has
  one.
- **`toAppError` keeps a 422 whose `detail` is a sentence** (FastAPI's
  `HTTPException(422, "...")`, the natural way to refuse a rule like a
  cap) as the error's message. It used to throw a `TypeError` reading it.
- **The template's Widget view has quick actions:** Status picked in the
  header, In Stock flipped in the header (no longer a Details row), and
  Checklist items ticked in place, whose done-count and the
  server-computed Progress badge follow
  (`src/routes/widgets/widget-quick-actions.tsx`). The table's In Stock
  switch uses the same save (`useSaveWidgetField`, replacing
  `useToggleWidgetInStockMutation`): it now updates the widget's view too,
  shows "Saving" instead of disabling itself, and its refusal toast gives
  the field's 422 message.

### How an app adds quick actions to a view

1. **Plan them.** In `docs/entities/<entity>.md`'s "View screen", add
   `- Quick actions: status, flagged, checklist` naming the fields, plus
   any rule the server enforces on one and any side effect it has.
2. **Wrap the hook** in `src/routes/<entity>/use-<entity>.ts`, copying
   Widget's `useSaveWidgetField`:
   `useRecordUpdate<Entity, EntityUpdate>({ id, detailKey, listsKey, update, name })`
   with the entity's detail key, its list key prefix, the gateway's PATCH
   and the record's name for the toast.
3. **Build one component per control** in
   `src/routes/<entity>/<entity>-quick-actions.tsx`, copying the matching
   one from Widget's (`WidgetStatusSelect`, `WidgetInStockSwitch`,
   `ChecklistItems`), and put it where the value shows on the view.
4. **Test each one** like `quick action: …` in
   `e2e/widget-view.spec.ts`: it saves, a refused save goes back with the
   server's reason, "Saving" shows while nothing is disabled, and two
   quick changes to a list both land.

An app with a hand-written row toggle (pattern 15 before 3.12) can move
it onto the same hook, so its record's view stays current too; nothing
breaks if it doesn't.

## 3.11.0 — columns per saved view

Additive. Run `npx ui-foundation sync` after the bump for the updated
playbook and plan template. A table with no saved views, or whose views
name no columns, is unchanged.

- **A saved view can name the columns it shows.** `TableView` takes
  `columns` (column ids). A view of one kind of record can then show the
  field only that kind uses, in place of a column it never fills.
- **`useTableUrlState` reports the active view.** Its optional third
  argument is the table's views by id (`{ all: {...}, bugs: {...} }`), and
  it returns `activeView`: the id of the view whose filters the URL has
  exactly (multi filters in any order), or `null`. Sort and page don't
  count. Adding or changing any filter leaves the view, so its columns go
  with it: they were chosen for that view's records only. Nothing new
  goes in the URL; a refresh or a shared link brings the view back from
  its filters.
- **`DataTable` takes `visibleColumns`** (optional): the ids of the
  columns to show, in their `columns` order. Undefined shows every column.
  Pinning, the loading skeleton and the header follow the visible ones.
- **The template's Widgets table has saved views** ("All widgets" and
  "Restock", a pressed button group above the filters, `aria-pressed` on
  the active one), with an e2e test for the columns coming and going.

### How an app gives a saved view its own columns

1. Pass the views to the hook: `useTableUrlState(FILTERS, MULTI_FILTERS, VIEWS)`,
   with `VIEWS` typed as `Record<'all' | 'bugs', TableView<Filter, MultiFilter>>`.
2. Give a view `columns: ['title', 'severity', ...]`, using the column
   defs' ids.
3. Pass `visibleColumns={activeView ? VIEWS[activeView].columns : DEFAULT_COLUMNS}`
   to `DataTable`, where `DEFAULT_COLUMNS` is `undefined` (every column) or
   a list that leaves out a field only a view shows.

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
