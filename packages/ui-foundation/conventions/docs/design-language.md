# Design Language

<!-- index: written by `npm run docs:index` in the package from the headings below; never edit it by hand -->
## Index

- [Semantic tones](#semantic-tones) · lines 33–61
- [The three badge styles](#the-three-badge-styles) · lines 63–80
- [Mapping an enum to tones](#mapping-an-enum-to-tones) · lines 82–111
- [Glyphs and icons: 3:1](#glyphs-and-icons-31) · lines 113–126
- [Logos and brand marks](#logos-and-brand-marks) · lines 128–172
- [Categorical colour](#categorical-colour) · lines 174–244
- [Typography](#typography) · lines 246–337
  - [Written text (notes)](#written-text-notes) · lines 277–337
- [Density](#density) · lines 339–396
- [Widget cards (hub pages)](#widget-cards-hub-pages) · lines 398–512
- [Module cards (a hub's places)](#module-cards-a-hubs-places) · lines 514–583
- [Notices](#notices) · lines 585–613
- [A value over time](#a-value-over-time) · lines 615–648
- [A list as a board](#a-list-as-a-board) · lines 650–701
- [A list as cards](#a-list-as-cards) · lines 703–749
- [Key numbers on a record](#key-numbers-on-a-record) · lines 751–773
- [Picking at random](#picking-at-random) · lines 775–806
- [Filling in what's missing](#filling-in-whats-missing) · lines 808–875

<!-- /index -->

The part of this foundation a consuming app cannot cheaply get right on
its own: color that carries meaning, checked for contrast in both themes.
Tokens and styles here **grow freely**, in the foundation package, so every
app gets them: they do not wait for a second app to need them. New
composites don't grow that way; they are built against a real app's screen.

## Semantic tones

Four tones carry meaning: **success**, **warning**, **destructive** and
**info**. Grey is not a tone — it is the absence of one, and most values
should stay grey.

The first three say good or bad. **Info** says neither: *notice this*,
without a verdict. It is for a state that is worth seeing but isn't good
news or bad news: in progress, new, scheduled, beta. If the honest answer
to "is this good?" is "neither, but it matters right now", it's info. If
the answer is "neither, and it doesn't", it's grey: info is still a
colour, and the "about a third" limit below counts it.

Each tone has two kinds of token, and picking the wrong one is the single
most common way to ship an unreadable label:

| Token | For | Why it can't be the other one |
|---|---|---|
| `--success` / `--warning` / `--destructive` / `--info` (+ `-foreground`) | a **solid fill**, always with white text on it | chosen to contrast with *white*, so on the page background it's too light in light mode |
| `--success-text` / `--warning-text` / `--destructive-text` / `--info-text` | the tone as **text, a border or an icon** on the page background | chosen to contrast with *the page*, so as a fill under white text it's needlessly dark |

Only the `*-text` tokens are remapped in `.dark`. A solid fill keeps one
shade in both themes, because it always carries white text and the page
behind it never enters the calculation.

Measured ratios (WCAG 2.x, sRGB) are recorded next to each primitive in
the package's `styles/theme.css`, and its `e2e/storybook-visual.spec.ts` re-checks all
twelve tone/style combinations with axe against the rendered DOM in both
themes. **A new tone or style is not done until it appears in that story.**

## The three badge styles

`Badge` ships each tone in three styles. They are not interchangeable:

- **Outline** — `outline-success`, `outline-warning`, `outline-destructive`,
  `outline-info`.
  The default choice, and the one proven across real columns. Quiet enough
  to repeat down 25 rows without the column becoming a wall of color.
- **Tinted** — `tinted-success`, `tinted-warning`, `tinted-destructive`,
  `tinted-info`. A
  low-alpha wash of the tone with `*-text` on top. More presence than
  outline; use when the value is the point of the row, not a detail of it.
- **Solid** — `success`, `warning`, `destructive`, `info`. The loudest. Use for one
  value that must be impossible to miss, rarely for a whole column: solid
  reads as an alert, and a column of alerts reads as noise.

Pick **one style per table** and vary only the tone. Mixing styles across
columns makes the difference look meaningful when it isn't.

## Mapping an enum to tones

The decision is the **grouping**, not the style. Before choosing how it
looks, write down which values mean good, which mean bad, and which mean
neither — including the ones that look distinct as text but should share a
tone.

```tsx
const STATUS_BADGE_VARIANT: Record<WidgetStatus, 'outline' | 'outline-success' | 'secondary'> = {
  draft: 'outline',
  active: 'outline-success',
  archived: 'secondary',
}
```

Type the lookup as `Record<TheEnum, …>` so `tsc` fails when `openapi.yaml`
gains a value with no tone, rather than falling back silently.

Two rules that keep this honest:

- **Most values are neutral.** If more than about a third of an enum is
  coloured, the colour has stopped meaning anything. Widget's `archived` is
  an end state, not a failure — it stays grey.
- **Never let colour be the only signal.** A colourblind reader, a
  greyscale screenshot and a printed page all lose it. The label text
  usually carries the meaning already; where a cell is a glyph rather than
  a word, vary the *shape* (filled / half / slashed) too, not just the hue.
  The package's `StageCircle` does this for an ordered status: dashed,
  filling, solid with a tick, struck through
  ([`cell-patterns.md`](cell-patterns.md) pattern 19).

## Glyphs and icons: 3:1

An icon that carries meaning on its own (a stage circle, a category's
icon, a pressed flag) must clear WCAG's **3:1 non-text minimum** against
the background behind it, in both themes. axe measures text only, so the
package's Storybook has a glyph check of its own: every `<svg>` in its
design-language stories, its ink (with any opacity modifier painted over
its background) against what's behind it. Every `*-text` tone, every
category slot and `muted-foreground` clear it as they are. An opacity
modifier is where it goes wrong: `text-muted-foreground/80` is the
faintest step that still clears it in light mode (3.2:1), and `/70`
doesn't (2.7:1). A deliberately faint icon that carries nothing on its
own (an "empty" star beside a rating's filled ones, pattern 9) may go
lower; say so in a comment.

## Logos and brand marks

An app's own logo (`AppShell`'s `logo`) and the marks of the services it
links to (a video site's mark on "Open on …", on a `WidgetCard` about it,
beside its name in a `SourceCredit`)
are **icon components** (`IconComponent`): sized by a `size-*` class,
`aria-hidden` passed through to the `<svg>`, with the same props as a
Lucide icon, so they go wherever an icon goes. Lucide has no brand logos,
and the package ships none: an app keeps the few it needs as its own
components (Simple Icons' paths are CC0), with no icon pack as a
dependency.

Colour them in one of two ways:

- **`currentColor`** for a one-colour mark that isn't a colour of its own
  (a black or white logo): it takes the text colour around it, so it
  turns over with the theme. The default.
- **A brand token** for a mark whose colour *is* the brand (a red play
  button). Define it in the app's `src/index.css`, the same value in both
  themes, since a logo keeps its colours, and register it so it's a
  class:

  ```css
  :root {
    --brand-videosite: #ff0033;
    --brand-videosite-foreground: #ffffff;
  }
  @theme inline {
    --color-brand-videosite: var(--brand-videosite);
    --color-brand-videosite-foreground: var(--brand-videosite-foreground);
  }
  ```

  Then `fill-brand-videosite` on the mark's shape. This is the one place
  a raw colour value is right, and it doesn't break "semantic tokens
  only": the token's name says what it's for. **Brand tokens paint
  marks only**: never text, a surface, a border, a focus ring or a tone.
  A mark is decorative (whatever it sits beside names it), so it isn't
  held to the 3:1 above, but check it against the page in both themes;
  where it vanishes in one, give it a `currentColor` outline or use the
  one-colour mark there.

The package's own stories show the slots with made-up marks in
`currentColor` (`app/AppShell` With logo, `app/WidgetCard` Brand mark,
`app/EntityView` Notice and footer).

## Categorical colour

Tones say good, bad or *notice this*. A value that is merely *different* from its
neighbours — a genre, a team, a category — needs a different mechanism, and
it is `--category-1` through `--category-12`.

They are **generic slots, not per-value tokens**. An app maps its enum to a
slot in its own columns file, so a new enum value costs a line there rather
than three tokens in the design system:

```tsx
const GENRE_COLOR: Record<Genre, string> = {
  Survival: 'text-category-1',
  Shooter: 'text-category-2',
  RPG: 'text-category-3',
}
```

Tailwind needs whole class names, so map the value to a complete class —
never build one by interpolation, or the class won't be generated. An app
that lets people pick a colour stores the slot's name (an enum of
`category-1` … `category-12` in its contract, with a CHECK on the column)
and maps each to its whole class the same way.

| Slot | Colour | Slot | Colour |
|---|---|---|---|
| 1 | blue (near info) | 7 | teal |
| 2 | orange | 8 | red |
| 3 | green | 9 | gold |
| 4 | purple | 10 | navy |
| 5 | pink | 11 | lime |
| 6 | brown | 12 | magenta |

Every slot is a colour with its own name: no two blues, no two teals. So
in a picker, label each with its name ("Orange"), not its number.

Five things about them:

- **Chosen to be told apart, not spaced by hue.** They use the whole hue
  circle and vary lightness and chroma as well, so a light lime sits next
  to a deep navy rather than two mid-tone hues 25° apart. Every pair is at
  least 17.9 apart in CIEDE2000 ΔE (the perceived difference; 10 and up
  reads as a different colour), in both themes. A unit test holds every
  pair to 15.
- **A category is not a tone.** Red, orange, brown and green are slots
  because a category is a tinted glyph beside its name, never a status
  badge, and doesn't read as good or bad there. Where it still could, keep
  them apart: a column that shows tone badges doesn't tint its categories
  in the same column, and a table that shows an info badge keeps its
  categories off slot 1, the one near info's blue.
- **They are ordered for small sets.** An app using the first few gets the
  most separable few, for everyone: the first six also stay apart (ΔE 10
  or more, tested) for readers with deuteranopia or protanopia, the common
  red-green deficiencies. Past six, some pairs merge for those readers
  (gold and lime are nearly one colour), so the glyph and the name carry
  the meaning and the colour only reinforces it.
- **Tint the glyph, never fill behind text.** The label stays
  `text-foreground`, so readability never depends on the hue. A slot used
  as a background needs its own contrast check, which nothing here does
  for you.
- **The glyph check re-measures them.** All twelve clear the 3:1
  non-text minimum in both themes, on the page and on a card (recorded in
  `theme.css`). axe checks text contrast, not icon contrast, so the
  package's Storybook glyph check draws an icon in each slot on both
  surfaces (`patterns/CategoricalColour`) and fails a change that takes
  one below 3:1. Its `SideBySide` story shows both themes at once, under
  normal vision and simulated deuteranopia and protanopia.

If you find yourself wanting a thirteenth, that is a sign the column should
be showing a shape or a label rather than more colours: there is no more
room that stays readable.

## Typography

Six roles cover every screen. Each is one class that sets size, line
height and weight together, from tokens in the package's `styles/theme.css`:

| Class | For | Size / weight |
|---|---|---|
| `type-page-title` | the screen's one `<h1>` (a table's title, a form's title) | 18px / 600 |
| `type-section-title` | a heading inside a screen (a form section, a card group) | 16px / 600 |
| `type-body` | running text, table cells, form text, the pagination summary | 14px / 400 |
| `type-label` | column headers, field labels, a small heading over a group | 14px / 500 |
| `type-caption` | counts, metadata, helper text under a field | 12px / 400 |
| `type-numeric` | the one live number on a card (`ModuleCard`'s count), in tabular figures | 22px / 500 |

- **Use a role instead of size and weight classes,** not as well as them.
  `type-page-title` replaces `text-lg font-semibold`. Combining a role with
  `text-sm`, `font-medium` or `leading-*` makes two classes set the same
  property, and which one wins depends on the order of rules in the
  stylesheet, not on the order in `className`.
- **`type-numeric` sets tabular figures** (`font-variant-numeric:
  tabular-nums`), so counts line up from card to card and don't change
  width as they tick. A number in running text or a table cell keeps its
  row's role; add `tabular-nums` there if a column of them should align.
- **Colour stays separate:** `type-caption text-muted-foreground`. A role
  never sets a colour, so any text token pairs with it.
- **Why `type-*` and not `text-*`:** `cn` (tailwind-merge) treats an
  unknown `text-*` class as a colour, so
  `cn('text-page-title', 'text-foreground')` would silently drop the title.
- A shadcn primitive keeps its own sizes (`CardTitle`, `Button`). Don't put
  a role on one: its built-in size classes would then compete with the role.

### Written text (notes)

Long text written as Markdown (`<Markdown>` and `RichTextEditor`) has its
own three heading roles, so `#`, `##` and `###` in a note never look
alike. They're for headings inside the text only, never a screen's own
outline (that stays `type-page-title` and `type-section-title`):

| Class | For | Size / weight |
|---|---|---|
| `type-heading-1` | `#` in a note, on a band in `--heading-band` with a 2px `--rule` along its foot | 28px / 700 |
| `type-heading-2` | `##`, on a band in `--muted` | 20px / 600 |
| `type-heading-3` | `###`, a small uppercase label in `--muted-foreground` | 12px / 600 |

The bands run the text's full width, with 12px of padding either side.
In text with a band, the rest (paragraphs, lists, tables, callouts,
`###` and deeper) is inset by the same 12px, so it lines up with the
words in the band rather than its edge; text with no band stays flush. The level reads at a glance: two bands of
different strength, then a label.

Headings in the text sit under where the text is in the page's outline.
`headingLevel` on `<Markdown>` and `RichTextEditor` is the HTML level `#`
renders as: 2 straight under the page's `<h1>` (a form, or a page that is
the note), 3 under a section's `<h2>` (the default). `##` is one below it
and `###` two below, never past `<h6>`, so the outline never skips a
level (axe's heading-order). Only the element moves: each level keeps its
look, and the editor saves `#` as `#`. Text pasted or imported from
another tool often has no `#` and starts at `##`; `headingFrom="text"`
puts the text's own highest heading at `headingLevel` instead, the rest
keeping their distance from it (the editor reads it from the text it
opens with). The text isn't rewritten.

A table wider than the text scrolls sideways. While it does, its box is a
tab stop and a region named "Table, scrolls sideways: " and its first
columns ("Item, Size, Colour, …"), so two such tables keep distinct
names; the arrow keys scroll it (in the editor Home and End too), with
the `ring` focus ring. A table that fits gets no tab stop and no region.

The same text has four colour tokens of its own: `--link` (`text-link`), a
link's colour, blue as well as underlined (5.59:1 on white, 8.90:1 on the
dark page); `--heading-band` (`bg-heading-band`), the `#` band, one step
stronger than `--muted`; `--rule` (`bg-rule`), the 2px line a `---`
divider draws, stronger than `--border`'s hairline, and the foot of the
`#` band; and `--heading-bar`, which the headings' old left bars drew in,
kept for apps but unused by the package. A callout (`> [!NOTE]`) is a 10% wash
of its kind's tone behind ordinary text, with the icon in the tone's text
shade: note `info`, tip `success`, important category slot 2, warning
`warning`, caution `destructive`. The package draws all of it; an app
only renders `<Markdown>` or the editor.

Highlighted words (`==words==` in the Markdown) have four colour tokens:
`--highlight-amber` (the default), `--highlight-yellow`,
`--highlight-green` and `--highlight-red` (`bg-highlight-amber`, …). Each
is a wash behind words that keep `--foreground`, so the pair is the
contrast that counts: light washes in the light theme and deep ones in the
dark, each pair checked by axe in both (the Default story's four marks).
Use them as a background behind written text only, never as a tone: a
status is `success`, `warning`, `destructive` or `info`.

`--link` is for written text only. A link in a table cell is
`text-foreground` and underlined, never blue: a column of coloured text
pulls the eye from every other column (cell patterns 16 and 20).

## Density

Four densities, set with `data-density` on **any ancestor** (a wrapper
`<div>`, a route's layout, or `<html>` for the whole app). It is a token
set, not a `DataTable` prop:

```tsx
<div data-density="compact">
  <DataTable … />
</div>
```

| `data-density` | Changes | Table cell padding (vertical) | Header height | For |
|---|---|---|---|---|
| `compact` | table rows, and a hub's cards (`WidgetCard`, `WidgetList` rows, `ModuleCard`) | 4px | 32px | wide tables people scan, many rows per screen; a dense hub |
| *(unset)* | — | 8px | 40px | the default |
| `comfortable` | table rows only | 12px | 48px | short tables, or rows people read rather than scan |
| `large` | **everything**: type, spacing, control heights, icons, the sidebar, table rows | 12px | 56px | a screen read from a distance: a TV used as the desktop monitor, with a mouse and keyboard |

- `compact` and `comfortable` change padding only. Text keeps
  `type-body`, so compact never drops below a readable size.
- On a hub, `compact` takes a `WidgetCard`'s padding from 16px to 12px,
  a `WidgetList` row from 36px to 32px (6px around its line) and a
  `ModuleCard`'s band and body by 4px each. On a phone a compact row is
  44px instead, its link filling that height, so it stays a finger's
  target.
- `large` grows the whole UI by about a quarter: body text 14 → 18px,
  controls 32 → 40px tall, icons 16 → 20px, the sidebar 256 → 320px.
  Breakpoints and `max-w-*` containers stay where they are, which is
  what browser zoom can't do (zoom narrows the viewport in CSS pixels, so
  a wide screen can fall into the phone layout).
- For `large`, set it on **`<html>`**. Menus, selects, dialogs and
  tooltips are portaled to `<body>`, so a wrapper `<div>` doesn't reach
  them. `compact` and `comfortable` only touch tables and hub cards, so a
  wrapper is fine.
- Pick **one density per screen**. Two tables at different densities side
  by side look like a mistake.
- Size things the way the package does and `large` reaches them for free:
  Tailwind's spacing and size utilities (`h-8`, `size-4`, `gap-2`, `w-64`)
  and `text-*`/`type-*`. A fixed `h-[18px]`, `w-[240px]` or
  `text-[13px]` stays its size at `large`; write it as a step of the scale
  (`h-[--spacing(4.5)]`) instead.
- Under the hood, the table primitive's cells read `--table-cell-px`,
  `--table-cell-py` and `--table-head-height`. `large` also redefines
  Tailwind's own scale (`--spacing`, `--text-*`, `--radius`), the `--type-*`
  roles and `--control-text-sm` (the small Button and Toggle).
  `DataTable`'s totals row reads the body cells' tokens, so it is a row's
  height at every density. Each
  default is the value it always had, so a screen without `data-density`
  doesn't change. The selectors are in `styles/theme.css`. A composite
  reaches `compact` with the `density-compact:` variant (`styles/index.css`:
  any ancestor with `data-density="compact"`), the way `WidgetCard` and
  `ModuleCard` do; an app's own card can use it too. Storybook's
  Density toolbar shows any story at a density, and `patterns/Density`
  shows the primitives, `DataTable`, the sidebar and the hub cards at
  each. Its checks
  measure that every step changes what it should, and that the default
  keeps today's sizes.

## Widget cards (hub pages)

A hub page (an app's home screen) shows a few small widgets from
different parts of the app, usually above a grid of navigation tiles.
Each widget is a `WidgetCard`: a titled card holding a short list,
loading its own data. Use one when a screen samples several lists at
once and each links on to the full list. A list someone works through
belongs on its own screen, in a `DataTable`.

```tsx
const { data, isLoading, error, refetch } = useReadyTasksQuery() // one page of 5

<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,--spacing(72)),1fr))] gap-4">
  <WidgetCard
    title="Ready to start"
    icon={ListChecksIcon}
    link={{ to: '/tasks?status=ready', label: 'All' }}
    isLoading={isLoading}
    error={error}
    onRetry={() => refetch()}
    isEmpty={data?.items.length === 0}
    emptyMessage="Nothing waiting"
    skeletonRows={3}
  >
    <WidgetList>
      {data?.items.map((task) => (
        <WidgetListItem
          key={task.id}
          to={`/tasks/${task.id}`}
          trailing={<Badge variant={READINESS_VARIANT[task.readiness]}>{READINESS_LABEL[task.readiness]}</Badge>}
        >
          {task.title}
        </WidgetListItem>
      ))}
    </WidgetList>
  </WidgetCard>
</div>
```

- **Three to six rows.** A widget is a sample, not the list: ask the API
  for that many (the query's page size) and put the rest behind the
  header `link` ("All", "All doing"), which goes to the full list
  filtered the same way. A widget about a service outside the app links
  its header there instead: `link={{ href: 'https://…', label: 'Open
  <service>' }}` opens it in a new tab, with the external-link mark and
  "(opens in a new tab)" for a screen reader. Set `skeletonRows` to the number it usually holds, so the card
  keeps its height when the data arrives.
- **Each widget owns its four states.** Loading is a skeleton of rows,
  empty is one quiet line the app writes ("Nothing waiting", not "No
  data"), and **an error stays inside the card**: the compact
  `ErrorState` with a retry, so one failing widget never takes the page
  down. Never let a widget's error reach the route's error boundary.
- **The title is a heading** (`headingLevel`, h2 under the page's h1 by
  default) and names the card's region, so the page's outline and its
  landmarks list every widget. Give each widget on a page a different
  title.
- **More widgets than a phone screen holds:** make the ones read less
  often `collapsible`, with a `storageKey` per widget
  (`"<app>:hub.<widget>"`) so a card folded stays folded on that device,
  and `defaultCollapsed` for one that should start folded. The chevron
  at the header's end is named by the title; the header's link stays
  while folded. Give a card that folds a `summary`: one short value its
  header shows while folded (`summary={data?.total}`, `"Due today"`),
  so a hub of folded cards still reads at a glance. It follows the
  card's state: a small skeleton while loading, a muted dash on an error
  (the error itself is in the body, opened), and `emptySummary`
  (`"None"`) or nothing when empty.
- **One open at a time on a phone:** put the cards in a
  `WidgetCardGroup accordion="mobile"` (its `className` is the grid),
  give each an `id`, and name the one to start open in `defaultOpen`.
  Below the sidebar's breakpoint every card folds, opening one folds the
  others, and a tap anywhere on a header (not its link) toggles it; on a
  desktop the cards keep their own `collapsible`. `accordion` alone does
  it at every width.
- **Letting someone order the cards:** keep the order in
  `useWidgetLayout('<app>:hub', ids)` (every card's id, in the default
  order), render `layout.visible`, and put a `WidgetLayoutSheet` (its
  Customize button) beside the page's title, with each card's title by id.
  Its rows have Up, Down and a Show switch, with Reset: the same on a
  phone, a desktop and a keyboard (the focus stays on the button
  pressed). The order is kept on the device; a removed id drops out and
  a new one falls in at its default place. To follow the person between
  devices, pass `{ store }`, a `WidgetLayoutStore` over the app's
  backend.

```tsx
const HUB_CARDS = { ready: 'Ready to start', waiting: 'Waiting on', links: 'Saved links' }
const layout = useWidgetLayout('my-app:hub', Object.keys(HUB_CARDS))

<div className="flex items-center justify-between gap-3">
  <h1 className="type-page-title text-foreground">Home</h1>
  <WidgetLayoutSheet layout={layout} titles={HUB_CARDS} />
</div>
<WidgetCardGroup accordion="mobile" defaultOpen="ready" className="grid … gap-4">
  {layout.visible.map((id) => <HubCard key={id} id={id} />)}
</WidgetCardGroup>
```
- **A row is one line:** its text is a link (`to` for a route in the
  app, `href` for an external address, which opens in a new tab with the
  external-link mark) or plain text, cut with an ellipsis, the whole of
  it in the link's name and its tooltip. After it, an optional `note`
  (muted, small: "2 h ago", "holds 2") and an optional `trailing`
  element: a tone badge (pattern 5's mapping) or a control.
- **A control in a row is named by the row's text.** Pass `trailing` as
  a function and put the id it gets in the control's `aria-labelledby`:
  `trailing={(id) => <Switch aria-labelledby={id} … />}`. A switch saves
  the way any row's switch does (`useRecordUpdate`, pattern 15).
- **Equal widths, height from content.** Put the cards in a grid of
  equal columns that wraps (the class above: one column on a phone, as
  many 288px-or-wider columns as fit). Each card is as tall as its rows;
  it doesn't stretch to its tallest neighbour.
- Storybook's `app/WidgetCard` shows three widgets on a page and every
  one in each state, a folded summary in each state and an accordion,
  and `app/WidgetLayoutSheet` a hub with its Customize sheet; its checks run axe and the token and glyph checks in
  both themes and at `large`.

## Module cards (a hub's places)

Above its widgets, a hub shows the app's places: its modules, and the
sites outside it that it links to. Each is a `ModuleCard` in a
`ModuleStrip`: a small card that names the place, shows one live number,
and offers one action.

```tsx
const { data, isLoading, error, refetch } = useProjectsSummaryQuery()

<ModuleStrip aria-label="Places">
  <ModuleCard
    title="Projects"
    icon={ListTodoIcon}
    category={1}
    to="/projects"
    value={data?.openCount}
    note="open"
    action={{ to: '/projects?view=today', label: 'Today' }}
    isLoading={isLoading}
    error={error}
    onRetry={() => refetch()}
  />
  <ModuleCard title="Recipes" icon={RecipesMark} category={6} href="https://recipes.example.com" note="Opens its own app" />
</ModuleStrip>
```

- **The band names the place and links to it.** The icon takes the
  place's categorical slot (`category`, 1–12), and the band behind the
  icon and the name is a 10% wash of the same slot over the card, with
  `foreground` text on it (axe measures every slot's wash in both themes).
  Give each place the slot it has elsewhere in the app (its sidebar entry,
  its badges), so a place is one colour everywhere. Without a `category`
  the icon is muted and the band plain.
- **One number, with a short note.** `value` is the one count that says
  what's live there ("5" open, "2" due today), in `type-numeric`; `note`
  is a few words under it. A card with no `value` shows no number, and
  that is not an empty state: a place outside the app usually has none,
  and its note says what it is ("Opens its own app").
- **One action** at the foot: the thing most often done next ("Today",
  "Start", "Add one"). It's described by the place's name, so several
  "Open" links on one page stay distinct.
- **A place outside the app** takes `href` instead of `to` (an action
  can too): it opens in a new tab with the external-link mark. Its icon
  can be the service's own mark ("Logos and brand marks" above).
- **States are the number's.** While loading, a skeleton the number's
  size (the note stays, it doesn't load); on an error, "Couldn't load"
  and Retry inside the card, so one failing place never hides the
  others. The band and the action work in every state.
- **The strip** is a navigation landmark (`aria-label` names it) of
  equal columns, 170px or wider, that wrap: six to eight across a
  desktop. On a phone it's three columns of smaller tiles with no action,
  each tile one link to its place (at least 44px tall); Retry stays its
  own button above it. Six places make the phone's 3 × 2 grid; past
  that, put the rest behind one tile ("More") rather than a third row.
- **A row of chips on a phone** (`<ModuleStrip mobile="row">`), when the
  hub's widgets should start on the first screen, or there are more
  places than six tiles: below the sidebar's breakpoint the strip is one
  row that scrolls sideways, a chip per place with its icon in its slot's
  colour, its name and its number (no note, no action). While the number
  loads, a small skeleton; on an error, a muted dash ("Couldn't load" to
  a screen reader), with Retry left to the desktop card and the place's
  own page. The row scrolls inside itself and the page never does. A
  desktop shows the cards either way, so don't render your own row
  beside a strip hidden on a phone.
- Storybook's `app/ModuleCard` shows a hub with a strip and a widget,
  every state, both at `compact`, and both again as a row of chips (Row,
  Row states); its checks run axe and the token and glyph checks in both
  themes and at `large`, measure the strip at a desktop and a phone
  width, and run axe on the chips at a phone's.

## Notices

A `Notice` says, across the page, a state that decides what you do with
what's on it: held, overdue, archived and read-only. It's louder than a
badge and stays until the state changes, unlike a toast. `EntityView`'s
`notice` is its usual place (under the header); any page can render one
under its own header.

```tsx
<Notice tone="warning" title="On hold" action={<Button size="sm" variant="outline">Release the hold</Button>}>
  Read “Hyperion” first: this one follows it.
</Notice>
```

- **The tone is the state's**, from the same grouping as its badge
  (warning for held, destructive for overdue, info for "up next", success
  rarely: a good state seldom needs saying across the page). `icon`
  swaps the tone's own icon for a better one (a lock for read-only).
- **A wash, not a fill:** the tone at 10% (20% in dark) with `foreground`
  text and the tone's `*-text` icon. The message reads as body text, so
  nothing inside it is muted. Storybook's `app/Notice` measures every
  tone with axe and the glyph check in both themes.
- **One or two sentences and at most one action**: what the state means
  and what to do about it. More than that belongs in a section.
- **Not an alert.** A notice there when the page opens is part of the
  page, so it has no role of its own. `EntityView` keeps a `role="status"`
  region in its place, so one appearing or clearing later is announced.
  Elsewhere, put it in a status region that is rendered before it
  changes.

## A value over time

`LineChart` (4.34) is the one chart: a single series on a record's page
(a price checked daily, a weight, a balance), oldest first, with an
optional dashed `target` and one point marked (`mark`: `'min'`, `'max'`
or `'last'`) with its value.

```tsx
<LineChart
  label="Price over time"
  points={data.history.map(({ checkedOn, price }) => ({ x: checkedOn, y: Number(price) }))}
  target={{ y: Number(data.targetPrice), label: 'Buy at' }}
  mark="min"
  formatY={usd}
  formatX={(x) => formatPlainDate(String(x), { month: 'short', day: 'numeric' })}
  isLoading={isLoading}
/>
```

- **Points sit apart by their x** when every x is a day (`'YYYY-MM-DD'`)
  or a number, so a gap in the checks shows as a gap; otherwise they're
  evenly spaced.
- **The colours are fixed:** the line in `info-text`, the target in
  `success-text`, each clearing 3:1 on a card in both themes. Don't
  restyle them; a chart that needs another meaning (a limit not to
  cross) is a request for the foundation.
- **It owns its states:** a skeleton at `height` while loading, one
  quiet line with no points (`emptyMessage`), a dot for one point.
- **A screen reader gets the values, not the picture:** the figure is
  named by `label`, with a summary (first, last, lowest, highest, the
  target) and a table of every point. Give it the same `formatY` and
  `formatX` the page uses for those values elsewhere.
- One series and a few dozen points. Several series, zoom or tooltips
  are a request for the foundation, not a hand-drawn chart in the app.

## A list as a board

`Board` (4.36) shows a list as a column per value of one choice field (a
status, a stage), a card per record, and moves a record by moving its
card. It is a second view of a list, on its own page beside the
`DataTable`, never a replacement: filters, sorting and saved views stay
the table's.

```tsx
<Board
  aria-label="Projects by stage"
  columns={STAGES.map((stage) => ({ value: stage, name: STAGE_NAMES[stage], label: <StageLabel value={stage} />, count: totals[stage] }))}
  items={projects}
  getId={(project) => project.id}
  getColumn={(project) => project.stage}
  getName={(project) => project.name}
  renderCard={(project) => <ProjectCard project={project} />}
  onMove={(project, stage) => saves.get(project.id)?.({ stage })}
  moveTo={[...STAGE_TARGETS, { value: 'archived', label: 'Archived' }]}
  isLoading={isLoading}
  error={error}
  onRetry={refetch}
  emptyTitle="No projects yet"
/>
```

- **A card moves two ways:** dragged to another column, and its Move
  button, a menu of `moveTo` (the columns by default) for the keyboard
  and a phone, where there is no drag. A value with no column (Archived,
  Dropped) is only in the menu, and takes the card off the board. After
  a move from the menu the focus is back on the card's Move button in
  its new column (on the board, if the card left it), and a status line
  tells a screen reader "Moved <name> to <column>".
- **A column has a name in words** for the menu and that line: its
  `label` when that is a string, else give `name` (a label with a glyph
  in it is not plain text). The columns are headings, h2 by default;
  `headingLevel` puts them under a section's heading.
- **Saving is the app's**, through `useRecordUpdate`, optimistic: cards
  are placed by `getColumn` on the record, so a move shows at once and a
  refusal puts the card back with the toast. Without `onMove` the board
  is read-only, for a computed field.
- **A column is its own query** when a list can outgrow one page: give
  it `count` (the total) and a `footer` linking the table filtered to it
  when it holds more than it shows.
- **The card is short:** the title (a link to the record, cell pattern
  16) and three or four values as glyphs, the same cells the table uses.
  An empty value is left out, not shown as a dash.
- It owns its states: skeleton columns, `ErrorState`, and an empty
  board; an empty column is a muted line, not an empty state. The
  columns share the width, at least 16rem each, and scroll sideways with
  snap points; a phone shows one column at a time, with the edge of the
  next one showing.

## A list as cards

`DataTable`'s `layouts` (4.39) draw the same rows as cards beside the
table: a thumbnail grid for a feed, covers for a collection, a dense line
each for clearing a backlog. They are layouts of one list, not other
pages: the toolbar, filters, saved views, paging, `groupBy` headings
and a picked grouping's folding ones (cell pattern 23) are the table's in every one, and so are its loading, empty and error
states.

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

- **The switch** sits at the end of the toolbar, the table first (rename
  it with `tableLayout`, "Rows" for a list-like table with no header).
  The pick is in the URL (`?layout=`) and remembered per table on the
  device, so name the `storageKey` for the list. A list opens on the
  layout it is read in most: covers for something browsed by its art, the
  table for something compared by its columns.
- **A grid's sizes** are the package's: `sm` for covers (three across on
  a phone), `md` for thumbnails (two), `lg` for big ones (one). `list`
  is one card per line in a bordered box, divided like rows.
- **The picture** is `Artwork`: a fixed shape (2:3 posters and books,
  1:1 square art, 16:9 video), the record's image or a neutral
  placeholder (the list's icon, and the title where most records have no
  picture), so the grid's rows stay even. Its corners hold an
  `ArtworkTag` (a length, "Live") and an `ArtworkToggle`, a round button
  that marks the record (Read, Owned): dark on the picture while off,
  success's fill while on.
- **The card holds what the row does**: the title as the link to the
  record (cell pattern 16), the list's key line in muted text, then its
  status, rating or quality as the table's own cells draw them, and the
  same actions. A card leaves an empty value out rather than showing a
  dash. Never an action only one layout has.
- `totals` and `highlightRow` are the table's alone. Sorting is the
  toolbar's in a card layout (there is no header to click).

## Key numbers on a record

`KeyStats` (4.46), in `EntityView`'s `strip`: the few figures a record's
page is read for first (done of total, time left, the next date), in a
row under the header, across the page at every width.

```tsx
<EntityView
  subtitle={<EditableValue label="Goal" edit={goals} layout="inline">{goal}</EditableValue>}
  strip={<KeyStats stats={[{ label: 'Done', value: '7', hint: 'of 12' }, { label: 'Next step', value: formatPlainDate(next) }]} />}
  … />
```

- **A label over its value**: the label in caption type and muted, the
  value in the section title's size and tabular figures, a `hint`
  under it in caption type. One bordered card, the figures side by side,
  wrapping on a phone. A `<dl>`, so each label is read with its value.
- **An empty value reads as `emptyLabel`** ("Not set"), in body type and
  muted, never a blank or a dash.
- **Three to five.** It's what the page is for at a glance; anything
  more is a section's label/value rows.
- **`subtitle`** is the line under the title: what the record is for,
  in muted body type, editable in place like any value.

## Picking at random

`SpinWheel` (4.42) picks one of a few candidates by chance, for "what do
I do next?" when every one would do: a wheel of slices, a pointer at the
top and a Spin button.

```tsx
const [picked, setPicked] = useState<SpinWheelItem | null>(null)

<SpinWheel
  aria-label="Ready tasks"
  items={tasks.map((task) => ({ id: task.id, label: task.title, weight: task.priority, emphasis: task.flagged }))}
  result={picked?.id ?? null}
  onResult={setPicked}
  emptyMessage="Nothing ready to pick from"
/>
```

- **The candidates and their chances are the app's.** `weight` (> 0,
  default 1) is both a slice's size and its chance, so a bigger slice
  is visibly likelier. Keep it to what fits: a dozen or so; past that,
  slices thin out and lose their labels (the full label is still each
  slice's tooltip).
- **The result is the app's too:** `onResult` when the wheel stops, and
  `result` is the slice drawn picked at rest (a solid fill). Show what
  was picked next to the wheel, with what to do about it (a link to the
  record, Start); the wheel only points.
- `emphasis` tints a slice (a flagged record). It doesn't change the
  chance; give it a weight for that.
- It spins a few turns with an ease-out and says "Picked <label>" to a
  screen reader; with reduced motion it doesn't turn, the result is at
  once. Square, the width of its container up to 28rem.

## Filling in what's missing

`FillInQueue` (4.42) walks a list of records that are each missing a
value, one record at a time: a size for every project without one, a
category for each unsorted purchase. It is a screen of its own for
clearing a backlog of blanks, linked from the list ("12 without a
size"); the list stays where a record is edited one field at a time.

```tsx
<FillInQueue
  items={missing}
  getKey={(project) => project.id}
  progress={{ done: total - missing.length, total }}
  canSave={(project) => drafts[project.id]?.size != null}
  onSave={(project) => saveSize.mutateAsync({ id: project.id, size: drafts[project.id].size })}
  renderItem={(project) => (
    <>
      <RecordHeading project={project} />
      <FillInChoice
        label="Size"
        choices={SIZES}
        value={drafts[project.id]?.size}
        onChange={(size) => setDraft(project.id, { size })}
        suggestion={project.guess ? { value: project.guess, note: 'from similar projects' } : undefined}
        shortcut
      />
    </>
  )}
  loading={isLoading}
  error={error}
  onRetry={refetch}
  empty="Every project has a size"
/>
```

- **The app owns the list, the draft and the save.** `items` is the
  query for records still missing the value, so a saved one leaves it
  and the next takes its place; one still missing something after a
  save is moved past. `progress` is the app's count. The draft is kept
  per record, so Skip and back finds it as it was.
- **A record is its heading, the few values to decide by, then its
  fields:** a `FillInChoice` (a row of toggle buttons, one picked,
  clicked again to clear) for a short choice, any input for the rest.
  A guess is a `suggestion`: drawn dashed in the info tone and said
  under the row, never picked for the person.
- **Quick from the keyboard:** Enter is Save and next (not in a
  textarea), and the one row marked `shortcut` takes the number keys.
  After a move the focus is on the new record.
- A refused save keeps the record and says why under the buttons, not
  in a toast. It owns its states: skeletons, `ErrorState`, and the
  empty queue, which is the good news ("Every project has a size").
- **Other kinds of value** (4.53): `FillInInput` is the row for text,
  long text, a number, money (the currency's symbol before it) or a date
  (`DateField`), and `FillInSelect` for a list too long for buttons (a
  reference to another record). Each has the label above and a
  suggestion under it as a dashed "Use $249.00" button, never filled in
  for the person.
- **Fields as data:** `FillInField` takes a field as an API describes it
  (`{ name, label, kind, choices, suggestion }`, `kind` one of choice,
  reference, text, longText, number, money, date) and draws the row its
  kind calls for: `FillInChoice` for up to nine choices, `FillInSelect`
  for more, `FillInInput` for the rest. Its value is a choice's value, a
  number for number and money, text otherwise, null for none. For a page
  that draws records it doesn't know in advance.
- **Records from several places:** `groups` (`{ id, label, icon,
  progress }`) and `getGroup` name a record's source above its heading,
  with that group's own count; with more than one group counted, each
  one's count is listed under the bar.
