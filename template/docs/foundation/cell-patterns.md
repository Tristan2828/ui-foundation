# Cell Patterns

How a column's value should *look*. Each entry is markup plus the bits a
first attempt gets wrong — **not components**: the lookup maps are always
per-entity, and only the shape is reusable. Copy the markup into your
`<entity>-columns.tsx`.

Patterns 1–10 were each chosen for a real column, from a page of
alternatives ([`column-options.md`](column-options.md)), not designed in the abstract.
Patterns 12 (boolean), 15 (yes/no flipped in the row), 16 (title linking
to its view), 17 (quick action on the view) and 18 (editable value) are
the template's own references: Widget's In Stock and Name columns and its
view render them, and their specs pin them. Patterns 19 (stage circle)
and 20 (count linking to the related records), the multi-value variant
of 4, the dependency list in 10 and the pressed icon in 15 were each
built for a real app's screen first; the package's Storybook renders
them (`app/StageCircle`, `app/CountLink`, `patterns/CellPatterns`), and
its checks pin their accessibility and contrast in both themes. The
other patterns from 11 on are marked **Unproven**: written ahead of a
real column, so no app has tested them on real data yet. Prefer a proven
pattern when one fits. When you use an unproven one, say so in the
entity's plan, and raise what you learned for the foundation, so the
entry can lose its label. A pattern that proves generic is worth raising
too, so it ships here for every app.

## The rules that apply to every cell

- **An empty value renders an em dash**, never a blank cell: a blank reads
  as a rendering bug. Define it once per columns file —
  `const emptyCell = <span className="text-muted-foreground">—</span>` —
  and use it everywhere. The one exception is a value whose "nothing" state
  has its own meaning (an unrated 0-of-5 scale, a missing image), where the
  shape itself should say so.
- **Colour is never the only signal.** Greyscale, colourblindness and print
  all lose it. The label usually carries the meaning; where a cell is a
  glyph, vary the *shape* too. See [`design-language.md`](design-language.md).
- **Type every lookup as `Record<TheEnum, …>`** so `tsc` fails when
  `openapi.yaml` gains a value the map doesn't cover, instead of silently
  falling back.
- **A cell that reads across the row needs `row.original`**, not just
  `getValue()`.
- **Give a repeated control a row-specific `aria-label`.** Twenty-five
  buttons all named "Link" are useless to a screen reader.

---

## 1. Plain text

The default, and it wins more often than it looks like it should. Reach for
something else only when the extra ink buys a decision the reader would
otherwise have to make themselves.

Always offer a plain-text option when exploring a column — in practice it
gets picked about as often as the visual ones.

## 2. Icon + label

A single-value enum where a glyph speeds up scanning but the word still
matters.

```tsx
const GENRE_ICON: Record<GameGenre, typeof Flame> = { Survival: Flame, Shooter: Crosshair, /* … */ }

cell: ({ getValue }) => {
  const genre = getValue() as GameGenre
  const Icon = GENRE_ICON[genre]
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-4 shrink-0" aria-hidden />
      {genre}
    </span>
  )
}
```

- **Don't wrap it in `Badge`** — beside a multi-value badge column it reads
  as one more tag.
- The glyph is decorative next to a visible label, so `aria-hidden`.
- Check lucide before drawing anything; it covers most vocabularies.

## 3. Icon in a badge

A count or short scalar that should read as a unit.

```tsx
<Badge variant="outline">
  <UsersIcon data-icon="inline-start" />
  <span className="tabular-nums">{maxPlayers}</span>
</Badge>
```

`Badge` already sizes child `svg`s and pads for
`data-icon="inline-start"|"inline-end"` — don't add a wrapper.
`tabular-nums` keeps a numeric column from jittering.

## 4. Icon only, label in a tooltip

An enum where the glyph alone is enough at a glance and the column is
narrow.

```tsx
<Tooltip>
  <TooltipTrigger render={<span role="img" aria-label={support} tabIndex={0} />}>
    <GamepadGlyph support={support} />
  </TooltipTrigger>
  <TooltipContent>{support}</TooltipContent>
</Tooltip>
```

- Base UI's `TooltipTrigger` renders a **`<button>`** by default. A
  read-only cell isn't a button: `render={<span role="img" aria-label … tabIndex={0} />}`
  keeps it focusable and named without faking one.
- Needs the `TooltipProvider` that `AppShell` mounts — free in any
  cell, absent in an isolated Storybook story.
- Encode the value in the glyph's **shape** (solid / half / slashed /
  dashed), not its colour.
- **Give the trigger a focus ring**
  (`rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50`):
  it's focusable, and a span has none of its own.

### Several values: the icons side by side, every name in one tooltip

A multi value (several categories on one record) where each value has
its own icon and colour slot, and the column is narrow. The package's
Storybook renders it (`patterns/CellPatterns`, "Icons with one tooltip").

```tsx
// values: the row's categories, `undefined` for one still loading.
const names = values.map((value) => value?.name ?? '…').join(', ')
if (values.length === 0) return emptyCell

<Tooltip>
  <TooltipTrigger
    render={
      <span role="img" aria-label={names} tabIndex={0}
        className="inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
    }
  >
    {values.map((value, index) => {
      if (!value) return <span key={index} className="text-muted-foreground">…</span>
      const Icon = CATEGORY_ICON[value.icon]
      return <Icon key={value.id} className={`size-4 shrink-0 ${CATEGORY_COLOR[value.color]}`} />
    })}
  </TooltipTrigger>
  <TooltipContent>{names}</TooltipContent>
</Tooltip>
```

