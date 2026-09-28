# Design-language batch (2026-09-27)

Draining the `DEFERRED.md` rows that had accumulated while building the
Game List app. Five PRs, in the order the rows themselves prescribe.

## Why now

The backlog had become write-only. Nineteen of its rows said "found while
building the Game List app", and **every commit to this repo since the
`create-app` merge was DEFERRED.md logging** — no code had landed while the
first real consuming app was feeding it. Several rows marked "next session
in this repo, small and concrete" had sat through a dozen sessions.

## What shipped

| PR | What |
|---|---|
| #34 | `<SelectValue>` renders the value, not the label — a live defect in `widgets-table.tsx` |
| #35 | The docs that still described the pre-v1 stance |
| #36 | Release process automated (PR install-test + auto-tag on merge) |
| #37 | Semantic tones: success / warning / destructive, three styles each |
| #38 | Cell-pattern catalogue + the column-options step (stacked on #37) |

## Deviations, and things the next session should not re-derive

**The destructive-badge contrast claim was wrong, and it had propagated.**
`DEFERRED.md` asked for a solid `Badge` variant "whose destructive/warning
fills pass AA (the shipped `destructive` badge is ~3.8:1 and fails)". It
doesn't fail. `--destructive` is `#e7000b` and white on it measures
**4.76:1**. The ~3.8 figure belongs to Tailwind's `red-500` (`#ef4444`), a
different colour. The claim traced back to a comment in
`widgets-columns.tsx` describing the **tinted** badge shadcn originally
shipped — which Phase 5 had already replaced with a solid fill. The comment
outlived the bug, the DEFERRED row quoted the comment, and the row nearly
caused a fill to be changed for no reason. That comment is now corrected in
place. **Measure before believing a ratio written down anywhere, including
here.**

**The registry workflow was proven by accident, which was better than the
plan.** #36's PR body predicted its own install-test would *skip*, since
the PR looked like workflows and docs. It ran — `AGENTS.md` is
registry-shipped. So the detection worked and the workflow is proven
end-to-end on its own PR rather than only proven to skip.

**Tagging model: auto-tag on merge**, chosen by the developer over
dropping tags for SHA pins. The README now links the latest release instead
of naming a version, which removes the manual bump *and* keeps the workflow
from having to commit back to a protected `main` — it only pushes a tag.
A minor/major bump stays manual: push that tag and the workflow continues
from it, because the next version comes from `git describe`, not a file.

**`--warning-text` is amber-800, not the amber-700 the DEFERRED row
suggested.** The row said to start from the Game List app's shades. amber-700
passes on the page (5.05:1) but drops close to the 4.5 line on a tinted
chip background; amber-800 gives headroom (7.20:1) for the tinted variant
that didn't exist in that app.

**No screenshot baseline for the `AllTones` story.** A baseline needs a
Linux round-trip through CI, and the real assertion is the measured
contrast plus axe. `DEFERRED.md`'s row on replacing pixel baselines with
programmatic checks is unactioned and now has one more data point in favour.

## Verification notes

Every new test got a negative control. The most informative one: pointing
`outline-success` at the **fill** token instead of the `*-text` token fails
the dark run while light still passes. That asymmetry *is* the bug the
two-token split exists to prevent, so the test binds to the real failure
mode rather than to a colour value.

## Follow-up pass (same session)

Draining the rest of the cheap rows, and reconciling the backlog itself:
`enableSortingRemoval` as an opt-in `DataTable` prop, the `meta.align`
column option, persistent toolbar filter captions, the mock-mode banner,
the collapse-aware sidebar brand text, and a **phone-width Playwright
project**.

`DEFERRED.md` had drifted badly: `AGENTS.md`, `ARCHITECTURE.md` and
`design-language.md` all cite its "Direction" section, but that section
had only ever existed on an unmerged branch — so `main` shipped a
dangling reference, `AGENTS.md`'s copy of it reaching every consuming
app. The full file is now on `main`, 27 shipped rows are removed (a queue,
not a log), and three new rows were added from what the phone-width run
turned up.

**The phone-width project earned itself immediately** — it failed four
tests on its first run. None was a product bug: below the sidebar's
breakpoint the nav renders into a Sheet *portaled to document.body*, so it
lands outside `app-shell.tsx`'s `<nav aria-label="Primary">` wrapper and
the landmark is empty; and hover has no meaning on a touch device. The
specs were wrong about phone width, not the app.

