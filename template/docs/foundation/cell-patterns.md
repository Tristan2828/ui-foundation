# Cell Patterns

<!-- index: written by `npm run docs:index` in the package from the headings below; never edit it by hand -->
## Index

- [The rules that apply to every cell](#the-rules-that-apply-to-every-cell) · lines 63–86
- [1. Plain text](#1-plain-text) · lines 88–137
- [2. Icon + label](#2-icon--label) · lines 139–162
- [3. Icon in a badge](#3-icon-in-a-badge) · lines 164–177
- [4. Icon only, label in a tooltip](#4-icon-only-label-in-a-tooltip) · lines 179–255
  - [Several values: the icons side by side, every name in one tooltip](#several-values-the-icons-side-by-side-every-name-in-one-tooltip) · lines 204–255
- [5. Enum → tone-mapped badge](#5-enum--tone-mapped-badge) · lines 257–277
- [6. Multi-value enum, clustered](#6-multi-value-enum-clustered) · lines 279–291
- [7. Link as an outline button](#7-link-as-an-outline-button) · lines 293–314
- [8. Date, relative](#8-date-relative) · lines 316–353
- [9. Ordinal scale (bounded integer)](#9-ordinal-scale-bounded-integer) · lines 355–431
  - [Three variants the package draws: a step bar, a star and a score](#three-variants-the-package-draws-a-step-bar-a-star-and-a-score) · lines 373–431
- [10. Summary in the cell, detail in a popover](#10-summary-in-the-cell-detail-in-a-popover) · lines 433–482
  - [A second example: what a row depends on](#a-second-example-what-a-row-depends-on) · lines 451–482
- [11. Number or currency — Unproven](#11-number-or-currency--unproven) · lines 484–524
- [12. Boolean](#12-boolean) · lines 526–554
- [13. Progress bar — Unproven](#13-progress-bar--unproven) · lines 556–590
  - [The compact form: `ProgressRing`](#the-compact-form-progressring) · lines 575–590
- [14. Avatar and name — Unproven](#14-avatar-and-name--unproven) · lines 592–610
- [15. Yes/no you flip in the row](#15-yesno-you-flip-in-the-row) · lines 612–714
  - [A variant: a pressed icon inside another value's cell](#a-variant-a-pressed-icon-inside-another-values-cell) · lines 635–714
- [16. Title linking to the record's view](#16-title-linking-to-the-records-view) · lines 716–757
- [17. Quick action on the view](#17-quick-action-on-the-view) · lines 759–831
- [18. Editable value](#18-editable-value) · lines 833–1571
  - [Presets: one line per field](#presets-one-line-per-field) · lines 1217–1289
  - [Several fields edited as one](#several-fields-edited-as-one) · lines 1291–1327
  - [A link and its label](#a-link-and-its-label) · lines 1329–1353
  - [A list of sub-items](#a-list-of-sub-items) · lines 1355–1488
  - [In a table's rows](#in-a-tables-rows) · lines 1490–1564
  - [A table of a few short columns: `width="content"`](#a-table-of-a-few-short-columns-widthcontent) · lines 1566–1571
- [19. Stage circle for an ordered status](#19-stage-circle-for-an-ordered-status) · lines 1573–1639
- [20. Count linking to the related records](#20-count-linking-to-the-related-records) · lines 1641–1695
- [21. Rows grouped under headings, and a pill filter](#21-rows-grouped-under-headings-and-a-pill-filter) · lines 1697–1779
- [22. A highlighted row, and rows that are done](#22-a-highlighted-row-and-rows-that-are-done) · lines 1781–1806
- [28. A list's rows: hover, lines, rows per page](#28-a-lists-rows-hover-lines-rows-per-page) · lines 1808–1841
- [23. A Group menu, and a record read beside the list](#23-a-group-menu-and-a-record-read-beside-the-list) · lines 1843–1894
- [24. A stored colour beside its name](#24-a-stored-colour-beside-its-name) · lines 1896–1970
  - [Picking one on a form: `ColorField`](#picking-one-on-a-form-colorfield) · lines 1916–1970
- [25. A list's tools: views, filters, columns, row actions, a phone's rows](#25-a-lists-tools-views-filters-columns-row-actions-a-phones-rows) · lines 1972–2183
  - [The framed look, and sibling lists beside the title](#the-framed-look-and-sibling-lists-beside-the-title) · lines 2132–2183
- [26. A record's related list, capped](#26-a-records-related-list-capped) · lines 2185–2219
- [27. A repeat and its next time](#27-a-repeat-and-its-next-time) · lines 2221–2268

<!-- /index -->

How a column's value should *look*. Each entry is markup plus the bits a
first attempt gets wrong — **not components**: the lookup maps are always
per-entity, and only the shape is reusable. Copy the markup into your
`<entity>-columns.tsx`.

A pattern marked **Unproven** was written ahead of a real column, so no
app has tested it on real data yet. Prefer a proven pattern when one
fits. When you use an unproven one, say so in the entity's plan, and
raise what you learned for the foundation, so the entry can lose its
label. A pattern that proves generic is worth raising too, so it ships
here for every app.

## The rules that apply to every cell

- **An empty value renders an em dash**, never a blank cell: a blank reads
  as a rendering bug. Draw it with the package's `EmptyText`, the
  record's own dash, read by a screen reader as "Not set" (`label` for
  other words): `const emptyCell = <EmptyText />` once per columns file,
  used everywhere. Never a hand-written dash. The one exception is a value whose "nothing" state
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
- **Column headers are Title Case** ("Available From", "Rows per Page");
  a cell's value is written as its data is, and an empty value's words
  ("Not set") are a sentence ([design-language.md "Words on screen"](design-language.md#words-on-screen-title-case-and-sentence-case)).
- **Give a repeated control a row-specific `aria-label`.** Twenty-five
  buttons all named "Link" are useless to a screen reader.

---

## 1. Plain text

The default, and it wins more often than it looks like it should. Reach for
something else only when the extra ink buys a decision the reader would
otherwise have to make themselves.

Always offer a plain-text option when exploring a column
([`column-options.md`](column-options.md)).

**Markdown in a one-line value.** A short field the app lets people write
Markdown in (a summary, a status note, a title with a link) shows in a
cell, a card's line or a caption with `<Markdown inline>`, not the block
`<Markdown>`:

```tsx
<span className="text-muted-foreground">
  <Markdown inline>{row.original.summary}</Markdown>
</span>
```

- Bold, italic, code and links keep their marks; every other mark shows
  as its words (a strikethrough or a highlight as plain words).
- It's a `<span>` in the font and colour of where it sits, with no block
  margins, so the row stays as tall as a plain-text one. Code is the mono
  face alone, with no wash, so it can't add height or fail contrast on a
  muted cell.
- Blocks written in it still read on one line: paragraphs joined with a
  space; a list's items with " · " (numbered ones with their numbers, a
  done task with ✓, one to do with ☐); a table's rows as `Header: value`
  pairs (`Size: S, Price: $4 · Size: L, Price: $6`); a heading, quote or
  rule as " · "; a callout led by its kind ("Warning: …"); an image as its
  alt text.
- A link opens in a new tab, and its click and Enter stay its own: they
  never reach the row or the card it sits in, even a card of the app's
  own with an `onClick`.
- It's for one line. Long text is notes, the block `<Markdown>` on the
  record's view.

**Long text in a list's column: `meta.clip`.** A column whose values run
long (a description, a note, a path) is cut to one line, so one long value
can't make the whole table thousands of pixels wide:

```tsx
{ id: 'notes', header: 'Notes', meta: { clip: true }, cell: ({ row }) => row.original.notes }
```

- `meta.maxWidth` alone caps the column and lets its text wrap, for a
  value worth reading whole in the row.
- The title column (the first) is cut this way already, with no `meta`
  (pattern 16).

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
  cell, absent in an isolated fixture.
- Encode the value in the glyph's **shape** (solid / half / slashed /
  dashed), not its colour.
- **Give the trigger a focus ring**
  (`rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50`):
  it's focusable, and a span has none of its own.

### Several values: the icons side by side, every name in one tooltip

A multi value (several categories on one record) where each value has
its own icon and colour slot, and the column is narrow.

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

**A record's status** is not this pattern: it's a
`StatusMark` (an icon, a colour and the word, one of six kinds; see
[`design-language.md` "Status marks"](design-language.md#status-marks)),
`<StatusMark kind={STATUS_KIND[status]}>{STATUS_LABELS[status]}</StatusMark>`
in the cell. A tone badge stays for the other status-like values (a
computed progress, a source's health).

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

### Three variants the package draws: a step bar, a star and a score

Each is one image to a screen reader, named in words.

- **`StepBar`, an ordered enum of a few bands** (best to worst): a short
  bar of steps, the first `value` filled in `foreground`, the rest the
  track (`border`), with the band's word beside it in `muted-foreground`.
  Narrower than five stars, and it reads as a scale, not a rating. Its
  name says both: `label="Quality: High, 4 of 5"` (the default is
  "High, 4 of 5", enough where the column header names the field).

  ```tsx
  const QUALITY: Record<Quality, { word: string; value: number }> = {
    best: { word: 'Best', value: 5 }, high: { word: 'High', value: 4 }, /* … */
  }
  <StepBar value={QUALITY[q].value} word={QUALITY[q].word} />
  ```

- **`RatingStar`, a three-value enum** (yes / partly / no): a full, half
  or empty star with the word beside it. The shape carries the value, so
  it survives greyscale. The half is the left half filled over the whole
  outline, never half a star: alone, half a star reads as broken.

  ```tsx
  <RatingStar value={OWNED[o].value /* 'full' | 'half' | 'empty' */} word={OWNED[o].word} />
  ```

- **`RatingScore`, a score out of a few**: `max` stars (the
  default) or hearts (`glyph="heart"`), the first `value` filled in
  `foreground`, the rest outlines in `muted-foreground` (which clears 3:1,
  so an empty glyph is still seen). Named "4 of 5";
  pass the field in `label` where the column doesn't give it. The facts
  rail's `rating` fact draws it too.

  ```tsx
  {row.rating === null ? <span className="text-muted-foreground">Not rated</span> : <RatingScore value={row.rating} glyph="heart" />}
  ```

- **`RatingInput`, the same score set by a click**: RatingScore's
  glyphs and tokens as a radio group named by `label`, one radio per
  star ("2 of 5"). A click (or Space) sets a star, a click on the set one
  clears it to `null`, the arrow keys move and set it, a mouse's hover
  previews it. 24px targets on a laptop, 44px on a touch screen.
  `onChange(value, source)`: `source` is `'pointer'` or `'keyboard'`.
  On a form it's the field's control; on a record or in a row it's
  `inPlace.rating` ("Presets" below), so a cell sets its row's score where
  it's drawn:

  ```tsx
  <RatingInput label="Taste" value={value} onChange={(next) => setValue(next)} />
  // A table's cell: inside DataTable, which runs editing in place.
  cell: ({ row }) => (
    <EditableValue layout="inline" label={`Rating of ${row.original.name}`}
      edit={inPlace.rating({ value: row.original.rating, save: (rating) => save(row.original.id, { rating }) })} />
  ),
  ```

- All of them draw in `foreground`. Tone one only as pattern 5 would (a `*-text`
  class in `className`), never by band alone.

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
the popover.

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

{
  accessorKey: 'price',
  header: 'Price',
  meta: { align: 'right' },
  cell: ({ getValue }) => {
    const value = getValue<string | null>()
    return value == null ? emptyCell : <span className="tabular-nums">{priceFormatter.format(Number(value))}</span>
  },
}
```

- **Money and counts are right-aligned** (`meta: { align: 'right' }`), with
  `tabular-nums`, so the units line up down the column and with the
  `totals` under it. The header's label is right-aligned too, a sort
  arrow on its left, so its right edge sits on the values'. A number
  that's an identifier or a year (an order number, 2024) isn't a
  quantity: leave it left-aligned like text.
- **Zero is a value, not an empty cell.** Test `value == null`, never
  falsiness, or `0` renders as an em dash.
- An API `format: decimal` arrives as a **string**. `Number()` is exact
  enough to display (about 15 significant digits). Never add up money in
  floats on the client: totals come from the backend.
- **A column's total goes in `DataTable`'s `totals`**:
  ``totals={data && { label: `Total · ${data.total} items`, cells: { price: usd(data.totals.price) } }}``.
  One formatted value per column id, from the list endpoint beside
  `total`, so it covers every matching row, not only the page. It renders
  as a footer row: the label in a row header in the first visible column,
  each value under its column in that column's alignment and tabular
  figures, above a 2px border. A hidden column's value isn't shown, and
  the row is hidden while loading, on error and when empty.
- The currency code comes from the data or the plan, never a guess. The
  template's `USD` is the demo's.
- **Cost:** none to speak of. It's the plain-text pattern with formatting.

## 12. Boolean

A yes/no field.

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

- The package ships `progress`: import it from
  `@tristan2828/ui-foundation/ui/progress`.
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

### The compact form: `ProgressRing`

Done out of total (a checklist, how far through an ordered list, the
steps of a process) as a small ring filling clockwise beside the count
("4/6"). The package ships it.

```tsx
<ProgressRing done={row.original.doneCount} total={row.original.itemCount} />
```

- The arc is `foreground` while under way and `success-text` once
  complete, on a `border` track; the count is in tabular numbers. Zero
  of zero shows the empty ring and reads "Not started".
- Its name is "4 of 6 done" unless `label` says better ("4 of 6 chapters
  read"). The count beside it is `aria-hidden`: the name already says it.
- Prefer it to the bar in a table: it's as narrow as the count.

## 14. Avatar and name — *Unproven*

A person: an assignee or an owner.

- The package doesn't ship `avatar`. Install shadcn's into
  `src/components/ui/` (`npx shadcn@<tools.shadcn> add avatar`, after
  checking its dependencies against `deps-allowlist.json`).
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
  `useSaveWidgetField`), and saving blocks nothing. Pattern 17 has the
  rules (the value at once, a refusal put back with a toast, the "Saving"
  slot that's always there); they're the same in a row.
- **Keep the word beside it** (pattern 12), `aria-hidden` since the switch
  announces its own state. Give the switch a row-specific name
  (`In Stock: ${row.original.name}`).
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
value's cell, beside its word.

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
  `muted-foreground`. axe doesn't measure icons.
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
- **It saves on its own, through `useRecordUpdate`**, like the Switch
  (pattern 17's rules): a refusal (a cap the server enforces) puts it
  back with the toast, and the "Saving" slot after the toggle is always
  there. The hook does both; add nothing.
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
- **DataTable caps the title column.** The first column is the title
  column, cut to one line at 24rem with an ellipsis, its whole text in a
  tooltip. Put the title column first and write no clip of your own
  (`truncate`, `max-w-*`) around it. `meta: { wrap: true }` wraps it at
  the cap instead, for a title worth reading whole in the row;
  `meta: { maxWidth: 'none' }` lifts the cap.

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
(pattern 18).

| The plan's field | The control | Accessible name |
|---|---|---|
| `yes/no`, in the header or a field row | A `Switch` (`size="sm"`) with the value in words beside it, `aria-hidden` (pattern 15) | The field's label: `In Stock` |
| A `yes/no` that belongs to another value (pattern 15's variant), beside that value in the header | The same pressed icon `Toggle` as in the table's cell | The field's label: `Focus` |
| A sub-record list's `yes/no` item field | Each item a `Checkbox` beside the item's text; the text isn't part of the box (a click on it edits the item in place, pattern 18) | `Done: <item text>` (the box's `aria-label`) |

```tsx
const save = useSaveWidgetField(widget.id) // one per control

// A value: send the field.
<Switch size="sm" checked={widget.inStock} aria-label="In Stock"
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
- **A refresh the save always needs goes on the hook**: another query
  the change affects (a summary, a related list) is invalidated in
  `useRecordUpdate`'s own `onSuccess`, never `mutate(change, { onSuccess })`,
  which TanStack skips once the control unmounts (a popover closed
  mid-save). Per-call effects (navigate, a toast in the call's words)
  stay on `mutate()`.
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
header `StatusMark`), Price, Description (rich text edited where it's read,
`inline`) and Extra Categories, with the controls in `widget-fields.tsx`,
the same ones the form uses.

The rule behind every part of it: **nothing typed is ever lost.**

**No toast, but one.** An edit in place says what happened where it
happened: "Saving…" and "Saved" beside the value, a refusal's reason
under it. A toast after one would repeat what the person just watched
(add-an-entity.md "Toasts and feedback": a toast is for what happened
out of sight). The one exception is notes that save themselves
(`autosave`, `alwaysEditable`, `inline`): the first refusal or failed
save of a run also toasts ("Couldn't save Description", the reason
under it), since the person is typing, not watching the line, and on a
long note the line can be a screen away.

**Which values.** Only those the plan's "View screen" names under `Edit
in place`; read-only is the default, and a value not named renders
exactly as it did. Text, long text, a single choice (optional ones with
their "not set" option), an integer or a rating, money, a date, a link
and its label, a yes/no, a single or multi reference, two fields that
must agree (edited as one), and a sub-record list (its own rules, under
"A list of sub-items" below). The plain ones are one line each with the
`inPlace` presets ("Presets" below). Never a computed field. The view's Edit button and
the form stay.

**At rest: says it's editable without shouting.** The value reads as it
always did. Hover tints it (`bg-muted`) and shows a pencil; the pencil is
a real button ("Edit <label>"), so Tab reaches it and Enter opens the
field, and its focus ring tints the value too. Muted text inside it (the
view's "Not set", a "No caption", a done item) turns `text-foreground`
on that tint, since muted on `bg-muted` is under 4.5:1; the package does
it, so an app just uses `text-muted-foreground` as anywhere else. On a
touch screen the pencil always shows. A click anywhere on the value opens it, except on a
link inside it (a reference to a record with a view, a link in the
notes), which still navigates. The tint reaches 0.375rem past the value
on each side without moving it, and never wraps it: a short title or
badge edited in place (`layout="inline"`) stays on one line, and a long
one wraps between words within its column.
Inline, the pencil takes no room at rest: a value in a summary
line ("Harbor Office · Tuesdays") is followed by its separator a space
after it, not a pencil's width. The pencil keeps its 24px box out of the
flow, hidden just past the value over the separator, so it's still a
target to hover, click and Tab to. Hover or focus makes its room under
it, eased (at once with reduced motion): what follows moves over by the
pencil, smoothly, only while it shows, and the pencil stays put. A touch
screen keeps the room open. `DataTable`'s cells keep the room at rest
(a column never widens on hover), and so does `EntityView`'s title,
which ends its line and can fill it. An app needs no override for this.

**In a field list, the row is the target** (`look="row"`, which
EntityView's field rows use). The row wears the list's row hover, the
`--table-hover` tint and the 3px `--primary` bar at its start, as a
DataTable row does, with its label readable on it and the pencil at its
end; a click anywhere on the row (its label too) opens the value. Under
48rem or on a touch screen there's no pencil but a chevron, and the row
is 44px tall at least; the control still opens in the row. The header's
strip and the title keep the value-sized tint above. A field list of the
app's own gets the same with `editRowClass` and `onEditRowClick` on its row.

**Open: the form's control, nothing else.** The same labels, choices and
pickers as `EntityForm`; the field's label is its accessible name. No
Save button, no Undo:

| Kind (`editInPlace({ kind })`) | Saves on | Esc |
|---|---|---|
| `text`: one line | Enter, or leaving it | puts the saved value back |
| `long-text`: notes, rich text for Markdown | Ctrl/Cmd+Enter, or leaving it (Enter is a new line); with `autosave`, also a pause in typing | a changed draft asks "Discard your changes?" first (unchanged closes); with `autosave`, saves what's left and closes |
| `choice`: a select, a switch, a single reference | the pick (its list opens with the field, non-modal) | closes the list with nothing picked: gives up |
| `multi`: a multi reference | leaving it, or Ctrl/Cmd+Enter (Enter picks) | closes the list first; Esc again gives up |
| `multi` over a small set (`MultiPick`) | each click, on its own | closes it: every pick is already saved |

In either multi picker (`MultiChoice`, `MultiReference`), on a form, in
a toolbar filter or in place, Escape never removes a pick: it closes the
list when it's open and leaves the value alone when it's closed (Base UI
would empty it). A pick comes off only by its chip's remove button,
Backspace in the empty input, or unpicking it in the list.

**A small set (`MultiPick`): every option shown, each click saves.** A
multi field whose options are few (up to about 25) and all loaded (a
dozen labels, a short tag list) uses `MultiPick` instead, on the form
and in place: every option a toggle chip with its icon or colour where
the app draws one (`icon`), the picked ones pressed with a check, and a
filter box above them, not in front of them. The chips wrap at every
width; past 30 options (`limit`) it shows the picked ones and the
first 30, then "Show All N", and a filter searches them all. The options
can be the app's list of records (its query's rows as `{ id, label }`,
`loading` meanwhile), so links to a few dozen other records use it too.
Larger sets, or ones that grow with the data, keep `MultiReference`
(typing searches the server) or `MultiChoice`.

- **The plan says which**, by marking the field `small`; the control
  isn't switched by option count. The two save differently in place
  (each pick here, the whole set on leaving there) and load differently
  (every option here, a search there), so a set crossing 25 would change
  how saving works under the user.
- **Each click saves that one pick** (`onPick`), like a quick action
  (pattern 17): the chip shows the pick at once with a spinner beside it
  (`aria-busy`) until the server agrees. Nothing is disabled, and quick
  picks each save, one after another, each built on the record's latest
  value (a function change, as a sub-record list's is).
- **A refusal puts back that one pick**, with its reason under the chips
  in the destructive text tone ("Couldn't add Archived: <the server's
  reason>"), the chip described by it. Picks still saving carry on. If
  the field closed before the answer, the reason is a toast.
- **Nothing is drafted**, so leaving the field (a click or Tab
  elsewhere), Esc or Ctrl/Cmd+Enter only close it: there's no "Saving…"
  under the field and nothing to give up.
- **Keyboard:** opening puts the caret in the filter box; Down goes to
  the chips, Left/Right (Home/End) move along them, Space or Enter
  toggles one, Up goes back to the box.
- **Create "<typed>"** (`onCreate`): when what's typed names no
  option (ignoring case), a Create "<typed>" button shows under the
  chips; Enter in the box does the same when nothing matches, and Down
  reaches it when there are no chips. It calls `onCreate(name)`, which
  opens the app's small create form (a `FormDialog`, the name filled in)
  or saves at once, and resolves with the new `{ id, label, icon? }`:
  that option joins the chips and is picked (in place, saved like any
  pick, with its spinner). `null` (the form cancelled) changes nothing.
  While it's out the button reads Creating "<typed>"… (`aria-busy`), the
  box is read-only and an edit in place stays open. A rejection shows
  "Couldn't create "<typed>": <reason>" under the chips, the button
  described by it, and keeps the typed name, so Create can be tried
  again; typing clears it. The caret goes back to the box either way,
  and a screen reader hears "<name> created and picked." Never a "New
  <thing>" button beside the picker for this.
- Pass the record's value as `value`, not the control's `props.value`
  (the draft, which never moves here), and keep the field's `save`: the
  form's whole-set save, never called in place.

```tsx
const editField = useEditTaskField(task.id) // optimistic: false, toastOnError: false
labels: editInPlace({
  kind: 'multi',
  value: task.labelIds,
  isEqual: sameIds,
  save: (labelIds) => editField.mutateAsync({ labelIds }),
  control: (props) => (
    <TaskLabelsPicker id={props.id} value={task.labelIds}
      onPick={(id, picked) => editField.mutateAsync((current) => ({
        labelIds: [...current.labelIds.filter((other) => other !== id), ...(picked ? [id] : [])],
      }))}
      aria-label={props.label} aria-describedby={props.describedBy} />
  ),
}),
// TaskLabelsPicker: <MultiPick options={labels.map((l) => ({ id: l.id, label: l.name,
//   icon: <TagIcon className={LABEL_COLOUR[l.slot]} /> }))} value onPick aria-label aria-describedby />
// On the form, the same control with onValueChange={field.onChange} instead of onPick.
```

Leaving means clicking or tabbing anywhere else. Unchanged closes with no
request; a value the form's schema refuses never leaves the browser and
shows the schema's message. Opening another value saves the open one
first; if that save fails, the open one stays and the other doesn't
open.

**Saving: still open, read-only, and says so.** Under the control,
"Saving…" with a spinner (`role="status"`) until the server agrees, then
it closes on the saved value, with "✓ Saved" beside it for two seconds
(`role="status"`). **Not optimistic**: the value only shows as
saved once it is, and the view shows the record the server returned (a
side effect included). The rest of the page stays usable.

**Refused: still open, with exactly what was typed and why.** The reason
under the control in the destructive text tone (`FieldError`), word for
word: a 422's field error as `EntityForm` shows it, or the error's
message (a 500, no answer). The control is `aria-invalid` and described
by the reason. Nothing reverts on its own, and there's no toast. Leaving
again retries; Esc gives up.

**Long text that saves itself (`autosave: true`)**, Notion-style, so
nobody has to click away to save notes. Opt in per field:
`editInPlace({ kind: 'long-text', autosave: true, ... })`.

- It saves about a second after typing stops, without leaving the field,
  and at once on leaving it (a click or Tab elsewhere, Ctrl/Cmd+Enter,
  opening another value, a link off the page).
- **Never read-only while it saves.** Typing carries on during a save;
  the next save waits for the one in flight and sends whatever the text
  is by then, so saves never cross and the latest always wins.
- Under the text, a quiet line in the muted caption tone
  (`role="status"`): "Saving…" with a spinner while a save is in flight,
  "Saved" with a check once nothing typed is waiting. **On a note longer
  than the screen the line is pinned to the screen's bottom edge** while
  the note runs past it, so the save's state and a refusal are never off
  screen.
- **Refused:** exactly what was typed stays, with the reason under it, as
  above, and the first refusal of a run toasts. Typing again retries
  after the pause; a refused draft is never re-sent on its own.
- **Saved elsewhere** (another tab, a phone, an AI chat; the record's
  query refetches): with nothing typed waiting, the note shows the new
  text at once, even with the caret in it, which keeps its paragraph.
  Under unsaved typing nothing saves over it: the line says it "changed
  elsewhere", with **Keep Mine** and **Show Saved** (drop what's typed).
  Keep Mine keeps both, block by block: what's typed is laid onto the
  other writer's text and the editor shows the result as it saves; when
  both changed the same paragraph it says so, and a second Keep Mine
  replaces theirs. A save the server refuses because another writer saved
  first (a 409, the record's version check: add-an-entity.md "Saves that
  don't overwrite") asks the same way, never a plain failure to retry.
  The server sending back what it was sent, even trimmed, is not a
  change: the editor keeps its undo.
- **Leaving mid-save:** a field that leaves the view while a save is in
  flight (a session ending, a parent that stops showing it) still sends
  what was typed after that save started.
- **Esc saves what's left and closes.** Nothing reverts: what was saved a
  second ago stays saved, so "give up" would only drop the last second.
- Rich text that can't save without rewriting what the person didn't edit
  (`RichTextEditor`'s `onProblem`) saves nothing; it counts as unsaved at
  once (leaving asks straight away), its message shows after the pause,
  and the next good edit saves.
- **Leaving the page** with a save still to come saves it first and goes
  on; "Discard your changes?" shows only if that save is refused. Closing
  the tab can't wait: it starts the save and the browser asks. Hiding the
  page (another tab, a phone's home screen) saves at once, with no pause.
  A save started as the page goes is sent with `keepalive` when its body
  fits (about 30 KB of JSON), so the browser finishes it after the page
  is gone; a longer note's save goes as an ordinary request.

**Notes are edited where they're read by default (`inline: true`)**: a
record's notes, a description, any long text
the page is for. `alwaysEditable` (the boxed editor at rest) and
`autosave` alone (the read view at rest, a click opens the editor) are
for where that doesn't fit, such as a short summary beside other values.
Opening one by a click puts the caret where the click was, and the page
doesn't move.

**Always editable (`alwaysEditable: true`, implies `autosave`)**: the
notes are the editor itself, shown at rest, with no pencil and no click
to open, and it never closes. Ctrl/Cmd+Enter or Esc saves now and leaves
the caret where it is. It sits beside the one open value rather than
being it: opening another value leaves it alone. Don't give its control
`autoFocus`. The cost: at rest the page shows the editor, not the read
view, and the editor loads on every visit. A click on a link in the
notes still opens it in a new tab; its words are edited from the
keyboard or by dragging over them, and Ctrl/Cmd+K edits its address. Use it where the notes are what the page is
for; elsewhere `autosave` alone keeps the read view at rest.

**Edited where it's read (`inline: true`, implies `alwaysEditable`)**,
Notion-style, for rich text: the editor from the start, drawn as the read
view rather than as a field (no border, no box, the text where the
section's text would be), so there's no mode change at all: click into
the words and type. Its control gets `inline: true` among its props;
pass it to `RichTextEditor`'s `inline`, with `toolbar="floating"`, which
keeps the toolbar over a selection (Alt+F10 reaches it) and the "/" menu
but drops the bar above the text. An empty one shows the editor's
`placeholder` (say "or type / for blocks" in it), not the view's "Not
set". It saves like any always-editable value (a pause after typing,
leaving the page saves first) and is otherwise the same: on the form the
control is the boxed editor, with the floating toolbar too
([add-an-entity.md "Forms"](add-an-entity.md#forms)).

```tsx
description: editInPlace({
  kind: 'long-text',
  inline: true,
  value: widget.description,
  schema: widgetFormSchema.shape.description,
  save: (description) => editField.mutateAsync({ description }),
  // The form's own control, spreading what it gets onto RichTextEditor:
  // inline={props.inline} toolbar={props.inline ? 'floating' : true}
  control: (props) => <WidgetDescriptionEditor … />,
}),
```

```tsx
summary: editInPlace({
  kind: 'long-text',
  autosave: true,                // not notes: a click opens it (autoFocus on the control)
  value: project.summary,
  schema: projectFormSchema.shape.summary,
  save: (summary) => editField.mutateAsync({ summary }),
  control: (props) => <ProjectSummaryEditor … />,
}),
```

**Leaving the page** (a link, Back) while a value holds unsaved text asks
"Discard your changes?" first (Keep Editing / Discard); closing the tab
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
// The status: <EditableValue label="Status" edit={status} layout="inline"><StatusMark …>…</StatusMark></EditableValue>
```

- **One control per field, shared with the form** (`<entity>-fields.tsx`):
  each takes `value`/`onChange` and `readOnly`, and the form wraps it in a
  `Controller`. Never a second, in-place-only control of the app's own: a
  plain box, number, money, day, list or reference uses the package's
  `inPlace` preset instead (below).
- **Long text written as Markdown edits as rich text** (`RichTextEditor`):
  formatted where it's read, saved as Markdown with every block the person
  didn't touch kept exactly as written. On the form too, so it's one
  control. Give it a `placeholder` and the schema's limit as `maxLength`
  (a count shows from 80% of it, in the destructive text tone once over).
  Its keys: Ctrl/Cmd+K adds or edits a link (web and email addresses
  only), Ctrl/Cmd+Shift+Enter ticks the task item the caret is in, and
  Markdown pasted as plain text arrives formatted. A web or email address
  typed (on a space or Enter) or pasted becomes a link, and one pasted
  over selected words links them; pasted lines stay lines, Word's and
  Notion's lists and to-dos arrive as lists and task items. An edit it
  can't save without rewriting text nobody touched is never saved: on a
  form, bind its `onProblem` to the field's error and refuse submit while
  it stands (add-an-entity.md, `widget-form.tsx`); with no `onProblem` it
  says so inside the field. Notion's block keys
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
  beside it add a row or a column, and a grip on the hovered column and
  row opens its menu: insert, move and delete, align, sort (rewriting the
  rows), a header column (its first cells bold) and cell colours (a
  cell's whole text in a highlight); a right-click or Shift+F10 in a cell
  opens the cell's. Columns fit their words. `tableLook="boxed"` (on the
  editor and on `<Markdown>`) gives a roomier boxed table with zebra rows
  instead of the compact grid. Selected words can be
  highlighted in four colours (amber, yellow, green, red) from the
  toolbars' Highlight menu or with "/highlight", and un-highlighted;
  they're saved as `==words==` (`=={green}words==` for the others), plain
  Markdown, and `<Markdown>` shows them. The fixed toolbar's Full Screen
  button fills the window with the field (Esc leaves; nothing is lost or
  saved by it), and on a touch screen or under 768px it carries Indent
  and Outdent for list items, where there is no Tab. A field with only the
  floating toolbar (`inline` notes, and notes on a form) gets the same
  two in a small "Editor Tools" strip over its corner while it has focus,
  with the Image button too when the editor has `upload`. On a touch screen the
  toolbar is instead one row pinned to the top of the keyboard while the
  field has focus (Aa for every format, in the keyboard's place; the list
  buttons, Insert, Image (with `upload`) and Undo; with words selected, their formats first, and
  no floating bar under the system's Copy bar), and the checkbox, the
  table grips, the fold button and the callout icon take a 40px tap. A new checklist item
  shows a "To-do" placeholder and the caret until you type. `[] ` (or
  `[x] `) at a line's start makes it a checklist item, a bulleted item
  too; Enter in one makes the next, its box unticked, and Enter in an
  empty one ends the list, as in a bulleted list.
  `toolbar={false}` leaves out the toolbars and the slash menu where a
  value is short and the shortcuts are enough; `toolbar="floating"` keeps
  the floating one and the slash menu without the bar above (an `inline`
  field's look). Images in the text (`![alt](url)`) show; give it the
  app's `upload` (the same one `ImageField` takes) and an image pasted,
  dropped or picked with an Image button (the fixed toolbar's, the tools
  strip's, the phone's row) is uploaded and goes
  in as `![](url)`, a placeholder showing meanwhile (never saved), a
  refusal or failure in a toast. No `upload`, no file handling at all.
- **The save is the single-field save** (`useRecordUpdate` with
  `optimistic: false, toastOnError: false`, the entity's
  `useEdit<Entity>Field`), `mutateAsync` of one field's PATCH.
- **Keep the value's look at rest**: the badge stays a badge, the price
  stays formatted. Only the open state looks like a form.
- **Cost:** a value that looks like text but edits on click can surprise.
  Keep it to the fields the plan names, and leave the form for everything
  else.

### Presets: one line per field

For a value whose control is a plain one (a text box, a number, money, a
day, a fixed list, another record), the package's **`inPlace` presets**
carry the control, its check and how the value reads at rest, so the
field is one line and there is nothing to wrap:

```tsx
import { inPlace } from '@tristan2828/ui-foundation'

const editField = useEditProjectField(project.id)           // optimistic: false, toastOnError: false
const save = (change: Partial<ProjectUpdate>) => editField.mutateAsync(change)
fields: [
  { label: 'Code', edit: inPlace.text({ value: project.code, maxLength: 8, save: (code) => save({ code }) }) },
  { label: 'Hours', edit: inPlace.number({ value: project.hours, min: 0, max: 200, unit: 'h', save: (hours) => save({ hours }) }) },
  { label: 'Budget', edit: inPlace.money({ value: project.budget, save: (budget) => save({ budget }) }) },
  { label: 'Due', edit: inPlace.date({ value: project.due, required: true, save: (due) => save({ due }) }) },
  { label: 'Renews on', edit: inPlace.monthDay({ value: project.renewsOn, save: (renewsOn) => save({ renewsOn }) }) },
  { label: 'Format', edit: inPlace.choice({ value: project.format, options: FORMAT_OPTIONS, save: (format) => save({ format }) }) },
  { label: 'Priority', edit: inPlace.select({ value: project.priority, options: PRIORITY_OPTIONS,
      render: (priority, label) => <Badge variant={PRIORITY_BADGE[priority]}>{label}</Badge>,
      save: (priority) => save({ priority }) }) },
  { label: 'My Rating', edit: inPlace.rating({ value: project.rating, save: (rating) => save({ rating }) }) },
  { label: 'Category', edit: inPlace.reference({ value: project.categoryId, label: categoryName,
      search: (text) => searchCategories(text), onCreate: (name) => openNewCategory(name),
      save: (categoryId) => save({ categoryId }) }) },
]
// The title: <EntityView titleEdit={{ label: 'Name', ...inPlace.text({ value: project.name, required: true, save: … }) }} />
// A badge: <EditableValue label="Priority" edit={priority} layout="inline" /> (its children default to the preset's look)
```

- **The field gives no `value`**: the preset's `shown` is what the view
  shows (and prints), `null` reading as the field's "Not set". Pass
  `value` or `shown` only to draw it some other way (a link to the record).
- **What each saves, and checks first** (its message under the field,
  nothing sent):

  | Preset | At rest | Saves | Refuses |
  |---|---|---|---|
  | `text` | the text | it trimmed; blank is `null` | blank when `required`, past `maxLength` |
  | `number` | `1,234 h` (`unit`) | a number; blank is `null` | not a number, under `min`, over `max`, a fraction with `integer` |
  | `money` | `$1,234.56` (`currency`, `locale`) | the API's decimal string, two places (`"1234.50"`), built from the digits, never a float; `$` and commas typed are fine | a third decimal, words, under `min` (0 by default), over `max` |
  | `date` | `Sep 2, 2026` | `'YYYY-MM-DD'`, typed ("3/14", "Mar 14", "today") or picked; an empty box or Clear is `null` | empty when `required`; what it can't read ("Try a date like 3/14 or Mar 14", nothing sent) |
  | `monthDay` | `Mar 14` (`format`, `locale`); a stored value that isn't a day, as written | `'MM-DD'`, no year; February 29 is a day; Clear is `null` | Clear when `required`, a day the month can't have ("February has 29 days") |
  | `select` | the option's label, or its `render` (a badge) | the option's value; "Not set" is `null` | "Not set" isn't offered when `required` |
  | `choice` | as `select` | as `select`, drawn as ChoiceButtons (two to four short options); pressing the picked one again is `null` | as `select` |
  | `rating` | `RatingScore` (`max`, `glyph`); always the stars (`RatingInput`), with no click to open | the star's number, at once on a click; an arrow's a pause after the last; pressing the set star again is `null` | clearing when `required` (the press does nothing) |
  | `reference` | the record's `label` (the view's lookup by id) | the picked record's id | "Not set" isn't offered when `required` |

- **They save the way their kind does** (the table above): `text`,
  `number`, `money` and a typed `date` on Enter or leaving them, a day
  picked in the date's calendar, `monthDay`, `select`, `choice` and
  `reference` on the pick (a list opens with the field), `rating` on a
  click of a star (it's always open: the stars are the value).
  `required: true` types the save without `null`.
- **`inPlace.recurrence`** (how something repeats) is in reminders.md.
- **`reference` searches through the app.** The package knows no
  endpoint: `search(text)` is the app's (its gateway's search by name,
  `''` when the list opens), called a pause after typing stops; a
  rejection reads as nothing found. Names come from the searches and from
  `label`, so the saved record's name shows before any search answers.
  With `onCreate(name)`, Create "name" ends the list when what's typed
  names no record: the app opens the other entity's `FormDialog` with the
  name filled in and resolves with the record it saves (`null` on
  Cancel); the field stays open meanwhile and saves the new record's id.
  The form's control is the same `ReferenceCombobox`; `MultiReference`
  takes the same `onCreate`.
- **Keep the app's own control when it has one.** A field whose control
  is the form's own (a rich-text editor, a multi picker, an icon select,
  anything in `<entity>-fields.tsx` beyond a plain box) stays
  `editInPlace({ kind, control, ... })`; the rule "one control per field,
  shared with the form" is for those. A preset is the package's control,
  and the form can use the same plain box.

### Several fields edited as one

Two (or more) of a record's fields that only make sense together (a
model and an effort that must agree, a range's low and high) edit as one
value and save in one PATCH: `inPlace.fields`.

```tsx
{ label: 'Model and effort', edit: inPlace.fields({
  value: { model: run.model, effort: run.effort },               // keyed by the record's field names
  fields: {
    model: { kind: 'select', label: 'Model', required: true, options: MODEL_OPTIONS },
    effort: { kind: 'select', label: 'Effort', required: true, options: EFFORT_OPTIONS },
  },
  rule: ({ model, effort }) => (effort === 'max' && model !== 'large' ? 'Max effort needs the large model' : null),
  save: ({ model, effort }) => editField.mutateAsync({ model, effort }),
}) }
```

- **Each part is a preset's control** (`kind` and its options, as in the
  table above, with its own `label`), side by side under a small caption
  of its label, and stacked when the row is narrow. At rest the parts
  read joined by " · " ("Small · Low"), or as `shown`.
- **A yearly range** is two `monthDay` parts (`{ kind: 'monthDay',
  label: 'From' }`, `'By'`). The package sets no rule across them: a
  range can run over New Year (Nov 1 to Feb 28), so "by after from" is
  the app's `rule` if it holds for its data.
- **Nothing saves until they agree.** Picking a part doesn't save it:
  the pair saves on leaving it or Ctrl/Cmd+Enter (and on Enter too when
  every part is typed into: numbers, money, text). Esc gives up both.
- **Where a refusal shows.** A part's own check ("Budget: Enter an
  amount") and a 422 naming its field (`fieldErrors.model`) show under
  that part, which is `aria-invalid`. The `rule`'s message, or a refusal
  naming none of them, shows under the pair, with every part invalid.
- Built from `editInPlace` options any field can use: `fieldErrors`
  (which of the value's fields a refusal is about) and `errorsOnFields`
  (the control shows them, so they aren't repeated under it); the
  control gets them as `errors`.

### A link and its label

A link stored as an address and an optional label (`docsUrl` and
`docsLabel`): `inPlace.link`, its value `{ url, label }` mapped to and
from the app's own fields.

```tsx
{ label: 'Docs', edit: inPlace.link({
  value: { url: project.docsUrl, label: project.docsLabel },
  save: ({ url, label }) => editField.mutateAsync({ docsUrl: url, docsLabel: label }),
}) }
```

- **At rest** it's `LinkCell`'s link (`LinkOut`): the label if it has
  one, else the address's host (`docs.example.com`), in the link tone,
  opening in a new tab with `noopener noreferrer` and saying so to a
  screen reader. No address reads as "Not set" (or `emptyLabel`). A
  stored address the box would refuse reads as text, never a link. A
  click on the link follows it; the pencil edits.
- **Open**, two boxes, URL and Label (optional); Enter in either or
  leaving saves both. The address is checked by **`linkRule`**, the rule
  `LinkCell` uses (exported, over `linkHref`): `example.com` gains
  `https://`, another scheme (`javascript:`) or a space is refused on the
  URL box. A label with no address is refused ("Add the address, or
  clear the label"); both blank saves `{ url: null, label: null }`.

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
  leaving saves, Esc gives up, one open at a time. The row lays its parts
  out side by side as `ListEditor`'s does, so a fragment (the box, then
  the text's `Field`) needs no wrapper of its own.
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
- **An item with a reference** (Widget's Pairings, `pairings` in
  `widgetEdits`) reads as the referenced record's name, from the view's
  lookup by id, and its row is the form's: a combobox per row, with its
  own search. Enter in the open list picks without saving, a click on an
  option is still inside the row, and Enter in the row's text box or
  leaving the row saves the item, ids only on the wire. A new item starts
  with no pick, which the list's schema refuses on that row.
- **Items that come from elsewhere** (a record's files, added by upload):
  `add` in place of `newItem` and `addLabel`. It renders the app's own
  control (an "Add files" button over a hidden file input) and is given
  `add(items)`, which saves them at the end through `save`, as a move is
  ("Saving…", a refusal under the list, the caret back on the control),
  plus `items` (to stop at a limit), `disabled` (a change is saving) and
  `onProblem(message)` (an upload refused, under the list). Each item
  then reads, edits, moves and removes like a checklist's.
- **Grouped by one of its items' fields** (`groupBy`, a checklist by
  room): each group under its own heading (`type-label`, muted), with its
  own rows, buttons and Add ("Add task to Kitchen", whose `newItem` is
  given the group's key). A move swaps the item with its group's next
  one, never into another group, and the first of a group can't go up.
  `order` names the groups in order and shows each even when empty (so
  its Add is there); others follow as their first item comes.
- **Filtered** (`filter`, the view's "Hide done"): only the items it
  keeps show; the others stay in the list as they are, and a move swaps
  with the next item shown, over the hidden ones. A new item the filter
  drops goes out of sight once it's saved. Grouped or filtered, the list
  still saves as one, in its own order.
- **Duplicate** (`duplicate: (item) => copy`), as on the form's
  `ListEditor`: a Duplicate button beside Remove ("Duplicate item 2")
  puts the copy right after the item, saved as a move is. Leave out
  what a copy mustn't share (a saved id).
- **A refusal about an item's field shows on that field.** Give the
  list its field `name` (`checklist`): a 422 at `checklist.2.text`, like
  the list schema's issue at `[2, 'text']`, reaches item 2's row as
  `props.errors.text`. With `errorsOnFields`, the row shows them on its
  fields and the line under the row keeps only a message about no one
  field; without it they still show under the row, as before.
- **The form's own react-hook-form row** (`itemForm: true`, with
  `name`): `renderItem` gets `form`, a form holding the list under
  `name` with the draft at the item's index, so the row the form's
  `ListEditor` renders (``form.register(`checklist.${index}.text`)``, a
  `Controller` on `form.control`, errors read from
  `form.formState.errors`) works here unchanged, and its every change is
  the item's draft. Refusals are set on that form (`setError`), so they
  show where the form shows them. No form of the app's own per item.

```tsx
const rooms = editInPlace<Task>({
  kind: 'list',
  name: 'tasks',                                            // the record's field: 422s land on the item's fields
  value: house.tasks,
  save: (change) => editField.mutateAsync((current) => ({ tasks: change(current.tasks) })),
  groupBy: { key: (task) => task.room, label: (room) => ROOM_LABELS[room], order: ROOMS },
  filter: hideDone ? (task) => !task.done : undefined,
  duplicate: ({ id: _id, ...task }) => ({ ...task, done: false }),
  newItem: (room) => ({ text: '', room: room ?? ROOMS[0], done: false }),
  itemName: (index) => `task ${index + 1}`,
  addLabel: 'Add task',
  itemForm: true,                                           // renderItem gets the form's own `form`
  renderShown: (task) => <TaskLine task={task} />,
  renderItem: ({ form, index }) => <TaskRowFields form={form!} index={index} />, // the form's row, as on the form
})
```

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

A list added by upload:

```tsx
const files = editInPlace<Attachment>({
  kind: 'list',
  value: record.attachments,
  save: (change) => editField.mutateAsync((current) => ({ attachments: change(current.attachments) })),
  itemName: (index) => record.attachments[index]?.name ?? `file ${index + 1}`,
  add: ({ add, items, disabled, onProblem }) => (
    <UploadButton                                           // the app's: a button over <input type="file" hidden>
      disabled={disabled || items.length >= MAX}
      onUploaded={(stored) => add(stored.map(toAttachment))}
      onRefused={(error) => onProblem(error.message)}
    />
  ),
  renderShown: (file) => <FileRow file={file} />,           // its thumbnail, name and caption
  renderItem: (props) => <CaptionInput {...props} />,       // what edits on a click: the caption
})
```

### In a table's rows

For a **small entity edited in its table** (a name and a few fields,
with no view page and no form: the plan's `Screens: list, edited in the
row`), every editable cell is an editable value, exactly as on a view.
`DataTable` runs it: one cell open at a time, the leave-page prompt while
one is open, "Saving…" and a refusal in the cell. There's no pencil
column and no edit route.

- **A cell is one of the package's three row-edit cells** (`NameCell`
  for a one-line name, `ChoiceCell` for a pick from a list, `LinkCell`
  for a link, checked as `inPlace.link`'s is), or an
  `<EditableValue label="<Column> of <name>" layout="inline"
  edit={editInPlace({ ... })}>` for anything else. The label names the
  column and the row, so its pencil reads "Edit Colour of Work" and its
  control "Colour of Work".
- **A cell is a component** (`<Entity><Field>Cell`) that calls
  `useEdit<Entity>Field(row.id)` for its save, the view's single-field
  save, and renders the package's cell with it. A hook can't be called
  inside a column definition.
- **Stable columns and row ids.** Make the column definitions once
  (at module level, or `useMemo`) and give
  `DataTable` a `getRowId`: new definitions every render, or rows keyed
  by position, remount an open cell and lose what's typed.
- **Create is `InlineCreate`** in the toolbar: the new record's name, Enter
  or Add. It's created with every other field at its default (say which in
  the plan) and appears as a row, edited like the others; the box empties
  and keeps the caret for the next one. The name's rule is the form's
  (`schema`), and a refusal (a taken name's 422) shows under the box.
- **Delete** stays a row action: a trash button in a pinned last column
  (`pinLastColumn`), with its confirm dialog.
- **Width:** the default, `width="content"` (below), keeps the row's cells
  and its delete together on a wide screen.

```tsx
import { ChoiceCell, InlineCreate, LinkCell, NameCell } from '@tristan2828/ui-foundation'

// Each cell is its own component, so it can call the record's save hook.
function CategoryColourCell({ category }: { category: Category }) {
  const editField = useEditCategoryField(category.id)       // optimistic: false, toastOnError: false
  return (
    <ChoiceCell label={`Colour of ${category.name}`} value={category.colour} options={CATEGORY_COLOURS}
      render={(colour) => <ColourSwatch colour={colour} />}
      save={(colour) => editField.mutateAsync({ colour })} />
  )
}
function CategoryNameCell({ category }: { category: Category }) {
  const editField = useEditCategoryField(category.id)
  return (
    <NameCell label={`Name of ${category.name}`} value={category.name} schema={categoryFormSchema.shape.name}
      save={(name) => editField.mutateAsync({ name })} />
  )
}
function CategoryWebsiteCell({ category }: { category: Category }) {
  const editField = useEditCategoryField(category.id)
  return (
    <LinkCell label={`Website of ${category.name}`} value={category.website} emptyLabel="No website"
      save={(website) => editField.mutateAsync({ website })} />
  )
}

// Made once: the cells read the row they're given.
const CATEGORY_COLUMNS: LegacyColumnDef<Category, unknown>[] = [
  { id: 'name', header: 'Name', cell: ({ row }) => <CategoryNameCell category={row.original} /> },
  { id: 'colour', header: 'Colour', cell: ({ row }) => <CategoryColourCell category={row.original} /> },
  { id: 'website', header: 'Website', cell: ({ row }) => <CategoryWebsiteCell category={row.original} /> },
  { id: 'actions', header: () => <span className="sr-only">Actions</span>, cell: ({ row }) => <DeleteCategoryAction category={row.original} /> },
]

<DataTable columns={CATEGORY_COLUMNS} getRowId={(row) => String(row.id)} width="content" pinFirstColumn pinLastColumn
  toolbar={<InlineCreate label="New category's name" schema={categoryFormSchema.shape.name}
    create={(name) => createCategory.mutateAsync({ name, colour: 'blue', icon: 'house' })} />} … />
```

The template has no small entity yet.

### A table of a few short columns: `width="content"`

On a wide screen a table of a few short columns (a name, a colour, a
count, its delete) spread across the page puts the row's actions far
from its name. `width="content"`, the default, sizes the table and its
pagination to its columns; `width="full"` takes the whole width.

## 19. Stage circle for an ordered status

A status that's an ordered lifecycle (each record moves through the same
stages, in the same order, toward one that means *done*), with one or
more exit states off the side. A small circle beside the word fills as
the record moves on. The package ships it: `StageCircle`.

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
  in both themes. An exit is
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
  where nothing was finished, so it isn't a stage circle (the demo draws
  it as a `StatusMark`).
- **On the record's view** it's the same markup in the header, beside the
  title; editing the status in place (pattern 18) wraps it in
  `<EditableValue>` like a badge.
- **Cost:** a reader learns the shapes once. Until then the word does the
  work, which is why it stays.

## 20. Count linking to the related records

A count of the records in another table that point at this row (open
Tasks per Project, items per Tag), which opens that table already filtered
to them. The count is a `computed` integer (the entity plan's type).
The package ships it: `CountLink`.

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

What the component decides, so a cell doesn't have to: underlined at
rest, in foreground (not `text-link`); zero a plain `0`, not a link and
not an em dash (zero is a value, pattern 11); and an accessible name
that is the count, then `label` (`3 open tasks in Kitchen remodel`), so
the link is found by what it shows (`getByRole('link', { name: /^3 / })`).

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

## 21. Rows grouped under headings, and a pill filter

A feed, an activity log or a timeline reads best as rows under day
headings (Today, Yesterday, Earlier This Week, then each older week, then
months), each heading with a count and a summary ("4 · 1 h 12 m"). The
same screens usually want one quick filter as pills above the rows (All /
Video / Audio / Text, one pressed at a time) rather than a dropdown: there
are few values, and switching between them is the main thing people do.

```tsx
import { byDay, DataTable, PillFilter } from '@tristan2828/ui-foundation'

const byPublished = byDay<FeedItem>('publishedAt')   // module level: once, not every render

const { page, filters, setFilter, setPage } = useTableUrlState(['kind'])

<DataTable
  header={false}
  groupBy={byPublished}
  groupSummary={(items) => `${items.length} · ${duration(sum(items, 'minutes'))}`}
  emptyTitle={filters.kind ? `No ${KIND_LABELS[filters.kind].toLowerCase()} items` : 'Nothing in the feed yet'}
  emptyAction={filters.kind ? <Button variant="outline" onClick={() => setFilter('kind', '')}>Show All Types</Button> : undefined}
  toolbar={
    <PillFilter label="Type" value={filters.kind} onValueChange={(kind) => setFilter('kind', kind)}
      options={KINDS.map((kind) => ({ value: kind, label: KIND_LABELS[kind] }))} />
  }
  … />
```

- **The server sorts, the table only heads.** `groupBy` says which
  group a row is in; a heading row starts wherever the key changes, so
  sort the list by the grouped field (newest first) or a key will come
  back with a second heading. Paging pages rows: a group split across
  pages repeats its heading on the next, and `groupSummary` is given the
  group's rows *on this page*. A summary that must count the whole group
  comes from the API.
- **`byDay(field, { now, timeZone })`** counts calendar days in the
  zone (the browser's by default), so a time near midnight or a daylight
  saving change never moves a row to the wrong day. Weeks start on
  Monday (`weekStartsOn: 0` for Sunday). Four weeks back it switches to
  months ("September", "December 2025"). A later date is Upcoming, no
  date is No Date. Pin `now` in a test, as for pattern 8.
- **A heading is a row header for its group** (`<th scope="rowgroup">`
  in the group's own `<tbody>`), so a screen reader names a cell's group
  as it names its column. It stays in view while a wide table scrolls
  sideways.
- **`stickyGroupHeadings`** pins the headings while their groups scroll,
  for a list long enough that "which day is this?" gets lost. An
  ancestor of your own with `overflow` set (a card with
  `overflow-hidden`, say) takes the place of the page: leave it off such a
  table's ancestors.
- **`stickyTop`**, with `stickyGroupHeadings`, for a page that pins a bar
  of its own to the top (a page header, a filter bar): how far down the
  header and headings pin, so they sit under the bar and never behind it.
  A variable the page sets per breakpoint gives a phone its own offset:

  ```tsx
  <main className="[--page-bar:3.5rem] md:[--page-bar:3rem]">
    <div className="sticky top-0 z-40 h-(--page-bar) bg-background">…</div>
    <DataTable stickyGroupHeadings stickyTop="var(--page-bar)" … />
  </main>
  ```

  Focus moved to a row clears the bar too. Give the bar a `z-index`
  above the table's (`z-40`).
- **`header={false}`** for a list-like table whose columns explain
  themselves (a thumbnail with a title block, then actions); sorting, if
  any, moves to the toolbar. Fewer, wider columns read as a list: put the
  thumbnail inside the title's cell rather than a column of its own.
- **`PillFilter` is a filter like the others**: its value is in the URL
  (`useTableUrlState`, '' for All) and `setFilter` sets it, so it returns
  to page 1 and survives a refresh, back and forward. Pressing the
  pressed pill leaves it pressed; All takes the filter off
  (`allLabel={null}` drops All for a filter that always has a value). It
  is one tab stop, the arrows along it; the pressed pill is filled with
  `--primary`, not the toggle's faint tint.
- **No rows for a filter** is the table's own empty state, saying which
  filter, with a button to take it off. An empty group never renders:
  groups come from the rows.
- **Headings that fold, picked by the reader** are pattern 23's
  `groupings`: a Group menu over choice fields. `groupBy` stays the
  app's one fixed grouping (a feed's days). **Not built:** grouping by
  more than one key.

## 22. A highlighted row, and rows that are done

One row of a table marked as **the one to look at**: next up, the
current one. `DataTable`'s `highlightRow` returns true for it.

```tsx
<DataTable highlightRow={(book) => book.id === nextUpId} … />
```

- **A wash of info on every cell**, over a stripe (`striped`) and the
  pinned columns' opaque backgrounds (`--table-highlight`, pre-mixed onto
  the page), and a bar in `info-text` at the row's start, so it reads
  without colour too. The pointer's hover (pattern 28) leaves it as it
  is, so "next up" never reads as the hovered row. Still **say why in the row** (a "Next up" word or badge):
  the wash says "look here", not what it is.
- **Muted text inside it is darkened for you.** `muted-foreground`
  measures 4.09:1 on the wash, under 4.5:1, and no lighter wash fixes it
  (4.47:1 even at 4%). So the row redefines `--muted-foreground` as
  `--table-highlight-muted-foreground`: 6.75:1 in light, the usual grey in
  dark (6.61:1). Use `text-muted-foreground` as anywhere else.
- **At most a row or two.** A highlight on every other row highlights
  nothing; a state many rows share is a column (pattern 5).
- **Rows that are done: colour, not opacity.** Greying finished rows with
  `opacity-50` (or `text-foreground/60`) drops their text under 4.5:1 the
  same way. Render their text in `text-muted-foreground`, which is
  measured, and keep the word that says done.

## 28. A list's rows: hover, lines, rows per page

What every `DataTable` does by default, and the two choices it leaves
an app.

- **The row under the pointer** lights whole: every cell, pinned ones
  included, in `--table-hover` (the muted fill, solid), with a 3px bar in
  `--primary` on its first cell. Muted text inside it takes the darker
  grey a highlighted row's does (4.34:1 would be under 4.5 in light). A
  row that opens a record (`opens` with a dialog, a page or the panel, or
  `onRowClick`) takes the hand cursor; a row edited in place
  (`opens={{ kind: 'rows' }}`) gets the same highlight and keeps the
  arrow. A highlighted row (pattern 22) and the panel's picked row keep
  their own look.
- **No zebra stripes:** rows are told apart by the line under each.
  `striped` brings the stripes back for an app that wants them. Tables in
  notes keep theirs.
- **Rows per Page:** a menu in the pagination bar, from
  `useTableUrlState`, which keeps the pick in the URL (`?size=`) and on
  this device:

```tsx
const { page, setPage, pageSize, pageSizes, setPageSize } = useTableUrlState(FILTERS, MULTI, VIEWS, {
  pageSizeStorageKey: 'my-app:recipes:page-size',   // defaults: pageSizes [25, 50, 100], defaultPageSize 50
})
const query = useRecipes({ page, pageSize, ... })
<DataTable page={page} pageSize={pageSize} onPageChange={setPage}
  pageSizes={pageSizes} onPageSizeChange={setPageSize} … />
```

  A pick returns to page 1. A size in the URL or storage that isn't one
  of `pageSizes` is ignored, so `?size=100000` can't ask the server for
  everything. Without `pageSizes` and `onPageSizeChange` the bar has no
  menu.

## 23. A Group menu, and a record read beside the list

A working list (tasks, chores, a backlog) is read two ways besides its
columns: **grouped by one of its choice fields**, picked by the reader
(by status to see what's moving, by area to plan a trip round the
house), and **one record at a time without leaving the list**, its notes
and key facts in a panel beside the rows. `DataTable`'s `groupings` and
`detailPanel` do both.

```tsx
const GROUPINGS: DataTableGrouping<Task>[] = [   // module level
  { id: 'status', label: 'Status', options: STATUS_OPTIONS, value: (task) => task.status },
  { id: 'categories', label: 'Category', options: CATEGORY_OPTIONS, value: (task) => task.categories, emptyLabel: 'No category' },
  { id: 'canDoNow', label: 'Can do now', options: [{ value: 'yes', label: 'Can do now' }, { value: 'no', label: 'Not yet' }],
    value: (task) => (task.canDoNow ? 'yes' : 'no') },
]

const { grouping, setGrouping, ...table } = useTableUrlState(FILTERS, MULTI, VIEWS, { groupStorageKey: 'my-app:tasks:group' })

<DataTable
  groupings={GROUPINGS}
  grouping={grouping}
  onGroupingChange={setGrouping}
  groupSummary={(tasks) => `${tasks.filter(isReady).length} ready · top ${Math.max(...tasks.map((task) => task.score))}`}
  detailLabel="Task"
  detailPanel={(task) => <TaskPreview task={task} />}   // its own "Open page" link
  … />
```

- **Only choice fields**: each group is one of the field's options, in
  the options' order (the order the form lists them), so give the same
  options list the column and the form use. A yes/no field is two
  options, worded as headings ("Can do now", "Not yet").
- **The grouped column is hidden** while grouped (its value is the
  heading), so a grouping's `id` is its column's id.
- **Remembered like the layout**: `useTableUrlState`'s `grouping`
  (`?group=`, then `groupStorageKey`). A saved view can name a `group`.
  Grouping doesn't change which rows are shown, so it keeps the page and
  doesn't count toward the active view.
- **It groups the page's rows**: paging pages rows, not groups (pattern
  21), so a list that groups wants a page size that holds it (a working
  list of a few dozen). A grouping, while on, takes the place of
  `groupBy`'s headings.
- **The panel is the app's**: a heading-sized title, a few badges, a
  short notes preview (a few lines of the record's notes, not the whole
  editor), and an "Open page" link (a `<Link>` in `text-link`, so it's
  announced as the link it is). Without `detailPanel` rows behave as they
  always have: the title link opens the record's page, or, with
  `onRowClick`, the row opens the record (a dialog over the list:
  add-an-entity.md "How a list opens a record").
- **The table layout's alone:** a card layout's cards don't open the
  panel.

## 24. A stored colour beside its name

A colour the user stored as data (a label's colour, a paint's hex): a
`ColorSwatch`, its name always beside it. design-language.md "A stored
colour" has the why.

```tsx
import { ColorSwatch } from '@tristan2828/ui-foundation'

{ id: 'color', header: 'Colour',
  cell: ({ row }) => <ColorSwatch color={row.original.color} label={row.original.colorName ?? row.original.color ?? 'No colour'} /> }
```

- **The label is required**: the colour's name, else the value (the hex),
  else "No colour".
- **A missing or invalid value** draws the empty swatch. Validate on the
  form with `storedColor`.
- **In a badge** (a label shown as a tag): `size="sm"` inside the
  `Badge`, which sizes it like the badge's icons (pattern 3).

### Picking one on a form: `ColorField`

The same colour on the record's form: a grid of named swatches
and **Custom**, which opens the browser's own colour picker. One control
for a react-hook-form `Controller`, like `DateField`.

```tsx
import { ColorField, storedColor } from '@tristan2828/ui-foundation'

<Field data-invalid={!!errors.color || undefined}>
  <FieldLabel id="label-color-label" htmlFor="label-color">Colour</FieldLabel>
  <Controller
    control={form.control}
    name="color"
    rules={{ validate: (value) => !value || !!storedColor(value) || 'Pick a colour' }}
    render={({ field, fieldState }) => (
      <ColorField
        id="label-color"
        aria-labelledby="label-color-label"
        value={field.value}
        onChange={field.onChange}
        onBlur={field.onBlur}
        invalid={fieldState.invalid}
      />
    )}
  />
  <FieldError errors={[errors.color]} />
</Field>
```

- **It's one radio group.** One tab stop; the arrow keys move and pick;
  Tab goes on to Custom's picker, then out. Each swatch's name is its
  radio's label, written beside it (the word carries it, as above). The
  picked one shows its radio's dot and a primary border, not only its
  colour.
- **Name the group with `aria-labelledby`** (the `FieldLabel`'s `id`): a
  label's `htmlFor` can't name a group. Still pass `id` and `htmlFor`, so
  `<FieldLabel required>` marks the group `aria-required`.
- **The value out is always `storedColor`'s form** (`#c0392b`). A value in
  is compared in full, so `C0392B` or `#FFF` still shows as its named
  colour. One that's none of the named colours (a hex typed in the old
  text box) shows **Custom** picked, its hex beside it, and stays as it
  is until someone picks. A value that isn't a colour shows nothing
  picked.
- **Custom by pointer opens the picker; by keyboard it only picks**, and
  the picker is the next tab stop. Picking Custom keeps the current
  colour until a colour is chosen in the picker.
- **The default set** is `COLOR_CHOICES`: twelve named hues at a middle
  lightness that read on a card in light, dark and every palette (3:1,
  2.3:1 on Palm LCD's mid panel). An app with its own names passes
  `colors={[{ name: 'Hale Navy', color: '#434c56' }, ...]}`; each name is
  shown, so make them words a person would say.
- **Replacing a text box and a swatch preview**: the stored values don't
  change. Swap the `Input` for `ColorField` in the same `Controller`;
  values already stored that aren't in the set show as Custom.

## 25. A list's tools: views, filters, columns, row actions, a phone's rows

What sits above a list's rows, at the end of each row, and what a phone
gets instead of the table. Each is a prop or a part.

```tsx
import { DataTable, FilterBar, FilterSelect, MultiChoice } from '@tristan2828/ui-foundation'

const VIEWS = {
  current: { label: 'Current', filters: { status: 'active' } },
  review: { label: 'To Review', filters: { status: 'watch' }, columns: ['name', 'status', 'notes'] },
  all: { label: 'All' },
}
const { filters, multiFilters, setFilter, setFilters, setMultiFilter, activeView, applyView, ... } =
  useTableUrlState(FILTERS, MULTI, VIEWS)

<DataTable
  views={VIEWS} activeView={activeView} onViewChange={applyView}
  columnsMenu={{ storageKey: 'my-app:plants:columns' }}
  rowActions={(plant) => [
    { label: 'Water', icon: DropletIcon, onSelect: () => water(plant) },
    { label: 'Delete', icon: Trash2Icon, tone: 'destructive', onSelect: () => remove(plant) },
  ]}
  phoneRow={{
    title: (plant) => plant.name,
    status: (plant) => <StatusMark kind={STATUS_KIND[plant.status]}>{STATUS_LABELS[plant.status]}</StatusMark>,
    facts: (plant) => [plant.light, `Watered ${plant.watered}`],
  }}
  toolbar={
    <FilterBar
      search={{ value: filters.search, onChange: (value) => setFilter('search', value), placeholder: 'Search by name' }}
      primary={<>
        <FilterSelect label="Status" options={STATUS_OPTIONS} value={filters.status}
          onValueChange={(value) => setFilter('status', value)} />
        <MultiChoice label="Rooms" placeholder="Any room" aria-label="Filter by rooms" options={ROOMS}
          value={multiFilters.rooms} onValueChange={(rooms) => setMultiFilter('rooms', rooms)} />
      </>}
      primaryActive={/* the chips of the two, for a phone */}
      secondary={<>{/* the rest, each a FilterSelect */}</>}
      active={/* the chips of the rest */}
      onClear={() => setFilters({ light: '', kind: '' })}
      onClearAll={() => setFilters({ status: '', light: '', kind: '', rooms: [] })}
    />
  }
  … />
```

- **Saved views are pills** above the toolbar: useTableUrlState's
  views, each with its `label`, in order. Replaces a hand-written row of
  view buttons; a Deleted view goes in ListHeader's ⋯ menu as Show
  Deleted instead.
- **A view can carry a count**: `count` on the view you pass
  `DataTable`. The app counts with its own query (the list's `total`
  under that view's filters, or a count endpoint); the table computes
  nothing. Count only views that ask you to act (Needs a Look, To Fill
  In), not All. Give the view the key from the first render, `undefined`
  while the query loads, so no pill moves when it arrives.

  ```tsx
  const { data: needsLook } = useNewsSourcesQuery({ ...VIEWS.look.filters, pageSize: 1 })
  <DataTable views={{ ...VIEWS, look: { ...VIEWS.look, count: needsLook?.total } }} … />
  ```
- **Views fill the filters**, so the bar always says why rows are
  hidden:
  - A view's `filters` and `multiFilters` are what the bar's controls
    show while it's on: write its whole meaning there. A "Current" view
    names its statuses (`multiFilters: { status: ['active', 'paused'] }`),
    never `{}` with the server's default hiding the rest.
  - `defaultView` (useTableUrlState's options) is the view the list opens
    on: at the list's plain address (no filter in the URL) its filters
    fill the bar and its pill is pressed; pressing it goes back to the
    plain address.
  - A part no control can show (a computed "overdue") is the view's
    `rule`: `{ label: 'Overdue', rule: { overdue: 'true' }, multiFilters: {
    status: OPEN } }`. It's in the URL and applies while the view is on;
    the bar shows the filters it can.
  - Changing a filter by hand keeps every other filter the bar shows (the
    default view's too), clears any `rule`, and the pills follow: the view
    the result equals is pressed (ticking every status is All), usually
    none. Clearing every filter by hand on a list with a `defaultView`
    writes `?view=none`, so it stays unfiltered; `applyView({})` (Back to
    the List, a "Clear filters" link) is the plain address again.

  ```tsx
  const VIEWS = {
    current: { label: 'Current', multiFilters: { status: ['open', 'waiting'] } },
    overdue: { label: 'Overdue', rule: { overdue: 'true' }, multiFilters: { status: ['open', 'waiting'] } },
    all: { label: 'All', multiFilters: { status: ['open', 'waiting', 'closed'] } },
  }
  const table = useTableUrlState(['search', 'overdue'], ['status'], VIEWS, { defaultView: 'current' })
  ```
- **The column header row** wears the muted fill on every cell,
  pinned and stuck ones too, in the plain and framed looks, so the names
  read apart from the rows; its words stay `--foreground`.
- **The filters**: `FilterBar` holds search, the two filters used
  most (`primary`), and the rest behind Filters (`secondary`, with their
  chips, as `SecondaryFilters` draws them). No captions over controls:
  each names itself. `FilterSelect` says "Any status" while off and
  "Status: Active" on, and is named by its label first: "Status"
  while it shows "Any status", "Status: Active", "Status: All reminders"
  for an `anyLabel` that doesn't say the label (`FilterDate` the same), so
  a test finds it by `getByRole('combobox', { name: /^Status/ })`.
  `search.onKeyDown` gives the search box's keys to the app
  first: Enter on "#12" opening record 12, `preventDefault()` keeping the
  key from the box. `MultiChoice`'s `label` makes it "Rooms: Hall +1"
  instead of a chip per pick. Given `OptionSelect`'s options
  (`{ value, label, kind?, icon? }`) in place of bare values,
  `MultiChoice` draws each option's icon as OptionSelect does: in the
  list, on each chip, and before the summary's first pick ("Status: ●
  Active +1"), so a status filter that takes several keeps its icons.
  Below 48rem search and Filters share a line and every filter, primary
  ones too, is in Filters' bottom sheet, so pass
  `primaryActive` (their chips) and an `onClearAll` that clears them all
  in one `setFilters` call.
- **A date filter** is `FilterDate`: "Any due date" while off,
  "Due: Before today" on, with the presets Before today, Today and From
  today (`presets` picks which) and Between dates, a From and a To day
  beside it. Its value is one string in the URL (`before-today`,
  `from-today`, `2026-11-01..2026-11-30`, an end left out when open), a
  single-value filter like any other, so a view sets it in `filters` and
  the bar shows it: an "Overdue" view is `{ filters: { due: 'before-today' }
  }`, not a `rule`. The query reads it with `resolveDateFilter(value)`,
  inclusive plain days (`{ to: yesterday }`, `{ from: today }`), read
  against today when the list loads; its chip's words are
  `dateFilterText(value)`. A list filtered in the browser (or a mock) uses
  `dateFilterKeeps(value, day)`.

  ```tsx
  const VIEWS = {
    upcoming: { label: 'Upcoming', filters: { due: 'from-today' } },
    overdue: { label: 'Overdue', filters: { due: 'before-today' } },
    all: { label: 'All' },
  }
  const { filters, setFilter } = useTableUrlState(['search', 'due'], [], VIEWS)
  const due = dateFilterText(filters.due)
  // The query: resolveDateFilter(filters.due) → { from?, to? } → due_from / due_to.
  <FilterBar
    secondary={<FilterDate label="Due" value={filters.due} onValueChange={(value) => setFilter('due', value)} />}
    active={due ? [{ id: 'due', label: `Due: ${due}`, onRemove: () => setFilter('due', '') }] : []}
    onClear={() => setFilter('due', '')}
  />
  ```
- **The Columns menu** (`columnsMenu`) sits at the end of the toolbar,
  its ticks remembered on this device under `storageKey`; a column added
  later shows. A column whose `header` isn't a string names itself in the
  menu with `meta.label`. It isn't shown with the phone's row list.
- **Row actions** take a column of their own, pinned to the right
  edge with its header for screen readers only. One action is its icon,
  its label the tooltip and accessible name; two or more are a ⋯ menu.
  A click on them never opens the row. Return `[]` for a row with none.
  Drop a hand-made Actions column and `pinLastColumn` when moving to it.
- **A phone gets a row list** (`phoneRow`) under 48rem: the `title`, the
  `status` at the line's end and one muted line of the `facts` that matter
  (two, usually). `title` is plain text (the row is already the link). A
  card layout, when picked, wins.
- **`lead`** puts one control at the row's start, outside the link: the
  tick that completes a to-do from its row. Its clicks never open the
  record, so it carries its own label (`Complete <title>`), as the
  table's tick column does.

### The framed look, and sibling lists beside the title

`look="framed"` on `DataTable`, and `siblings` on `ListHeader`. Both are
opt-in.

```tsx
<ListHeader
  title="Exercises" count={total}
  siblings={[
    { label: 'Exercises', to: '/training/exercises', count: 5 },
    { label: 'Targets', to: '/training/targets', count: 9 },
    { label: 'Weak Spots', to: '/training/weak-spots', count: 4 },
  ]}
  deleted={{ shown, onShownChange: setShown, noun: 'exercises' }}
  newAction={{ label: 'New Exercise', to: '/training/exercises/new' }}
/>
<DataTable look="framed" views={VIEWS} columnsMenu={…} groupings={…} toolbar={<FilterBar … />} … />
```

The header goes in the table, as `pageHeader`, so the header row ends
where the card does:

```tsx
<DataTable look="framed" pageHeader={<ListHeader title="Exercises" … />} views={VIEWS} toolbar={…} … />
```

- **The card** holds the toolbar, the rows and the pager, as wide as
  `width` makes the table, so nothing sits off at the far right of a wide
  page. Saved views sit above it.
- **So does the header**, passed as `pageHeader`: the header, the views
  and the card are one box as wide as the table. A ListHeader left
  outside the table spans the page.
- **One settings button** in place of Columns and Group. Its name says
  the grouping that's on ("Table Settings, Grouped by Status"). Fold All
  stays a button of its own while grouped.
- **One more button beside New** (`secondaryAction`), in the
  header in or out of the table: a list's second most common action, as
  an outline button just before New, which stays the primary.

  ```tsx
  <ListHeader title="Feeds" count={total}
    secondaryAction={{ label: 'Refresh Now', icon: RefreshCwIcon, onClick: () => refresh.mutate(), disabled: refresh.isPending }}
    newAction={{ label: 'New Feed', to: '/feeds/new' }} />
  ```

  One at most: a third action goes in ⋯ (`more`). On a phone it's ⋯'s
  first item, so the row keeps the title, ⋯ and New; ⋯ shows on a phone
  for it alone when nothing else is in the menu.
- **Siblings** are the page's peers, a switch of links beside the title,
  the current one marked (`aria-current="page"`); they don't go in ⋯,
  which keeps what's left. Two or more; on a phone the switch has its own
  line. Pass `current` when the siblings differ only by query string.

## 26. A record's related list, capped

A list of records related to this one, in a section of its view (a
provider's visits, a project's tasks): the ten newest, then View All N to
the whole list filtered to this record, so a long list doesn't push
the rest of the record away. With tabs (EntityView's), each such list
counts as a group.

```tsx
import { RelatedTable } from '@tristan2828/ui-foundation'

const visits = useVisits({ provider: provider.id, sort: 'date:desc', page: 1, pageSize: 10 })
<RelatedTable
  columns={VISIT_COLUMNS}
  opens={{ kind: 'dialog', to: (visit) => `/health/visits/${visit.id}` }}
  data={visits.data?.items ?? []}
  total={visits.data?.total ?? 0}
  isLoading={visits.isLoading}
  error={visits.error}
  onRetry={() => visits.refetch()}
  emptyTitle="No visits yet"
  viewAll={{ to: `/health/visits?provider=${provider.id}` }}
  phoneRow={{ title: (visit) => visit.what, facts: (visit) => [visit.date, visit.kind] }}
/>
```

- **`limit`** is 10 unless set; ask the server for that many, newest
  first. No pagination bar, and the headers aren't sort buttons (View All
  has the list's own sorting).
- **View All** shows only when `total` is over the rows shown, its text
  "View All 19" unless `viewAll.label` says otherwise. It's a link, so a
  modified click opens a tab.
- **`opens` is required**, as on any list. Everything else a DataTable
  takes for its rows (`rowActions`, `phoneRow`, `highlightRow`) works.
- On a DataTable of your own, `limit` and `viewAll` do the same.

## 27. A repeat and its next time

A record that repeats (a chore, a reminder) shows two columns: **Repeats**,
the rule in words, and **Next**, when it falls next. The value is the
contract's `Recurrence` (reminders.md "Repeating reminders"); both cells
read it in the rule's own zone, so a reminder set in Chicago says 9:00 AM
wherever it's looked at.

```tsx
import { formatOccurrence, formatRecurrence, nextOccurrence, EmptyText } from '@tristan2828/ui-foundation'

{
  id: 'repeats',
  header: 'Repeats',
  cell: ({ row }) => (row.original.repeats ? formatRecurrence(row.original.repeats) : <EmptyText />),
},
{
  id: 'next',
  header: 'Next',
  cell: ({ row }) => {
    const repeats = row.original.repeats
    if (!repeats) return <EmptyText />
    const next = nextOccurrence(repeats, new Date())
    if (!next) return <span className="text-muted-foreground">Ended</span>
    return (
      <time dateTime={next.toISOString()} className="tabular-nums">
        {formatOccurrence(next, repeats.timeZone)}
      </time>
    )
  },
},
```

- **The label** reads "Every 2nd Tue at 9:00 AM", "Every Mon and Thu at
  7:00 AM and 7:30 PM", "Every 30 days after done, at 9:00 AM" (from
  completion), "…, until Mar 1, 2027", "…, 10 times". `times: false`
  leaves the times out, for a table with its own time column. An app
  whose weeks start on Sunday passes `weekStart: 'SU'`: an every-N-weeks
  rule whose WKST isn't the app's says so (", weeks start Mon"), and a
  week's days read from its first ("Sun and Wed"). A rule it can't read
  shows as stored, never blank.
- **Next** is "Tue, Dec 8, 9:00 AM", the year only when it isn't this
  one, or "Tue, Dec 8" with `{ time: false }` (a record whose times are
  its own); a rule that has ended (UNTIL passed, COUNT used up) says Ended, in
  muted text. For a `fromCompletion` repeat whose next depends on being
  done, use the server's `next_at` if it sends one; `nextOccurrence`
  counts from the schedule's start.
- **Sorting by Next** is the server's (`next_at`), not the cell's text.
