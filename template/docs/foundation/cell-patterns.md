# Cell Patterns

How a column's value should *look*. Each entry is markup plus the bits a
first attempt gets wrong — **not components**: the lookup maps are always
per-entity, and only the shape is reusable. Copy the markup into your
`<entity>-columns.tsx`.

Patterns 1–10 were each chosen for a real column, from a page of
alternatives ([`column-options.md`](column-options.md)), not designed in the abstract.
Pattern 12 (boolean) is the template's own reference: Widget's In Stock
column renders it and its specs pin it. The other patterns from 11 on are
marked **Unproven**: written ahead of a real
column, so no app has tested them on real data yet. Prefer a proven
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

## 5. Enum → tone-mapped badge

A many-valued enum that collapses to good / neutral / bad. **The grouping
is the decision, not the style** — see
[`design-language.md`](design-language.md#mapping-an-enum-to-tones).

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
- **It saves on its own:** a PATCH of that one field, not the form. Show
  the new value at once (optimistic) and put it back, with a toast naming
  the row, if the save fails (`useToggleWidgetInStockMutation`).
- **Keep the word beside it** (pattern 12), `aria-hidden` since the switch
  announces its own state. Give the switch a row-specific name
  (`In stock: ${row.original.name}`).
- Its own component in its own file, rendered from the column's `cell`,
  so the hook lives in a component and the columns stay stable
  ([`add-an-entity.md`](add-an-entity.md) "Keep column definitions
  stable").
- **Cost:** one click changes data, with no confirmation. Only for values
  that are cheap to flip back; never for anything destructive.
