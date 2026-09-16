# Phase 5 — Tokens

## What was built

Small, as the plan predicted — this phase closed the two carry-over items
Phase 3 and Phase 4 both flagged, rather than choosing a new palette.

- **Fixed `Badge`'s `destructive` variant** (`src/components/ui/badge.tsx`):
  replaced the shadcn-shipped tinted fill (`bg-destructive/10
  text-destructive`) with a solid fill (`bg-destructive
  text-destructive-foreground`), matching the fix Phase 3 already gave
  `Button`'s `destructive` variant. This was the specific carry-over Phase 4
  named for this phase.
- **Fixed a real dark-mode contrast failure this pass found**, not just
  carried forward: dark mode's `--destructive` (`--red-400`, `oklch(0.704
  0.191 22.216)`) against `--destructive-foreground` (white) computes to
  2.88:1 — short of WCAG AA's 4.5:1 for normal text, and well short of
  light mode's already-verified 4.77:1 (`--red-500` vs white, from Phase
  3's note). Fixed by remapping dark mode's `--destructive` to the same
  `--red-500` primitive light mode already uses, rather than introducing a
  second red. `--red-400` is now unused and was removed from `theme.css`'s
  Layer 1 rather than left as dead code an agent might reach for later.
- **Added a `badge` section to `/kitchen-sink`** (all four variants:
  default, secondary, outline, destructive) and registered it in
  `e2e/shell.spec.ts`'s `KITCHEN_SECTIONS`. Without this, nothing on
  `/kitchen-sink` ever rendered `Badge`'s destructive variant, so neither
  axe nor the screenshot baseline could have caught the contrast bug above
  — this is *why* it went unverified through two prior phases, not just an
  oversight this phase happened to fix incidentally.
- **Added a dark-mode axe pass** (`e2e/shell.spec.ts`, `kitchen sink has
  zero axe violations in dark mode`) alongside the existing light-mode one.
  This is the actual fix for "dark-mode contrast independently verified,"
  which Phase 3 and Phase 4 both left as a manual, hand-computed note. It
  immediately caught the `--destructive` bug above on its first run, before
  any fix was in place — proof the check does what it's meant to, not just
  that it's wired up.
- **Added `tests/theme-tokens.test.ts`**, the vitest the plan's Phase 5 exit
  criteria names explicitly: parses `theme.css`, extracts every token
  declared after each block's `Layer 2 — semantic` comment, and asserts the
  `:root` and `.dark` sets are equal (excluding `--radius`, the one
  intentional asymmetry — it's layer 2 but not color-valued, so it has
  nothing to remap). Passes today; its value is catching the next token
  someone adds to one block and forgets in the other.
- **Regenerated the two affected dark-mode screenshot baselines**
  (`kitchen-button-dark-*.png`, changed color; `kitchen-badge-dark-*.png`,
  new) on win32 locally. Every other baseline is untouched — nothing else
  changed. Linux baselines for these two are not yet committed; see below.
- **Deliberately did not touch the rest of the primitive palette.** The
  existing grayscale-plus-single-red set (shadcn's Nova preset, reorganized
  into two layers in Phase 1) was reviewed against this phase's mandate
  ("primitive palette itself is deliberately chosen") and kept as the
  intentional v1 choice: this is a reusable foundation, not a specific
  brand, and `docs/DEFERRED.md` already defers "Additional themes" until a
  second app needs a distinct look. Regenerating baselines project-wide "in
  case the palette changed" would have been busywork against a palette that
  didn't.

## Deviations from the plan

- **The plan's Phase 5 section doesn't literally ask for a dark-mode axe
  test or a `badge` kitchen-sink section** — it names the vitest
  set-equality check and "the Phase 3 screenshot baseline is regenerated
  here." Both additions were necessary to actually close the two carry-over
  items Phase 4 assigned to this phase (`docs/phases/phase-4.md`'s "What
  the next session needs to know"), not scope creep: the contrast bug was
  unreachable by any existing check until `Badge`'s destructive variant had
  somewhere to render, and "independently verified" only means something if
  a script does the verifying.
- **Linux dark-mode screenshot baselines for `button` and `badge` are not
  committed yet.** Same constraint Phase 3 hit: no Docker available in this
  environment to generate them locally, and Phase 3's own baselines were
  sourced from CI's failure-artifact upload rather than a container. This
  session pushes to `main` expecting CI to fail on exactly these two Linux
  comparisons, downloads the actual-\*.png files from the uploaded
  `playwright-test-results` artifact, and commits them as the new
  baselines in a follow-up commit — mirroring `2f868be` exactly. If this
  session ends before that follow-up lands, the next session should check
  CI status on `main` first, before doing anything else.
- **`/kitchen-sink` still has no section for the other Phase 4 primitives**
  (`select`, `dialog`, `combobox`, `calendar`, `textarea`, `table`,
  `field`, `label`) — only `badge` was added, because it was the specific
  item flagged for this phase. Filling in the rest is a legitimate gap
  (axe and the dark-mode screenshot baseline currently can't see any of
  those components) but is broader than what Phase 4 assigned here, so it
  is *not* done in this phase. Worth a `docs/DEFERRED.md` line or a
  dedicated future pass rather than silently expanding this one.

## Verification

`npm run verify` passes: `tsc -b`, `eslint . --max-warnings 0`,
`vitest run` (35 tests: the existing 33 + 2 new in
`tests/theme-tokens.test.ts`), `playwright test` (30 tests, one new: the
dark-mode axe pass — the pre-existing 29 unchanged in count and names).
One unrelated flake reproduced once (`ERR_CONNECTION_REFUSED` against the
preview server on `empty`'s dark-mode screenshot, same class of webServer
race Phase 3's report already noted for `msw-contract.spec.ts`); a bare
re-run was green. `scripts/check-phase-5.sh`: **PASS** (confirmed after
committing — see Deviations for the one still-open follow-up, which
`check-phase-5.sh` does not gate on, since it only requires the win32
baseline to exist and be committed, matching `check-phase-3.sh`'s own
pattern of documenting the Linux gap rather than blocking on it).

## What the next session needs to know

- Next up: Phase 6 (Registry). Before starting it, confirm CI is green on
  `main` and that the Linux `button`/`badge` baselines from this phase's
  "Deviations" section have landed — if not, finish that first; it is a
  loose end of this phase, not new work for Phase 6.
- `--red-400` no longer exists in `theme.css`. If a future session's memory
  or notes reference it (Phase 3/4's reports both do, in passing), that's
  expected — it was the unused primitive this phase's fix orphaned and
  removed.
- `docs/BLOCKERS.md` is still empty (the `spec-tester` item was resolved
  before this phase, per Phase 4's report). Nothing from this phase added
  to it.
- The Notion tracker (`Frontend Design System`, page id
  `3dd2b1f9153e8047a2b9de3867b13195`) was updated at the end of this
  session: Phase 5 row flipped to done, a new Session Log entry added.