- **One tooltip on the whole group**, listing every name in the record's
  order ("Home, Finance"), not one per icon: one tab stop per cell, and
  the names read as one value.
- **The trigger is the `role="img"` span**, named by that same list. The
  icons inside are presentational (children of an `img`), so they need no
  `aria-hidden` of their own. Read-only: never a button.
- **Each icon tinted with its value's colour slot**
  ([`design-language.md`](design-language.md) "Categorical colour"), the
  icon's shape telling values apart in greyscale.
- **A value still loading shows "…"**, in the cell and in the names,
  never a bare id.
- **Where there's room** (the record's view), each icon sits beside its
  name instead (pattern 2 per value, in a `flex flex-wrap gap-x-3 gap-y-1`
  list), with no tooltip.

**Testing note.** With several tooltips on a page, one that's closing
stays in the DOM for a moment beside the one opening. A spec that reads
the open tooltip must select `[data-slot=tooltip-content][data-open]`;
the bare `[data-slot=tooltip-content]` can match the closing one, and
reads the wrong text:

```ts
await page.getByRole('img', { name: 'Home, Finance', exact: true }).focus()
await expect(page.locator('[data-slot=tooltip-content][data-open]')).toHaveText('Home, Finance')
```

## 5. Enum → tone-mapped badge

