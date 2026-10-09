# Design Language

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

Five roles cover every screen. Each is one class that sets size, line
height and weight together, from tokens in the package's `styles/theme.css`:

| Class | For | Size / weight |
|---|---|---|
| `type-page-title` | the screen's one `<h1>` (a table's title, a form's title) | 18px / 600 |
| `type-section-title` | a heading inside a screen (a form section, a card group) | 16px / 600 |
| `type-body` | running text, table cells, form text, the pagination summary | 14px / 400 |
| `type-label` | column headers, field labels, a small heading over a group | 14px / 500 |
| `type-caption` | counts, metadata, helper text under a field | 12px / 400 |

- **Use a role instead of size and weight classes,** not as well as them.
  `type-page-title` replaces `text-lg font-semibold`. Combining a role with
  `text-sm`, `font-medium` or `leading-*` makes two classes set the same
  property, and which one wins depends on the order of rules in the
  stylesheet, not on the order in `className`.
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
| `type-heading-1` | `#` in a note, with a rule under it | 26px / 700 |
| `type-heading-2` | `##` | 20px / 600 |
| `type-heading-3` | `###` | 17px / 600 |

The same text has two colour tokens of its own: `--link` (`text-link`), a
link's colour, blue as well as underlined (5.59:1 on white, 8.90:1 on the
dark page), and `--rule` (`bg-rule`), the 2px line a `---` divider draws,
stronger than `--border`'s hairline. A callout (`> [!NOTE]`) is a 10% wash
of its kind's tone behind ordinary text, with the icon in the tone's text
shade: note `info`, tip `success`, important category slot 2, warning
`warning`, caution `destructive`. The package draws all of it; an app
only renders `<Markdown>` or the editor.

`--link` is for written text only. A link in a table cell is
`text-foreground` and underlined, never blue: a column of coloured text
pulls the eye from every other column (cell patterns 16 and 20).

## Density

Tables have three densities, set with `data-density` on **any ancestor**
(a wrapper `<div>`, a route's layout, or `<html>` for the whole app). It is
a token set, not a `DataTable` prop:

```tsx
<div data-density="compact">
  <DataTable … />
</div>
```

| `data-density` | Cell padding (vertical) | Header height | For |
|---|---|---|---|
| `compact` | 4px | 32px | wide tables people scan, many rows per screen |
| *(unset)* | 8px | 40px | the default |
| `comfortable` | 12px | 48px | short tables, or rows people read rather than scan |

- Density changes padding only. Text keeps `type-body`, so compact never
  drops below a readable size.
- Pick **one density per screen**. Two tables at different densities side
  by side look like a mistake.
- Under the hood, the table primitive's cells read `--table-cell-px`,
  `--table-cell-py` and `--table-head-height`, and the `data-density`
  selectors in `styles/theme.css` set them. The package's Storybook check
  measures that each step really changes the row height.

