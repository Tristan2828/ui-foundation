# Choosing How a Column Displays

An optional step in [`add-an-entity.md`](add-an-entity.md), for a developer
who knows what the data *means* but not what it should look like.

Instead of the agent picking a cell style and the developer reacting to it,
the agent builds a page of numbered options rendering **the same sample
rows** in each style, and the developer replies with a number. That has now
picked eight columns across a real app, and the choices it produced are
[`cell-patterns.md`](cell-patterns.md).

Run it per column, and only for columns where it isn't obvious. A plain
text column doesn't need a page.

## What the page must contain

**Open with the value, before any style.** Two lines that decide most of
what follows:

- The field's **type, range and how "unset" is represented**, read from
  `schema.d.ts` — not every field is an enum. A 1–5 integer whose
  "not rated" state is *absence from a list* is a different problem from a
  nullable enum, and the page should say which it is.
- A **value grouping**: how many values mean good, bad, or neither, and
  which ones can share a tone. For a many-valued enum this is the real
  decision, and making it first renders half the styles obviously wrong.
  If the agent invented a taxonomy (families, bands, thresholds), show it
  as a **legend and flag it as a guess** — that's usually what the
  developer actually wants to change.
- **Why this column differs from the last one explored.** "One value, no
  good/bad axis, so colour has nothing to say by default" saves a round.

**Sample rows must span the value's cardinality, not just its values.**
For a multi-value column: 1, 2, 3, 5 and 6 values *plus an empty row*. For
a bounded scale: one row per value plus the unset row. The six-value row
is what kills one-badge-per-value styles; the empty row surfaces the null
case for free. For a date column, pin "today" in the header and choose
rows relative to it, or the page's own relative strings rot.

**Number the cards** so the developer can reply "5". If a second round is
requested, **append** rather than renumber — the earlier numbers have
already been used in conversation.

**Per card:**

- A **one-line tradeoff** and a **cost line**: what this style trades away
  (an extra text shade, ambiguity of blank, needs colour, more ink).
- **Capability tags** for a multi-value column — ✓ shows who rated, ✓ shows
  disagreement, ✓ still fits 5+ values. This compares options on what each
  *preserves*, which for a multi-value column matters more than looks.
- A **backend-implication note** where one applies. "Sorting by average
  needs a backend change — not sortable server-side today" reads to a
  backend developer the way visual weight reads to a designer, and it stops
  an unbuildable option winning on looks.
- **Collision with neighbouring columns.** An outline badge beside a badge
  column, or "★ n" beside an existing ratings column, looks identical to
  its neighbour — a failure only visible in context.

**Group the cards by what they cost the design system**, not by look:
*fits as-is* / *needs new tokens* / *removes the column*. In a system whose
Hard Rule bans palette colours, whether colour is worth new tokens **is**
the decision, and grouping puts it on the page before any style is judged.

**Include the boring option.** A plain-text style gets picked about as
often as the visual ones. A page of only visual options is a loaded
question.

**Include options that remove the column** where they exist (the value as
a subline under the name; rows grouped under a header), with their cost in
`DataTable` terms: no column to sort by, and grouping fights both column
sorting and server-side pagination.

**For an editable cell, answer read-versus-edit up front.** Every display
style silently decides whether one-click editing survives. Put a "decision
for you" callout on the page, tag each card *keeps picker / read-only*, and
list what else touches the cell — e2e tests driving the control, docs
describing it. Moving a rating to the edit screen is a test-and-docs
change, not a one-line cell change.

## Controls on the page

- **"Try it in a table"** — a switcher that re-renders one sample table
  (real column names, ~7 rows including an empty one) in the selected
  style. A style that looks fine in an isolated card can be far too noisy
  down 25 rows; this is the single most useful control on the page.
- **Greyscale toggle** (`filter: grayscale(1)` over every card) — the cheap
  colourblind check, and it settles which options depend on hue alone.
- **Tone toggle** (none / three tones) and **order toggle** (as picked / by
  family) where they apply. Global toggles over all cards beat per-card
  variants: a request like "card 1's shape with card 5's tone rule" is a
  toggle that was missing.
- **Demo interaction live** (CSS `:hover`/`:focus`) for any style whose
  point is an interaction. A static screenshot hides exactly what's being
  judged.

## The one recurring failure: drift

Every options page so far re-implemented the cells in vanilla CSS with
copied tokens, and every one drifted:

- an amber the app had no token for
- a text shade of `oklch(0.42)` where the app shipped `0.5`
- lucide glyph paths typed from memory
- a `color-mix` tinted fill the design system had no variant for — and that
  one **changed the outcome**: the developer picked it, and it had to be
  rebuilt as the app's existing `secondary` fill

An option using a fill the design system can't produce is being judged as
something the app can't render.

**Render the options from the app's real components.** Storybook is already
in this repo and is the obvious host: the cards then use the real tokens
and the real `Badge`, and the winner can be copied straight out. Do this
rather than hand-writing a standalone HTML page.

## After the pick

Implement it in `<entity>-columns.tsx`, and if the pattern isn't already in
[`cell-patterns.md`](cell-patterns.md), add it — with the bits that were
non-obvious while building it, not just the final markup.
