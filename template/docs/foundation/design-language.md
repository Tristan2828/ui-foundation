# Design Language

The part of this foundation a consuming app cannot cheaply get right on
its own: color that carries meaning, checked for contrast in both themes.
Tokens and styles here **grow freely**, in the foundation package, so every
app gets them: they do not wait for a second app to need them. New
composites don't grow that way; they are built against a real app's screen.

## Semantic tones

Three tones carry meaning: **success**, **warning**, **destructive**. Grey
is not a tone — it is the absence of one, and most values should stay grey.

Each tone has two kinds of token, and picking the wrong one is the single
most common way to ship an unreadable label:

| Token | For | Why it can't be the other one |
|---|---|---|
| `--success` / `--warning` / `--destructive` (+ `-foreground`) | a **solid fill**, always with white text on it | chosen to contrast with *white*, so on the page background it's too light in light mode |
| `--success-text` / `--warning-text` / `--destructive-text` | the tone as **text, a border or an icon** on the page background | chosen to contrast with *the page*, so as a fill under white text it's needlessly dark |

Only the `*-text` tokens are remapped in `.dark`. A solid fill keeps one
shade in both themes, because it always carries white text and the page
behind it never enters the calculation.

Measured ratios (WCAG 2.x, sRGB) are recorded next to each primitive in
the package's `styles/theme.css`, and its `e2e/storybook-visual.spec.ts` re-checks all
nine tone/style combinations with axe against the rendered DOM in both
themes. **A new tone or style is not done until it appears in that story.**

## The three badge styles

`Badge` ships each tone in three styles. They are not interchangeable:

- **Outline** — `outline-success`, `outline-warning`, `outline-destructive`.
  The default choice, and the one proven across real columns. Quiet enough
  to repeat down 25 rows without the column becoming a wall of color.
- **Tinted** — `tinted-success`, `tinted-warning`, `tinted-destructive`. A
  low-alpha wash of the tone with `*-text` on top. More presence than
  outline; use when the value is the point of the row, not a detail of it.
- **Solid** — `success`, `warning`, `destructive`. The loudest. Use for one
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

## Categorical colour

Tones say good or bad. A value that is merely *different* from its
neighbours — a genre, a team, a category — needs a different mechanism, and
it is `--category-1` through `--category-8`.

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
never build one by interpolation, or the class won't be generated.

Four things about them:

- **The hues avoid red, green and amber**, which the tones already spend. A
  category drawn in red reads as "this one is bad" even when nothing is
  wrong.
- **They are ordered by distinctness, not by hue angle.** An app using
  three categories gets three obviously different colours. Past about five,
  hue alone stops separating them — slots 3 and 7 are both yellow-greens —
  so the glyph has to carry the meaning and the colour only reinforces it.
- **Tint the glyph, never fill behind text.** The label stays
  `text-foreground`, so readability never depends on the hue. A slot used
  as a background needs its own contrast check, which nothing here does
  for you.
- **Nothing re-measures them automatically.** All eight clear the 3:1
  non-text minimum in both themes (measured, recorded in `theme.css`), but
  axe checks text contrast, not icon contrast — so a change to these
  values is not caught by any gate.

If you find yourself wanting a ninth, that is usually a sign the column
should be showing a shape or a label rather than more colours.