A many-valued enum that collapses to good / neutral / bad. **The grouping
is the decision, not the style** — see
[`design-language.md`](design-language.md#mapping-an-enum-to-tones).

An **ordered** status (a lifecycle every record moves through toward
*done*) reads better as a stage circle beside the word (pattern 19);
the tone badge stays right for a status with no order, or one whose end
isn't *done*.

Keep a separate short-label map when the API strings are full sentences
(`"Yes – Full Crossplay"` → `Full`): read once in a dropdown they're right,
read down 25 rows under a column header they're noise.

## 6. Multi-value enum, clustered

A column holding several values from one enum. Cluster by family, with the
family's icon once at the start of each cluster, rather than one badge per
value — a six-value row is the stress case that kills per-value styles.

- The family taxonomy is a **display decision made in the columns file**,
  not part of the API contract.
- Clustering **discards the picked order**, so if "first = primary" means
  something, say in a comment that the form still preserves it.
- Needs an empty case and a wrap policy (`flex flex-wrap gap-1`).
- Tests that matched each value as its own element break when values share
  a badge — assert `toContainText` on the row.

## 7. Link as an outline button

An external URL.

```tsx
<Button
  variant="outline" size="sm" nativeButton={false}
  aria-label={`Link to ${row.original.name} store page`}
  render={<a href={link} target="_blank" rel="noreferrer" />}
>
  Link
  <ExternalLinkIcon />
</Button>
```

- `render={<a />}` **plus** `nativeButton={false}` is what keeps it a real
  anchor styled as a button. A `<button>` wrapping an `<a>` is invalid, and
  Base UI warns without the flag.
- Every row shows the same word, so the `aria-label` must name the row —
  and must still contain the visible text.
- Null renders `emptyCell`, not a disabled button.
- **Cost:** the loudest link style; a long table becomes a wall of buttons.

## 8. Date, relative

When the useful question is "how soon?" rather than "which day?".

- `Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })` gives
  `tomorrow`/`today` free, but it takes **one unit** — write a ladder (days
  under 2 weeks, weeks under ~2 months, months under 2 years, then years)
  or you get "in 44 days".
- An API `format: date` is a calendar day with no time. Parse as
  `T00:00:00Z`, format with `timeZone: 'UTC'`, and count from **local today
  rebuilt as UTC midnight** (`Date.UTC(y, m, d)`). Subtracting `Date.now()`
  shifts the answer by a day for anyone west of UTC.
- Relative text **goes stale**, so a fixture pinning a date drifts. Freeze
  the clock (Playwright's `page.clock`) in any test asserting one, and
  assert one past and one future value:

```ts
// West of UTC, where subtracting Date.now() would be off by a day.
test.use({ timezoneId: 'America/Los_Angeles' })

test('release dates read relative to today', async ({ page }) => {
  // Before goto, so the first render already sees it. Noon UTC is the same
  // calendar day in every timezone from UTC-11 to UTC+11.
  await page.clock.setFixedTime(new Date('2026-06-01T12:00:00Z'))
  await page.goto('/games')
  // Mock fixtures: one released 2026-04-01, one due 2026-06-22.
  await expect(page.getByRole('cell', { name: '2 months ago' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'in 3 weeks' })).toBeVisible()
})
```

`setFixedTime` pins `Date.now()` and `new Date()` and leaves the real
timers alone, so debounces and TanStack Query behave as usual. Reach for
`page.clock.install()` only when a test has to move time forward.

- `title` is mouse-only. If the exact date matters, use pattern 4 instead.
- **Cost:** "2 years ago" is vague, and the column doesn't look sorted even
  though server-side sorting still works.

## 9. Ordinal scale (bounded integer)

A 1–5 rating or similar. The grouping step from pattern 5 applies, but the
values are a **range**: read the min/max from `schema.d.ts`, band it
(5 and 4 share a tone, 3 alone, 2 and 1 share), and treat "not set" as its
own state.

- Token colours work as SVG fills (`fill-success-text` plus
  `text-success-text`), and the tone classes must be whole strings picked
  by a function — Tailwind won't generate one built from a value.
- The filled **count** carries the value; the tone only reinforces it, so
  the cell survives greyscale.
- Accessible name on a wrapping `<span role="img">` with the glyphs
  `aria-hidden`, saying the value in words and handling "not set".
- Very faint "empty" glyphs fall below the 3:1 non-text minimum, and axe
  does not check icon contrast. That's a defensible choice — make it
  deliberately, in a comment, not by accident.

## 10. Summary in the cell, detail in a popover

A one-to-many value (`★ 4.7 (3)` opening a per-person breakdown).

- Use `Popover` with `<PopoverTrigger openOnHover delay={100}>`, **not**
  `Tooltip`: a tooltip can't hold rich content and is unreachable on touch.
  Here the trigger *should* be a real `<button>` — it opens something —
  unlike pattern 4.
- shadcn's `hover-card` exists but has nothing to tap on touch, so it is
  deliberately not used for information not available elsewhere in the row.
  Say so, or someone will "fix" it.
- `PopoverContent` defaults to `w-72`; use `w-auto min-w-48` for a short list.
- The popup is **portaled** — Playwright must query
  `page.getByRole('dialog')`, not within the row.
- **Cost:** the detail can't be scanned down the column, and an average
  can't be sorted server-side without a backend change
  (`enableSorting: false`).

### A second example: what a row depends on

The records a row waits on (parts it needs, a date that has to pass,
other records that have to finish), summarised in the cell, listed in
the popover. The package's Storybook renders it
(`patterns/CellPatterns`, "Dependency list").

- **The cell: a computed summary.** "Ready" when nothing holds the row,
  else the count of what does ("1 hold", "2 holds"). Compute it where the
  data is: the backend, when the column sorts or filters on it.
- **The popover: every related record, grouped by kind**, each kind
  under a small heading (`type-caption text-muted-foreground`) in its own
  labelled group, in a fixed order. Each record keeps its kind's glyph
  (`aria-hidden`, beside the name), so the kinds stay apart in
  greyscale.
- **Held reads dark, with its reason; clear reads muted.** A held record
  is `text-foreground` with why after its name ("Bulb: unavailable",
  "Delivery day: hasn't happened", or the blocking record's status);
  a clear one is `text-muted-foreground` with a visually hidden ": clear",
  so a screen reader hears the state the colour shows. No tone: a hold
  is the normal state of waiting, not an error, and the count already
  says how many.
- **Name the popup**: `<PopoverContent aria-label={`What ${name} depends on`}>`.
  It's a `dialog`, and axe fails one with no name.
- **A row that links nothing has nothing to open**: render the summary as
  plain text (`<span>Ready</span>`), not a button. A button that opens an
  empty popover is a dead end.
- **The trigger reads as the value**, with a dotted underline
  (`underline decoration-dotted underline-offset-4`) and a focus ring,
  so it looks openable without becoming a column of buttons.
- The trigger's name starts with the summary it shows
  (`aria-label={`${summary}: what ${name} depends on`}`), so it's still
  found by its visible text, and says which row.

## 11. Number or currency — *Unproven*

A count, a quantity, a price.

```tsx
// Module scope: one formatter per column, not one per cell render.
const priceFormatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })

cell: ({ getValue }) => {
  const value = getValue<string | null>()
  return value == null ? emptyCell : <span className="tabular-nums">{priceFormatter.format(Number(value))}</span>
}
```

- `tabular-nums` gives every digit the same width, so values line up down
  the column even when left-aligned.
- **Zero is a value, not an empty cell.** Test `value == null`, never
  falsiness, or `0` renders as an em dash.
- An API `format: decimal` arrives as a **string**. `Number()` is exact
  enough to display (about 15 significant digits). Never add up money in
  floats on the client: totals come from the backend.
- **Right-aligning isn't available yet.** `DataTable`'s `meta.align` only
  supports `'center'`, and a right-aligned cell under a left-aligned header
  looks broken. Stay left-aligned until a real column needs
  `align: 'right'`, then raise it for the foundation.
- The currency code comes from the data or the plan, never a guess. The
  template's `USD` is the demo's.
- **Cost:** none to speak of. It's the plain-text pattern with formatting.

## 12. Boolean

A yes/no field. Widget's In Stock column (`src/routes/widgets/widgets-columns.tsx`)
is the reference; its value is never null, so it drops the `emptyCell`
branch below.

```tsx
cell: ({ getValue }) => {
  const value = getValue<boolean | null>()
  if (value == null) return emptyCell
  return value ? (
    <span className="inline-flex items-center gap-1">
      <CheckIcon aria-hidden="true" className="size-4 text-success-text" />
      Yes
    </span>
  ) : (
    <span className="text-muted-foreground">No</span>
  )
}
```

- **The word carries the value.** The check only reinforces it, so the
  cell survives greyscale and a screen reader hears "Yes".
- **Never a checkbox** in a read-only cell. It looks editable, and people
  will try to click it.
- "No" is muted, not red. False is rarely bad. If it is, the field is
  really an enum with a verdict, and pattern 5 fits better.
- **Nullable means three states.** `null` is the em dash, distinct from
  "No". Check the schema before collapsing them.
- **Cost:** a column that is mostly "Yes" is noise. If almost every row
  shares the value, consider showing only the exception.

## 13. Progress bar — *Unproven*

A percentage, or a count out of a total (`7 of 12 done`).

- The package doesn't ship `progress`. Install shadcn's into
  `src/components/ui/` (`npx shadcn@<tools.shadcn> add progress`, after
  checking its dependencies against `deps-allowlist.json`).
- **Always print the number** beside the bar (`72%`, `7 / 12`). The bar
  shows roughly how far; the number says exactly.
- Fix the bar's width (`w-24`) so bars compare down the column. A bar that
  stretches with the column compares nothing.
- The default colour is `bg-primary`. Tone it (`bg-success`) only when the
  value means something, like "complete", and say that in the plan.
- Clamp to the schema's range. A value of 105% from bad data shouldn't
  draw past the track.
- Give each bar a row-specific `aria-label` (`${row.original.name}
  progress`).
- **Cost:** a bar takes far more width than the number it replaces. On a
  wide table, the plain number from pattern 11 usually wins.

## 14. Avatar and name — *Unproven*

A person: an assignee or an owner.

- The package doesn't ship `avatar`. Install shadcn's the same way as
  pattern 13.
- **Always render the fallback** (initials). Images fail, load slowly, or
  aren't set, and the cell must still look intentional.
- The image is decorative (`alt=""`) because the name is right beside
  it. Otherwise a screen reader reads the name twice.
- `size-6` keeps the row height unchanged at `compact` density
  ([`design-language.md`](design-language.md) "Density").
- Initials on `bg-muted text-muted-foreground`. Categorical colours
  would make every person look like a category.
- Avatar URLs load from wherever the API points. Use `loading="lazy"` so a
  25-row page doesn't fetch every image up front.
- **Cost:** a column of faces draws the eye more than any other cell. Use
  it when *who* matters most in the row, not as decoration.

## 15. Yes/no you flip in the row

A yes/no the user changes more often than they open the form ("available
now", "happened"). Widget's In Stock column is the reference
(`src/routes/widgets/in-stock-toggle.tsx`).

- **A `Switch`, never a checkbox.** It acts at once; a checkbox in a row
  reads as "select this row".
- **It saves on its own:** a PATCH of that one field, not the form,
  through the foundation's `useRecordUpdate` (Widget's
  `useSaveWidgetField`). The new value shows at once, in the table and on
  the record's view, and goes back, with a toast naming the row and the
  server's reason, if the save is refused.
- **Saving blocks nothing.** The switch stays usable (a second flip waits
  for the first and builds on it), and a "Saving" spinner shows beside it
  in a slot that's always there, so the cell never changes width.
- **Keep the word beside it** (pattern 12), `aria-hidden` since the switch
  announces its own state. Give the switch a row-specific name
  (`In stock: ${row.original.name}`).
- Its own component in its own file, rendered from the column's `cell`,
  so the hook lives in a component and the columns stay stable
  ([`add-an-entity.md`](add-an-entity.md) "Keep column definitions
  stable").
- **Cost:** one click changes data, with no confirmation. Only for values
  that are cheap to flip back; never for anything destructive.

### A variant: a pressed icon inside another value's cell

A yes/no that belongs to another value rather than having a column of
its own: a "focus" flag that only exists while the status is "doing", a
"pinned" mark on an open item. It's a small icon button inside the owning
value's cell, beside its word. The package's Storybook renders it
(`patterns/CellPatterns`, "Pressed icon in a cell").

**Pick it over the Switch** when the yes/no only means something while
another value allows it, or when a Switch and its words would crowd that
value's cell. A yes/no that stands on its own keeps its own column and
the Switch.

```tsx
// Off: faint. On: the destructive text tone, filled. The primitive's
// pressed background is dropped: the icon carries the value.
const FLAG_TOGGLE_CLASS =
  'text-muted-foreground/80 hover:text-muted-foreground aria-pressed:bg-transparent ' +
  'aria-pressed:text-destructive-text'

// <entity>-focus-toggle.tsx, rendered inside the status cell
export function FocusToggle({ item }: { item: Item }) {
  const save = useSaveItemField(item.id) // useRecordUpdate, like Widget's useSaveWidgetField
  return (
    <>
      <Toggle size="icon-xs" pressed={item.focus} aria-label={`Focus: ${item.name}`}
        className={FLAG_TOGGLE_CLASS} onPressedChange={(focus) => save.mutate({ focus })}>
        <FlagIcon className="group-aria-pressed/toggle:fill-current" />
      </Toggle>
      <span className="inline-flex size-3.5 shrink-0">
        {save.isPending && <Spinner aria-label="Saving" className="size-3.5 text-muted-foreground" />}
      </span>
    </>
  )
}

// The status cell: the word stays, the toggle only while the status allows it.
<span className="inline-flex items-center gap-1.5">
  <StageCircle {...STATUS_STAGE[item.status]} />
  {STATUS_LABEL[item.status]}
  {item.status === 'doing' && <FocusToggle item={item} />}
</span>
```

- **`Toggle` from the package** (`/ui/toggle`, shadcn's, on Base UI), at
  `size="icon-xs"`: a 24px target, the smallest WCAG 2.2 allows, which
  keeps the row's height. It's `aria-pressed` by itself.
- **Named for the row, not the state**: `Focus: <record name>`. The
  pressed state is announced on its own; a name that changes with it
  ("Unfocus") reads twice.
- **The icon carries the value.** Filled when on
  (`group-aria-pressed/toggle:fill-current`), outline when off, so it
  reads in greyscale. Pick a glyph with an area to fill (`FlagIcon`,
  `StarIcon`, `PinIcon`), not a line.
- **Faint, but never below 3:1.** Off is `text-muted-foreground/80`, the
  faintest step that still clears WCAG's 3:1 non-text minimum in light
  mode (3.2:1; dark is 5.2:1). `/70` measures 2.7:1, and a control a
  reader can't see fails them. Hover lifts it to full
  `muted-foreground`. axe doesn't measure icons, so the package's
  Storybook glyph check does.
- **Tone: `destructive-text`, read as "flagged", not "error".** A flag
  claims attention ahead of the rest of the row, and the destructive
  tone is the one with that pull. The other tones are taken where it
  sits: `info` is the in-progress status it belongs to (an info flag
  beside an info stage disappears), `success` reads as done, and
  `warning` says something may be wrong. It stays honest because it's
  rare (a flag nearly every row carries is the "about a third" limit
  broken) and because no word beside it says error. If a flag is common,
  or does mean "something's wrong", it's an enum with a verdict
  (pattern 5) instead.
- **It saves on its own, through `useRecordUpdate`**, like the Switch: the
  new value shows at once, and a refusal (a cap the server enforces)
  puts it back with the toast giving the server's reason. The hook does
  both; add nothing.
- **The "Saving" slot is always there**, after the toggle, so nothing
  moves while it saves, and nothing is disabled.
- **Only rendered while the owning value allows it.** When the status
  moves on, the toggle goes; what the server does with the flag then (it
  clears it, or keeps it for next time) is the plan's rule, and shows
  through the record it returns.
- **On the record's view** it's the same component beside the owning
  value in the header, as a quick action (pattern 17): the plan names it
  under `Quick actions`. There its name is the field's label alone
  (`Focus`), like the view's other controls.

## 16. Title linking to the record's view

The column that names a record (its name or title), when the entity has a
view (`/<entity>/:id`). Widget's Name column is the reference
(`src/routes/widgets/widgets-columns.tsx`).

```tsx
const TITLE_LINK_CLASS =
  'rounded-sm font-medium text-foreground underline-offset-4 outline-none hover:underline ' +
  'focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50'

cell: ({ row }) => (
  <Link to={`/widgets/${row.original.id}`} className={TITLE_LINK_CLASS}>
    {row.original.name}
  </Link>
)
```

- **A plain `Link`, not a `Button`.** It goes somewhere and does nothing
  else; a button-styled title down every row is a wall of buttons
  (pattern 7's cost).
- **The record's own name is the link text**, so each row's link is
  already distinct for a screen reader, with no `aria-label`.
- `font-medium` marks it as the row's name; the underline appears on hover
  and keyboard focus. Foreground, not `text-primary`: it's the row's
  heading, and a column of coloured text pulls the eye from every other
  column.
- **The view replaces the row actions.** Edit and Delete live in the
  view's header, so a table whose title links to a view has no actions
  column. A `yes/no` marked `toggle` (pattern 15) stays in its row.
- **A reference to another record** (a cell showing a linked record's
  name) uses the same link when *that* entity has a view, pointing at
  `/<other>/${id}`, on the table and on the view alike.
- **Cost:** none to speak of. Specs that match the title as a cell still
  work (`getByRole('cell', { name })` reads the link's text); ones that
  opened the form from a row button go through the view's Edit instead.

## 17. Quick action on the view

A value on the record's view that changes right where it's shown, with one
click, saved on its own the moment it changes, without the form: a yes/no
flipped, a sub-record item ticked. Widget's view is the reference
(`src/routes/widgets/widget-quick-actions.tsx`): In Stock in the header,
Checklist items ticked in place.

**Read-only is the default.** A value on the view is a control only when
the plan's "View screen" names it under `Quick actions` (or `Edit in
place`, pattern 18); everything else renders as its table cell does, and
changes through Edit. A quick action is for a value people change often
and can change back as easily: never anything destructive. Anything you
type or pick from a list (text, a status) edits in place instead
(pattern 18); a status was a quick action in 3.12, and moved there in
3.13.

| The plan's field | The control | Accessible name |
|---|---|---|
| `yes/no`, in the header or a field row | A `Switch` (`size="sm"`) with the value in words beside it, `aria-hidden` (pattern 15) | The field's label: `In stock` |
| A `yes/no` that belongs to another value (pattern 15's variant), beside that value in the header | The same pressed icon `Toggle` as in the table's cell | The field's label: `Focus` |
| A sub-record list's `yes/no` item field | Each item a `Checkbox` inside a `<label>` with the item's text, so the text ticks it too; the list in one `role="group"` named for the list, described by the done-count | `Done: <item text>` (a visually hidden `Done: ` inside the label) |

```tsx
const save = useSaveWidgetField(widget.id) // one per control

// A value: send the field.
<Switch size="sm" checked={widget.inStock} aria-label="In stock"
  onCheckedChange={(inStock) => save.mutate({ inStock })} />

// A list item: send the whole list, built from the latest record.
<Checkbox checked={item.done} onCheckedChange={(done) =>
  save.mutate((current) => ({
    checklist: current.checklist.map((other, i) => (i === index ? { ...other, done } : other)),
  }))} />

// Beside every control: the "Saving" slot, always there.
<span className="inline-flex size-3.5 shrink-0">
  {save.isPending && <Spinner aria-label="Saving" className="size-3.5 text-muted-foreground" />}
</span>
```

- **Every save goes through `useRecordUpdate`** (the entity's
  `useSave<Entity>Field(id)` in `use-<entity>.ts`), called once per
  control. The change shows at once on the view and in every cached list
  page. When the save answers, the view takes the record the server
  returned, so a server-side effect shows (a computed field, a flag the
  change cleared). Never write a quick action's mutation by hand.
- **A list is sent whole, built from the latest record**: pass a function
  of the record (`(current) => ({ checklist: ... })`), not a list read from
  props. Saves of one record run one at a time and each request is built
  when it's sent, so two quick ticks both land.
- **A refusal puts the value back** and toasts "Couldn't update <name>:
  <reason>", the reason being the server's: the 422's message on the
  field, or the error's message. That's built into the hook; don't add a
  second toast.
- **Saving shows, and blocks nothing.** Each control keeps its own
  "Saving" spinner in a slot that's always there (nothing moves), and
  nothing is disabled: not the other controls, not this one, not Edit.
- **Keep the value's look.** The yes/no keeps its words; a ticked item
  keeps the muted text a done item had. The control only adds the
  affordance.
- **One component per control, in its own file** (`<entity>-quick-actions.tsx`),
  so each hook lives in a component and the view's sections stay plain
  data.
- **Cost:** one click changes data, with no confirmation, and the server
  may still say no. Keep the list short: a view where every value is a
  control reads as a form.

## 18. Editable value

A value on the record's view that turns into **the form's own control**
where it's shown, and saves when you leave it: a title, a status, a
price, notes, a list of linked records. Widget's view is the reference
(`src/routes/widgets/widget-view.tsx`): Name (the title), Status (its
header badge), Price, Description (rich text) and Extra Categories, with
the controls in `widget-fields.tsx`, the same ones the form uses.

The rule behind every part of it: **nothing typed is ever lost.**

**Which values.** Only those the plan's "View screen" names under `Edit
in place`; read-only is the default, and a value not named renders
exactly as it did. Text, long text, a single choice (optional ones with
their "not set" option), an integer or a rating, a yes/no, a single or
multi reference, and a sub-record list (its own rules, under "A list of
sub-items" below). Never a computed field. The view's Edit button and
the form stay.

**At rest: says it's editable without shouting.** The value reads as it
always did. Hover tints it (`bg-muted`) and shows a pencil; the pencil is
a real button ("Edit <label>"), so Tab reaches it and Enter opens the
field, and its focus ring tints the value too. On a touch screen the
pencil always shows. A click anywhere on the value opens it, except on a
link inside it (a reference to a record with a view, a link in the
notes), which still navigates.

**Open: the form's control, nothing else.** The same labels, choices and
pickers as `EntityForm`; the field's label is its accessible name. No
Save button, no Undo:

| Kind (`editInPlace({ kind })`) | Saves on | Esc |
|---|---|---|
| `text`: one line | Enter, or leaving it | puts the saved value back |
| `long-text`: notes, rich text for Markdown | Ctrl/Cmd+Enter, or leaving it (Enter is a new line) | the same |
| `choice`: a select, a switch, a single reference | the pick (its list opens with the field, non-modal) | closes the list with nothing picked: gives up |
| `multi`: a multi reference | leaving it, or Ctrl/Cmd+Enter (Enter picks) | closes the list first; Esc again gives up |

Leaving means clicking or tabbing anywhere else. Unchanged closes with no
request; a value the form's schema refuses never leaves the browser and
shows the schema's message. Opening another value saves the open one
first; if that save fails, the open one stays and the other doesn't
open.

**Saving: still open, read-only, and says so.** Under the control,
"Saving…" with a spinner (`role="status"`) until the server agrees, then
it closes on the saved value. **Not optimistic**: the value only shows as
saved once it is, and the view shows the record the server returned (a
side effect included). The rest of the page stays usable.

**Refused: still open, with exactly what was typed and why.** The reason
under the control in the destructive text tone (`FieldError`), word for
word: a 422's field error as `EntityForm` shows it, or the error's
message (a 500, no answer). The control is `aria-invalid` and described
by the reason. Nothing reverts on its own, and there's no toast. Leaving
again retries; Esc gives up.

**Leaving the page** (a link, Back) while a value holds unsaved text asks
"Discard your changes?" first (Keep editing / Discard); closing the tab
asks through the browser. A link press doesn't save the field on its
way out: the prompt decides.

```tsx
const editField = useEditWidgetField(widget.id) // optimistic: false, toastOnError: false
const price = editInPlace({
  kind: 'text',
  value: widget.price,                         // as the form's control holds it
  schema: widgetFormSchema.shape.price,        // the form's own rule
  save: (price) => editField.mutateAsync({ price }),
  control: (props) => (
    <WidgetPriceInput id={props.id} value={props.value} onChange={props.onChange}
      invalid={props.invalid} readOnly={props.disabled}
      aria-label={props.label} aria-describedby={props.describedBy} />
  ),
})
// A field: { label: 'Price', value: <…as the table shows it…>, edit: price }
// The title: <EntityView titleEdit={{ label: 'Name', ...name }} />
// A badge: <EditableValue label="Status" edit={status} layout="inline"><Badge>…</Badge></EditableValue>
```

- **One control per field, shared with the form** (`<entity>-fields.tsx`):
  each takes `value`/`onChange` and `readOnly`, and the form wraps it in a
  `Controller`. Never a second, in-place-only control.
- **Long text written as Markdown edits as rich text** (`RichTextEditor`):
  formatted where it's read, saved as Markdown with every block the person
  didn't touch kept exactly as written. On the form too, so it's one
  control. Give it a `placeholder` and the schema's limit as `maxLength`
  (a count shows from 80% of it, in the destructive text tone once over).
  Its keys: Ctrl/Cmd+K adds or edits a link (web and email addresses
  only), Ctrl/Cmd+Shift+Enter ticks the task item the caret is in, and
  Markdown pasted as plain text arrives formatted. Notion's block keys
  work: Ctrl+Shift+1 to 3 for headings, +4 tasks, +5 bullets, +6 numbers,
  +8 a code block, +0 back to text (Cmd+Option on a Mac), and
  Ctrl/Cmd+Shift+S strikes through. Ctrl/Cmd+Enter stays the save, in a
  table too. A formatting toolbar sits above the text (bold to link, each
  button naming its shortcut), and a smaller one floats over selected
  words (bold, italic, strikethrough, code, link); Alt+F10 reaches the
  floating one, else the fixed one. Both are part of the field, so moving
  to them doesn't save, and Esc hides the floating one before it gives up
  the edit. "/" typed at a line's start lists the blocks the line can
  become (three headings, lists, quote, callout, code block, divider,
  table); typing filters ("/warn" finds a warning callout), Enter or Tab
  picks, and Esc closes the list before it gives up the edit. A callout
  is GitHub's `> [!NOTE]` (note, tip, important, warning, caution), its
  icon a menu of kinds. In a table, Tab in the last cell adds a row,
  Enter goes down a column (and out from the last row), bars under and
  beside it add a row or a column, and the toolbar's Table menu inserts
  rows and columns, aligns a column and deletes.
  `toolbar={false}` leaves out the toolbars and the slash menu where a
  value is short and the shortcuts are enough.
- **The save is the single-field save** (`useRecordUpdate` with
  `optimistic: false, toastOnError: false`, the entity's
  `useEdit<Entity>Field`), `mutateAsync` of one field's PATCH.
- **Keep the value's look at rest**: the badge stays a badge, the price
  stays formatted. Only the open state looks like a form.
- **Cost:** a value that looks like text but edits on click can surprise.
  Keep it to the fields the plan names, and leave the form for everything
  else.

### A list of sub-items

A sub-record list (a checklist, a list of links) on a `content` section,
edited where it's shown: `editInPlace({ kind: 'list', ... })`. Widget's
Checklist is the reference (`checklist` in `widgetEdits`). It's built on
`ListEditor`, so the rows and their buttons are the form's.

- **Each item reads as it always did** (`renderShown`), its own controls
  included: a done box still ticks it on its own, a quick action. A click
  on the item (not its box, not a link in it) or its pencil ("Edit item
  2") turns it into the form's row (`renderItem`, the same fields as the
  form's `ListEditor` row), an editable value like any above: Enter or
  leaving saves, Esc gives up, one open at a time.
- **Add at the end.** "Add item" opens a new row; Enter saves it and
  opens the next, the caret already in it, so a run of items goes in from
  the keyboard. Esc on an empty one closes it; nothing is sent.
- **Move and remove** are `ListEditor`'s buttons, with its names ("Move
  item 2 up", "Remove item 2"). Each saves at once; whatever is open is
  saved first. While it saves, the buttons wait and "Saving…" shows under
  the list; the caret follows the item it moved. A refusal leaves the
  list as it was, with the reason under it.
- **One save per change, of the whole list**, built on the record's
  latest list when it's sent: `save` is given a change, not a list, and
  hands it to the single-field save as a function of the record, so it
  never undoes a tick or a change still saving.
- **The form's rules**, the whole list's schema, run on the list each
  change would make: a message about an item shows under that item, one
  about the list (too many items) under the row being added.
- `content` shows above the items (the done-count) and `emptyLabel` in
  place of them when there are none.

```tsx
const checklist = editInPlace<ChecklistItem>({
  kind: 'list',
  value: widget.checklist,
  schema: widgetFormSchema.shape.checklist,                 // the whole list's rule
  save: (change) => editField.mutateAsync((current) => ({ checklist: change(current.checklist) })),
  newItem: () => ({ text: '', done: false }),
  itemName: (index) => `item ${index + 1}`,                 // as the form's ListEditor names them
  addLabel: 'Add item',
  renderShown: (_item, index) => <ChecklistItem widget={widget} index={index} />, // the quick action
  renderItem: (props) => <WidgetChecklistItemFields index={props.index} … />,     // the form's row
})
// The section: { title: 'Checklist', content: <ChecklistDoneCount …/>, emptyLabel: 'No items', edit: checklist }
```

The row's fields are one component shared with the form
(`WidgetChecklistItemFields` in `widget-fields.tsx`), each field named by
position ("Item 2 text") as the row buttons name the item.

## 19. Stage circle for an ordered status

A status that's an ordered lifecycle (each record moves through the same
stages, in the same order, toward one that means *done*), with one or
more exit states off the side. A small circle beside the word fills as
the record moves on. The package ships it: `StageCircle`, rendered with
every stage and tone in its Storybook (`app/StageCircle`).

| Stage (`stage`) | Drawn as | Say it for |
|---|---|---|
| `0` | a dashed outline | the first stage: not started |
| `1`, `2`, `3` | the outline with a quarter, a half, three quarters filled | a stage under way, in order |
| `'complete'` | a solid circle with a tick | the final stage: done |
| `'exit'` | the outline, struck through | off the lifecycle: dropped, cancelled |

```tsx
import { StageCircle, type StageCircleStage, type StageCircleTone } from '@tristan2828/ui-foundation'

// <entity>-format.ts: typed by the enum, so a new value can't go unmapped.
const STATUS_STAGE: Record<ItemStatus, { stage: StageCircleStage; tone?: StageCircleTone }> = {
  idea: { stage: 0 },
  considering: { stage: 1 },
  doing: { stage: 2, tone: 'info' },
  done: { stage: 'complete', tone: 'success' },
  dropped: { stage: 'exit' },
}

cell: ({ getValue }) => {
  const status = getValue() as ItemStatus
  return (
    <span className="inline-flex items-center gap-1.5">
      <StageCircle {...STATUS_STAGE[status]} />
      {STATUS_LABEL[status]}
    </span>
  )
}
```

- **The word stays**, in plain `text-foreground`. The circle is
  `aria-hidden`; the word is what's read, and what a reader who doesn't
  know the shapes yet goes by.
- **The shape carries the stage, in greyscale.** Dashed, filling, solid,
  struck through: the stage reads from the shape alone, and the tone only
  reinforces it.
- **Tone it like pattern 5:** the stage in progress is `info` ("notice
  this"), complete is `success`, and the rest stay `muted` (the default).
  The tones are the `*-text` shades, so the circle clears 3:1 on the page
  in both themes, measured by the package's glyph check. An exit is
  muted: dropped is an end, not a failure. Give it `destructive` only if
  the exit really is bad news (failed, rejected).
- **Map the stages in order**, the first `0`, the final `'complete'`, the
  ones between `1`–`3` in order. Two middle stages fill a quarter and a
  half; three, up to three quarters. More than three stages between
  first and done is more than a fill can tell apart: use the tone badge.
- **Stage circle or tone badge (pattern 5)?** The circle is for an
  *ordered* status: every record goes the same way, and "how far along
  toward done" is the question. A status with no order (`active` /
  `paused` / `blocked`), or one whose end isn't *done*, keeps pattern 5.
  Widget's Status is the second kind: `draft` → `active` → `archived` is
  an order in time, but `archived` is retirement, not completion, and its
  good state is the middle one. A tick on `archived` would say "done"
  where nothing was finished, so it stays a tone badge.
- **On the record's view** it's the same markup in the header, beside the
  title; editing the status in place (pattern 18) wraps it in
  `<EditableValue>` like a badge.
- **Cost:** a reader learns the shapes once. Until then the word does the
  work, which is why it stays.

## 20. Count linking to the related records

A count of the records in another table that point at this row (open
Tasks per Project, items per Tag), which opens that table already filtered
to them. The count is a `computed` integer (the entity plan's type).
The package ships it: `CountLink`, rendered in its Storybook
(`app/CountLink`).

```tsx
import { CountLink } from '@tristan2828/ui-foundation'

cell: ({ row }) => {
  const { id, name, openTaskCount: count } = row.original
  return (
    <CountLink
      count={count}
      to={`/tasks?project=${id}`}
      label={`open ${count === 1 ? 'task' : 'tasks'} in ${name}`}
    />
  )
}
```

What the component decides, so a cell doesn't have to:

- **Underlined at rest**, not only on hover as in pattern 16. A title
  reads as a name to open; a bare number doesn't look like it goes
  anywhere until it's underlined. Hover thickens the line. Foreground,
  not `text-link`: `--link` is for links in written text, and a column of
  blue numbers pulls the eye from every other column.
- **Zero is a plain `0`**, not a link (a link to an empty list is a dead
  end) and not an em dash: zero is a value (pattern 11). Same
  `tabular-nums`, so it lines up with the links.
- **The accessible name is the count, then `label`**: `3 open tasks in
  Kitchen remodel`. Every row's link text is just a number, so `3` alone
  isn't distinct, and starting with it keeps the link findable by what
  it shows (speech input, `getByRole('link', { name: /^3 / })`).

What the cell decides:

- **`label` says what's counted and which row**, singular for one
  (`open task in Garden`).
- **The target is the other entity's list, filtered by the URL**:
  `/<other>?<filterName>=<id>`, the same query string `useTableUrlState`
  reads (a multi-value filter takes the id the same way). Back, forward,
  a refresh and saved views keep working, and the other list needs a
  filter by this reference (`Filter: yes` in its plan).
- **The count and the list it opens must agree.** If the target list
  narrows by default (hides finished records unless asked), the count
  applies the same condition, and the word in the name says so (`open`
  tasks). Where the list has a filter for that condition, prefer putting
  it in the link too (`?project=7&status=open`), so the list shows what
  was counted even if its default changes. Say the rule in the field's
  `description` in `openapi.yaml` (`Tasks in this project that aren't
  done; what /tasks?project=<id> lists`), so the backend, the mocks and
  the next agent count the same thing.
- **Sorted on the server, as a number**, like any computed field: the
  scalar subquery is the sort expression, with a stable tiebreak (the
  name, then the id) so rows with the same count don't change places
  between pages.
- **Cost:** one correlated subquery per row read. Fine at an app's scale;
  give the other table's foreign key column an index, since every row's
  count reads it.
- **On the record's view**, the same `CountLink` beside its label (`Open
  tasks: 3`), with the record's name in `label` like the table's.
