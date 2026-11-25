# Design Language

<!-- index: written by `npm run docs:index` in the package from the headings below; never edit it by hand -->
## Index

- [Palettes](#palettes) · lines 60–143
- [Glow](#glow) · lines 145–164
- [Semantic tones](#semantic-tones) · lines 166–194
- [The three badge styles](#the-three-badge-styles) · lines 196–213
- [Status marks](#status-marks) · lines 215–258
- [Mapping an enum to tones](#mapping-an-enum-to-tones) · lines 260–289
- [Glyphs and icons: 3:1](#glyphs-and-icons-31) · lines 291–302
- [Logos and brand marks](#logos-and-brand-marks) · lines 304–344
- [Emoji](#emoji) · lines 346–386
- [Categorical colour](#categorical-colour) · lines 388–453
- [Heat scale](#heat-scale) · lines 455–507
- [Depth ramps](#depth-ramps) · lines 509–576
- [A stored colour](#a-stored-colour) · lines 578–625
- [Shapes and sizes](#shapes-and-sizes) · lines 627–648
- [Typography](#typography) · lines 650–820
  - [Words on screen: Title Case and sentence case](#words-on-screen-title-case-and-sentence-case) · lines 684–716
  - [Written text (notes)](#written-text-notes) · lines 718–820
- [Density](#density) · lines 822–951
  - [Rows on this device](#rows-on-this-device) · lines 895–923
  - [Page width (a record on a wide screen)](#page-width-a-record-on-a-wide-screen) · lines 925–951
- [Widget cards (hub pages)](#widget-cards-hub-pages) · lines 953–1065
- [Module cards (a hub's places)](#module-cards-a-hubs-places) · lines 1067–1139
- [Notices](#notices) · lines 1141–1168
- [A value over time](#a-value-over-time) · lines 1170–1300
  - [Several values over time](#several-values-over-time) · lines 1219–1257
  - [Parts of a whole over time](#parts-of-a-whole-over-time) · lines 1259–1300
- [A list as a board](#a-list-as-a-board) · lines 1302–1412
  - [Order, groups and the header](#order-groups-and-the-header) · lines 1355–1412
- [A list as cards](#a-list-as-cards) · lines 1414–1461
- [Images full screen](#images-full-screen) · lines 1463–1509
- [Key numbers on a record](#key-numbers-on-a-record) · lines 1511–1547
- [Parts of the page standards](#parts-of-the-page-standards) · lines 1549–1585
- [A few equal things](#a-few-equal-things) · lines 1587–1702
- [An overview page](#an-overview-page) · lines 1704–1769
- [A record's header and empty values](#a-records-header-and-empty-values) · lines 1771–1834
- [A record's tabs, mark and facts](#a-records-tabs-mark-and-facts) · lines 1836–1923
- [Picking at random](#picking-at-random) · lines 1925–1956
- [Filling in what's missing](#filling-in-whats-missing) · lines 1958–2025
- [Values edited in place: the presets' looks](#values-edited-in-place-the-presets-looks) · lines 2027–2046
- [A quick add line](#a-quick-add-line) · lines 2048–2076
- [A date field's quick picks](#a-date-fields-quick-picks) · lines 2078–2102
- [A few choices, then the month](#a-few-choices-then-the-month) · lines 2104–2130
- [A month calendar](#a-month-calendar) · lines 2132–2164
- [A settings page](#a-settings-page) · lines 2166–2223
- [The sidebar and the phone's bar](#the-sidebar-and-the-phones-bar) · lines 2225–2284

<!-- /index -->

The part of this foundation a consuming app cannot cheaply get right on
its own: color that carries meaning, checked for contrast in both themes.
Tokens and styles here **grow freely**, in the foundation package, so every
app gets them: they do not wait for a second app to need them. New
composites don't grow that way; they are built against a real app's screen.

## Palettes

A palette is an app's own look: its surfaces, text, accent and a
second colour. Four dark ones serve every app:

| Name | `palette` | Accent | Second colour |
|---|---|---|---|
| Indigo and Cyan | `indigo-cyan` | indigo, the only accent that passes 4.5:1 on cards | cyan |
| Indigo and Rose | `indigo-rose` | indigo-violet | rose |
| Graphite and Periwinkle | `graphite-periwinkle` | periwinkle on neutral grey | lilac |
| Violet | `violet` | violet | magenta |

And one light one, which an app opts into by name (`LIGHT_PALETTES`):

| Name | `palette` | Surface | Text and accent |
|---|---|---|---|
| Palm LCD | `palm-lcd` | a Palm OS LCD's green, flat (cards are the same green) | dark ink; ink is also the primary fill and the field border |

**How an app picks one.** `<FoundationProviders palette="indigo-cyan">`
names the app's default. Add `palettePicker` and the app shell's header
offers the four dark ones (with swatches), or a page does, as tiles
(`PaletteSetting`, "A settings page"); the one picked is remembered
on that device, and a new device starts on the default. `usePalette()`
reads the palette on screen. Without `palette`, nothing changes: light and
dark follow the system, with the toggle in the header.

**A palette forces its theme.** A dark palette forces the dark theme and
the shell has no light/dark toggle. The light theme stays for apps
without a palette, and for Palm LCD. Printed notes still print light:
the print override beats a palette's block.

**Palm LCD is opt-in.** An app gets it only by naming it:
`<FoundationProviders palette="palm-lcd">`. It forces the light theme, so
the shell has no toggle. It is never in the picker: `palettePicker` is
ignored beside it, and so is a palette a device saved before. It has no
[glow](#glow). Everything is still a semantic token, so the app's code
uses no raw colours:

- **Surfaces.** `--background`, `--card` and `--popover` are the LCD green
  (`#c9d1b2`). `--muted`, `--secondary` and `--accent` are a step darker.
- **Ink.** `--foreground` is the ink (`#1d2416`, 10.1:1).
  `--primary` and `--ring` are ink too, with the green on the primary fill,
  as a pressed button looks on the device.
- **Dimmed text.** `--muted-foreground` is `#464e39`, 5.50:1.
- **The dotted rules between rows.** The colour is a token: `--rule` and
  `--border` are the LCD's line colour (`#a3ad8f`). The style is the
  app's, a Tailwind border utility: `border-b border-dotted border-rule`.
  A table's own rows wear the colour, solid.
- **Status text and links.** Status text reads on its own tinted wash
  (7.0:1 or more on the green). `--link` is a blue.
- **Glyphs and fills.** Palm LCD has its own categorical slots, heat
  steps and depth steps, each clearing 3:1 on both greens. Each depth
  ramp holds its Palm LCD slot's hue and gets darker at every step, as
  in light ([Depth ramps](#depth-ramps)). Every heat and depth fill
  takes white text.

**Where it lives.** `styles/theme.css`: each palette's colours as
primitives (`--palette-<name>-*`, ratios beside them), and one block per
palette that sets only what differs from its theme:
`.dark[data-palette="<name>"]` for the four, and `[data-palette="palm-lcd"]`,
on top of `:root`, for Palm LCD. `data-palette` goes on `<html>`, so popups
portaled to `<body>` wear it too. An installed app's colours follow it with
`pwa({ palette })`. For Palm LCD that is the ink and the green.

**The accent is never small text.** It fails 4.5:1 as small text on
Indigo and Rose and on Violet, and on every palette's cards but Indigo
and Cyan: it is the ring, the primary fill and the active item's tint.
Links are accent light (`--link`, 8.5:1 or more; the `link` Button
variant is `text-link`), and so is the theme colour as text
(`--primary-text`: the open tab's name, a picked choice's word). The
status colours as text are `--success-text`, `--warning-text` and
`--destructive-text` (soft badges, icons, coloured words); solid fills
keep the deeper shades with white text. Field borders (`--input`)
measure 2.5 to 2.9 against the page, under 3:1; axe doesn't check
borders.

**An app's own axe specs** check its palettes instead of light and dark:
`defineA11ySuite({ …, palettes: ['indigo-cyan'] })` (and
`defineDataEnvironmentBannerSuite`'s `palettes`) saves each as the
device's choice before the page loads and checks it in the theme it
forces: dark, or light for `palettes: ['palm-lcd']`. Pass the app's
default on every spec and, with the picker, `PALETTES` on the one that
covers the shell. Without `palettes`, a dark palette app's light run
fails: there is no light theme to find.

## Glow

Under a dark palette only, from `--primary` so each palette glows in its
own accent. An app without a palette never gets it, and nor does Palm
LCD, the light one. Everything else stays flat: no glow at the top of the
page.

- **The primary button** (Button's default variant) on hover, keyboard
  focus and press: one soft layer of the accent (`--primary-glow`: 38px
  blur, 2px spread, 38%), and on hover a shine sweeping across once
  (650ms). Under reduced motion, no shine and no shrink. Secondary,
  outline, ghost and destructive buttons never glow.
- **A hovered card**: its edge turns the accent with a soft halo
  (`--edge-glow`), through the `glow-edge` utility. `ModuleCard`,
  `WidgetCard` and `Board`'s cards carry it, and a `DataTable` card
  layout's `Card`s; an app's own card takes the class.
- **A slider's thumb** (`ui/slider`): a small halo (`--thumb-glow`).

For anything else of an app's own, `palette:` is the variant
(`palette:hover:shadow-(--primary-glow)`).

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
the package's `styles/theme.css`, and the package re-checks all twelve
tone/style combinations with axe against the rendered DOM in both
themes. **A new tone or style is not done until it is in that check.**

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

## Status marks

A record's status is a `StatusMark`: an
icon, a colour and the status's own word, the same in its cell, the
record's header and the select's options. Every status sorts into one of
six kinds; the kind decides the icon and the colour, so it reads by
shape without colour too, and the word stays, so nothing needs learning.

| Kind | Means | Icon | Colour |
|---|---|---|---|
| `active` | in use or under way now | a ring with a dot | `success-text` |
| `planned` | not started yet: an idea, queued, ordered, scheduled | a dashed ring | `info-text` |
| `paused` | started, then held; expected back | a ring with bars | `warning-text` |
| `done` | finished as meant: closed, resolved, filed, bought | a ring with a tick | `status-done-text`: a teal |
| `ended` | stopped without finishing: dropped, retired, cancelled, past | a ring with a slash | `status-ended-text`: a soft rose |
| `attention` | overdue, failing or blocked: look now | a warning triangle | `destructive-text` |

```tsx
// widget-format.ts: the enum sorted by what each value means.
export const STATUS_KIND: Record<WidgetStatus, StatusKind> = {
  draft: 'planned',
  active: 'active',
  archived: 'ended',
}
// The cell, the header and the select's render:
<StatusMark kind={STATUS_KIND[status]}>{WIDGET_STATUS_LABELS[status]}</StatusMark>
```

- **Sort by meaning, not by word.** "As needed" is `active`, "On hold"
  `paused`, "Idea" and "Up next" `planned`, "Retired" `ended`.
  `attention` is for a state that wants a look now, often worked out
  rather than stored (a review date past due).
- **The icons are one map** (`STATUS_KIND_ICONS`): changing one there
  changes it in every app. A screen can pass `icon` for one place; don't.
- **Done and ended have colours of their own**: a teal for
  finished, a hue away from `active`'s green, and a soft rose for no
  longer going, a hue away from `attention`'s red. Neither is grey, so a
  finished record never reads as a disabled one. They're text shades
  (`--status-done-text`, `--status-ended-text`, in every palette and both
  themes); nothing fills with them.
- **Measured:** every kind's word clears 4.5:1 and its icon 3:1 on the
  page, a card and a table row, in both themes and every palette.
- Badges stay for everything else status-like (a computed progress, a
  tag): the tone rules below.

## Mapping an enum to tones

The decision is the **grouping**, not the style. Before choosing how it
looks, write down which values mean good, which mean bad, and which mean
neither — including the ones that look distinct as text but should share a
tone.

```tsx
const CHECKLIST_STATE_BADGE_VARIANT: Record<WidgetChecklistState, 'outline' | 'outline-success' | 'secondary'> = {
  none: 'secondary',
  open: 'outline',
  complete: 'outline-success',
}
```

Type the lookup as `Record<TheEnum, …>` so `tsc` fails when `openapi.yaml`
gains a value with no tone, rather than falling back silently.

Two rules that keep this honest:

- **Most values are neutral.** If more than about a third of an enum is
  coloured, the colour has stopped meaning anything. Widget's progress
  only colours `complete`; an empty or unfinished list isn't a problem.
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
the background behind it, in both themes. axe measures text only. Every
`*-text` tone, every
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

## Emoji

Lucide is the icon set for the app's own things: modules, the sidebar,
hub cards, statuses, kinds, actions, fact labels, one icon per meaning.
Emoji are for things the person names: a routine, a to-do, a list, a
topic. Every emoji a field holds is drawn as Noto's own SVG, the same on
every device (no Noto font draws reliably on iPhone Safari); emoji typed
inside text (notes, rich text) stay the device's.

- **`<Emoji emoji label? className?>`:** one emoji as Noto's picture,
  from `/assets/emoji-18.0/` (the `emoji()` Vite plugin serves and builds
  them; an app adds it to its plugins). `size-4` unless a `size-*` class
  says otherwise. Beside the words that name the thing it is decorative;
  alone, give it a `label`. With no picture (an emoji newer than the set,
  or one with a skin tone) it falls back to the character.
- **`<EmojiTile emoji>`:** a row's emoji on a 26px `bg-muted` tile with a
  `border-border` edge, between a to-do's tick and its title. None is a
  dashed empty tile, so every title in the list starts at the same place.
  It is never a control: a row's emoji is set on its record or form.
- **`EmojiField`:** picking one emoji on a form or in place. Every
  fully-qualified Unicode emoji, without skin tones: a search, tabs that
  jump to Recent, Suggested and Unicode's nine groups, an 8-across grid.
  A popup on a laptop, a sheet from the bottom on a phone.
- **`IconField`:** picking one icon out of an app's fixed set (a
  category's, a place's) from a 6-across grid, with a line naming the
  icon under the pointer or focus. For a value that always has an icon,
  so no Clear.
- **Contrast:** emoji pictures are images in their own colours, so the
  3:1 glyph rule above doesn't apply to them; the tile's edge is
  `border-border`. IconField's icons are `text-foreground`, as glyphs are.
- **`PillFilter`'s `lead`:** a topic's `<Emoji className="size-3.5">`
  before its label inside the pill. Decorative: the pill is still named
  by its label.
- **The parts that draw an emoji beside its words** (4.145), each
  decorative, the words still naming the thing:
  - a facts rail's `kind: 'emoji'` fact: `size-5`, alone as the value, so
    named by the emoji itself; printed as the character;
  - `WidgetListItem`'s `lead`: `size-4`, before the row's text in its link;
  - `MonthCalendarItem`'s `emoji`: `size-3.5`, no tile, before the title in
    the month's cell and in the day's list. The day's summary line keeps
    the titles' words only.

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
  reads as a different colour), in both themes.
- **A category is not a tone.** Red, orange, brown and green are slots
  because a category is a tinted glyph beside its name, never a status
  badge, and doesn't read as good or bad there. Where it still could, keep
  them apart: a column that shows tone badges doesn't tint its categories
  in the same column, and a table that shows an info badge keeps its
  categories off slot 1, the one near info's blue.
- **They are ordered for small sets.** An app using the first few gets the
  most separable few, for everyone: the first six also stay apart (ΔE 10
  or more) for readers with deuteranopia or protanopia, the common
  red-green deficiencies. Past six, some pairs merge for those readers
  (gold and lime are nearly one colour), so the glyph and the name carry
  the meaning and the colour only reinforces it.
- **Tint the glyph, never fill behind text.** The label stays
  `text-foreground`, so readability never depends on the hue. A slot used
  as a background needs its own contrast check, which nothing here does
  for you.
- **All twelve clear the 3:1 non-text minimum** in both themes, on the
  page and on a card (recorded in `theme.css`). axe checks text
  contrast, not icon contrast.

If you find yourself wanting a thirteenth, that is a sign the column should
be showing a shape or a label rather than more colours: there is no more
room that stays readable.

## Heat scale

For values that have an **order**: how much, how often, how hot. A heat
map, a calendar shaded by activity, a grid of counts. Five steps from
cold to hot, `--heat-1` through `--heat-5`. Tailwind gives each one as
`fill-heat-1` (a shape), `bg-heat-1` (a cell) and `text-heat-1-foreground`
(text on that cell).

**Use it only for ordered values.** A value that's good or bad is a tone
(hot is not "bad" here, and red here says nothing about danger). A value
that's only different from its neighbours is a categorical slot: the scale
would claim one category is more than another. Beside tone badges, keep
heat out of the same column.

An app sorts its values into the five steps itself, on rules it writes
down (thresholds, or an even split of the range), and maps each to whole
class names:

```tsx
const HEAT = [
  { fill: 'fill-heat-1', cell: 'bg-heat-1 text-heat-1-foreground' },
  { fill: 'fill-heat-2', cell: 'bg-heat-2 text-heat-2-foreground' },
  { fill: 'fill-heat-3', cell: 'bg-heat-3 text-heat-3-foreground' },
  { fill: 'fill-heat-4', cell: 'bg-heat-4 text-heat-4-foreground' },
  { fill: 'fill-heat-5', cell: 'bg-heat-5 text-heat-5-foreground' },
] as const

<path className={`${HEAT[step - 1].fill} stroke-card`} d={shape} />
<td className={HEAT[step - 1].cell}>{count}</td>
```

- **Opaque, at full strength.** Each step clears 3:1 against the card and
  the page in light, dark and every palette, so a shape stands out with
  no outline. An opacity modifier (`bg-heat-3/50`) gives that up.
- **Text on a fill takes its own foreground.** Pair the two as above: the
  right text colour depends on the step and the theme. `text-foreground`
  or muted text on a fill fails. It measures 4.71:1 at the least.
- **Neighbours can touch.** Neighbouring steps are at least ΔE 17.8 apart
  (the perceived difference) and 12.6 under simulated deuteranopia and
  protanopia, the common red-green deficiencies. A thin `stroke-card`
  between shapes still helps, since a boundary is easier to see than a
  shade.
- **The order holds without hue.** Each step is darker than the one before
  it in both themes, so the scale also reads in greyscale. Hot is always
  the red end, which in the dark themes means it is the darker end too.
- **Never colour alone.** Show the value too, in the cell, a tooltip or
  a legend of the steps. A shape holding a value needs a name for screen
  readers.
- **Nothing to show is not step 1.** Step 1 is the coldest *value*. No data
  stays `fill-muted` or an empty state, so "none" and "cold" don't look
  alike.
- **Five steps, not more.** Past five, neighbours stop being readable as
  different. Bin the values rather than interpolating between steps.

## Depth ramps

For **depth within one category**: the levels of one kind of thing, where
the category stays the same and only how deep, how specific or how far
in changes. A category's subcategories in a chart (Food, then Groceries,
then Produce), nesting levels of one tree, a stacked bar of one
category's parts. Every categorical slot has five steps, shallow to deep,
`--category-N-depth-1` through `--category-N-depth-5`, given by Tailwind
as `fill-category-N-depth-M` (a shape), `bg-category-N-depth-M` (a cell)
and `text-category-N-depth-M-foreground` (text on that cell).

**Which to use:**

| The values are | Use |
|---|---|
| different from each other, in no order | the slot itself, `text-category-N` (a glyph's tint) |
| one category's levels, shallow to deep | its depth ramp, `bg-category-N-depth-M` |
| amounts in an order, with no category | the heat scale, `bg-heat-M` |
| good or bad | a tone |

- **One ramp per category, its slot's.** A record whose category is slot 3
  draws its levels from slot 3's ramp, so the depth reads as "more of the
  same thing". Two categories side by side each keep their own ramp. A
  ramp has one hue, its slot's, in all five steps and in both themes: only
  lightness and chroma change. Steps of two neighbouring slots' ramps can
  still come close (orange and brown, blue and navy): tell categories apart
  by their slot's own glyph and name, not by a ramp step alone.
- **Depth, not amount.** A ramp says "a level of this", never "more of
  this is worse". A count or a total over many categories is the heat
  scale; a status is a tone.
- **Opaque, at full strength, and text on a fill takes its own
  foreground**, as on the heat scale: each step clears 3:1 (3.03:1 at the
  least, light on `--muted`) and its text 4.55:1 at the least, paired as
  below. An opacity modifier (`bg-category-3-depth-2/50`) gives that up.
- **Neighbours are closer than the heat scale's, so keep a boundary.**
  Neighbouring steps are at least ΔE 9.6 apart in light and 8.7 in dark,
  and 6.9 under simulated deuteranopia and protanopia. Five steps of one
  hue that each clear 3:1 on the card only have so much lightness to
  share. A `stroke-card` or a 1px gap between shapes, as a stacked bar's
  segments have, makes each boundary easy to see.
- **Deeper is more contrast with the page.** In light each step is darker
  than the one before it, in the dark themes brighter, so a ramp also
  reads in greyscale. Step 1 is the shallowest, a tint of the hue (lightest
  step still 3:1 on the card), and step 5 the deepest: nearly black in
  light, nearly white in dark, never a grey. No step comes within ΔE 6 of
  the neutral greys (`--muted`, `--muted-foreground`, `--rule`, `--border`,
  `--input`, the charts' greys), so a step never reads as "no value".
- **Never colour alone.** Name the level too, in the cell, a tooltip or
  a legend, and give a shape holding one a name for screen readers.
- **Five steps, not more.** Deeper nesting than five shares step 5, or
  starts again with a label saying so; don't interpolate between steps.

An app maps a slot's levels to whole class names, as the heat scale's
steps are mapped: Tailwind only generates classes it finds written out.

```tsx
// Slot 3's ramp, shallow to deep.
const GREEN_DEPTH = [
  { fill: 'fill-category-3-depth-1', cell: 'bg-category-3-depth-1 text-category-3-depth-1-foreground' },
  { fill: 'fill-category-3-depth-2', cell: 'bg-category-3-depth-2 text-category-3-depth-2-foreground' },
  { fill: 'fill-category-3-depth-3', cell: 'bg-category-3-depth-3 text-category-3-depth-3-foreground' },
  { fill: 'fill-category-3-depth-4', cell: 'bg-category-3-depth-4 text-category-3-depth-4-foreground' },
  { fill: 'fill-category-3-depth-5', cell: 'bg-category-3-depth-5 text-category-3-depth-5-foreground' },
] as const

<rect className={`${GREEN_DEPTH[level - 1].fill} stroke-card`} />
<td className={GREEN_DEPTH[level - 1].cell}>{name}</td>
```

## A stored colour

A colour the user stored as data (a paint's hex, a label's colour, a
calendar's colour) is not a design decision, so no token can hold it,
and the token rule rightly forbids writing a hex into code. Show it with
**`ColorSwatch`**: a small swatch filled with the stored value, beside its
name.

```tsx
import { ColorSwatch } from '@tristan2828/ui-foundation'

<ColorSwatch color={paint.colorHex} label={paint.name} />                  // 16px: a cell, a list, a line of text
<Badge variant="outline"><ColorSwatch size="sm" color={label.color} label={label.name} /></Badge>  // 12px, a Badge's icon size
<ColorSwatch color={null} label="No colour" />                             // the empty swatch
```

- **The value is validated.** Only a hex (`#rgb`, `#rgba`, `#rrggbb`,
  `#rrggbbaa`, the `#` optional, as some APIs store labels' colours) is
  painted. Anything else, missing, blank, a typo, a CSS keyword, draws
  the **empty swatch**: a dashed ring with no fill. `storedColor(value)`
  is the same check, returning the colour normalised (`'C0392B'` →
  `'#c0392b'`) or `null`: use it in a form's schema so a bad value never
  saves. Store colours as hex; another format shows as empty.
- **The ring is `border-muted-foreground`**, and it is what keeps any
  stored colour visible: a white on a white card, a near-black in dark
  mode. It clears the 3:1 non-text minimum against the page, a card, a
  muted surface, a table row and a Badge's wash, in light, dark and every
  palette (lowest 3.69:1, light, inside a secondary Badge). `--border`
  and `--input` don't (2.5 to 2.9:1), so never draw a stored colour with
  them or with no ring.
- **Never the colour alone.** The swatch is `aria-hidden`, and `label` is
  a required string, so a swatch can't be written without its name: the
  colour's name, or what it labels. Where the record has no name for the
  colour, the label is the value itself (the hex), or "No colour". A long
  name stays on one line, cut, its whole text in a tooltip.
- **The fill is the one colour that isn't a token.** The swatch's
  `backgroundColor` is an inline style from the prop, which the ESLint
  token rule allows (it forbids hex *literals* in a `style`). Nothing
  else may paint a stored colour,
  and a stored colour never paints text, a surface or a border: a
  colour the user picked from a few is a categorical slot (above), not a
  hex.

Cell pattern 24 is it in a column.

**Picking one on a form is `ColorField`**: the same swatches, each
beside its name, as one radio group, and Custom for the browser's own
picker. Cell pattern 24 has its markup and its rules.

## Shapes and sizes

The shared style guide's, the same in every app with or without a
palette:

- **Radius 9px** (`--radius-base`): buttons and cards on `--radius`,
  fields on `--radius-md` (about 7px).
- **Buttons** 36px tall with 16px sides, semibold (`sm` 32px, `lg` 40px,
  the icon sizes to match). A press shrinks the button to 96%, not under
  reduced motion.
- **Fields** (input, select, input group, a multi-pick's box) 36px,
  outlined. **Checkbox** 18px, a 5px radius, solid when checked, a small
  press pop.
- **Cards** a hairline border with a soft shadow (`--card-shadow`: 30% in
  dark, lighter on white), 16px padding, 14px between their parts. A
  card's header, when it comes first, is a tinted bar flush with the top
  (`--card-header`), as on every `WidgetCard` and `EntityView` section.
- **Badges** are pills; the default is a soft tint of the accent
  (`variant="solid"` is the filled one). The tone styles are unchanged.
- **Behind a dialog or sheet**, the page is dimmed and blurred.
- **Motion** is quick: 120ms with the standard easing, for every
  transition that doesn't name its own.

## Typography

Six roles cover every screen. Each is one class that sets size, line
height and weight together, from tokens in the package's `styles/theme.css`:

| Class | For | Size / weight |
|---|---|---|
| `type-page-title` | the screen's one `<h1>` (a table's title, a form's title) | 28px / 600, line 1.2 |
| `type-section-title` | a heading inside a screen (a form section, a card group) | 16px / 600 |
| `type-body` | running text, table cells, form text, the pagination summary | 14px / 400, line 1.5 |
| `type-label` | column headers, field labels, a small heading over a group | 14px / 500 |
| `type-caption` | counts, metadata, helper text under a field | 12px / 400 |
| `type-numeric` | the one live number on a card (`ModuleCard`'s count), in tabular figures | 22px / 500 |

- **Headings draw in a little:** the page and section titles, and written
  text's `#` and `##`, take -0.02em letter spacing. Labels stay normal
  case at 14px medium (small caps at 12px read too small).
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

### Words on screen: Title Case and sentence case

Two cases, chosen by what the words are:

- **Title Case names a thing you can see or press:** page, dialog, sheet,
  form, card and section titles; buttons and links that act like
  buttons; menu items and menu labels; tabs and pills; column headers;
  field labels; a group's heading in a list ("Earlier This Week"); and a
  control's accessible name (`aria-label="Next Page"`, an icon button's
  tooltip). "Show Deleted", "Try Again", "Rows per Page", "View All 12",
  "Back to the List", "Save and Next", "Move To".
- **Sentence case is anything said to the person:** messages, help text
  (`FieldDescription`), toasts, placeholders, a form's error ("Give it a
  title"), an empty or error state's words, even its heading line
  ("Nothing here yet", "Something went wrong", "Couldn't load"), a
  notice's title, a question ("Discard your changes?"), and a sentence
  read to a screen reader (a live announcement, "Moved Fix the latch to
  Done"). A value the app shows is written as its data is (a status
  label, a rule's phrase "Every weekday", "Not set").
- **The small words stay lowercase** unless first or last, or first
  after a colon: a, an, the, and, but, or, nor, as, at, by, for, in, of,
  on, per, to, with (`TITLE_CASE_SMALL_WORDS`). Every other word,
  however short, is capitalised ("Turn Into Page", "Show All", "Is",
  "It"), and so is each part of a hyphenated word ("Follow-Up"). A word
  that is part of a verb ("Sign In", "Log Out", "Turn Off") is
  capitalised even where it is a small word elsewhere.
- **A label written in the code is written in Title Case**; a label built
  from a value goes through `titleCase()` (`` `Add ${titleCase(noun)}` ``).
  `titleCase` leaves a word that already holds a capital as written, so
  names and acronyms survive ("Open in GitHub").
- **The words around a name keep the name's own case:** `Back to
  ${list}` gets the list's title as it is, `Actions for ${row}` the row's
  name.

### Written text (notes)

A one-line value written as Markdown (a cell, a card's line) is
`<Markdown inline>` instead: no headings or blocks, the font and colour
of where it sits (cell-patterns.md, pattern 1).

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

A column in a written table can have a width: dragged at its right edge
in `RichTextEditor` (the edge catches on 96, 160, 256 and 384px, 56px at
least), a column's menu has Narrower, Wider, Fit to content and Fit all
columns, and a double-click on the edge fits it again. The width is kept
in the Markdown as a comment after the table, naming its columns
(`<!-- table widths: Item=140, Cost=72 -->`), which `<Markdown>` and the
editor read and never show; nor do the backend's MCP read tools (`fetch`,
`list`, `search`, and `update`'s answer), while `edit_text` and
`update` keep it in what's stored. A column named nowhere fits its words. A
phone ignores the widths and can't set them; on paper they scale to the
page.

A table wider than the text scrolls sideways. While it does, its box is a
tab stop and a region named "Table, scrolls sideways: " and its first
columns ("Item, Size, Colour, …"), so two such tables keep distinct
names; the arrow keys scroll it (in the editor Home and End too), with
the `ring` focus ring. A table that fits gets no tab stop and no region.

**The theme colour as text** is `--primary-text`
(`text-primary-text`): what's picked or open, in the primary's own colour
where that reads as small text. The open record tab's name, the open tab
of any line tab list (`TabsList variant="line"`, a page's sub-navigation
under a section heading) and a picked `ChoiceButtons` option wear
it (each tab with a 3px `bg-primary` line and a `bg-primary/12` tint, the choice with
a `border-primary` and a `bg-primary/12` fill). The pill look
(`TabsList`'s default) keeps its open tab in `--foreground` on the page
colour. It's the
primary itself in the light and dark themes (near-black, near-white),
each dark palette's accent light (the accent fails 4.5:1 as small text on
some surfaces), and Palm LCD's ink. Never for a link (`--link`) or a
heading.

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

A page link (a link the app marks as one of its pages, `pageLink`) is the
page icon in `--muted-foreground`, then the title in the text's own
colour at medium weight, underlined in `--muted-foreground` (the colour
of the words around it, so the underline is what tells it apart). Alone
on its line it's a page line, a row that tints `--muted` on hover. A
removed page is muted and struck through, "Page removed" beside it in
the caption size, with an outline `xs` Restore button. Both renderers
draw it from the same CSS (styles/index.css "Page links in written
text"). The trail back from a page, `PageTrail`, is shadcn's Breadcrumb:
crumbs in `--muted-foreground`, the page itself in `--foreground`, on
one line, the middle folded into a "…" menu when it doesn't fit.

Highlighted words (`==words==` in the Markdown) have four colour tokens:
`--highlight-amber` (the default), `--highlight-yellow`,
`--highlight-green` and `--highlight-red` (`bg-highlight-amber`, …). Each
is a wash behind words that keep `--foreground`, so the pair is the
contrast that counts: light washes in the light theme and deep ones in the
dark, each pair checked by axe in both.
Use them as a background behind written text only, never as a tone: a
status is `success`, `warning`, `destructive` or `info`.

`--link` is for written text only. A link in a table cell is
`text-foreground` and underlined, never blue: a column of coloured text
pulls the eye from every other column (cell patterns 16 and 20).

## Density

Five densities, set with `data-density` on **any ancestor** (a wrapper
`<div>`, a route's layout, or `<html>` for the whole app). It is a token
set, not a `DataTable` prop:

```tsx
<div data-density="compact">
  <DataTable … />
</div>
```

| `data-density` | Changes | Table cell padding (vertical) | Header height | For |
|---|---|---|---|---|
| *(unset)* | — | 4px | 32px | the default: compact rows, as the shared style guide has them |
| `compact` | a hub's cards (`WidgetCard`, `WidgetList` rows, `ModuleCard`); table rows stay the default's | 4px | 32px | a dense hub |
| `comfortable` | table rows only | 12px | 48px | short tables, or rows people read rather than scan |
| `large` | **everything**: type, spacing, control heights, icons, the sidebar, table rows | 12px | 56px | a screen read from a distance: a TV used as the desktop monitor, with a mouse and keyboard |
| `extra-large` | **everything**, a step past `large` | 13px | 63px | the same screen read from further back, such as a couch |

- `compact` and `comfortable` change padding only. Text keeps
  `type-body`, so compact never drops below a readable size.
- **Forms are compact at every density but the two large ones**: inside a
  `FieldGroup` (every `EntityForm`, `FormDialog` and `FormSection`) the
  inputs, selects, combobox boxes and default buttons are 32px, the
  compact table's row, with 14px between fields; under 48rem or on a
  touch screen 40px, for the finger. They read `--control-height`, which
  `FieldGroup` and the forms' bars set from `--spacing`, so `large` and
  `extra-large` grow them as they grow everything. Outside a form a control
  keeps its 36px.
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
- `extra-large` is `large` about a ninth bigger again: body text 18 → 20px,
  captions 15 → 17px, spacing 5 → 5.6px (controls 45px tall, icons 22px, the
  sidebar 358px), and every other size in proportion. It sets every token
  `large` sets, so whatever follows `large` follows it.
- **A record's facts rail grows with the text** (`--facts-rail-width`):
  300px at the default, 375px at `large` and 420px at `extra-large`, the
  text's own scale (1.25× and 1.4×), so a short value keeps its one line
  beside its label. The record page grows by the same amount (see "Page
  width"), and the room the view needs before it draws the rail beside
  the body grows with it (960px at the default, about 1,040px and
  1,090px). Nothing in the rail is ever cut, at any size: a value too
  long for its line wraps (add-an-entity.md, "The facts rail").
- For `large` and `extra-large`, set it on **`<html>`**. Menus, selects,
  dialogs and tooltips are portaled to `<body>`, so a wrapper `<div>` doesn't reach
  them. `compact` and `comfortable` only touch tables and hub cards, so a
  wrapper is fine.
- Pick **one density per screen**. Two tables at different densities side
  by side look like a mistake.
- Size things the way the package does and `large` and `extra-large` reach
  them for free:
  Tailwind's spacing and size utilities (`h-8`, `size-4`, `gap-2`, `w-64`)
  and `text-*`/`type-*`. A fixed `h-[18px]`, `w-[240px]` or
  `text-[13px]` stays its size at both; write it as a step of the scale
  (`h-[--spacing(4.5)]`) instead.
- Under the hood, the table primitive's cells read `--table-cell-px`,
  `--table-cell-py` and `--table-head-height`. `large` and `extra-large` also
  redefine Tailwind's own scale (`--spacing`, `--text-*`, `--radius`), the `--type-*`
  roles and `--control-text-sm` (the small Button and Toggle). The
  selectors are in `styles/theme.css`. A composite reaches `compact` with
  the `density-compact:` variant (`styles/index.css`: any ancestor with
  `data-density="compact"`), the way `WidgetCard` and `ModuleCard` do; an
  app's own card can use it too.

### Rows on this device

An app can let each device choose its table rows: `rowsPicker` on
`FoundationProviders` adds **Rows on this device** to the shell's look
menu (under the palettes, or a menu of its own beside the light/dark
toggle in an app without a palette). `RowsSetting` offers the same choice
on a page ("A settings page").

```tsx
<FoundationProviders palette="indigo-cyan" palettePicker rowsPicker …>
```

| Rows | Table cell padding (vertical) | Header height |
|---|---|---|
| Compact *(the default)* | 4px | 32px |
| Regular | 8px | 40px |

- The choice is kept in this device's `localStorage`
  (`ui-foundation:rows`), like the palette, so a phone and a laptop can
  differ. A new device starts compact; without `rowsPicker` every device
  is compact and a saved choice is ignored.
- It rides on `<html>` as `data-rows="regular"`, so every table follows it
  with no prop: `DataTable`, the `Table` primitive and tables in notes. A
  `data-density` on a nearer ancestor still wins, so a hub's
  `data-density="compact"` wrapper keeps its tables compact.
- Regular is not `comfortable` (12px, 48px): the names are different
  sizes. `useRows()` reads the choice, for a screen that must know it.
- Content inside cells (an inline editor, a button, a badge) must fit both
  heights; check a cell like that at both.

### Page width (a record on a wide screen)

A record page (`EntityView`) keeps a reading width: its column is at most
`max-w-4xl`, and with a facts rail the page is that plus the gap and the rail
(300px, 375px at `large`, 420px at `extra-large`): the column keeps its
width and the page grows by the rail's extra width.
On a TV the right of the page is then empty. `data-width="wide"` on
`<html>` lifts the cap: the column fills the page and the rail
keeps its width, moving right with it.

```ts
// The app's own Page Width setting, kept per browser, applied before first paint.
document.documentElement.dataset.width = wide ? 'wide' : ''
```

- **The app owns the setting**, as it owns Text Size: a field on its
  settings page, kept in `localStorage`, set on `<html>` by a script in
  `index.html` so the first paint has it. Regular is no attribute.
- **Only the record page widens.** A record in a dialog over its list
  keeps the dialog's size (the rule skips anything inside
  `role="dialog"`); a phone is unchanged, since the column already fills
  it; lists already take the content's width.
- **Long text reflows to the column**: notes and tabs fill it; the
  Details tab keeps its own 42rem.
- Anything else of the package's that should follow it uses the
  `page-wide:` variant (`page-wide:max-w-none`), which has the same
  dialog rule.

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
    title="Ready to Start"
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
const HUB_CARDS = { ready: 'Ready to Start', waiting: 'Waiting On', links: 'Saved Links' }
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
  it in the link's name and its tooltip. A `lead` (an `<Emoji
  className="size-4">`, an icon) goes before the text inside the link;
  it's decorative, so the text alone still names the row. After it, an optional `note`
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
  colour, its name and its number (no action, and no note unless the card
  sets `noteOnChip`). While the number loads, a small skeleton; on an
  error, a muted dash ("Couldn't load" to
  a screen reader), with Retry left to the desktop card and the place's
  own page. The row scrolls inside itself and the page never does. A
  desktop shows the cards either way, so don't render your own row
  beside a strip hidden on a phone.
- **`noteOnChip`** puts a card's `note` on its chip, after the number,
  for a word or two the number means little without ("5 new"). A rule of
  the card, so a strip can show it on the chips that need it. It stays on
  the chip's one line in caption type, cut off with an ellipsis past 96px
  (the whole note is still read out), so every chip keeps its height and
  a long note can't take over the row. It stays while the number loads,
  so the chip doesn't change width, and goes on an error, as on the card.

## Notices

A `Notice` says, across the page, a state that decides what you do with
what's on it: held, overdue, archived and read-only. It's louder than a
badge and stays until the state changes, unlike a toast. `EntityView`'s
`notice` is its usual place (under the header); any page can render one
under its own header.

```tsx
<Notice tone="warning" title="On hold" action={<Button size="sm" variant="outline">Release the Hold</Button>}>
  Read “Hyperion” first: this one follows it.
</Notice>
```

- **The tone is the state's**, from the same grouping as its badge
  (warning for held, destructive for overdue, info for "up next", success
  rarely: a good state seldom needs saying across the page). `icon`
  swaps the tone's own icon for a better one (a lock for read-only).
- **A wash, not a fill:** the tone at 10% (20% in dark) with `foreground`
  text and the tone's `*-text` icon. The message reads as body text, so
  nothing inside it is muted.
- **One or two sentences and at most one action**: what the state means
  and what to do about it. More than that belongs in a section.
- **Not an alert.** A notice there when the page opens is part of the
  page, so it has no role of its own. `EntityView` keeps a `role="status"`
  region in its place, so one appearing or clearing later is announced.
  Elsewhere, put it in a status region that is rendered before it
  changes.

## A value over time

`LineChart` is the chart for a single series on a record's page
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
- **A projection**: `projection={{ label: 'Projected', points }}`
  carries the line on past its last point, dashed in the same colour, for
  where a value may go (a balance at a rate of return), never for what was
  measured. Its points come after the last of `points`; the mark stays on
  `points`, and a screen reader gets the projection's end in the summary
  and its rows in the table, each named by `label`.
- **Levels**: for a value that is one of a few named steps and
  holds until it changes (a confidence, a severity, a stage), pass
  `levels`, lowest first, and give each point its step's index as y:
  `levels={['Very low', 'Low', 'Moderate', 'High']}`. The steps are named
  down the plot's left, the range is all of them (so one step looks like
  one step), and the line steps instead of sloping. Values read by name
  in the mark, the summary and the table; don't pass `formatY` unless the
  names need more.
- One series and a few dozen points. Zoom or tooltips are a request for
  the foundation, not a hand-drawn chart in the app.

### Several values over time

`MultiLineChart` puts several series on one plot, sharing one x
and one y range: a net worth beside its assets and what's owed, or a
balance's history beside low, middle and high projections.

```tsx
<MultiLineChart
  label="Net worth over time"
  series={[
    { label: 'Assets', tone: 'success', points: assets },
    { label: 'Owed', tone: 'destructive', points: owed },
    { label: 'Net worth', points: netWorth },
  ]}
  target={{ y: 1_500_000, label: 'Target' }}
  formatY={usd}
  formatX={month}
  isLoading={isLoading}
/>
```

- **Tones, not colours:** each series takes a text tone (`info`, the
  default, `success`, `warning`, `destructive` or `muted`), each clearing
  3:1 on a card in both themes. Pick by meaning where there is one (what's
  owed in `destructive`); otherwise keep the series that matters most in
  `info` and the rest `muted`.
- **`dashed` is for what wasn't measured:** a projection or a plan. A
  projection that starts at the last measured point should repeat that
  point as its first, so the lines meet.
- **A legend under the plot** names each series with its latest value,
  so colour never carries the meaning alone. The target is a dashed
  `success-text` line, as on `LineChart`.
- **It owns its states** as `LineChart` does: a skeleton, one quiet line
  when no series has a point, a dot for a series of one point.
- **A screen reader gets a summary** (each series from first to last
  value, and the target) and a table with a column per series.
- Up to four or five series. More than that, or bars, are a request for
  the foundation. Amounts that add up to a total are a stacked area:
  `StackedAreaChart`, "Parts of a whole over time" below.

### Parts of a whole over time

`StackedAreaChart` shows several amounts that add up to a total,
each a category, over time: a portfolio by asset class, a budget by
envelope. Each band is stacked on the one below, from zero, so the top
edge is the total and both the growth and the mix show.

```tsx
<StackedAreaChart
  label="Allocation over time"
  xs={snapshotDates}
  series={[
    { label: 'US stocks', values: usStocks },
    { label: 'International', values: international },
    { label: 'Bonds', values: bonds },
    { label: 'Cash', values: cash },
  ]}
  formatY={usd}
  formatX={month}
  isLoading={isLoading}
/>
```

- **Colours are categorical slots**, in order (band 1 takes
  `category-1`, unless it gives its own `category`), opaque, with a 1px
  card-coloured line between neighbouring bands. Keep it to about six:
  the first six slots stay apart for colour-blind readers.
- **Amounts, stacked from zero:** the range is 0 to the largest total,
  with room above. There is no share (100%) mode.
- **One shared `xs`**, oldest first; each band's `values` line up with
  it. A missing or negative value counts as 0 everywhere (the plot, the
  legend, the table), so a gap is a 0, not a hole.
- **The legend** lists the top band first, as the picture reads, each
  with its latest value and its share of the latest total (rounded, so
  they may not add to exactly 100), then the total.
- **The states:** a skeleton at its height while loading; one quiet line
  when there are no xs, no bands, or only zeros; one stacked column
  mid-plot for a single snapshot (it turns into bands at the second);
  the bands.
- **A screen reader gets a summary** (the total from first to last, each
  band's latest value and share) and a table with a column per band and
  a Total column.

## A list as a board

`Board` shows a list as a column per value of one choice field (a
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

### Order, groups and the header

```tsx
<Board<Job, Stage, Size>
  aria-label="Jobs"
  columns={[
    { value: 'idea', label: 'Idea', lead: true, action: <AddButton />, description: 'Worth doing one day',
      groups: [{ value: 'quick', label: 'Quick' }, { value: 'big', label: 'Big', defaultOpen: false }],
      footer: <Link to="/jobs?size=someday">Someday {somedayCount}</Link> },
    { value: 'active', label: 'Active', note: `${waiting} waiting` },
    { value: 'done', label: 'Done', ordered: false },
  ]}
  getGroup={(job) => job.size}
  ordered
  pageSize={20}
  pageKey={filtersKey}
  phone="counts"
  menu={(job) => <JobMenuItems job={job} />}
  onMove={(job, stage, place) => save(job, stage, place.group, place.beforeId ?? afterOf(place.afterId))}
  {...rest}
/>
```

- **Order:** with `ordered`, cards keep `items`' order within their
  column (and group). A drag within a column reorders, and a 3px line in
  the text colour (`data-slot="board-drop-line"`) in the gap shows where
  the card lands; the card dragged is faded where it was. The card's menu
  has an Order section (Move Up, Move Down, Move to Top, disabled where
  they can't apply). After any menu move the focus is on the card's menu
  button wherever it now is, and the status line says "Moved <name> up"
  (or "down", "to the top"), "to <column>, <group>", or "to place 3 of 8
  in <column>" for a drag.
- **`onMove(item, value, place)`:** `place.beforeId` is the card it now
  sits before and `place.afterId` the one after, among `items` in that
  column (and group), null at the end and the start. A server that orders
  by "before this id" takes `beforeId`; one that keeps a position takes
  the halfway point. The place counts every card in `items`, not only
  those shown: a drop after the last shown card is before the first one
  "Show N More" hides. A drop that leaves the card where it was calls
  nothing. A column with `ordered: false` (Done, by date) has no line, no
  Order items, and a drop there only changes the column.
- **Groups:** a column's `groups` split its cards by `getGroup`, each a
  heading one level under the column's: a chevron, the label in small
  capitals and its count, a button that folds the group (`defaultOpen:
  false` starts folded). A drop on a group's cards reports that group; a
  drop on a folded group's heading outlines it and lands at the group's
  end. A card whose group isn't one of the column's isn't on the board.
  The keyboard's way to change group is the app's own field in `menu`
  (Priority, Size): Board's menu has no group section.
- **Paging, the header's slots and the phone's counts** are props, each
  in the example above: `pageSize` with `pageKey` (the filters, which
  fold the pages back); a column's `description`, `note`, `action` and
  `lead`; `phone="counts"`.
- **The menu:** `menu(item)` appends the app's own items after a
  separator; the button is then ⋯, "Actions for <name>", holding Move To,
  Order and the app's items. Without it, the Move button.
- **No grip:** a card that drags shows a grab hand over it, and is picked
  up whole, from its title link too.

## A list as cards

`DataTable`'s `layouts` draw the same rows as cards beside the
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
  a phone), `md` for thumbnails (two), `lg` for big ones (one).
  `arrange: 'list'` is one card per line in a bordered box, divided like
  rows.
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

## Images full screen

`ImageViewer` shows one of an ordered list of images large, over
the whole viewport: a cover clicked in a grid, a record's photos, the
pages kept from a set. It's the package's modal dialog, so focus stays in
it while it's open and goes back to the cover that opened it.

```tsx
const [shown, setShown] = useState<number | null>(null)

<button aria-label={`Open ${book.title}`} onClick={() => setShown(i)}>
  <Artwork src={book.coverUrl} aspect="2:3" />
</button>

<ImageViewer
  title="Covers"
  images={books.map((book) => ({ src: book.coverUrl, alt: `${book.title}, cover`, caption: book.title }))}
  index={shown}
  onIndexChange={setShown}
  actions={(image, i) => <Button onClick={() => readFrom(books[i])}>Read From Here</Button>}
/>
```

- **One value runs it:** `index` is the image shown, `null` while closed.
  The viewer calls `onIndexChange` with the next index on a step and with
  `null` on Esc and Close. An action that leaves (opens a page, starts a
  reading) sets it to `null` itself.
- **The dark stage, always**, whatever the app's theme: the frame is the
  dark theme's tokens, so a picture's own colours never fight a light
  page. The image fits the frame whole (`object-contain`), any shape.
- **Moving:** the round buttons at the frame's sides, ←/→ (Home and End
  for the ends), one image per wheel gesture, and a sideways swipe on a
  touch screen. The list doesn't wrap: at an end the button stays in the
  tab order, dimmed and `aria-disabled`, so focus is never dropped. The
  images either side are fetched ahead.
- **Told to a screen reader:** the dialog is named by `title`, and each
  step announces "3 of 14: <alt>". So `alt` says what the image shows
  ("Issue 3, cover"), not "image". The visible counter ("3 of 14") shows
  with more than one image; with one there are no steps either.
- **Below the image:** `caption` (a node: the name in semibold, the rest
  muted) and, beside it, the app's own `actions(image, index)`, one or
  two Buttons. On a phone they stack under the caption at full width.
- **States in the frame:** a spinner while the image loads (the last one
  is never left showing), and "This image couldn't be loaded." with its
  `alt` and Try Again when it fails. The rest of the viewer still works.
- Arrow keys typed into a control that uses them (a text box, a slider, a
  menu an action opened) stay that control's.

## Key numbers on a record

`KeyStats`, in `EntityView`'s `strip`: the few figures a record's
page is read for first (done of total, time left, the next date), in a
row under the header, across the page at every width.

```tsx
<EntityView
  subtitle={<EditableValue label="Goal" edit={goals} layout="inline">{goal}</EditableValue>}
  strip={<KeyStats stats={[{ label: 'Done', icon: HashIcon, value: '7', hint: 'of 12' }, { label: 'Next step', icon: CalendarClockIcon, value: formatPlainDate(next) }]} />}
  … />
```

- **A label over its value**: the label in caption type and muted, the
  value in the section title's size and tabular figures, a `hint`
  under it in caption type. One bordered card, the figures side by side,
  wrapping on a phone. A `<dl>`, so each label is read with its value.
- **An icon with the word** (`icon`): the concept's icon at 13px
  before the label, in the label's muted tone, one icon per meaning
  across the app (Lucide: a date `CalendarIcon`, next and review on
  `CalendarClockIcon`, when and length `ClockIcon`, a count `HashIcon`,
  status `CircleDotIcon`, price `DollarSignIcon`). The word stays; the
  icon is decorative. Never an icon alone in the strip.
- **An empty value reads as a dash** (`emptyLabel`), in body type and
  muted, read by a screen reader as "Not set".
  Never a blank.
- **A tip and an action on a value**, as a rail fact has:
  `info` is a few words behind a small info button after the value (a
  tooltip on hover and keyboard focus, a caption line under the value on
  a touch screen, read with the value by a screen reader), and `action`
  (`{ label, icon?, onClick | render }`) a small outline button under it.
  Both are there at rest, so nothing moves on hover. `hint` stays the
  caption line ("of 12"); `info` is the tooltip.
- **Three to five.** It's what the page is for at a glance; anything
  more is a section's label/value rows.
- **`subtitle`** is the line under the title: what the record is for,
  in muted body type, editable in place like any value.

## Parts of the page standards

Small parts the list, record and overview standards share. Each is
generic and standalone: an app wires it into a table, a record or an
overview. Their props are in the type declarations.

- **`ValueList`: several values in a cell.** `<ValueList items={[{ label }]} max={2} />`
  shows two values on one line and the rest as `+N`. A value is a chip by
  default, or the app's own `node` (an icon, a `ColorSwatch`) with its
  `label` as the plain text.
- **`ListHeader`: a list's header.** The title (the page's h1) with its
  `count`, `newAction` alone beside it, and one ⋯ menu for the rest
  (`links`, `more`, and `deleted`'s "Show Deleted"). It holds no state:
  the app keeps `shown`. `secondaryAction` (the list's second most
  common action, one at most, with an optional `hint` line under it),
  `siblings` and passing it as a framed DataTable's `pageHeader` are in
  cell pattern 25. **A line of context** (`description`): one short
  muted sentence under the title, for a list that needs it ("Each search
  runs against the catalog once a day."). A `more` item that can't be
  used now (`disabled: true`: an import already running) stays in ⋯,
  greyed, never hidden.
- **A bar between the header and the list** (`DataTable pageBar`):
  something about the whole page that belongs above its rows, such as a
  deals bar, "Allow Reminders" or a budget's totals. Never a bar put
  between a separate `ListHeader` and the table, which loses the shared
  width. One sentence: anything longer belongs in a help page.
- **`Timeline`: a record's dated history**, its `items` newest first.
- **`NeedsYou`: what waits on the user.** One region at the top of an
  overview, each line a link; `tone: 'destructive'` for an overdue one.
  Nothing renders for an empty list.
- **`Freshness`: how old a number is.** `<Freshness label="Balances entered"
  at="2026-08-02" staleAfter="2026-11-02" />` reads "Balances entered Aug
  2", in the warning tone once `staleAfter` has passed. The app owns the
  rule (entered plus 90 days); this only compares.
- **`PartEmpty` and `WidgetCard`'s `empty`: a part with nothing yet.**
  `empty={{ text?, action }}` draws "Nothing here yet" and one outline
  button in place of the card's plain `emptyMessage` line.

## A few equal things

`EqualItems`: a small set of equal, related
things inside a record (a plan's phases, the stores a price is compared
at, a handful of options), one data shape in five looks. A record picks
one look per set; a sixth is asked for first.

```tsx
<EqualItems
  label="Phases"
  look="featured"
  featuredId={currentPhaseId}
  items={phases.map((phase) => ({
    id: String(phase.id),
    title: phase.name,
    state: { label: 'Current', tone: 'info' },
    fields: [{ label: 'Weeks', value: phase.weeks }, { label: 'Focus', value: phase.focus }],
  }))}
/>
```

| `look` | Draws | Use it when |
|---|---|---|
| `cards` (the default) | a row of equal cards that wraps, one column on a phone; label and value on one line, no rules | a few things with little to say about each |
| `table` | one compact row per item, the title as its row header, a column per field label (first-seen order), a dash where an item has none; scrolls sideways in its own box on a phone | things compared on the same values (a price at each store) |
| `featured` | the item `featuredId` names in full, in a card with the accent border, then the rest as toggles that open in place | one is current or best (a program's phases) |
| `panels` | a panel per item side by side, its title and state in a muted band, every detail labelled above its value; stacked on a phone | each has several details and must read as separate |
| `stepper` | a row of numbered steps joined by a line, each done, current or upcoming, picking the one item whose panel shows under it; opens on the current step; the row scrolls sideways in its own box on a phone | a sequence with one running and the others looked at in turn (a program's phases), where `featured`'s toggles would stack every phase's long content |

- **A state is a badge**, the outline style in its tone (`state: 'Planned'`
  is the neutral one; `{ label, tone }` with `info`, `success`, `warning`
  or `destructive`). Most states stay neutral ("Mapping an enum to tones").
- **A field is the record's row**: the label in label type and muted, the
  value in body type; an empty value is the record's dash, read as "Not
  set". `featured` uses the rail's beside rows.
- **Featured's toggles** are buttons inside headings at the items' level:
  Enter or Space opens one, Tab moves to the next, several can be open,
  `aria-expanded` says which. Never a link; `defaultOpenIds` opens some at
  first.
- **The stepper**: each item's `step` is `done` (filled with
  the primary, a check), `current` (ringed, "Current" under its name, its
  panel's border the accent) or `upcoming` (outlined, the default); the
  line into a step is the primary up to the current one. It opens on
  `featuredId`, else the `current` step, else the first; the shown step
  has a ring round its mark and its name semibold. The steps are a
  tablist named `label`: arrow keys, Home and End move and pick, Tab goes
  on into the panel, and the current step is `aria-current="step"`. A
  step's name is what it shows plus hidden words ("Step 2: Phase 2:
  Build, done"), never an `aria-label`. An app that keeps the shown step
  (in the URL as `?phase=`) passes `selectedId` and `onSelectedChange`.
  `attention` ("needs an answer") puts a small warning dot on a step and
  those words in its name, for something in a panel not shown (an
  unsaved change waiting on an answer). **On a phone** the row stays a
  row: each step at least 4.5rem wide and 44px tall, scrolling sideways
  in its own box (never the page) as the record's tab bar does, the
  shown step kept in view; it never folds into a select, which would
  hide the done and current marks the stepper is for.
- **The same steps, read only**: `StepTrack` draws the stepper's
  row on its own, with no panels and nothing to pick, for a display of
  where a sequence is (a list card showing a program's phases). The
  marks, the line and the sizes are the stepper's own parts, so the two
  never differ; the current step is ringed and has "Current" under it,
  or `caption` in its place ("Day 12"), its name still saying ", current"
  to a screen reader. It's a named list (`<ol aria-label={label}>`), never
  a tablist: steps are list items, not tabs or buttons. On a phone it
  scrolls sideways in its own box with the current step in view, and
  only while it overflows is the box a tab stop, so the arrow keys
  scroll it. Pass the stepper's items as they are (an `EqualItem` is a
  `StepTrackStep`); no steps reads `emptyText`. Never a hand-drawn row of
  steps on a card.

  ```tsx
  <StepTrack label={`${program.name}, phases`} caption={`Day ${program.day}`} steps={phases} />
  ```
- **Empty**: no items reads `emptyText` ("Nothing yet"), an item with no
  fields `noFieldsText` ("No details"). `label` names the set for a screen
  reader (the list's name, the table's caption); titles are `h3` under a
  section's `h2` (`headingLevel`).

**An item's own content and actions.** When an item holds more
than label/value rows (an editor of several fields, a note, a chart), it
carries them itself, never as a field's value, where the label/value grid
squeezes them into its narrow value column:

```tsx
items={stores.map((store) => ({
  id: store.id,
  title: store.name,
  fields: editing === store.id ? undefined : [{ label: 'Price', value: store.price }],
  content: editing === store.id && <StoreEditor store={store} onDone={stopEditing} />,
  wide: editing === store.id,
  actions: (
    <>
      <IconAction icon={PencilIcon} label={`Edit ${store.name}`} size="sm" variant="ghost" onClick={() => edit(store.id)} />
      <IconAction icon={Trash2Icon} label={`Remove ${store.name}`} tone="destructive" size="sm" variant="ghost" onClick={() => remove(store.id)} />
    </>
  ),
}))}
```

- **`content`** goes under the item's fields at the item's full width (in
  `table`, a row of its own under the item's, as wide as the table's box
  and held in view while a phone scrolls the table sideways). An item with
  content and no fields reads no "No details".
- **`actions`** are the item's own buttons, at the end of its title line;
  in `featured` beside the toggle, never inside its button; in `table` a
  last column, named `actionsColumn` ("Actions") for a screen reader. Icon
  actions (`IconAction`, a tooltip and a name each) named for the item
  ("Edit Corner Hardware"), as the record standard's header draws them.
  A Remove that loses data asks first, as any delete does
  (add-an-entity.md "Deleting").
- **`wide`** gives the item the whole row of `cards` or `panels`, for
  content that needs it: set it while the item's editor is open. The
  items keep their order; the others wrap around it.
- **Editing one item swaps its fields for its editor** (the content), then
  back on Save or Cancel. The set's other items stay as they are.

## An overview page

The overview standard: a module's first page when it has three
or more lists, saying how things stand and what waits on the user, each
part one click from its list. `OverviewPage` draws the whole page; the
hub's `WidgetCard`s take the same card anatomy, so a hub and an overview
read alike.

```tsx
<OverviewPage
  title="Household"
  stats={<KeyStats stats={[{ label: 'Savings', value: '$24,800', icon: LandmarkIcon }]} />}
  needs={[{ text: 'Balances are three months old', to: '/accounts' }]}
  parts={[
    {
      id: 'savings',
      title: 'Savings',
      icon: LandmarkIcon,
      to: '/accounts',
      value: '$24,800',
      line: '+$1,120 since August',
      freshness: { label: 'Balances entered', at: entered, staleAfter: addDays(entered, 90) },
      detail: <WidgetList>…</WidgetList>,
      isLoading,
      error,
      onRetry: refetch,
    },
    { id: 'budget', title: 'Budget', icon: WalletIcon, to: '/budget',
      empty: { action: { label: 'Add the First Line', to: '/budget/new' } } },
  ]}
/>
```

- **The top:** the title (the page's h1, `actions` at its end), then
  `stats` (a `KeyStats` strip of three to five numbers), then `NeedsYou`
  from `needs`, which draws nothing when nothing waits. Collect `needs`
  from what each part says about itself.
- **From 48rem up, tiles.** One per part, at least 170px, as many as fit:
  the icon and title, `value` in the numeric type, and `freshness`. A
  tile is a button (`aria-expanded`, `aria-controls` the detail); a click
  opens its part's detail below the grid, one at a time, and a second
  click or Escape inside the detail closes it, focus back on the tile.
  `defaultOpen` names a part open at first.
- **The detail is a `WidgetCard`:** the title as a link to `to` with a
  chevron, `value`, `line`, the app's `detail` (a few `WidgetList` rows,
  a small `LineChart`) and `freshness`.
- **Under 48rem, an accordion.** The same cards in a `WidgetCardGroup`,
  each folded to one line with its value; opening one folds the others.
- **Each part owns its states:** `isLoading` (a skeleton in the tile and
  the card), `error` with `onRetry` (a dash in the tile, the compact
  `ErrorState` in the card), and `empty` (a part with nothing yet: "Nothing
  yet" in the tile, `PartEmpty` and its one way to start in the card). An
  empty part stays on the page: hiding it makes the part forgotten.
- **Links out** (`links`): a short list of pages outside the app
  (`{ label, href, icon? }`), one section after the parts under a
  "Links" heading (`linksTitle`). Each link is its label, its icon
  before it if it has one, and the external-link mark, opening in a new
  tab and saying so to a screen reader. In a row from 48rem, one per
  line on a phone, each 44px tall. A few: a module's whole bookmark list
  is a list of its own.
- **One card anatomy on a hub** (`WidgetCard`): `to` makes the title the
  link with a chevron (in place of the header's `link`), `value` the
  headline in the numeric type, `line` one muted line under it, and
  `freshness` the `Freshness` line at the body's end, after the
  children. A folded card shows `value` when it has no `summary`. All
  optional.

## A record's header and empty values

The record page standard: the same header on every record, the data on
each its own.

```tsx
<EntityView
  title={name}
  badges={<><StatusSelect … /><Badge variant="outline">Wholesale</Badge></>}
  subtitle={summary}
  actions={<><Button variant="outline"><PlusIcon />New Order</Button><DeleteSupplier … /></>}
  emptyFields="fold"
  … />
// Delete: <DialogTrigger render={<IconAction icon={Trash2Icon} label="Delete" tone="destructive" />} />
```

- **The title's line**: the title, then the status and badges after it
  (12px apart, 6px between badges), centred on the title's line; a title
  too long for both pushes them to the next line, starting under it.
  `subtitle` is the line below, in muted body type.
- **Badges edited in place** (an inline `EditableValue` around a
  `Badge`) keep their pencil's room at rest, as the strip's values
  do, so hovering one moves nothing after it and never wraps the line.
- **A hint under a header button** (`ActionHint`): `<ActionHint
  hint="12 searches left"><Button>Search</Button></ActionHint>` draws a
  short caption line under the button, describing it; the header's
  buttons line up by their tops, so it stays level with the rest.
- **Actions**: the record's own commands in words (New Visit, Mark
  Done), then the universal ones as `IconAction`s: Print Notes
  (`printer`, EntityView's own) and Delete (`trash-2`, the destructive
  tone). Each is a square outline button at the header's 36px with its
  words as both its tooltip and its accessible name. An `IconAction`
  that goes somewhere (Open Site, Print to a page) takes the link as
  `render` (`render={<Link to="/print" />}` or `render={<a href=…
  target="_blank" />}`) and is drawn as that link. `accessibleName` says
  more than the tooltip where several are on one page: `DeleteAction`'s
  icon is named "Delete <name>", its tooltip still "Delete". Icon alone is for
  the universal actions only (Delete, Print Notes, Copy Link, Pin, Open
  Site, Restore, Open Full Page, Close, More); everything else keeps its
  word. `printLook="words"` keeps Print Notes as a button with its words.
- **An empty value** reads as a dash (`emptyText`, default `'—'`), in the
  muted text tone, read by a screen reader as "Not set": the same on
  every field, the presets' included. A field's own `emptyLabel` still
  wins where words say more than a dash ("No budget yet").
- **The same dash off the record: `EmptyText`.** An app's own
  strip, summary line or cell with nothing in it draws
  `isEmptyValue(value) ? <EmptyText /> : value`, never a dash and an
  `sr-only` of its own. `label` is what a screen reader says for the
  dash ("Not set" unless set: `label="No reason given"`), `text` shows
  words instead of it, and `className` replaces the muted tone's class
  (keep a muted tone: `className="type-label text-muted-foreground"` on a
  label-sized line). EntityView, KeyStats, EqualItems, ValueList and the
  hub cards' "Couldn't load" all draw through it.

  ```tsx
  <p className="type-body">{shelf} · {isEmptyValue(reason) ? <EmptyText label="No reason given" /> : reason}</p>
  ```
- **Folded empties** (`emptyFields="fold"`): each fields card lists its
  filled fields, then a muted, underlined "N empty" with a down chevron
  under them opens the rest in their places, each still edited in place,
  and reads "Hide Empty" (the chevron up) while open. A card with
  nothing empty has no toggle; one with nothing filled has the toggle
  alone. A value set elsewhere moves its field into the card at once.
  The fold is per card and isn't remembered.

## A record's tabs, mark and facts

A record is one column, its long content grouped under tabs where it has
three or more groups, and its short facts the last tab, Details (or,
with `factsRail`, a column beside the record's body). A mark goes left
of the title.

```tsx
<EntityView
  leading={<img src={photo} alt="" className="size-12 rounded-full object-cover" />}
  strip={<KeyStats stats={stats} />}
  sections={[
    { title: 'Summary', placement: 'rail', fields },           // the Details tab
    { title: 'Notes', tab: 'Notes', content: <Markdown>{notes}</Markdown> },
    { title: 'Packing', tab: 'Notes', placement: 'rail', fields: packing }, // beside Notes
    { title: 'Changes', tab: 'Changes', content: changes },
  ]}
  … />
```

- **Tabs** (`tab` on a section): a line tab list under the strip and any
  sections with no tab, one tab per name in the order the sections first
  give it, the open one marked in `--primary-text` ("The theme colour as
  text" above), as a page's own line tabs (`TabsList variant="line"`)
  are. A tab's count is `tabCounts`. Short tab names, one or two words;
  no icons in them.
- **The tab bar sticks** to the top of whatever scrolls; a page with a
  bar of its own pinned to the top passes `tabsStickyTop` (any CSS
  length). The address holds the selected tab (`?tab=used-in`,
  `entityViewTabSlug`), replaced rather than pushed, so Back leaves the
  record, not the tab. Every tab's sections stay mounted, so a value open
  in place survives a switch.
- **The facts** (`placement: 'rail'` with no `tab`): the last tab,
  Details (`detailsTab` names it otherwise). A record with no other tab
  keeps them in the column, in their place. With `factsRail`, sections of
  `facts` go in a column beside the record's body where the view has
  room, and leave Details.
- **A box beside a tab** (`placement: 'rail'` with a `tab`): a few short
  facts that explain that tab's content (a dose beside the notes), in a
  18rem column beside its sections once the tab is 42rem wide, under
  them below that. Short facts only, never free text: run-on text in a
  narrow box is what the standard took away.
- **Several items in one fact**: linked records, a few tasks. A `list`
  fact (`{ label: 'Related', kind: 'list', items: [{ name, to, icon }] }`)
  draws them; an app's own box of several things uses the same
  `FactList` and `FactListItem`. Never a bare stack of links.
- **The record's status** is the first fact (`recordStatus: true`, one
  per record: EntityView draws it first in the facts rail and in
  Details), edited in place there; a status that changes only through an
  action stays read-only, with the action as a small button under it and
  a tooltip saying why.
- **An action under a fact** (`action`): a small outline button under
  the value, its words a verb ("Close…", an ellipsis when it opens a
  dialog). For the status above, and for any read-only fact that one
  action changes. Never several: more belong in the header's actions.
- **Why a fact can't be edited here** (`hint`): a few words, in a tooltip
  on a small info button after the value, and a caption line under the
  value on a touch screen. Nothing that only hover shows.
- **A rating** (`kind: 'rating'`) is drawn as the list's cells draw it
  (cell pattern 9): stars, hearts (`look: 'hearts'`) or the step bar
  (`look: 'bar'`, with its `word`). Never "4 of 5" as text. An empty one
  reads its `emptyLabel` ("Not rated"), not a row of empty stars. A score
  the person sets is edited with `inPlace.rating` (`RatingInput`, cell
  pattern 9).
- **A yes/no** (`kind: 'switch'`) is a switch on the value's line, never
  a two-choice select; return the save's promise from `onCheckedChange`.
  `disabled` with a `hint` for one that can't change here.
- **Icons on badges**: a `badges` fact's items may each carry an icon
  before the label. The label always stays.
- **The strip** (`KeyStats`) is as wide as its numbers (`width="content"`,
  the default), not the page's width. **Nothing in it moves on hover or
  focus**: a value edited in place inline keeps its pencil's room at rest
  there, as in a table cell.
- **A mark or avatar** (`leading`): left of the title, top-aligned,
  with the title, subtitle and badges beside it at every width. 40 to
  64px (`size-10` to `size-16`): an avatar round (`rounded-full`), a
  mark or cover in a rounded square (`rounded-lg`). Decorative, since
  the title names the record (`alt=""`, `aria-hidden`); initials in
  foreground on `bg-muted`, an icon in muted foreground on the card
  with its border. "Logos and brand marks" above holds for a logo here.
- **Facts beside their labels** (`railFields`, `beside` by default;
  `stacked` puts each label above its value).
- **A tiny record** (a few fields, no notes): `RecordDialogRoute
  look="card"`, a 420px card dialog (a sheet on a phone) with its title,
  Delete, Open Full Page and Close on one line and the facts as plain
  rows, no cards.
- **The rail layout** (`layout="rail"`) is kept for apps not yet moved;
  a new record never uses it.

## Picking at random

`SpinWheel` picks one of a few candidates by chance, for "what do
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

`FillInQueue` walks a list of records that are each missing a
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
- **Quick from the keyboard:** Enter is Save and Next (not in a
  textarea), and the one row marked `shortcut` takes the number keys.
  After a move the focus is on the new record.
- A refused save keeps the record and says why under the buttons, not
  in a toast. It owns its states: skeletons, `ErrorState`, and the
  empty queue, which is the good news ("Every project has a size").
- **Other kinds of value**: `FillInInput` is the row for text,
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

## Values edited in place: the presets' looks

The `inPlace` presets (cell pattern 18, "Presets") draw a value the same
way everywhere it's edited in place, so a record's view reads alike
across apps. That pattern's table has how each reads at rest; beyond it:

- **Money**'s box has the symbol before it (an `InputGroup` addon in the
  muted text tone), as `FillInInput`'s money does; **a number with a
  unit** has the unit after it, in the same addon tone.
- **A date** reads `Sep 2, 2026` (`dateStyle: 'medium'`), never shifted
  by the time zone.
- **A link** reads in `--link`, underlined, with the external-link mark:
  `LinkOut`, LinkCell's look.
- **Several fields edited as one**: open, each part has its label over
  it in `type-caption text-muted-foreground`, and a part's refusal under
  it in the destructive text tone, as a form field's; the pair's own
  refusal is under them all.
- **A list in place under group headings** heads each group in
  `type-label text-muted-foreground` (an `<h3>` under the section's
  title), with `gap-4` between groups and the list's own `gap-2` inside.

## A quick add line

One line that becomes a record ("pay rent tomorrow at 3pm #home"): the
package's `QuickAddInput` over `parseQuickAdd`. Dates, times and
repeats are typed in words; the app's own choices (a list, a place) are a
symbol and a few letters, or a chip pressed.

- **What was read is marked in the box** as you type (a wash of `info`
  under the words), and shown under it as chips: Due (the day and time),
  Repeats, and one per token typed. A misread is seen where it was typed.
- **✕ on a read chip gives its words back to the title**, for a word that
  only looked like a day ("the sun article"). They stay given back while
  they're in the line.
- **The app's chips come after the read ones** (`chips`, usually
  `QuickAddChip`): dashed while they show a default ("List Home ▾", "+
  Place"), solid once pressed. The app drops its chip for a kind the line
  typed (`result.tokens`).
- **No menu opens on a symbol.** A symbol that names nothing stays in the
  title; a few letters pick the first name that starts with them, then the
  first that holds them.
- **Enter adds** (`onSubmit` with the reading). A line with nothing read
  is a title. Give the box a visible label and, the first times, a `hint`
  saying what can be typed.

What `parseQuickAdd` reads, and how a day with no year, a time with no
day and a repeat with no day come out, is in its source's header
(`src/lib/quick-add.ts`); `options.today` and `timeZone` come from the app's
own day (`todayIn`). A repeat is a `Recurrence`, read by
`parseRecurrencePhrase` (`every!` repeats from completion).

## A date field's quick picks

`DateField` (and `inPlace.date`) with `quickPicks` puts a short list of
days over the calendar, for a due day picked in one press:

- **The four:** `quickPicks` (`true`) is Today, Tomorrow, This Weekend
  and Next Week (`DATE_QUICK_PICKS`). This Weekend is the coming
  Saturday, today when it's Saturday; Next Week is the coming week start
  (`weekStart`, Monday when left out), a week on when today is one. An
  app passes its own list instead: `{ label, day: (today, weekStart) =>
  day }`, its words in Title Case.
- **The look:** a column of ghost buttons at the popover's top, over a
  `border-border` rule, each its words on the left and the day it sets
  on the right in `text-muted-foreground` ("Sat, Nov 28", the locale's
  short weekday, month and day), so nobody has to work out which day
  "Next Week" is.
- **Behaviour:** a pick sets its day and closes, as a day picked in the
  calendar does (editing in place, it saves). Each is a button named for
  its words and its day ("This Weekend, Sat, Nov 28") in a group named
  Quick Picks; the keyboard still opens on the calendar's day, with the
  picks before it (Shift+Tab).
- **Off unless asked for:** a field without `quickPicks` is the calendar
  alone. Give them to a due day or a start day, the dates people set
  ahead; a day something happened (finished, bought) has no use for
  them.

## A few choices, then the month

A row's "move to" picker (a to-do's ⋯: the parts of the day, Tomorrow,
or any day) is the package's `DateChoices`, never a `DropdownMenu` with a
calendar in it. A calendar's grid can't sit inside `role="menu"`, and a
menu's arrows never reach it.

- **The look is DateField's popup:** the app's `choices` at the top, under
  their `choicesLabel` heading ("Move to"), each a ghost button with its
  label on the left and its `value` muted on the right (a start time, "Thu,
  Nov 26"), over a `border-border` rule. Then the month, on the day the
  thing sits on (`value`), with today ringed (`today`, the app's own day,
  the browser's when left out). A choice that can't be picked now (a block
  that has ended) is `disabled`: shown, greyed, skipped by Tab.
- **It's a dialog named for what it moves** (`label`, "Move Water the
  plants"), opened from the app's own `trigger`. It opens on the first
  choice that can be pressed, or on the month's day when there are none.
  Tab goes through the choices, then the month's buttons and its day,
  where the arrows move a day or a week. Escape closes, and focus goes
  back to the trigger.
- **A choice runs its own `onSelect`; a day picked runs `onPick`** with
  its `'YYYY-MM-DD'`. Either closes the popup first, so a row that moves
  away leaves nothing open behind it. Each choice is named for its label
  and value ("Tomorrow, Thu, Nov 26"), as the quick picks are.
- **DateField's popup shares its parts:** its quick picks are the same
  rows, its month the same calendar. A field still opens on the day, with
  its picks before it; a picker opens on its first choice.

## A month calendar

A month of days holding the app's dated things (events, visits): the
package's `MonthCalendar`. Not a date picker, which is
`Calendar`; not the place for to-dos, which belong in a list by day.

- **On a laptop the days hold titles**: two to a day, by time, each
  after a dot in its tone, and the rest folded to "+N more". **On a phone
  they hold dots**, one per item in its tone, up to four.
- **An item's `emoji`** is drawn before its title, in the cell and the
  day's list (Noto's picture, `size-3.5`, decorative).
- **The picked day's list is under the month**, every item with its time
  ("All day" without one), its `detail` and a link (`to`). The app's own
  actions for that day sit beside its heading (`dayActions`, an Add
  button); what picking a day does beyond that is the app's (`onSelect`).
- **How an item opens its record** is `opens`, DataTable's kinds
  (add-an-entity.md "How a list opens a record"). Left out (`page`), a
  link goes to the record's page. `dialog` (or `dialog-only`) opens it in
  a dialog over the month, Open Full Page and all: the calendar's route is
  a `RecordDialogRoute` with the calendar as its `list` and the records
  as its children, as any list's is.
- **Tones** are the semantic ones plus `neutral` (design-language
  "Semantic tones"): pick one per kind of thing (an event `info`, a visit
  `success`), not per item, and say in the list's `detail` what it is.
- **Months, Today and the keys**: the arrows beside the month's name and
  Today; in the grid one tab stop, the arrows a day or a week, Home and End
  the week's ends, Page Up and Page Down a month, past the edge into the
  next. Weeks start on Monday, `weekStart="SU"` for Sunday.
- **Four states**: `isLoading` draws the month's frame with placeholders,
  `error` puts ErrorState (with `onRetry`) where the days were, a month
  with nothing says so over the days (`emptyText`), and success.
- `today` comes from the app's own day (`todayIn`); every day is a plain
  `'YYYY-MM-DD'`, so no zone moves one.

## A settings page

One page for what an app lets a person choose: the groups listed down the
side, the one you're on beside them as a card of rows. Parts the app puts
together, so a group's routes, its rows and where a choice is kept are the
app's:

```tsx
const GROUPS = [
  { to: '/settings', label: 'Look' },
  { to: '/settings/notifications', label: 'Notifications' },
]

// the layout route
<SettingsPage title="Settings" groups={GROUPS}><Outlet /></SettingsPage>

// a group's route
<SettingsCard>
  <SettingsRow
    label="Text Size"
    help="For this browser only."
    control={(aria) => <ChoiceButtons {...aria} options={SIZES} value={size} onValueChange={save} />}
  />
  <PaletteSetting />
  <RowsSetting />
</SettingsCard>
```

- **Each group is a route**, so it has an address, Back and a deep link.
  The first is the layout's index route, at the page's own address. A
  group that holds nothing is left out, and has no route: send an unknown
  path under the page to the first group.
- **The current group** is marked as the sidebar marks its entry, a tint
  and a 3px bar, and stays marked on a page below it. Past the first, the
  bar's trail reads "Settings / Notifications" and a phone's back arrow
  goes to the first; a page below a group puts up its own trail.
- **In a box under 40rem** (a phone, or a window the sidebar has narrowed)
  the groups wrap in a row above the card, each 40px tall.
- **A row** is its label, one short line of help and its control. Spread
  what the `control` function is handed on the control: it names it by the
  label and the help. A control that is one thing (a select, a switch)
  also gets an `id`, and the row its `htmlFor`.
- **`layout="below"`** is for a control with a size of its own: tiles, a
  list to order. Everything that fits on a line stays beside its label;
  it drops under the words by itself where it doesn't fit.
- **A table goes after the card**, as any framed list: a
  `DataTable look="framed"` under its `ListHeader`. The card stops at 832px
  and the table doesn't.
- **A choice kept on the device says so** in its help: "For this browser
  only." A row has no saving state: a device's choice saves at once, and a
  control that saves to a server shows its own.
- **`PaletteSetting` and `RowsSetting`** are the shell's look menu as rows,
  kept under the same keys. Each draws nothing where the app doesn't let a
  device pick, so a page can always render them.
- **With both on a page, `<AppShell lookMenu={false}>`** takes the look menu
  out of the header. `palettePicker` and `rowsPicker` stay on: they say a
  device may choose, and its choice applies. Don't turn the menu off before
  the page has the two: a device that picked would have no way back.

## The sidebar and the phone's bar

`AppShell`'s navigation, all set in the app's `nav` and `bottomBar`, and
the trail and search in the bar. Their props are in the type
declarations.

```tsx
const nav: NavEntry[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { label: 'Every day', items: [{ to: '/news', label: 'News', icon: NewspaperIcon, count: unread, countLabel: 'unread' }] },
  { label: 'Home and money', items: [{ to: '/finance', label: 'Finance', icon: WalletIcon, children: [
    { label: 'Money', items: [accounts, savings] },
    { label: 'Spending', items: [budget] },
  ] }] },
  { label: 'Tools', placement: 'bottom', items: [fillIn, roadmap] },
]
const bottomBar: BottomBarItem[] = [
  { to: '/', label: 'Home', icon: HouseIcon },
  { group: 'Every day', icon: SunIcon, sheet: 'tiles' },
  { search: true, icon: SearchIcon },
]
```

- **The current entry:** the sidebar's tint and a 3px `--primary` bar
  at its start, the same mark as a selected or hovered table row, in the
  sidebar and on the icon rail.
- **Headings among a module's pages** (a group `{ label, items }` in an
  entry's `children`): use them for a module with more than about six
  pages, a few words each.
- **Counts** (`count`, `countLabel`): a plain number at the entry's end
  in the muted text tone, never a coloured badge. Only on entries that
  ask you to act (unread, to fill in, new). `countLabel` is what the
  number counts, read after the entry's name ("News 24 unread").
- **A section at the foot** (`placement: 'bottom'`): for tools rather
  than modules.
- **A phone's back arrow:** below 48rem, a page below a nav entry (a
  record under Accounts) shows "‹ Accounts" at the header's start,
  linking to the entry.
- **An area's sheet as tiles** (`sheet: 'tiles'`): a grid of tiles, one
  per entry, in place of a list.
- **The sidebar as icon tiles** (`navLook="tiles"` on `AppShell`, or a
  section's own `look: 'tiles'`): fewer words, more icons. Keep tile
  labels to a word or two; a section that should stay a list (Tools at
  the foot) sets `look: 'list'`.
- **The trail in the bar** (`usePageTrail`, `EntityView`'s
  `back.trail`): from 48rem up; a page that names none shows its nav
  entry's ("Finance › Accounts" for one of Finance's pages, "Home" on
  the hub). It replaces a page's own back link; the bar sits outside
  `<main>`, so the page's links are still the only ones in it.
- **Search in the bar** (`search={{ placeholder, findRecords, recent }}`):
  a box from 48rem up, a search button on a phone (the bar's instead,
  where it has Search), and the shortcut (Ctrl K, ⌘K on a Mac) open a palette of the nav's pages, the records
  opened lately on this device (`useRecentRecord`) and the app's records
  under their `kind`.
- **Search on the phone's bar** (`{ search: true, icon: SearchIcon }` in
  `bottomBar`): a button named Search among the bar's items, opening the
  same palette in thumb reach. It is an action, not a place: never the
  current item and never counted. It takes the place of the header's
  button on a phone, so there is one Search. Without `search`, or past the
  bar's fifth item, it isn't drawn and the header is as without it.
