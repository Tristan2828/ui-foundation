# Changelog

Notable releases and what an app must do to take them. Since 4.34 a
release is cut only when a PR bumps the version (#231), so each one has
an entry here covering every PR since the last. Before that every merge
published a patch, with its `release-smoke` result in the notes; those
are listed on the
[releases page](https://github.com/Tristan2828/ui-foundation/releases).

## 4.43.0 — `testing`'s page loads wait for the app's boot

Additive, so a minor.

- **`test` and `expect` from `@tristan2828/ui-foundation/testing`**:
  Playwright's, with a `page` whose `goto()` and `reload()` return once
  the app has rendered into `#root`, not at the load event. React renders
  only after MSW's `worker.start()`, which the load event doesn't wait
  for (up to 2.4 s past it under load), so a spec's first expect met an
  empty page. When one of the app's own files is refused before then
  (`vite preview` under load, `ERR_CONNECTION_REFUSED`/`RESET`, which the
  browser never retries for a module script), the page is loaded once
  more; a second refusal fails naming the file. A page without `#root`
  isn't waited on. `withBootWait(page)` does the same to a page an app's
  own fixture opens.
- **The suites use it**: `defineA11ySuite`'s page loads (and the banner
  suites') no longer flake as "never rendered" in a busy run.
- The template's specs import `test` and `expect` from the package;
  add-an-entity.md step 8 says to.

**To take it:** in each spec, import `test` and `expect` from
`@tristan2828/ui-foundation/testing` instead of `@playwright/test`
(types like `Page` still come from Playwright). An app that wrote its
own boot wait can drop it for this one.

## 4.42.0 — SpinWheel; FillInQueue and FillInChoice

Additive, so a minor.

- **`SpinWheel`** picks one item at random, weighted: an SVG wheel of
  slices (`items`, each `{ id, label, weight?, emphasis? }`; `weight` is
  a slice's size and its chance), a pointer at the top, the count in
  the hub and a Spin button. It turns a few times with an ease-out and
  stops with the pointer inside the pick, then calls `onResult(item)`
  and says "Picked <label>" in a polite live region; with reduced
  motion it doesn't turn. `result` is the slice drawn picked at rest
  (the app's), `emphasis` a tinted slice, `emptyMessage` the empty
  wheel (Spin disabled), `random` the source of chance for tests.
  `pickSpinWheelIndex(items, value)` is the pick on its own.
  design-language.md "Picking at random"; Storybook `app/SpinWheel`.
- **`FillInQueue`** fills in a list of records' missing values one
  record at a time: progress and "Record i of n" on top, the app's
  `renderItem` in a centred column, Skip and Save and next under it.
  `onSave(item)` is the app's save; when it resolves the next record is
  shown (the saved one usually left `items`; one still there is moved
  past), Skip wraps round, and the focus goes to the new record. Enter
  is Save and next (not in a textarea); a refused save keeps the record
  with its message under the buttons. `canSave` (a boolean, or asked
  about the record on screen), `progress`, `loading`, `error` with
  `onRetry`, `empty`, and `index`/`onIndexChange`.
  **`FillInChoice`** is a record's field as a row of toggle buttons
  (`aria-pressed`, clicked again to clear) named by its `label`, a
  `suggestion` drawn dashed in the info tone with "Suggested: <label>
  (<note>)" under it, and `shortcut` for the number keys inside the
  queue. design-language.md "Filling in what's missing"; Storybook
  `app/FillInQueue`.

**How an app adopts it:** bump both packages and run `sync`. Nothing
changes on its own.

## 4.41.0 — A list in place added by upload; muted text on the edit tint

Additive, so a minor (#256, #257).

- **editInPlace's `list` kind takes `add`** (#256): what adds items in
  place of "Add" and its blank row, such as an upload or a picker. It
  renders the app's own control and is given `add(items)`, which saves
  them at the end of the list through the list's `save`, as a move is:
  "Saving…" under the list, a refusal there with the list as it was, the
  caret back on the control. It also gets `items` (to stop at a limit),
  `disabled` (a change is saving) and `onProblem(message)`, which puts an
  upload's refusal where a refused save shows. `newItem` and `addLabel`
  are optional with it. A list of files then reads, edits, moves and
  saves exactly like a checklist (`cell-patterns.md` "A list of
  sub-items"; the `EditableList` story "Added by upload").
- **Muted text on an editable value's hover and focus tint reads as
  foreground** (#257): `text-muted-foreground` on `bg-muted` is 4.34:1 in
  light mode, under AA. EntityView's "Not set", a done checklist item, an
  app's own muted placeholder ("No caption") inside an `EditableValue`
  turn `text-foreground` while the value is hovered or its pencil has the
  caret; axe covers both themes (`e2e/editable-list.spec.ts`).

**How an app adopts it:** bump both packages and run `sync`. Nothing
else changes on its own; the contrast fix needs nothing. Then:

- **Remove any stopgap** that turned muted text foreground on the edit
  tint (`group-hover/editable:text-foreground` and its
  `group-has-[[data-edit]:focus-visible]/editable` twin): the package
  does it now.
- **A list built by hand on `ListEditor` and `EditableValue` because its
  Add is an upload** moves onto the `list` kind:

```tsx
const files = editInPlace<Attachment>({
  kind: 'list',
  value: record.attachments,
  save: (change) => editField.mutateAsync((current) => ({ attachments: change(current.attachments) })),
  itemName: (index) => record.attachments[index]?.name ?? `file ${index + 1}`,
  add: ({ add, items, disabled, onProblem }) => (
    <UploadButton
      disabled={disabled || items.length >= MAX}
      onUploaded={(stored) => add(stored.map(toAttachment))}
      onRefused={(error) => onProblem(error.message)}
    />
  ),
  renderShown: (file) => <FileRow file={file} />,
  renderItem: (props) => <CaptionInput {...props} />,
})
// The section: { title: 'Files', content: null, emptyLabel: 'No files yet', edit: files }
```

Its own save queue and "Saving…" line go: the list keeps both. Its
Playwright specs keep their names (the row buttons are ListEditor's, as
before).
## 4.40.0 — A list as cards: `DataTable` layouts

Additive, so a minor (#252). 4.39.0 is the dark stage for timed screens.

- **`DataTable` takes card layouts beside its table**: `layouts`, each an
  id, a label, an icon and a `renderCard(row)`, drawn as a grid (`size`
  `sm` covers, `md` thumbnails, `lg` big ones; the columns come from the
  table's width, three, two or one on a phone) or a `list` (one card per
  line). A switch at the end of the toolbar moves between them, the table
  first (`tableLayout` renames it, "Rows" for a list-like table). Paging,
  `groupBy` headings with their summaries, and the loading (a skeleton
  card grid or list), empty, error and past-the-last-page states work in
  every layout.
- **`useTableLayout({ layouts, defaultLayout, storageKey })`** gives
  `layout` and `setLayout` for DataTable's `layout` and `onLayoutChange`:
  the URL's `?layout=`, then the one remembered for the table on this
  device, then its default.
- **`Artwork`**, a card's picture: a fixed shape (2:3, 1:1, 16:9), the
  image or a neutral placeholder (the list's icon, optionally the title),
  and four corner slots. **`ArtworkTag`** labels a picture (a length,
  "Live"); **`ArtworkToggle`** is the round button that marks a record
  from its cover (Read, Owned).
- `design-language.md` "A list as cards" says when a list gets cards and
  what a card holds.

**How an app adopts it:** bump both packages and run `sync`. A table that
stays a table changes nothing. For one that gets cards:

```tsx
const { layout, setLayout } = useTableLayout({
  layouts: ['table', 'covers'],
  defaultLayout: 'covers',
  storageKey: 'my-app:books:layout',
})

<DataTable
  {...tableProps}
  layouts={[{ id: 'covers', label: 'Covers', icon: LayoutGridIcon, size: 'sm', aspect: '2:3', renderCard: (book) => <BookCard book={book} /> }]}
  layout={layout}
  onLayoutChange={setLayout}
/>
```

Build each card from the cells the table already uses, so the two never
disagree, and give it every action the row has. Playwright: one success
test per layout (`?layout=covers` in the URL opens it), and one that the
pick is remembered.
## 4.39.0 — A dark stage for timed screens

Additive, so a minor (#253).

- **`SessionView` takes `dark`**: the view renders with the dark theme's
  tokens (theme.css's `.dark`, and `color-scheme: dark`) whatever the
  app's theme, scoped to the view, so the page under it keeps its own.
  It carries `data-look="dark"`.
- **`SessionStage`**: the stage a timed screen draws its run in, below the
  view's header. `tone` (`neutral`, `success`, `info`, `warning`,
  `destructive`) and `glow`, a radial wash of the tone behind the centre.
  It sets `--stage-tone` and `--stage-tone-text` for its children.
- **`sessionStageLit`** (the big time in the tone's text shade, with a
  glow around the figures), **`sessionStageQuiet`** (a quiet outline
  control) and **`sessionStageMain`** (the main control, an outline in
  the foreground colour) are class strings for the stage's contents.
- Storybook's `app/SessionView` has a DarkStage story, axe-checked in both
  app themes; `timed-screens.md` "The dark stage" has the recipe.

**How an app adopts it:** bump both packages and run `sync`. Nothing
changes until a screen opts in. To offer the dark stage as a setting,
keep a remembered switch beside the screen's Mute (`useMuted` with its
own key works for any on/off), then:

```tsx
<SessionView dark={darkStage} …>
  <SessionStage tone={darkStage ? phaseTone : 'neutral'} glow={darkStage}>
    <div role="timer" className={cn(TIME, darkStage && sessionStageLit)}>{time}</div>
    <Button variant="outline" className={cn(darkStage && sessionStageQuiet)}>Skip</Button>
  </SessionStage>
</SessionView>
```

A screen that draws its own box inside the view (a border, a
`bg-background` panel) drops it on the stage, or the glow sits behind it.
Run the screen's axe check with the stage on under both app themes.

## 4.38.0 — Follow-ups on `useRecordUpdate` itself

Additive, so a minor (#250).

- **`useRecordUpdate` takes `onSuccess`, `onError` and `onSettled`**:
  `onSuccess(saved, change)` runs once the caches hold the server's
  record, `onError(error, change)` after the rollback (and its toast),
  `onSettled(saved, error, change)` after either. They run on the
  mutation, so they run even when the control that saved has unmounted,
  which a `mutate(change, { onSuccess })` callback doesn't: TanStack
  skips those once the caller is gone, so a popover closed mid-save lost
  its refresh. What a callback returns is awaited before `mutateAsync`
  resolves, as in TanStack. `cell-patterns.md` "17. Quick action on the view"
  says where a refresh goes.

**How an app adopts it:** bump both packages and run `sync`. Then move
each refresh a save always needs (invalidating another query, a hub
summary) from `mutate(change, { onSuccess })` into the hook's options:

```ts
const save = useRecordUpdate<Widget, WidgetUpdate>({
  ...keysAndUpdate,
  onSuccess: () => client.invalidateQueries({ queryKey: summaryKey }),
})
```

Per-call effects (navigate after a form saves, a toast in the call's own
words) stay on `mutate()`.

## 4.37.0 — The reminders job on an app's own table, and a widget header linking out

Additive to both packages, so a minor (#247, #248). Nothing changes on the
wire or in the database.

- **The reminders job takes the app's table model** (#247):
  `reminders.register(model=MyReminder)` and
  `send_due_reminders(session, now, model=MyReminder)` read any table
  model with the reminder columns, in whatever schema or table name the
  app keeps them. Left out, they read the package's `reminders`, as
  before.
- **Push and reminder tables only for an app that uses them** (#247):
  `PushSubscription` moved to `foundation_backend.push_models` and the
  package's `Reminder` to `foundation_backend.reminders_models`, so
  importing `foundation_backend.models` no longer puts
  `push_subscriptions` and `reminders` on `SQLModel.metadata`.
  `push_subscriptions` arrives with `foundation_backend.push` (or
  `reminders`, which sends through it); `reminders` with the package's
  `Reminder` (imported, or the job run without a model).
  `from foundation_backend.models import PushSubscription, Reminder`
  still works and registers the table then.
- **`WidgetCard`'s header link can go outside the app** (#248):
  `link={{ href, label }}` beside `{ to, label }` opens in a new tab with
  the external-link mark and "(opens in a new tab)" for a screen reader,
  as `WidgetListItem`'s `href` does. The type is exported as
  `WidgetCardLink`. Story `app/WidgetCard` (Saved links, Brand mark),
  `e2e/widget-card.spec.ts`; `design-language.md` "Widget cards".

**How an app adopts it:** bump both packages and run `sync`. Nothing
changes for an app on the package's tables.

- An app that keeps reminders in its own table and copied the job's
  query and send loop deletes its copy and registers the package's job
  on its model: `reminders.register(model=MyReminder)`
  (`docs/foundation/reminders.md` "A reminder is the app's own row").
- An app that relied on `foundation_backend.models` alone to put
  `push_subscriptions` or `reminders` on the metadata (its Alembic
  `env.py`, a test's `create_all`) imports the table from where it uses
  it, or re-exports it from its `app/models.py` as the template does.
  An app without push, or with reminders in its own table, now sees
  autogenerate leave those tables alone; it re-exports neither.
- A widget about an outside service can put its address in the header:
  `link={{ href: 'https://…', label: 'Open <service>' }}`.

## 4.36.0 — A board

Additive, so a minor.

- **New: `Board`**, a list as a column per value of one choice field, a
  card per record, moved by dragging it to another column or by its Move
  menu (the keyboard and a phone, and values with no column, such as
  Archived). `onMove` is the app's save, through `useRecordUpdate`;
  without it the board is read-only. It owns its loading, error and
  empty states, and its columns take a `count` and a `footer` for a list
  longer than a page. A move from the Move menu keeps the focus on the
  card (or the board, if the card left it) and is announced to a screen
  reader; a column gives its `name` in words for the menu when its
  `label` isn't plain text, and `headingLevel` sets its heading's level.
  On a phone a column is the board's width less 2rem, one at a time.
  Story `app/Board`, axe in both themes, `e2e/board.spec.ts`;
  `design-language.md` "A list as a board".

**How an app adopts it:** bump both packages and run `sync`. Nothing
changes for an app that doesn't use it. An app with its own board
replaces its columns, drag and Move menu with `Board`, keeping its card
content and its save.

## 4.35.0 — MCP tools, scheduled jobs and Web Push move into the backend package

Additive to both packages, so a minor (#230). Nothing changes on the wire
or in the database.

- **`ui-foundation-backend` now holds AI chats' tools, the scheduled
  jobs, Web Push and reminders**, as 4.25 moved sign-in: `mcp`
  (`McpEntity`, `ListArgs`, `check_entities`, `register_entities`),
  `mcp_tools`, `routers.mcp`, `jobs`, `routers.jobs`, `push`,
  `reminders`, `routers.push`, their tables (`McpAuditEntry`,
  `JobRunRecord`, `PushSubscription`, `Reminder`), the job and push
  schemas, their settings in `config` (`JOBS_ENABLED`,
  `JOB_RUNS_KEEP_DAYS`, `PUSH_*`, `VAPID_*`), and the scripts
  `generate_vapid_keys`, `send_test_push` and `check_jobs_live`. A new
  `push` extra brings `cryptography`. Reference copies of migrations
  0013–0015 are in its `migrations/`.
- **The template keeps only what is its own:** its `McpEntity` list
  (`app/mcp_entities.py`, ending in `register_entities(ENTITIES)`), its
  `main.py` wiring, and a test of its entities through the package's
  tools. The package's tests (jobs, push, reminders, the MCP registry)
  replace the template's copies, so a fix like #226's reaches every app
  with the pin.

**How an app adopts it:** bump both packages, run `sync`, then follow
`docs/consuming.md` "Moving to the shared MCP, jobs and push (4.35)" to
delete its copies. An app that doesn't keeps working on its own copies,
without their fixes.

## 4.34.0 — Nested nav, a phone bottom bar, a line chart, folding widgets

Additive, so a minor. Nine requests from apps (#232–#240).

- **New: `DataTable`'s `meta.align: 'right'`** (#237), for money and
  counts. The header and cells right-align, a sort arrow sits on the
  label's left so the label's right edge lines up with the numbers, and
  `totals` cells follow their column. `cell-patterns.md` §11 now says to
  right-align money and counts.

- **New: `defineA11ySuite`'s `checkSidebar`** (#234), default `true`.
  With `false`, the suite checks only the `nav` pages and routes it's
  given, without the test that the sidebar links exactly `nav`, so a
  modular app can keep one a11y spec per module. `loggedOutRoutes` is
  now optional, so only one of those files needs to check `/login`.

- **New: `headingFrom` on `Markdown` and `RichTextEditor`** (#235).
  `'hash'` (the default) is 4.33's mapping, `#` at `headingLevel`.
  `'text'` puts the text's own highest heading at `headingLevel`, the
  rest keeping their distance, so notes that start at `##` (an export
  from Notion, a README) don't skip a level under the page's heading.
  The editor reads it from the text it opens with; a heading added above
  it renders at `headingLevel` too. The look and the saved Markdown
  don't change. New type `HeadingFrom`.

- **New: `WidgetCard`'s `collapsible`, `defaultCollapsed` and
  `storageKey`** (#233). A chevron button at the header's end (named by
  the title, `aria-expanded`, `aria-controls` the body) folds the card to
  its header; the header's link stays. With `storageKey` the choice is
  remembered in `localStorage` on that device, and where storage is
  blocked it still folds for the page's life. The body is hidden, not
  unmounted. `useMuted` now runs on the same remembered-flag store.

- **New: `LineChart`** (#238): a small value-over-time chart for a
  record's page, plain SVG, no chart dependency. One series (`points`,
  `{ x, y }` oldest first, spaced by their dates), an optional dashed
  `target` with its label, one point marked (`mark`: `min`, `max`,
  `last`) with its value, `formatY`/`formatX`, `height`. The line is
  `info-text` and the target `success-text`, each 3:1 on a card in both
  themes (the glyph check measures them). A skeleton while loading, an
  empty line, a dot for one point. A screen reader gets the figure's
  name, a summary and a table of every point. New types `LineChartPoint`,
  `LineChartMark`, `LineChartProps`. `design-language.md` "A value over
  time" says how to use it.
- **New: `NavItem`'s `children` and `open`** (#239): a module's own
  pages listed under its entry, one level deep, as shadcn's sidebar
  sub-menu (a list inside the entry's item, so assistive tech reads them
  as its pages). They show while the page is the entry or one of them
  (`open: 'current'`, the default) or always (`'always'`); otherwise
  they're in the page but hidden, as a folded section's are. The most
  specific match is current and names the tab, children included. On the
  icon rail they take no icons: the entry looks current while one of them
  is, and its tooltip names them. `navTargets` and the a11y suite include
  them.
- **New: `AppShell`'s `bottomBar`** (#240): on a phone (below the md
  breakpoint) a bar of up to five shortcuts at the bottom of the screen,
  each a page (`{ to, label, icon }`) or a nav section by its label
  (`{ group, label?, icon }`) that opens a bottom sheet of that section's
  entries, children under their parents. The sheet takes focus, closes on
  Escape and on navigation. The item holding the current page is marked
  `aria-current`. The shell pads its content by the bar's height and
  `env(safe-area-inset-bottom)`; toasts already sit at the top, clear of
  it. The header's menu button stays. New type `BottomBarItem`.
- **The long synced docs open with an index** (#232): `add-an-entity.md`,
  `cell-patterns.md`, `design-language.md` and `timed-screens.md` (every
  doc over 300 lines) list each section, and each of the entity
  playbook's steps, with its anchor and the lines it spans, so an agent
  reads the index and then only those lines. Written from the headings
  by the package's `npm run docs:index`, and checked in its
  `verify:fast`. `AGENTS.md`'s block says to use it.

- **New: Python dependencies are allowlisted too** (#236).
  `ui-foundation-backend` ships `python -m foundation_backend.scripts.check_deps`:
  run from `backend/`, it fails on any requirement in `pyproject.toml`
  (`dependencies`, every optional group, every `[dependency-groups]`
  group) that isn't in `../deps-allowlist.json`'s new `python` list, or
  isn't pinned with `==`. The template lists its backend's seventeen and
  runs it first in `backend/scripts/verify.sh`.

**How an app adopts it:** bump the version, run `sync`.

- **A money or count column:** add `meta: { align: 'right' }` to it.
- **The backend's dependencies:** bump `ui-foundation-backend` to this
  version, add a `"python": [...]` list to `deps-allowlist.json` naming
  every distribution in `backend/pyproject.toml` (the template's is the
  starting point), pin any that aren't with `==`, and add
  `"$PY" -m foundation_backend.scripts.check_deps` to the top of
  `backend/scripts/verify.sh`'s checks.
- **A nav worked out per page to fake sub-entries:** declare the
  module's pages as its entry's `children` in `src/nav.ts` and drop the
  per-location nav and the indent icon.
- **A hand-built phone bottom bar:** pass its items as `bottomBar`
  and delete the layout route, its sheets and its padding.
- **A hand-drawn chart of one value over time:** replace it with
  `LineChart`.
- **A long hub:** pass `collapsible` and a `storageKey` per widget to
  the `WidgetCard`s read less often.
- **Notes imported or pasted from another tool:** add
  `headingFrom="text"` beside their `headingLevel`, and drop any a11y
  workaround for `heading-order` on them.
- **An app split into modules:** an `e2e/a11y-<module>.spec.ts` per
  module, each passing its own entries as `nav` with
  `checkSidebar: false`, and one spec with the whole nav (and
  `loggedOutRoutes`) that keeps the sidebar check.

## 4.33.0 — Totals rows, list items that open, headings that follow the page

Additive, so a minor. Four requests from apps (#222, #223, #225, #226).

- **New: `DataTable`'s `totals`** (#225): sums under the columns they add
  up, as a `<tfoot>` row. `{ label, cells: { [columnId]: value } }`: the
  label in a `<th scope="row">` in the first visible column, each
  already-formatted value under its column in that column's alignment
  and tabular figures, over a 2px border. It follows `visibleColumns`,
  pins with `pinFirstColumn` and `pinLastColumn`, scrolls with the table
  and is a body row's height at every density. It is hidden while
  loading, on an error and when there are no rows. The values come from
  the server, for every matching row, not the page. New type
  `DataTableTotals`. Money stays left-aligned like its column: right
  alignment is still a request of its own (`cell-patterns.md` §11).
- **New: `ListEditor`'s `summary`, `invalid` and `onDuplicate`** (#222).
  - `summary(index)` shows each item as one line, a button
    (`aria-expanded`) that opens it to its fields. One item is open at a
    time, held by row id so it stays open through a move. A new or
    duplicated item opens, and so does an item a field inside takes focus
    in.
  - `invalid(index)` keeps an item with an error open. Several can be.
  - `onDuplicate(index)` puts "Duplicate <item>" beside Remove, disabled at
    `max`. The app inserts the copy after the original (useFieldArray's
    `insert(i + 1, copy)`, leaving out a saved id), and it opens.
  - Without them, nothing changes.
- **New primitive: `@tristan2828/ui-foundation/ui/collapsible`**
  (shadcn's, on Base UI), which the summary lines use.
- **New: `headingLevel` on `Markdown` and `RichTextEditor`** (#223): the
  HTML level the text's `#` renders as, each deeper level one below,
  capped at `<h6>`. The default, 3, is what both did before (`#` h3,
  `##` h4, `###` h5), so nothing moves. Only the element changes: the look
  and the saved Markdown don't. New type `HeadingLevel`.
- **Wide tables in written text are reachable from the keyboard** (#223),
  in both: while a table overflows, its box is a tab stop, a region named
  "Table, scrolls sideways: <its first columns>", and the arrow keys
  scroll it (Home and End too in the editor). It updates as the table or
  the text resizes. A table that fits is unchanged.
- **Template:** the push test's fake service reads the request body
  before it answers a redirect (#226). On Windows, a socket closed with
  unread data on it is reset, and the client could see the reset before
  the 302.

**How an app adopts it:** bump the version, run `sync`.

- **A table of money or quantities:** have the list endpoint return its
  sums beside `total`, pass them as `totals`, and drop any stopgap totals
  line from the toolbar.
- **A long list of rich sub-records:** pass `summary`, `invalid`
  (`(i) => !!errors.<list>?.[i]`) and `onDuplicate` to its `<ListEditor>`.
- **Written text straight under the page's `<h1>`** (a form's notes
  field, a page that is the note): pass `headingLevel={2}`. Leave the
  default under a section's `<h2>`. An a11y test that worked around `#`
  headings or wide tables can drop the workaround.
- **An app that installed shadcn's `collapsible`** into
  `src/components/ui/` gets a lint error after the bump: delete that copy
  and import `@tristan2828/ui-foundation/ui/collapsible`.
- **An app that adopted push (#167)** makes the same one-line change in its
  `backend/tests/test_push.py`, if it hasn't already: read the body in the
  fake service's `do_POST`.

## 4.32.0 — Hub places: ModuleCard, compact hub cards, a numeric type role

Additive, so a minor. One request from an app (#224).

- **New: `ModuleCard` and `ModuleStrip`**, a hub's places above its
  widgets. A card's band holds the place's icon, tinted with its
  categorical slot (`category`), and its name on a 10% wash of the same
  slot, and links to the place (`to`, or `href` for another site, which
  opens in a new tab). Under it, one live number (`value`, any number or
  short string) with a `note`, and one `action` link at the foot. States
  are the number's: a skeleton while `isLoading`, "Couldn't load" and
  Retry inside the card on an `error`; no `value` shows no number, which
  is not an empty state. `ModuleStrip` is a navigation landmark of equal
  columns, 170px or wider, that wrap; on a phone, three columns of tiles
  with no action, each tile one link of 44px or more. New types
  `ModuleCardProps`, `ModuleStripProps`, `ModuleCardLink`,
  `ModuleCardPlace` and `CategorySlot`.
- **`data-density="compact"` reaches a hub's cards**: `WidgetCard`'s
  padding (16 → 12px), `WidgetList` rows (36 → 32px) and `ModuleCard`'s
  band and body. Text stays at `type-body`; on a phone a compact row is
  44px, its link filling it. Without `compact`, nothing changes size.
  **New variant: `density-compact:`**, for an app's own cards to follow
  it the same way.
- **New typography role: `type-numeric`**, 22px / 500 in tabular figures,
  for a card's count (28px at `large`).
- Axe, the token check and the glyph check cover every slot's band wash
  in both themes and at `large`. `design-language.md` has a "Module cards
  (a hub's places)" section, and its Typography and Density sections name
  the new role and what compact reaches. Storybook: `app/ModuleCard` and
  `patterns/Density` Hub cards.

**How an app adopts it:** bump the version and run `sync`. Then, on a hub
whose places are plain cards or tiles, replace them with a `ModuleStrip`
of `ModuleCard`s: give each the slot its module has elsewhere, its
summary number as `value` (with the query's `isLoading`, `error` and
`refetch`), and one `action`. A dense hub sets `data-density="compact"`
on the hub route's wrapper. An app that set `tabular-nums` and a size by
hand on such a number can use `type-numeric`.

## 4.31.0 — A source credit can carry the service's mark

Additive, so a minor. One request from an app (#220).

- **New: `Source`'s `icon`**, an `IconComponent`: the service's mark,
  drawn before its name inside the credit's link, `aria-hidden` and sized
  to the line's text. The name stays the link's accessible text, and the
  external-link arrow and "(opens in a new tab)" stay as they were. A
  source without one renders exactly as before.
- `add-an-entity.md` (the view's source credit) and `design-language.md`
  ("Logos and brand marks") name the slot; the EntityView Notice and
  footer story shows one.

**To take it:** bump the version, run `sync`. An app that leaves its
credit lines as words can pass the marks it already has as `icon`.

## 4.30.0 — Timed screens recover from an audio interruption

Additive, so a minor. One request from an app (#217): on iOS the audio
clock stops while the context is interrupted (speech speaking, a
notification, a call, the lock screen), so 4.29.0's booked chimes went
silent or came late, and the app had no way to notice.

- **The package resumes a stopped audio context** as soon as it stops
  (`statechange` to anything but `running` or `closed`), when the page is
  visible again, and on the next `unlockAudio()`. Nothing to do.
- **New: `onCuesRecovered(callback)`** calls back when the audio runs
  again after stopping, and returns the unsubscribe. Every booked chime
  has been taken back by then (each would have struck late), so the
  callback books again from where the run is now. The context's first run
  isn't a recovery.
- **New: `cuesInSync()`**: false when the audio clock has drifted from
  `Date.now()` by more than 250 ms since the bookings, or the audio is
  stopped; true when nothing is booked. For a tick to rebook where no
  recovery was announced (`cancelCues()`, then book again).
- **New: `keepAudioAlive({ title, onToggle? })`**, opt-in, to keep the
  sound playing with the phone locked: a silent looped track so iOS keeps
  the page's audio session, with `title` and Pause and Play on the lock
  screen (`onToggle(playing)` when pressed). Returns `{ pause(), stop() }`.
  Keep it behind a setting that is off by default: it pauses other apps'
  music. New types `KeepAudioAlive` and `KeepAudioAliveOptions`.
- `timed-screens.md` has an "Interruptions" section under "Background
  tabs", a `keepAudioAlive` bullet under "Sound", and the Playwright
  recipe's stand-in `AudioContext` takes `statechange` listeners.

**To take it:** bump the version, run `sync`. An app with its own
`AudioContext` scheduler can replace it with `chime({ at })`,
`cancelCues()` and `onCuesRecovered` (subscribe in an effect and rebook
from the run's position, as the Timer story does), and replace its own
silent-track module with `keepAudioAlive`. Screens that already book with
the package add `onCuesRecovered`. A test's stand-in `AudioContext`
without `addEventListener` still works; it just can't be interrupted.

## 4.29.0 — Brand marks, background-tab timers, and less noise after a deploy

Additive, so a minor. Four requests from apps (#193, #205, #206, #211).

- **New: `AppShell`'s `logo`** (#211): the app's mark before its title at
  the top of the sidebar, and alone, centred, at the top of the collapsed
  icon rail. Decorative; `title` still names the app.
- **`WidgetCard`'s `icon` takes any icon component** (#211), not only a
  `LucideIcon`: an app's own mark for a card about an outside service.
  Every Lucide icon still fits. **New export: `IconComponent`**, the type
  both slots take.
- **Design language: logos and brand marks** (#211). An app keeps the
  marks it needs as its own components (no icon pack), coloured with
  `currentColor` or with app-level `--brand-<name>` tokens, for marks
  only, the same in both themes (`design-language.md` "Logos and brand
  marks"; the token Hard Rule names the exception).
- **Timed screens in a background tab** (#193):
  - `chime` and `sequence` take `at` (a `Date.now()` time) and book the
    chime ahead on the Web Audio clock, so it strikes on time in a
    background tab. Each returns a `Cue` whose `cancel()` takes back what
    hasn't sounded; **new: `cancelCues()`** takes back every booked chime.
    New types `Cue` and `CueTime`.
  - `useSessionClock` ticks once a second (or as the browser allows) while
    the tab is hidden, enough for a countdown in the tab's title, and
    catches up exactly when it comes back.
  - `useSessionClock` returns **`startFrom(ms)`** (a run resumed from
    storage) and **`seek(ms)`** (Skip and Back), with pause and resume
    still exact.
  - `timed-screens.md` has a "Background tabs" section and its Playwright
    recipe.
- **Error reporting drops what can't be the app's** (#205): `Script
  error.` with nothing else, and a `window`/`unhandledrejection` error
  whose every stack frame is at a page's own address (a script the browser
  or an extension injected, e.g. Firefox for iOS's `__firefox__`) or in an
  extension. Route crashes and failed requests are never filtered.
  **New: `ErrorReportingOptions`' `ignore(report)`** drops a pattern of
  the app's own.
- **After a deploy, a missing lazy chunk reloads the page once** (#206)
  instead of crashing the screen: `FoundationProviders` listens for Vite's
  `vite:preloadError`, reloads once (remembered in `sessionStorage`), and
  reports nothing meanwhile. A second failure within a minute of the
  reload is a real missing file: it reaches the error boundary and is
  reported.

No migration, no contract change, no new dependency.

- **How an app adopts it:** bump `@tristan2828/ui-foundation` and
  `ui-foundation-backend` to 4.29.0 and run `npx ui-foundation sync`.
  Then, as wanted: pass the app's logo to `AppShell`'s `logo`; swap a
  widget card's generic icon for the outside service's mark; keep the
  app's `--brand-*` tokens as the design language says; replace an own
  `AudioContext` scheduler, hidden-tab tick and `Date.now()` clock with
  `chime({ at })`/`cancelCues()` and `startFrom`/`seek`; remove an own
  `vite:preloadError` listener; resolve the noise issues in the error
  tracker once deployed.

## 4.28.0 — ImageField, and images uploaded in the Markdown editor

Additive, so a minor: a photo on a record and pictures in notes, with the
upload the app's own (the package knows no endpoint and no storage).

- **New: `ImageField`**, a form control for one image. A thumbnail with
  Replace and Remove, or Add photo when empty. A file picked uploads at
  once through the app's `upload(file) => Promise<{ id, thumbUrl, url? }>`;
  while it does, the buttons wait and say so, and the value (the stored
  file's id, or `null`) changes only once it's stored. A file of a type it
  doesn't take, or over `maxSize`, is refused before it's sent, and a
  failed upload's `message` shows under the field. Use it in a
  react-hook-form `Controller`, with `thumbUrl` for the record's saved
  photo and `onBusyChange` to hold a submit meanwhile.
- **New: `RichTextEditor`'s `upload`** (with `imageAccept` and
  `imageMaxSize`): an image pasted, dropped, or picked with an Image
  button on the fixed toolbar is uploaded and goes in as `![](url)` (the
  result's `url`, else its `thumbUrl`). A placeholder shows where it will
  go while it uploads; it isn't part of the text, so nothing is saved for
  it. A refused file or a failed upload takes it away and says why in a
  toast. Without `upload`, nothing changes: no button, and files pasted or
  dropped are handled as before.
- **New exports:** `ImageField`, `ImageFieldProps`, `ImageUpload`,
  `ImageUploadResult` and `DEFAULT_IMAGE_TYPES` (JPEG, PNG and WebP, the
  default for both).
- **Fixed: the editor shows images.** It dropped every `![alt](url)` as
  the text loaded (Milkdown's image node refused remark's empty title), so
  editing a note with an image in it refused to save. Images now show,
  at most the field's width, and such a note edits and saves like any
  other.
- **`<Markdown>`'s images** were already inside the text's width, lazy and
  with their alt text; they now keep their shape at any width (`h-auto`).
  Their address goes through the same URL check as links: a web address or
  a path on the site (`/api/files/7/content`), never `data:` or `blob:`.

No migration, no contract change, no new dependency. The backend side
(an upload endpoint, storage, serving files safely) stays each app's
(`docs/DEFERRED.md`).

- **How an app adopts it:** bump `@tristan2828/ui-foundation` and
  `ui-foundation-backend` to 4.28.0 and run `npx ui-foundation sync`. To
  use it, write the app's `upload` in its gateway (a `safeFetch` of the
  file to its own endpoint, resolving to `{ id, thumbUrl, url }`, rejecting
  with the `AppError`), then give it to `ImageField` on the form and to
  each notes field's `RichTextEditor`. An app carrying its own image field
  can replace it with `ImageField`.

## 4.27.0 — A `reference` inside a sub-record item

The entity plan and the playbook now allow a **`reference` as a
sub-record item field** (a comic's segments, each pointing at a series),
and the template's Widget has a worked example to copy: **Pairings**, a
list of `{ categoryId, note }` items. No package code changed: `ListEditor`
and the list edited in place already take any row; this release is the
convention, the reference files and their tests.

The convention (`docs/foundation/entity-plan-template.md` "Sub-records",
`docs/foundation/add-an-entity.md` "A `reference` inside a sub-record
item"):

- **Wire:** the item carries the referenced id only, named as a
  top-level reference is (`categoryId`; `seriesId` for a Series), never
  a name or a nested record. Names come from the other entity's lookup by
  id (`GET /<other>?ids=…`), on the form and on the view. An optional text
  field beside it is a `string`, `""` when empty. The list is read and
  written whole, in order, like any sub-record list.
- **Backend:** a child table with `position` and a commented foreign key;
  every item's id checked in one query before saving, and one that isn't
  there (or, for a per-user entity, isn't this user's) refused with a 422
  at the item's path, `["body", "<list>", 2, "<field>Id"]`, never a
  foreign-key 500.
- **Form:** one row component shared with editing in place: the
  referenced entity's combobox (its own search per row, the picked name
  from the lookup by id) and the item's other fields. A server 422 at the
  item's path binds to that row's picker; a row with no pick is refused
  on that row.
- **View:** each item as the referenced record's name, linked to its view
  when it has one. **Editing in place:** `editInPlace({ kind: 'list' })`
  with that row; Enter in the open list picks without saving.

Not built (`docs/DEFERRED.md`): a "New …" option that creates the
referenced record from the item's picker, and AI chats naming an item's
reference (they print its id).

- **How an app adopts it:** bump `@tristan2828/ui-foundation` and
  `ui-foundation-backend` to 4.27.0, run `npx ui-foundation sync`, and
  `npm run verify`. Nothing changes for an app's existing entities. To
  build a plan with a reference item field, follow the playbook's new
  paragraph; while the Widgets demo is gone, copy the template's files
  at this version (`widget-fields.tsx`'s `WidgetPairingItemFields` and
  `WidgetCategoryCombobox`, Pairings in `widget-form.tsx`, `pairings` in
  `widgetEdits`, `_check_item_categories_exist` in `routers/widgets.py`,
  migration `0016_widget_pairings.py`) and add a row for the pattern to
  your `AGENTS.md` "### Reference files". The template's migration 0016
  is the demo's own; an app doesn't need it.

## 4.26.0 — The backend reads a database URL as a provider gives it (#203)

New export, so a minor: **`foundation_backend.config.normalize_database_url(raw)`**,
which `DATABASE_URL` is now read through. Until now the package read it
raw, so a plain `postgresql://` URL (a compose file's, or a server's) made
SQLAlchemy pick psycopg2 and the async engine wouldn't start, and a
provider's string as copied (`?sslmode=require&channel_binding=require`)
passed params asyncpg rejects.

- `postgres://` and `postgresql://` become `postgresql+asyncpg://`; an
  already-normalized URL passes through. Surrounding whitespace from a
  paste is dropped.
- libpq's `sslmode` and `channel_binding` are dropped from the query;
  every other param is kept.
- `DATABASE_SSL`: an explicit value still wins. Unset, it follows the
  URL's `sslmode` (`require`, `verify-ca`, `verify-full` mean on; any other
  value means off), and with no `sslmode` it stays off, as before.

No migration, no contract change, and nothing to do for an app whose URL
is already `postgresql+asyncpg://` with `DATABASE_SSL` set.

- **How an app adopts it:** bump `@tristan2828/ui-foundation` and
  `ui-foundation-backend` to 4.26.0. An app that normalized `DATABASE_URL`
  itself (in its `app/config.py`, before the package's star import) can
  drop that code and its tests, and any wrapper scripts kept only so the
  account scripts saw asyncpg's URL: run
  `python -m foundation_backend.scripts.<name> <email>` from `backend/`
  directly, and point the deploy docs at that. Then
  `npm run verify:backend`.

## 4.25.0 — The backend's auth and security layer as a pip package

New: **`ui-foundation-backend`** on PyPI (import `foundation_backend`,
`packages/backend-foundation/`), released with the npm package under the
same version. It holds what every app's backend copied from the template
and never changed on purpose: settings, the engine and session
dependency, the account tables, the sign-in and error schemas, password
and token hashing, TOTP, sign-in limits, error reporting, the error
handlers, the production start-up checks, the SPA mount, the `/auth/*`,
`/environment`, `/client-errors` and OAuth routers, the
`set_password`/`enable_totp`/`disable_totp` scripts and the `signed_in`
test helper. A fix there now reaches an app by bumping one pin
([`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) "backend-foundation").

The code is the template's, moved, not rewritten. The one change of
shape: **`foundation_backend.routers.auth` has two routers**, `router`
(login, the TOTP step, logout, me) and `register_router`
(`POST /auth/register`), so an app without self-service accounts includes
`router` alone instead of deleting a route from a copied file.

Nothing changes on the wire or in the database: no migration, and the
npm package's code is unchanged (its conventions say where the backend
layer lives; run `npx ui-foundation sync`).

- **New apps** get it automatically: `create-app.sh` pins
  `ui-foundation-backend==<version>` in `backend/pyproject.toml`, and the
  template's `app/config.py`, `db.py`, `models.py`, `schemas.py`,
  `openapi_responses.py`, `security.py`, `errors.py` and `spa.py`
  re-export the package, so `from app.models import User` still works.
  The scripts run as `python -m foundation_backend.scripts.<name> <email>`
  from `backend/`.
- **An existing app** keeps working as it is: its copied files are its
  own. To take the package and its future fixes, follow
  [`docs/consuming.md`](docs/consuming.md) "Adopting the backend package
  (4.25)": pin it, delete the copies it owns, re-export, include its
  routers (`register_router` only if the app has `/auth/register`), drop
  the duplicated tests, and point the deploy docs at the `-m` scripts.
  No migration: the tables are the same.
- **Template backend:** its project is renamed `template-backend`
  (`ui-foundation-backend` is now the published name). A test that
  changes one of the package's settings patches `foundation_backend.config`,
  not `app.config` (the template's `tests/test_mcp.py` does this for
  `MCP_*`, which the OAuth router reads).

## 4.24.0 — Heading levels in written text: bands, not bars (#184)

A change of look, nothing to do beyond the upgrade: `<Markdown>` and the
rich-text editor draw it. Run `npx ui-foundation sync` for the updated
`docs/foundation/design-language.md` ("Written text").

- **`#`** sits on a full-width band in the new `--heading-band` token
  (`bg-heading-band`; one step stronger than `--muted` in both themes),
  with a 2px `--rule` along its foot, and is a touch larger
  (`type-heading-1`: 28px / 36px, was 26px / 32px).
- **`##`** sits on a lighter band in `--muted`, with a little more room
  above it.
- **`###`** is a small uppercase label in `--muted-foreground`
  (`type-heading-3`: 12px / 20px, was 17px / 24px). `####` and deeper are
  unchanged.
- **The rest of the text lines up with the words in the band:** in text
  with a `#` or `##`, every other block is inset 12px (`PROSE_INSET`).
  Text with neither stays flush, where the section's own text starts.
- The left bars are gone. **`--heading-bar` is kept** (nothing in the
  package uses it any more) for an app that drew with it; it will be
  retired in the next major.

## 4.23.0 — MCP fields a chat may read but never write (#197)

Additive: the package's code doesn't change, and an entity with no
`script_only` behaves as before. Run `npx ui-foundation sync` for the
updated `docs/foundation/add-an-entity.md` ("Fields only a script writes").

- **New `McpEntity` option: `script_only: tuple[str, ...] = ()`**, in the
  template's `backend/app/mcp_entities.py`: wire names of fields the API
  takes from an importer or another script (a source record's id that a
  re-run matches on) and a chat must never write. `create` and `update`
  (`backend/app/mcp_tools.py`) refuse a call naming one, by its camelCase
  wire name or its snake_case name, before the entity's function runs:
  the tool answers `Nothing was saved.` with
  `- <field>: set by a script, not through MCP` (beside any other field
  problems), saves nothing and writes no audit row. The create and update
  tool descriptions leave the field out; `fetch` still shows it.
  `check_entities` refuses at start-up a name that isn't a field of the
  entity's create or update schema (by wire name), or that the create
  schema requires.
- **How an app adopts it:** `mcp_entities.py` and `mcp_tools.py` are
  copied into the app, so by hand. In `app/mcp_entities.py`, add the
  `script_only` field to `McpEntity` (after `restore`) and the
  `_wire_names` / `_check_script_only` helpers with their call at the end
  of `check_entities`'s loop. In `app/mcp_tools.py`, take the new
  `_validate` (a third argument, `script_only`), pass `entity.script_only`
  from `tool_create` and `tool_update`, and take `_describe_fields`'s new
  `script_only` argument and the two calls in `tool_definitions` that
  pass it. An app whose `mcp_tools.py` hasn't drifted from the template
  can copy it whole instead; `mcp_entities.py` holds the app's own
  entities, so it's always patched. Then set `script_only` on
  each entity with such a field, delete any wrappers that refused it
  around the entity's `create`/`update`, and copy the "fields only a
  script writes" tests from the template's `tests/test_mcp.py`, adjusted
  to the app's field. `npm run verify:backend`.

## 4.22.0 — canVibrate(), and a count-up recipe that pauses before Start (#194, #195)

Additive: one new export, and a fix to a test recipe in the docs. Run
`npx ui-foundation sync` for the updated `docs/foundation/timed-screens.md`.

- **New: `canVibrate()`** (#194), exported beside `vibrate` from
  `@tristan2828/ui-foundation`. True where the browser can vibrate
  (Android browsers; iPhone browsers can't), the same test `vibrate()`
  makes, which now calls it, so a Vibrate setting and the call never
  disagree. `timed-screens.md` "Sound": offer a Vibrate toggle only where
  it's true, read once (`useState(canVibrate)`).
- **How an app adopts it:** an app with its own copy of the check deletes
  it and imports `canVibrate` from the package. Nothing else changes.
- **The open-ended count-up recipe pauses before Start** (#195). The old
  one clicked Start, then `pauseAt(Date.now() + 50)`; the page's fake
  clock runs in real time until the pause lands, so under load it had
  already passed that time and `pauseAt` failed with "Cannot fast-forward
  to the past". The recipe now installs at a fixed `t0`, goes to the page,
  `pauseAt(t0 + 60_000)`, then clicks Start.
- **How an app adopts it:** a spec copied from the old recipe moves its
  `pauseAt` before the click that starts the session and pauses at a time
  fixed from `install` (`install({ time: t0 })` … `pauseAt(t0 + 60_000)`),
  never one read after Start.

## 4.21.0 — a nav entry that opens a saved view, and tab titles from the nav and the record (#188, #186)

Additive: nothing an app has stops working. Run `npx ui-foundation sync`
for the updated playbook.

- **A nav entry's `to` can carry a query string** (#188), so a sidebar
  entry can open its list on a saved view (`/widgets?status=active`).
  `AppShell` matches an entry on its `to`'s path alone, so the entry is
  current (`aria-current="page"`) on the list and every page under it,
  and its collapsible section opens; the most specific entry is still the
  one with the longest path. `defineA11ySuite`'s "the sidebar links
  exactly the pages in nav" compares paths on both sides, and each nav
  page is visited as its `to` is given, query string and all.
- **How an app adopts it:** nothing to do. An app whose sidebar links the
  bare path and replaces the URL with a view when the list is reached
  with no query (the stopgap) can put the view in `to` instead.
- **The browser tab names the page** (#186). `AppShell` sets
  `document.title` to `"<page> · <title>"`, the page being the label of
  the nav entry the path is under (the same one marked current); the home
  entry (`'/'`) and a page under no entry give the app's title alone.
  `EntityView` names the tab after its `title` once the record has
  loaded ("Wireless Mouse · UI Foundation"), and the nav's comes back
  while it loads, on an error and when you leave; its new `documentTitle`
  prop names it otherwise, or `false` leaves the nav's. A new export,
  `useDocumentTitle(title)`, names the tab from any other screen ("New
  Widget"). A screen's title wins over the nav's whichever is set first,
  so a record that loads after the shell, and a view mounted in the same
  render as the shell (whose effect runs after its child's), both show.
  When nothing names the tab (signed out), it gets back the title it had
  (`index.html`'s).
- **How an app adopts it:** nothing, for the nav and the views. Every tab
  of the app now reads differently: a spec that asserted the old
  `index.html` title on a page inside the shell asserts the new one. Name
  any other screen with `useDocumentTitle`.
- **Template: the app's own favicon placeholder.** `index.html` links
  `public/favicon.svg` (a letter on the theme's colour) in place of Vite's
  `vite.svg`, which is gone. An existing app can do the same with its own
  icon; `docs/create-an-app.md` says where to replace it.

## 4.20.0 — rich text edited where it's read: always editable, floating toolbar only (#183)

Additive: the current behaviour stays the default.

- **New: `editInPlace({ kind: 'long-text', inline: true })`.** Notes that
  are the editor from the start, drawn as the read view (no border, no
  box), typed into where they're read, Notion-style. It implies
  `alwaysEditable`, so it saves as that does: a pause after typing, and
  leaving the page saves first. The control gets a new optional prop,
  `inline`, among its `EditControlProps`.
- **New: `RichTextEditor`'s `inline`** (the look above) **and
  `toolbar="floating"`**: the toolbar over a selection (Alt+F10 still
  reaches it) and the "/" menu, with no bar above the text. An empty
  inline field shows the editor's `placeholder`, not the view's "Not set".
- **How an app adopts it:** `npx ui-foundation sync` for the playbook
  (`docs/foundation/cell-patterns.md`, "Edited where it's read"). Then, for
  a notes field that should edit in place this way, add `inline: true` to
  its `editInPlace` and pass the control's `inline` on to
  `RichTextEditor`: `inline={props.inline} toolbar={props.inline ?
  'floating' : true}`, with a `placeholder`. Nothing changes for a field
  that doesn't opt in.

## 4.19.0 — a small set picked in place: every option shown, each click saves

Additive: one new export, `MultiPick`, and its docs. Nothing existing
changes. Run `npx ui-foundation sync` for the updated docs.

- **New: `MultiPick`** (#185), a picker for a multi field whose options
  are few (up to about 25) and all loaded. Every option is a toggle chip
  (with its `icon`, where the app draws one: a category glyph in its
  slot's colour), the picked ones pressed with a check, under a box that
  filters them. Edited in place (`editInPlace({ kind: 'multi' })`), each
  click saves that one pick through `onPick` (a spinner beside it until
  the server answers, like a quick action), a refusal puts back that one
  pick with its reason under the chips, and leaving, Esc or
  Ctrl/Cmd+Enter only close it. On a form it's `onValueChange`. Down
  from the box goes to the chips, Left/Right and Home/End move along
  them, Space toggles, Up goes back.
- **Which picker is the plan's choice, not the option count's**: a field
  marked `small` is `MultiPick`; anything larger, or that grows with the
  data, keeps `MultiReference` (or `MultiChoice`). A switch by count
  would change how saving works the day the 26th option is added (cell
  pattern 18, "A small set").
- **How an app adopts it:** `npx ui-foundation sync`. Nothing changes
  until a plan marks a multi field `small`; then follow
  `docs/foundation/cell-patterns.md` pattern 18 "A small set": `value`
  is the record's (not `props.value`), `onPick` the single-field save as
  a function of the record.

## 4.18.4 — a list item's row edited in place sits side by side

- **Fix: `editInPlace({ kind: 'list' })` lays the item's row out as the
  form does** (#187). The row `renderItem` returns now sits in a flex row
  (`items-start gap-2`) inside the field, as in `ListEditor`'s row, so a
  fragment (a done box, then the text's `Field`) keeps the box beside the
  text box while an item is edited or added, instead of stacking it above.
  A single element still fills the width, so an app that wrapped its
  `renderItem` in its own flex row looks as before.
- **How an app adopts it:** nothing to do. An app that wrapped its
  `renderItem` only to work around this can drop the wrapper and share
  the form's fragment as is. `npx ui-foundation sync` picks up the note in
  `docs/foundation/cell-patterns.md`.

## 4.18.2 — three things an app found testing: a paused fake clock, a forced mutation's refetch, the mocks with storage blocked

Two playbook notes and a template fix; nothing in the package's code
changes. Run `npx ui-foundation sync` for the updated docs.

- **Docs: three fake-clock gotchas in the timed-screens recipe**
  (`docs/foundation/timed-screens.md`, "Testing a timed screen in
  Playwright"). After `clock.install()` the fake clock keeps moving in real
  time, so an open-ended count-up (a stopwatch, a hold that ends on a tap)
  drifts under load: pause it once the session opens and move it only with
  `fastForward`. `clock.pauseAt(Date.now())` fails with "Cannot
  fast-forward to the past" (the page's clock is already ahead), so pause
  at `Date.now() + 50`. A paused clock hangs axe and the dialog's close
  animation, so `clock.resume()` before either. With an example.
- **How an app adopts it:** `npx ui-foundation sync`. An app with a
  count-up screen whose Playwright readings are off under load pauses its
  clock as the example does.
- **Docs: forcing a mutation's success forces its refetch too**
  (`docs/foundation/add-an-entity.md`, step 8). An override that answers
  only the mutation is undone by the mutation's invalidation refetch, which
  reads the unchanged mock store; answer the follow-up GET (and the list's,
  if the screen shows it) with the record the mutation answered. With an
  example.
- **How an app adopts it:** `npx ui-foundation sync`. A spec that forces a
  mutation's success and then sees the old value gets the extra GET
  override.
- **Fix (template): the app renders in mock mode with storage blocked.**
  MSW 2.15's cookie store calls `localStorage.getItem` unguarded when its
  module loads (`msw/lib/core/utils/cookieStore.mjs`, an upstream MSW
  issue, not filed from here; `docs/DEFERRED.md` says when to drop the
  workaround), so where the browser blocks storage (a private window with
  site data blocked, or the `Storage` methods throwing)
  `import('./mocks/browser')` threw and the page stayed blank. `main.tsx`'s
  `enableMocking()` now calls `swapBlockedLocalStorage()` first: if a
  `localStorage` write throws, `window.localStorage` becomes an in-memory
  one for the page's life. Mock mode only: it runs after the
  `VITE_API === 'real'` check, so a real build keeps the browser's own
  storage (the package's storage reads already fall back on their own). `e2e/blocked-storage.spec.ts` blocks storage both ways (the
  methods throw, and `window.localStorage` itself throws) and checks the
  page renders; both fail without the fix.
- **How an app adopts it:** copy `swapBlockedLocalStorage` and its call
  (before `import('./mocks/browser')`, after the `VITE_API === 'real'`
  check) from the template's `src/main.tsx`, and copy
  `e2e/blocked-storage.spec.ts`, changing its assertion to something the
  app's home page shows.

## 4.18.1 — the MCP tools read the user after a write

A fix in the reference backend, which apps copy in; nothing changes in the
package.

- **Fix (template backend): a JSON-RPC batch that writes and then reads
  no longer fails with a 500.** Each MCP write commits its audit row last
  (`_audit` in `app/mcp_tools.py`), which expires the `User` the request
  loaded, so the next call in the same batch that read `caller.user` failed
  with `MissingGreenlet`. 4.18.0's rule, applied: `Caller` saves `user_id`
  when it's made, the audit row uses it, and the user is loaded again after
  the audit's commit. `test_a_batch_reads_after_a_write` (`tests/test_mcp.py`,
  signed in for real) fails without the fix.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.18.1`.
  An app with the MCP backend (4.2.0 or later) copies the change to
  `app/mcp_tools.py` from the template: `Caller`'s `user_id` (set in
  `__post_init__`), `user_id=caller.user_id` in `_audit`, and `await
  session.refresh(caller.user)` after its commit. Then copy the test. An
  app whose entities' MCP functions read the user after a commit of their
  own gets the same treatment.

## 4.18.0 — three fixes found by an app: links with spaces, a test fixture that hid a 500, waiting on several tables

Fixes, plus one new testing export, so a minor. Run `npx ui-foundation sync`
for the updated playbook.

- **Fix: a link address with a space in it is refused** (#177). `linkHref`
  added `https://` to anything without a scheme, so two words typed in a
  `LinkCell` (or the rich-text editor's link box) saved as
  `https://two words`, a link that goes nowhere. Whitespace inside an
  address is now refused for every kind (a bare address, `https://`,
  `mailto:`, `tel:`, a path, a heading); around it, it's trimmed as
  before. The cell says "An address has no spaces"; the editor's link box
  says "An address has no spaces. Remove them, or write each as %20."
  Another scheme keeps its old message.
- **Fix (template backend tests): the `client` fixture signs in for real.**
  It stood a detached `User` in for `get_current_user`, so a router that
  read `user.id` after `session.commit()` passed its tests and failed live
  with `MissingGreenlet` (the commit expires the user the request loaded).
  `client`, `test_widgets.py`'s `other_user_client` and `test_jobs.py`'s
  `api` now hold a `sessions` row and send its cookie
  (`tests/signed_in.py`, `session_cookie(session, user_id)`), and
  `tests/test_signed_in.py` fails on the old fixture. The rule is in
  `docs/foundation/add-an-entity.md`, "After a commit, in the backend":
  after a commit, read by a `user_id` saved before it, never by the `User`.
- **Fix: `defineA11ySuite` waits correctly on a page with several data
  views.** A view route waited on `[data-state="success"]`, which Playwright's
  strict mode refuses once two `DataTable`s (or an `EntityView` and a
  table) are on the page, and a nav page could be scanned before its
  screen was up. Both now wait until at least one data view shows its data
  (a view route) or the screen is up (a nav page), and none still shows
  its skeleton. The suite's options are unchanged.
- **`expectDataViewsLoaded(page, { success? })`** from
  `@tristan2828/ui-foundation/testing`: that wait, for an app's own specs.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.18.0`,
  `npx ui-foundation sync`.
  - Links: nothing to do.
  - Several data views: an app's spec that worked around the strict-mode
    failure (its own wait, or leaving a view route out of `viewRoutes`) can
    go back to `defineA11ySuite`, or call `expectDataViewsLoaded(page)`
    where it waited on `[data-state="success"]` itself.
  - Backend (copy-in, so by hand): copy `backend/tests/signed_in.py` and
    `test_signed_in.py` from the template, and in `conftest.py` replace the
    `get_current_user` override with `cookies = await session_cookie(session,
    1)` passed to `AsyncClient(..., cookies=cookies)`; do the same in any
    fixture of the app's own that returns a `User(...)` for
    `get_current_user` (the user needs a row; the template's `session`
    fixture seeds user 1). Then run the backend's tests: a route that reads
    the `User` after a commit now fails there, and the fix is to save
    `user_id = user.id` before the commit.

## 4.17.0 — reminders: an installable app and Web Push

Additive: new exports, a new Vite plugin and optional contract paths
(#167). Off until an app turns it on. See `docs/foundation/reminders.md`.

- **`pwa({ name })`** from `@tristan2828/ui-foundation/vite`: serves and
  builds `/manifest.webmanifest` (`display: standalone`, the theme's
  colours), icons (an SVG with the name's first letter, plain PNGs in
  `--primary` for iOS; `icon` swaps in the app's own PNG) and
  `/push-sw.js`, a service worker for pushes and notification clicks only
  (no fetch handler, no caching). Adds the manifest, theme-color and
  apple-touch-icon tags to `index.html`.
- **`usePushPermission()`**: `{ status, enable, disable, pending, error }`,
  status `off`, `on`, `needs-install` (iPhone or iPad in a browser tab),
  `blocked`, `unsupported` or `mock` (under MSW, whose worker holds the
  page). `enable()` asks the browser first thing, from the click, then
  registers the worker, subscribes with the backend's key and saves it.
  `createPushController` is the same rules without React.
- **`AllowReminders`**: explains, then asks, and says what to do in every
  state (the Home Screen steps on iOS, where to unblock).
- **Contract** (`openapi/foundation.yaml`, all `x-optional`):
  `GET /push/public-key`, `POST /push/subscriptions`,
  `DELETE /push/subscriptions/{id}`. MSW handlers: `pushHandlers` from
  `/mocks`.
- **Reference backend:** `app/push.py`, `send_push(session, user_id, title,
  body, url)`, with VAPID (RFC 8292) and aes128gcm encryption (RFC 8291,
  tested against its worked example) on `cryptography`, an optional
  `push` extra. Sends only to the browsers' push services
  (`PUSH_ALLOWED_HOSTS`), never follows a redirect, deletes a device the
  service says is gone. `push_subscriptions` and `reminders` tables
  (migrations `0014`, `0015`), and the `send-reminders` job: every minute,
  each reminder due in its own time zone, once a day, at most 15 minutes
  late. `PUSH_ENABLED`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; the app
  refuses to start with push on and either missing.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.17.0`,
  `npx ui-foundation sync`. For reminders: copy `/push/*` and their three
  schemas from the package's `openapi.yaml` into the app's, add
  `pushHandlers` to the mocks and `pwa({ name })` to `vite.config.ts`, then
  the backend side as `docs/deploy.md` "Reminders (Web Push)" says (an app
  made from an older template copies `app/push.py`, `app/reminders.py`,
  `app/routers/push.py` and the two migrations from the template). An app
  without reminders does nothing.

## 4.16.0 — timed screens: a full-screen view, a session clock, a wake lock and sound cues

Additive: new exports only (#163, #164, #165, #166). See
`docs/foundation/timed-screens.md`.

- **`SessionView`**: the whole viewport over the app shell for a screen
  that runs for minutes. A modal named by its required `title`, focus
  kept inside, Esc and Close through `onOpenChange`, padded by the
  safe-area insets, a fade and no zoom. `fullscreenControl` adds a "Full
  screen" toggle for the browser's real fullscreen, absent where the
  browser has none (iOS Safari on a phone). `keepAwake` holds a wake lock
  while open. `initialFocus` picks the control focused on open.
- **`useWakeLock(active)`**: a screen wake lock while `active`, asked for
  again each time the tab comes back (the browser drops it when hidden),
  released on deactivate or unmount, including a request still in flight.
  A no-op where the API is missing or refused.
- **`useSessionClock({ running, endsAt })`**: `{ elapsed, status, paused,
  start, pause, resume, stop }`. Elapsed from `performance.now()` each
  animation frame, so it doesn't drift; paused time left out; `idle` →
  `running` → `done` at `endsAt`. `running: false` holds it still without
  pausing it (the view closed).
- **`usePrefersReducedMotion()`**, through `useSyncExternalStore`.
- **Audio cues**: `unlockAudio()` (call it from the click that starts a
  session), `chime({ pitch, volume, duration })`, `sequence([...])`,
  `say(text)`, `hush()`, `vibrate(pattern)`. Web Audio and speech
  synthesis, no audio files. Each is a no-op where the browser can't
  make the sound. A cue before `unlockAudio()` is dropped, never played
  late.
- **`useMuted(key)`**: `[muted, setMuted]`, remembered in `localStorage`,
  kept in memory where storage is blocked, and followed across tabs.
- **Docs:** `docs/foundation/timed-screens.md`, with the Playwright recipe
  for a timed screen's states: `clock.install()` before `goto`, then
  `clock.fastForward()`, never `runFor()`.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.16.0`,
  `npx ui-foundation sync`. A screen that built its own full-screen
  `Dialog`, wake-lock hook, Web Audio module or clock can replace it with
  these. Nothing changes until it does.

## 4.15.0 — the accessibility suite scales with the nav

Additive (#161). `defineA11ySuite`'s "every nav page" visited every
sidebar page in one test, so an app of about 20 pages ran past
Playwright's 30 s timeout on a loaded machine.

- **`defineA11ySuite({ nav })`**: the app's `NavEntry[]` (the one
  `AppShell` gets). Each nav page becomes its own test, in both themes,
  plus one test that the rendered sidebar links exactly those pages.
- **Without `nav`**, the pages are still found in the sidebar at run
  time, and that one test's timeout now grows by 10 s per page.
- **Pages in a folded sidebar section are found too** (links read by
  element, not role), for apps using 4.14's collapsible sections.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.15.0`,
  `npx ui-foundation sync`, then in `e2e/a11y.spec.ts` import the nav
  (`import { NAV_ITEMS } from '../src/nav'`) and pass `nav: NAV_ITEMS`.

## 4.14.0 — sidebar sections that fold, remembered

Additive (#152): two optional fields on `NavSection`; a nav that doesn't
use them is unchanged.

- **`collapsible: true`** turns a section's label into a button with a
  chevron (`aria-expanded`, `aria-controls`) that folds its entries away.
  Enter and Space toggle it; focus stays on it.
- **Remembered per browser** in `localStorage`, by the section's label;
  **`defaultOpen: false`** starts it folded for a first visit.
- **The section holding the current page is always open** (its label is
  `aria-disabled`), and arriving at a page in a folded section unfolds it.
- **The icon rail** shows every section's entries, folded or not, so no
  page is out of reach there.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.14.0`,
  then add `collapsible: true` to the sections in `src/nav.ts`.

## 4.13.0 — row-edit cells as components

Additive (#155). Cell pattern 18's "In a table's rows" cells, which every
app copied, now ship from the package:

- **`NameCell`** (`label`, `value`, `save`, `schema?`, `children?`): one
  line, Enter saves, the form's rule first, a taken name's 422 in the cell.
- **`ChoiceCell<T>`** (`label`, `value`, `options`, `render`, `save`): the
  list opens with the cell, a pick saves, closing gives up.
- **`LinkCell`** (`label`, `value`, `save(link | null)`, `linkText?`,
  `emptyLabel?`): a link out (new tab, said to screen readers) or the
  not-set label; a bare address gains `https://`, another scheme is
  refused, a blank clears it to `null`.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.13.0`,
  `npx ui-foundation sync`. An app with its own `row-edit-cells.tsx` can
  swap each cell for the package's (same labels, so its specs keep
  passing) and delete the file.

## 4.12.0 — a plain date field, and arrow keys in the calendar

Additive (#157), plus a fix to the shipped `Calendar`.

- **`DateField`**: a plain date (`'YYYY-MM-DD'`, or `''` for not set) as a
  button opening the `Calendar` in a `Popover`. One control for the form
  (a `Controller`) and for editing in place (`kind: 'choice'`: a pick
  saves). `clearable` adds Clear for an optional field. The chosen day
  (else today) has focus when it opens.
- **`formatPlainDate(value, options?, locale?)`**: "Sep 2, 2026", never
  shifted by the time zone (checked in browsers at UTC−10 and UTC+14).
- **`ui/calendar` fix:** the arrow keys didn't move focus between days.
  shadcn's `CalendarDayButton` made a ref for that but never passed it to
  the button. Every app's date picker built on the package's `Calendar`
  (the template's Available From included) gets arrow keys with this
  release.
- **Docs:** the plan template's `date` type is now the package's
  `DateField` rather than a variant of `date-time`. `add-an-entity.md`
  says how to wire one: contract, form, cells, editing in place, backend.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.12.0`,
  `npx ui-foundation sync`.

## 4.11.0 — a progress ring, a step bar, a half star, and a highlighted row

Additive (#154, #156): new exports, one optional `DataTable` prop and two
tokens; nothing changes until an app uses them. See
`docs/foundation/cell-patterns.md` patterns 9, 13 and 22.

- **`ProgressRing`** (`done`, `total`, `label?`): done out of total as a
  small ring filling clockwise beside the count ("4/6"); `foreground`
  under way, `success-text` complete, "Not started" for zero of zero.
- **`StepBar`** (`value`, `steps` = 5, `word`, `label?`): an ordered enum
  of bands as a short bar of steps, the band's word beside it, named
  "Quality: High, 4 of 5".
- **`RatingStar`** (`value: 'full' | 'half' | 'empty'`, `word`): a
  three-value enum as one star; the half is the left half filled over
  the whole outline.
- **`DataTable` `highlightRow`**: the row to look at, an info wash on
  every cell (over the stripe and the pinned columns) with a bar at its
  start. Muted text inside it is darkened (new tokens `--table-highlight`,
  `--table-highlight-muted-foreground`): plain `muted-foreground` is
  4.09:1 on the wash.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.11.0`,
  `npx ui-foundation sync`. An app that drew its own ring, step bar or
  half star replaces it with the package's; one that greyed done rows
  with opacity switches to `text-muted-foreground` (pattern 22).

## 4.10.0 — a notice across a record's page, and a credit for its data's source

Additive (#158, #159): new optional props and exports; a view that passes
neither looks exactly as before.

- **`EntityView` `notice`**: under the header, above both columns, across
  the page at every width. It sits in a `role="status"` region that's
  always rendered, so a notice appearing or clearing after the page loads
  is announced and one there from the start isn't.
- **`Notice`**: `tone` (`info`, `success`, `warning`, `destructive`), an
  optional `title`, the message, an optional `action` and `icon`. A wash
  of the tone with `foreground` text, and no role of its own.
- **`EntityView` `footer`**: after every section (below both columns in
  the rail layout, last on a phone), in caption type, outside any card.
- **`SourceCredit`**: `sources: { name, href, note? }[]`, "Data from A and
  B." with each name a link opening in a new tab (said to screen readers),
  then each `note` as written.
- **A new primitive, `@tristan2828/ui-foundation/ui/alert`** (shadcn's
  Alert, which `Notice` is built on), with its destructive variant's text
  patched to `--destructive-text`: upstream's was 3.2:1 on the dark card.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.10.0`,
  `npx ui-foundation sync` (`add-an-entity.md` and `design-language.md`
  say when to use each). An app that had added `alert` to its own
  `src/components/ui/` must now import the package's (lint says so).

## 4.9.1 — a save of a record outside its caches says so

Package only (#153). `useRecordUpdate` builds each save from the record it
finds under `detailKey` or `listsKey`. When a screen held the record
somewhere else (a query gathering a related list's records), a save
failed with a plain `Error` instead of an `AppError`, so nothing on screen
explained it. Now:

- **An object change** (`mutate({ status: 'done' })`) is sent anyway; it
  needs no current record. It isn't shown until the server answers, and
  only where the keys reach, so the screen's own query has to refetch
  (`onSuccess`) to show it.
- **A function change** (`mutate((record) => …)`) can't be built, so it's
  refused with an `AppError` (`kind: 'server'`, "It isn't loaded on this
  page. Reload and try again"), toasted like any refusal or handed back to
  `mutateAsync` when editing in place.
- **Both warn in the console**, naming the keys searched, in every build.

- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.9.1`,
  `npx ui-foundation sync` (a note in `add-an-entity.md`). Nothing changes
  for a save whose record is cached.

## 4.9.0 — the schema in build-info.json, and grouped API addresses for MCP

Additive (#149, #150). An app that doesn't pass the new options sees no
change.

- **`buildInfo({ alembic })`**: the Alembic versions folder, from the Vite
  root (`backend/migrations/versions`). `build-info.json` gains `schema`,
  the head revision, read from the migration files (no Python in the
  build). No head or several fails the build. The template passes it.
- **`buildInfo({ extra })`**: a function whose fields are merged into
  `build-info.json`. It can't set `api`, `commit`, `pr`, `builtAt` or
  `schema`; the build fails if it tries.
- **Template backend: `McpEntity.api_path`** (optional, default
  `/api/<name>`): where the record is in the API, for an API grouped by
  module. A pasted `/api/media/channels/3` now reads the record.
  `check_entities` also refuses an API path outside `/api/`, or two
  entities with the same one.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.9.0`.
  For the schema, pass `alembic` to `buildInfo()` in `vite.config.ts`, and
  make sure the build stage has the migrations (`docs/deploy.md` "Which
  build is live"). An app with its own plugin rewriting `build-info.json`
  deletes it and passes `alembic` or `extra`. For MCP, copy the changes to
  `app/mcp_entities.py`, `app/mcp_tools.py` and `tests/test_mcp.py` from
  the template at the 4.9.0 tag (keep the app's own `ENTITIES`), then set
  `api_path` on each entity whose API isn't at `/api/<name>`.

## 4.8.0 — rows grouped under headings, and a pill filter

Additive: new optional props and exports; nothing changes until a table
opts in (#135). See `docs/foundation/cell-patterns.md` pattern 21.

- **`DataTable` `groupBy` and `groupSummary`**: rows under headings, in
  the server's order, a heading row (`<th scope="rowgroup">`, its own
  `<tbody>`) starting each run of one key, with a summary of the group's
  rows on the page. A group split across pages repeats its heading.
- **`byDay(field, { now, timeZone, weekStartsOn, locale })`**, a
  `groupBy` for feeds and logs: Today, Yesterday, Earlier this week,
  "Week of 6 Oct" for four weeks back, then months; Upcoming and No date.
  Calendar days in the zone, via Intl (no new dependency).
- **`DataTable` `header={false}`**: no header row on screen, the column
  names kept for screen readers, no hidden sort buttons to tab into.
- **`PillFilter`**: one quick filter as pills (All plus the options), on
  shadcn's ToggleGroup, now shipped as the primitive
  `@tristan2828/ui-foundation/ui/toggle-group`. The value is the app's,
  from `useTableUrlState` like any filter.
- **How an app adopts it:** `npm install @tristan2828/ui-foundation@4.8.0`,
  `npx ui-foundation sync`. An app that had added `toggle-group` to its
  own `src/components/ui/` must now import the package's (lint says so).

## 4.7.0 — scheduled jobs in the reference backend

Template backend only (#136). An app that pulls from an outside service or
cleans up nightly registers a job instead of writing its own loop in
`lifespan`, and gets what each app would otherwise get wrong:

- **`register_job(name, every=…, run=…, run_at_start=False, timeout=…)`**
  in `app/jobs.py`. Jobs start from the lifespan when `JOBS_ENABLED` (on by
  default with `APP_ENV=production`, off otherwise).
- **One run at a time, once per interval, across processes**: a Postgres
  advisory lock per job, and a scheduled run that finds the job started
  less than `every` ago skips. Jitter keeps jobs off the same second.
- **`job_runs`** (migration `0013`): every run's times, outcome
  (ok, failed, skipped), error and summary, kept `JOB_RUNS_KEEP_DAYS` (30).
- **A failure never stops the schedule**: logged, sent through
  `report_error`, recorded.
- **`GET /api/jobs`** and **`POST /api/jobs/{name}/run`** (202, or 409
  while running), signed in, in the contract with a new `ConflictError`
  response.
- **How an app adopts it:** copy `app/jobs.py`, `app/routers/jobs.py`,
  `scripts/check_jobs_live.py` and `tests/test_jobs.py` from the template
  at the 4.7.0 tag. Apply the changes to `app/config.py`, `app/main.py`,
  `app/models.py`, `app/schemas.py` and `app/openapi_responses.py`. Add
  migration `0013_job_runs.py`, renumbered onto the app's own chain. Add
  the two paths, the `Job`/`JobRun` schemas and `ConflictError` to
  `openapi.yaml` and run `npm run gen:api`. Then register the app's jobs
  (`docs/deploy.md` "Scheduled jobs").

## 4.6.0 — MCP addresses under a section

Template backend only (#141). MCP's `fetch`, `update`, `delete` and
`restore` only understood `/<entity>/<id>`, so in an app that groups its
screens under a section (`/media/channels/3`) a link pasted into a chat
wasn't recognised.

- **`McpEntity.path`** (optional, default `/<name>`): where the record's
  page is in the app. A pasted address is matched against every entity's
  path plus `/<id>`; the API's form (`/api/<name>/<id>`) and a full link
  still work. The addresses the tools hand back use the path, so a chat
  links to the page the user would open.
- **`check_entities`** runs when `mcp_entities.py` loads and refuses a
  malformed path, one under `/api`, or two entities with the same path.
- **How an app adopts it:** copy the changes to `app/mcp_entities.py`,
  `app/mcp_tools.py` and `tests/test_mcp.py` from the template at the
  4.6.0 tag (keep the app's own `ENTITIES`), then set `path` on each
  entity whose pages aren't at `/<name>`.

## 4.5.0 — which build is live, and production refuses a mock build

Additive. Two apps had each built both of these by hand (#142, #143).

- **`@tristan2828/ui-foundation/vite`**, a new entry point: `buildInfo()`,
  a Vite plugin. On `vite build` it writes `dist/build-info.json` (`api`:
  `"real"` or `"mock"`, `commit`, `pr`, `builtAt`) and sets
  `import.meta.env.VITE_BUILD_COMMIT`, `VITE_BUILD_PR` and
  `VITE_BUILD_REPO_URL` from the build's `BUILD_COMMIT`, `BUILD_PR` and
  `BUILD_REPO_URL` (or its `repoUrl` option). `vite` is now an optional
  peer dependency (every app already has it).
- **`AppShell`'s `version`** (optional, `AppShellVersion`): the short
  commit in the sidebar footer, linking to its PR, or to the commit when
  there's no PR. Nothing shows without a commit, so development shows
  nothing.
- **Template backend:** with `APP_ENV=production`, `production_problems`
  refuses to start when `STATIC_DIR` has no `build-info.json` or it says
  `"mock"`, naming `npm run build:real`.
- **How an app adopts it:** add `buildInfo({ repoUrl: '<the app's repo>' })`
  to `vite.config.ts`'s plugins, pass `version` to `AppShell` as the
  template's `src/App.tsx` does, and set `BUILD_COMMIT` (and `BUILD_PR`
  when there is one) where the app is built (`docs/deploy.md` "Which build
  is live"). The backend check is copy-in: take `frontend_build_problem`
  and the `static_dir` argument from the template's
  `app/deploy_checks.py` and `app/main.py`, and **build with the plugin
  before deploying it**, or production will refuse to start for want of
  `build-info.json`. An app that already has its own check can drop it.

## 4.4.1 — the Postgres check runs on its own database

Template only. `scripts/check-backend-postgres.sh` used the dev
`docker-compose.yml` Postgres on :5432 with its persistent volume, so it
failed when another checkout (a worktree, another app) held :5432, and
when the volume had been migrated by a branch this one doesn't have
("Can't locate revision"). It now runs a compose project of its own, named
for the checkout's path, on a free port (`CHECK_POSTGRES_PORT` to choose
one), and deletes it after the run. `docker-compose.yml` publishes
`${POSTGRES_PORT:-5432}`, so `docker compose up` for development is
unchanged.

- **How an app adopts it:** copy the two files' changes from the template
  at the 4.4.1 tag, if the app still has the template's script.

## 4.4.0 — long text that saves as it's typed

Additive: two new optional options on `editInPlace`; nothing changes until
a field opts in. Asked for to make notes feel like Notion: no click away to
save.

- **`autosave: true`** on a `long-text` field edited in place: it saves
  about a second after typing stops, without leaving the field, and at once
  on leaving it. It stays editable while a save is in flight; the next save
  waits behind it and sends the latest draft, so saves never cross. A quiet
  "Saving…" / "Saved" line sits under it. A refusal keeps exactly what was
  typed with the reason, as before. Esc saves what's left and closes:
  nothing reverts. Rich text that can't round-trip (`onProblem`) still
  saves nothing.
- **`alwaysEditable: true`** (implies `autosave`): the editor is the value
  at rest, with no click to open, and never closes. At rest it shows the
  editor rather than the read view, so links in it are edited, not
  followed.
- **Leaving the page** with only autosaving text unsaved saves it and goes
  on; "Discard your changes?" shows only if that save fails. Hiding the
  page saves too.
- **Fix: Esc in a rich-text field edited in place now gives up the edit**,
  as `cell-patterns.md` always said. ProseMirror marked every Esc handled,
  so the field never saw it and Esc did nothing.
- The template's Widget Description autosaves (still opened with a click).
- **How an app adopts it:** add `autosave: true` (or `alwaysEditable: true`,
  and drop `autoFocus` from its control) to the long-text field's
  `editInPlace`. See `docs/foundation/cell-patterns.md` "Editable value".

## 4.3.1 — MCP: a refused write leaves nothing behind

Backend only, a fix to `app/mcp_tools.py` since 4.2.0. When an entity's router
refused a `create` or `update` part way through (a field error raised after
it had already changed part of the record), the chat was told "Nothing was
saved", but the partial change stayed in the request's session. A later
write in the same request (a JSON-RPC batch) then committed it, with no
row in `mcp_audit_log`. A refused write is now rolled back
(`_refused`). Found adopting 4.2.0 in an app whose task router applies
fields before its focus rule refuses. 4.3.0's `delete` and `restore` need
no change: their routers refuse before they change anything.

- **How an app adopts it** (the backend is copied in): in
  `app/mcp_tools.py`, add `_refused` and use it in both `except
  RequestValidationError` blocks, as in the template at the 4.3.1 tag. Add
  `test_a_refused_write_leaves_nothing_for_a_later_write_to_save` to
  `tests/test_mcp.py`, rewritten for one of the app's own routers that
  changes a field before refusing another.

## 4.3.0 — soft delete as an entity pattern, and an MCP delete that only soft-deletes

Additive: a new endpoint, a new list parameter and two new MCP tools in the
reference backend and template; nothing in the package's exports changes.
Issue #137.

- **The entity plan asks how a record is deleted:** retired by a status,
  soft-deleted, or hard-deleted. `docs/foundation/add-an-entity.md`
  "Deleting" shows the soft pattern.
- **Widgets are soft-deleted.** `DELETE /widgets/{id}` now sets a nullable
  `deleted_at` (migration `0012`, commented) instead of removing the row.
  New `POST /widgets/{id}/restore` and `deleted=true` on the list (only the
  deleted). A deleted widget is a 404 to get, update and delete. The
  delete toast offers Undo.
- **MCP gains `delete(url)` and `restore(url)`,** offered only for entities
  whose `McpEntity` sets both. `delete` is marked `destructiveHint`, so the
  chat asks before each call; one record per call. Both are logged in
  `mcp_audit_log` with the whole record. An entity that deletes for good
  gets no delete tool.
- **How an app adopts it:** `docs/consuming.md` "Adding soft delete to a 4.x
  app".

## 4.2.0 — AI chats read and write an app's records through MCP

Additive, and backend only: nothing in the package or the contract changes.
The reference backend gains a Model Context Protocol endpoint and the OAuth
2.1 sign-in that custom connectors require, off until `MCP_ENABLED=true`.
Issue #132.

- **`/mcp`** (streamable HTTP, stateless JSON-RPC, stdlib only) with five
  tools: `fetch(url)` (one record by the app's own address,
  `/<entity>/<id>`, with its fields, labels and the titles of the records
  it points at), `search(query)`, `list(entity, filters, search, sort,
  offset, limit)`, `create(entity, fields)` and `update(url, fields)`.
  **No delete tool.** `create` and `update` call the entity's router
  functions, so validation, per-user scoping and the 404 for another
  user's record are the API's; refused fields come back as text.
- **`app/mcp_entities.py`** is where entities are described once: the name
  in the address, the out/create/update schemas, the title field, list
  filters and sorts, which fields point at other entities. The tools are
  generated from it. The template registers `widgets` (read and write) and
  `widget-categories` (read only).
- **Every write is logged** in `mcp_audit_log`: user, chat, time, entity,
  record, and the changed fields before and after.
- **OAuth 2.1** (`app/routers/oauth.py`): discovery documents, dynamic
  client registration (public clients, https or loopback redirects, a cap),
  an approval page behind the app's own session (so its rate limits and
  two-step sign-in apply), PKCE S256 required, single-use hashed codes,
  rotating refresh tokens whose reuse ends the connection, revocation.
- **Docs:** the template's `docs/deploy.md` "AI chats (MCP)": turning it on,
  connecting Claude, the log, ending a connection, and which paths to let
  through an access proxy that would otherwise block the provider's servers.
- **Checks:** `tests/test_mcp.py` (SQLite) and, against real Postgres,
  `scripts/check_mcp_live.py` run by `check-backend-postgres.sh`.
- **How an app adopts it** (the backend is copied in, so by hand): see
  `docs/consuming.md` "Adding AI chats (MCP) to a 4.x app".

## 4.1.0 — error reporting

Additive: a new optional `FoundationProviders` prop, a new optional path in
the contract, new mocks. Nothing changes until an app turns it on. Issue
#126.

- **A seam, with a Sentry-protocol destination.** The reference backend's
  `report_error(exc, context)` (`app/error_reporting.py`) runs for every
  500 and is there for app code. It always logs. With
  `ERROR_REPORTING_DSN` set, it also sends a Sentry envelope over plain
  HTTP (stdlib only, no SDK, in the background) to Sentry or a
  self-hosted Sentry-compatible server such as GlitchTip.
- **The browser reports too**, when `FoundationProviders` gets
  `errorReporting` (or `{ release }`). That covers `RouteErrorBoundary`,
  `window` `error` and `unhandledrejection`, and TanStack Query failures of
  kind `server` (never `auth`, `notfound`, `validation`, `rate_limited` or
  `network`), each at most once a minute. Reports go to the app's own
  `POST /api/client-errors`, signed in only, and the backend forwards them
  under the session's user. Duplicates are dropped (once a minute per
  session), and each session is capped at `CLIENT_ERRORS_PER_MINUTE`.
- **Privacy:** a report holds the error's type, message and stack, the
  route pattern, the method and status, the release and the user's id.
  Never bodies, cookies, headers, form values or query strings. Query
  strings, and a database error's SQL and parameters, are cut from
  messages and stacks. Tested on both sides.
- **Contract:** `POST /client-errors` (`x-optional`, `ClientErrorReport`):
  204, 401, 422, 500.
- **Mocks:** `clientErrorHandlers`, `getMockClientErrors()`,
  `resetMockClientErrors()`.
- **How an app adopts it:**
  1. Upgrade, then pass `errorReporting={{ release: import.meta.env.VITE_RELEASE }}`
     to `FoundationProviders`. This needs a data router
     (`createBrowserRouter`).
  2. Add `clientErrorHandlers` to the app's MSW handlers and
     `resetMockClientErrors()` to its reset.
  3. Copy `/client-errors` and `ClientErrorReport` into `openapi.yaml`, then
     run `npm run gen:api`.
  4. Backend, by hand from the template: `app/error_reporting.py`,
     `app/routers/client_errors.py` (included in `main.py`), the 500
     handler in `app/errors.py`, `request.state.user_id` in
     `get_current_user`, `ClientErrorReport` in `app/schemas.py`, the
     settings in `app/config.py`, and `tests/test_error_reporting.py`.
  5. Set `ERROR_REPORTING_DSN` (and `RELEASE`, `VITE_RELEASE`). Unset,
     everything still works and logs as before. See the template's
     `docs/deploy.md` "Error reporting".

## 4.0.0 — sign-in limits and two-step sign-in

**Breaking:** the foundation's part of the contract changes (`POST
/auth/login`), and so do `useAuth().login`'s result, `AppError`'s kinds and
`ApiResponse`. Upgrade steps: [`docs/consuming.md`](docs/consuming.md)
"Moving a 3.x app to 4.0". Issues #124 and #125, shipped together so the
contract changes once.

- **Too many failed sign-ins are refused** (issue #124). The reference
  backend counts failures in a `login_failures` table, per client IP (10 in
  15 minutes) and per account (20 in an hour, from any IP), all settings.
  Over either, `POST /auth/login` answers **429** with `Retry-After`,
  before the password is checked. A session starting clears that IP's and
  that account's failures. The account key is a hash of the email, so an
  unknown email counts like a known one and no address is stored.
- **Two-step sign-in with TOTP and recovery codes** (issue #125), stdlib
  only (RFC 6238, checked against its test vectors). For an account with
  TOTP on, the password answers **202 `{"next": "totp"}`** and no session.
  A short-lived, single-use pending sign-in (its own `pending_login`
  cookie, stored hashed) waits for `POST /auth/login/totp` with a code or
  a recovery code: a 30-second step, one step of drift either way, a used
  step refused. A wrong code is a 401 and counts toward the limits. Five
  wrong codes, or five minutes, end the pending sign-in: **410**, start
  again. Turned on per account with `scripts/enable_totp.py` (it needs one
  right code first) and off with `scripts/disable_totp.py`.
- **Contract** (`openapi/foundation.yaml`): `/auth/login` gains `202`
  (`LoginNextStep`) and `429` (`RateLimitedError`, with `Retry-After`);
  new optional path `/auth/login/totp` (`TotpLoginRequest`,
  `SignInExpiredError`); `LoginRequest.password` gains `maxLength: 1024`,
  which the backend already enforced (from DEFERRED: "the next major
  release").
- **Package:**
  - `AppError` kind `rate_limited`, with `retryAfterSeconds` from
    `Retry-After`. `toAppError(status, body, headers?)` maps a 429 to it.
    `ErrorState` titles it "Too many attempts".
  - `ApiResponse.headers`.
  - `useAuth().login` resolves to a `SignInResult`, and the context gains
    `submitTotp`.
  - `LoginRoute` has the second step: one code field
    (`autocomplete="one-time-code"`, `inputmode="numeric"`), "Use a
    recovery code", the error on the field, "Start over", and back to the
    password with the reason when the pending sign-in has gone. A 429
    shows on the form and holds the button until `Retry-After` has passed,
    with no retry offered.
  - Mocks: a two-step account (`MOCK_TOTP_USER`, `MOCK_TOTP_CODE`,
    `MOCK_RECOVERY_CODE`) and `/auth/login/totp`. The e2e override takes
    `headers`, so a spec can force a 429 with its `Retry-After`.
- **Reference backend (by hand):** migration `0010` (`login_failures`,
  `users.totp_secret`/`totp_last_step`, `recovery_codes`, `pending_logins`,
  all commented), `app/login_limits.py`, `app/totp.py`, the two scripts,
  the routes in `app/routers/auth.py`, and `app/errors.py` keeping an
  `HTTPException`'s headers. `tests/test_login_limits.py`,
  `tests/test_totp.py`.
- **Docs:** the template's `docs/deploy.md` "Sign-in limits" (the
  settings, the lockout trade-off, uvicorn's `--proxy-headers`) and
  "Two-step sign-in" (the scripts, recovery, and why database backups must
  be encrypted: the TOTP secret is stored as is).
## 3.30.1 — Escape never clears a multi picker

A fix; nothing to change. Run `npx ui-foundation sync` for the updated
cell patterns.

- **Fix: a second Escape no longer empties `MultiChoice` or
  `MultiReference`** (issue #123). Base UI clears a multiple combobox on
  Escape while its list is closed, so picking and pressing Escape twice
  wiped every chip, on a form with nothing saying so. Escape now closes
  the list when it's open and leaves the value alone when it's closed;
  the key goes on to whatever holds the picker, so editing in place gives
  up on the second Escape with the saved picks (before, it emptied the
  field and waited for a third). Chips still come off by their remove
  button, Backspace in the empty input, or unpicking in the list. An
  app's e2e helpers that close a picker with Escape no longer race the
  list closing.

## 3.30.0 — a widget card for hub pages

Additive: new components and one new optional prop, nothing existing
changes. Run `npx ui-foundation sync` for the updated design language and
AGENTS.md block.

- **New components `WidgetCard`, `WidgetList` and `WidgetListItem`**
  (issue #121): a hub page's small widget, a titled card holding a short
  list that loads on its own. It owns the four required states the way
  `DataTable` does (`isLoading`, `error`, `onRetry`, `isEmpty`,
  `emptyMessage`): a skeleton of `skeletonRows` rows so the card keeps its
  height, one quiet empty line, and the error inside the card with a
  retry, so one failing widget never takes the page down. The header has
  an optional icon, a real heading (`headingLevel`, h2 by default) that
  names the card's region, and an optional `link` to the full list,
  described by the title so several "All" links stay distinct. A row is a
  route link (`to`), an external link (`href`, a new tab) or plain text,
  cut to one line with the whole text in its name and tooltip, then an
  optional muted `note` and a `trailing` badge or control; a control gets
  the row text's id for its `aria-labelledby`.
- **`ErrorState` takes `size="compact"`** for a small container: less
  padding, the icon beside the title. The default is unchanged.
- **Fix: `SecondaryFilters`' button is named by its content.** axe 4.14
  (which a fresh `npm install` now resolves) flags an `aria-label` that
  doesn't hold the visible text ("Filters 1" isn't in "Filters, 1
  active"), as voice control reads it. The name is unchanged, "Filters,
  1 active", so specs matching it still pass; it's now built from the
  label, the visible count and a hidden " active".
- **Design language: "Widget cards (hub pages)"**: when to use one, three
  to six rows, the error staying in the card, the grid they sit in.
- Checked by Storybook's `app/WidgetCard` stories (three widgets on a
  page, and each in every state): axe, the token check and the glyph check
  in both themes, axe again at `large`, and specs for the region names,
  the header link's description, a switch named by its row, the cut row
  and the skeleton's height. Each check failed on a negative control.

**Using it:** nothing to do on upgrading. An app that built its own
widget card can swap it for `WidgetCard` and drop its own skeleton,
empty and error markup.

## 3.29.0 — sidebar nav sections

`AppShell`'s `nav` takes labelled sections beside plain entries, for an
app with more than one module: `{ label, items: NavItem[] }` becomes its
own sidebar group with that label. Additive: a `NavItem[]` is still a valid
`nav`, and a nav with no sections renders exactly as before, one
"Navigation" group.

```ts
export const NAV: readonly NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  {
    label: 'Projects',
    items: [
      { to: '/projects', label: 'Projects', icon: ListIcon },
      { to: '/projects/categories', label: 'Categories', icon: TagIcon },
    ],
  },
]
```

- **New exports:** the types `NavSection` and `NavEntry` (`NavItem |
  NavSection`). `AppShellProps['nav']` is now `readonly NavEntry[]`.
- **One current entry, the most specific.** An entry used to be active on
  any path that *started with* its route, so `/projects` and
  `/projects/categories` were both current on the Categories page, and
  `/projects` was current on `/projects-archive` too. Now matching is on a
  path-segment boundary, and only the most specific match is current
  (`aria-current="page"` and the sidebar's active style). `end: true`
  still means exact.
- **The links are plain `Link`s, not `NavLink`s,** so they no longer get
  NavLink's `active` class; the active style was always the sidebar's own
  `data-active`, and `aria-current` is still set on the current entry.
- Checked by `app/AppShell` stories (axe and the token check in both
  themes) and `e2e/app-shell.spec.ts` (the groups, and one current entry),
  each with a negative control.

**Using it:** nothing to do on upgrading. To group, write `src/nav.ts` as
`readonly NavEntry[]` with sections. An app whose CSS targets the nav's
`a.active` should use `[aria-current="page"]` instead.

## 3.28.0 — a large density, for a screen read from a distance

`data-density="large"` joins `compact` and `comfortable`: a TV used as the
desktop monitor, with a mouse and keyboard, read from across the room.
Unlike the other two it isn't only tables. Everything under it grows by
about a quarter: body text 14 → 18px, controls 32 → 40px tall, icons
16 → 20px, the sidebar 256 → 320px, table rows to match. Breakpoints and
`max-w-*` containers stay put, so a wide screen keeps its wide layout
(browser zoom would move them).

No new props, components or exports, and **nothing changes for an app
that doesn't set it**: every token it reads defaults to the value the
primitive had before, and the Storybook checks hold the default sizes to
the pixel.

- **How it reaches everything:** Tailwind compiles every spacing, size
  and icon utility to `calc(var(--spacing) * n)` and every `text-*` to
  `var(--text-*)`. `large` redefines those (plus `--radius`, the `--type-*`
  roles and the `--table-*` tokens) in `styles/theme.css`, so the
  package's components and the app's own Tailwind classes grow together.
- **Primitives patched** where a size bypassed that scale, each reading a
  token whose default is today's value: the sidebar's widths (`16rem`,
  `18rem`, `3rem` → steps of `--spacing`), `Switch` (fixed px), the small
  `Button` and `Toggle` text and the calendar's weekdays (`0.8rem` →
  `--control-text-sm`), `DropdownMenu`'s minimum width, `EntityView`'s
  label column and rail, and `DataTable width="content"`'s minimum.
- **Storybook:** a Density toolbar (sets `data-density` on `<html>`, as an
  app would) and `patterns/Density` (the primitives, `DataTable` and the
  sidebar at each density, made-up data). axe runs on those stories and on
  every primitive's own story at `large`, in both themes.

**Using it:** set `data-density="large"` on `<html>` (for example from a
setting the app keeps itself). Set it on `<html>`, not on a wrapper:
menus, selects, dialogs and tooltips are portaled to `<body>`. Run
`npx ui-foundation sync` for the updated design language ("Density"). An
app's own fixed sizes (`h-[18px]`, `w-[240px]`) stay their size at
`large`; write them as steps of the scale to have them grow.

## 3.27.4 — axe checks wait for a popup to finish opening

Nothing for an existing app to do. `expectNoAxeViolations` (from
`/testing`) now waits for the page's open and close transitions to finish
before running axe. A popup fading in is already visible to Playwright,
and its text is blended with the page behind it: CI failed the
template's phone Filters sheet at 4.37:1 mid-fade, on colours that measure
4.74:1 once it's open. Endless animations (spinners, skeletons) aren't
waited for. An app's own spec that builds `AxeBuilder` itself straight
after opening a popup has the same race; calling `expectNoAxeViolations`
instead fixes it.

## 3.27.3 — `create-app.sh` runs on macOS

Nothing for an existing app to do. `create-app.sh` used two GNU-only
flags: `sed -i` with no suffix (BSD sed reads the expression as the
suffix) and `tar --wildcards` (macOS's bsdtar rejects it). The `<title>`
is now set in the script's `node` step, and a downloaded tag is extracted
whole into a temporary folder before its `template/` is copied. Checked
against bsdtar 3.8 (the old flag fails, the new extraction gives the same
128 files as before), not on a Mac itself.

## 3.27.2 — two package fixes from the first review

No export or prop changes; nothing is required beyond the upgrade.

- **A link to `//example.com` is refused** in the rich-text editor's link
  box, like `javascript:`. It looked like a path on this site but the
  browser reads it as another site (`/\example.com` too).
- **Logging out when the server can't be reached still logs out on
  screen.** `useAuth().logout()` ends the session in the app whatever the
  request does, and still rejects when the server didn't confirm. The
  shell's Log out button lands on a clean `/login` either way. An app that
  calls `logout()` itself and catches the rejection to stay "logged in"
  now finds the user logged out.

## 3.27.1 — reference backend fixes from the first review

Template only: the package doesn't change. Six findings from the first
whole-project review, all in `template/backend/` and the template's mocks.
The backend is copied into each app (`ARCHITECTURE.md` "Why shared code"),
so **an existing app doesn't get these by upgrading**. Apply the ones that
fit by hand (below). No contract shape changes: each 500 that becomes a
422 was already declared as a 422 in `openapi.yaml`.

- **PATCH with `null` for a field that can't be empty** (`name`,
  `categoryId`, `status`, `availableFrom`, `price`, `description`, `tags`)
  was a 500 (a NOT NULL violation at commit). It's now a 422 on that
  field. One `field_validator("*", mode="before")` on `WidgetUpdate`
  refuses `null` for every field not in its `NULLABLE_FIELDS`
  (`assignee_email`), replacing the three per-field validators, so a new
  field is covered without remembering to add one. `tags: null` used to
  clear the tags; send `[]` for that, as `openapi.yaml` says and the mocks
  already required.
- **An unknown `categoryId`** saved on SQLite and was a foreign-key 500 on
  Postgres. It's now a 422 on `categoryId`, on create and on PATCH. The
  test engine now turns on SQLite's foreign keys, so a missing check like
  this one fails in pytest rather than only on Postgres.
- **Paging is stable.** The list always ends its `ORDER BY` with
  `Widget.id`, so rows that tie on the sort column (or every row, with no
  sort) can't show on two pages or on none. The mocks sort ties the same
  way.
- **Search treats `%` and `_` literally** (`autoescape=True`), in
  `/widgets` and `/widget-categories`.
- **Login runs the password hash for an unknown email too**, against a
  dummy hash, so its response time doesn't say which emails have accounts.
- **Passwords are at most 1024 characters** on login and register (a
  422). Not in `openapi.yaml`: `LoginRequest` is the foundation's part of
  the contract, and `check-contract` would fail every existing app until
  it copied the new `maxLength`.

**Applying it to an app**, for an entity built from Widgets (substitute
its names):

1. `backend/app/schemas.py`: in each `<Entity>Update`, delete the
   per-field not-null validators and add
   ```python
   NULLABLE_FIELDS: ClassVar[frozenset[str]] = frozenset({...})  # the model's nullable columns

   @field_validator("*", mode="before")
   @classmethod
   def _refuse_null(cls, v: object, info: ValidationInfo) -> object:
       if v is None and info.field_name not in cls.NULLABLE_FIELDS:
           raise ValueError(f"{to_camel(info.field_name or '')} can't be null")
       return v
   ```
   Give both password fields `max_length=1024`.
2. `backend/app/routers/<entity>.py`: check every single `reference`
   field exists (a 422 on the field) on create and when a PATCH sends it,
   as `_check_categories_exist` does; end every list query with
   `.order_by(col(<Entity>.id).asc())`; add `autoescape=True` to every
   `.contains(search…)`.
3. `backend/app/routers/auth.py` and `security.py`: copy
   `DUMMY_PASSWORD_HASH` and the login change.
4. `backend/tests/conftest.py`: the `PRAGMA foreign_keys=ON` listener, and
   a `flush()` after seeding the rows other rows point at.
5. `src/mocks/`: refuse `null` on PATCH and break sort ties by id, as
   `template/src/mocks/handlers.ts` does.

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
