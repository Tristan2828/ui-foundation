#!/usr/bin/env bash
# Exit criteria for Phase 5 — Tokens.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-5: $1" >&2; exit 1; }

# Cumulative: Phase 5 must not have broken Phases 1-4 (also runs `npm run
# verify`, which covers this phase's own Playwright specs too).
scripts/check-phase-4.sh

# Every semantic token in theme.css must be defined in both the light and
# dark blocks (docs/BUILD-PLAN.md Phase 5 exit criteria) — enforced by a
# vitest, not eyeballed.
[ -f tests/theme-tokens.test.ts ] || fail "tests/theme-tokens.test.ts missing (semantic token set-equality check)"

# The Badge destructive variant carried a tinted, low-contrast fill forward
# from Phase 3/4 (docs/phases/phase-4.md). It must now match Button's solid
# fix: a dedicated foreground token, not a tinted background used as text.
grep -q "bg-destructive/10" src/components/ui/badge.tsx &&
  fail "badge.tsx still uses the tinted bg-destructive/10 fill (unfixed contrast carry-over from Phase 4)"
grep -q "bg-destructive text-destructive-foreground" src/components/ui/badge.tsx ||
  fail "badge.tsx's destructive variant does not appear to use the solid bg-destructive/text-destructive-foreground fill"

# Badge must have its own Storybook story so axe and the screenshot
# baseline actually exercise the fixed variant (Phase 3/4's contrast fixes
# were never independently verified in dark mode precisely because Badge
# had no kitchen-sink section — Phase 9 replaced kitchen-sink with
# Storybook; see docs/phases/phase-9.md).
[ -f src/components/ui/badge.stories.tsx ] || fail "src/components/ui/badge.stories.tsx missing"
grep -q "'badge'" e2e/storybook-visual.spec.ts || fail "e2e/storybook-visual.spec.ts's PRIMITIVES does not include 'badge'"

SNAPSHOT_DIR="e2e/storybook-visual.spec.ts-snapshots"
[ -f "$SNAPSHOT_DIR/storybook-badge-dark-chromium-win32.png" ] ||
  fail "no committed win32 dark-mode baseline for the badge story"
git ls-files --error-unmatch "$SNAPSHOT_DIR/storybook-badge-dark-chromium-win32.png" >/dev/null 2>&1 ||
  fail "badge dark-mode baseline exists on disk but is not committed"

# Dark-mode contrast (the thing Phase 3 and 4 both flagged as unverified)
# must be mechanically checked, not hand-computed from a hex value.
grep -q "zero axe violations in dark mode" e2e/storybook-visual.spec.ts ||
  fail "e2e/storybook-visual.spec.ts has no dark-mode axe check"

echo "check-phase-5: PASS"