One self-inflicted bug worth remembering: the first fix branched on
`(await nav.getByRole('link').count()) === 0`. `count()` does **not**
retry, so on a slow first paint it read 0 on *desktop* too, clicked the
sidebar trigger — collapsing it — and then waited for a sheet that was
never coming. Keyed off the `isMobile` fixture instead. A racy DOM read is
not a substitute for knowing which device you are on.

## Second follow-up pass (same session)

Five more rows: the password-visibility toggle, the nested-worktree scan,
`build:real`/`.env.real`, the sparse-fixture convention, and a guard for
patched primitives. 45 open rows at the start of the session, 16 now.

**`build:real` was the one with teeth.** `VITE_API` is read at *build*
time, so a plain `npm run build` produces a bundle with MSW inside it and
the deployed app serves the mock fixture behind a seeded demo user, looking
entirely normal. The registry cannot ship the escape hatch (npm scripts
can't be merged into `package.json`, and a dotfile isn't a registry file),
so it is Step 0 of the playbook — and a step done by hand is a step that
gets skipped. `consume-test.sh` now builds both modes and asserts the real
one contains no MSW, with an inline negative control asserting the default
build *does* (otherwise the grep proves nothing). Verified locally first:
1.2 MB real vs 1.6 MB mock, and the string present in exactly one.

**Two registry mistakes caught before merge, both the same shape.** The new
`password-input.tsx` imports shadcn's `input-group`, which was neither
shipped as a file nor listed in `registryDependencies` — a fresh install
would have broken on an import of something that was never installed. And
`table` was still a `registryDependency` *after* #39 started shipping a
patched copy as a file, so upstream's unpatched version could overwrite the
patch. `consume-test.sh` now compares `table.tsx`, `button.tsx` and
`badge.tsx` against the ref, so a patched primitive silently arriving
unpatched fails loudly instead of passing every other check.

**A self-inflicted API collision:** the toggle's `aria-label="Show
password"` contains "Password", so `getByLabel('Password')` began matching
both the input and the button and broke four existing auth tests on strict
mode. The button's name is right for users, so the tests got `exact: true`
and the component carries a comment saying why.

## Third follow-up pass (same session)

Categorical colour slots, and the screenshot baselines replaced. 16 open
rows before this, 14 after.

**Categorical slots** are `--category-1..8`, generic rather than per-value:
an app maps its enum to a slot in its own columns file, so a new enum value
costs a line there instead of three tokens here. Hues avoid the red, green
and amber the tones already spend — a category drawn in red reads as "bad"
— and they are ordered by *distinctness* rather than hue angle, so an app
using three gets three obviously different colours. Honest limit, stated in
the docs: past about five, hue alone stops separating them and the glyph
has to carry the meaning. All eight clear 3:1 in both themes (measured),
but axe does not check icon contrast, so nothing re-measures them.

**The screenshot baselines are gone**, replaced by a test that asserts
every colour a shipped primitive paints resolves to a token. Two
non-obvious mechanics took iterations to get right, and both are worth
knowing before touching it:

1. `ctx.fillStyle = value; ctx.fillStyle` does **not** normalise a modern
   colour — Chrome echoes `oklch(...)` back in the same space. Rasterising
   (`fillRect` then `getImageData`) is what actually converts.
2. `getComputedStyle` **resolves** custom properties by name but does not
   **enumerate** them, so the token list cannot come from the computed
   style. It is collected from the stylesheets' own `:root`/`.dark` rules.

Alpha is stripped from the string before normalising, so `bg-success/15`
still counts as `--success`.

**The negative control is the reason this swap is defensible.** An inline
`style={{ color: '#ff00aa' }}` on `Badge`: ESLint's token rule **exits 0**
— it genuinely cannot see it, which is exactly why the screenshots existed
— while the new test fails in both themes. Same failure caught, no images,
runs on any OS, and no Linux round-trip through CI's artifact upload. That
last rule is deleted from ARCHITECTURE's learned-the-hard-way list.

## Still open

- The three rows added at the start of this session: the phone-width
  Playwright project, and the sparse-fixture testing convention (the
  `<SelectValue>` row is now closed by #34).
- Row on replacing pixel screenshot baselines with programmatic checks —
  not attempted.
- Categorical colour (genre/family hues) — still deliberately unbuilt; the
  row argues for `--category-1..8` slots rather than per-enum tokens.
- Nothing here ported the Game List app's `pinFirstColumn` / sticky bottom
  scrollbar. Both are *structure*, and both are `querySelector` workarounds
  around `table.tsx` not forwarding a ref or className to its container —
  the right fix is to patch `table.tsx` first.
