#!/usr/bin/env bash
# Exit criteria for Phase 3 — App Shell.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-3: $1" >&2; exit 1; }

# Cumulative: Phase 3 must not have broken Phases 1-2 (also runs `npm run
# verify`, which covers this phase's own Playwright specs too).
scripts/check-phase-2.sh

[ -f src/components/app/app-shell.tsx ] || fail "src/components/app/app-shell.tsx missing"
[ -f src/components/app/route-error-boundary.tsx ] || fail "src/components/app/route-error-boundary.tsx missing (route-level error boundary)"
[ -f src/auth/auth-provider.tsx ] || fail "src/auth/auth-provider.tsx missing"
[ -f src/auth/use-auth.ts ] || fail "src/auth/use-auth.ts missing"

# Phase 9 retired the kitchen-sink route in favor of Storybook (see
# docs/phases/phase-9.md) — this originally asserted a <Section
# name="..."> per primitive on /kitchen-sink; it now asserts a
# *.stories.tsx file per primitive instead. Everything else below is
# unchanged from Phase 3.
[ -f .storybook/main.ts ] || fail ".storybook/main.ts missing"
for name in button card input sidebar sheet tooltip separator skeleton spinner empty; do
  [ -f "src/components/ui/$name.stories.tsx" ] || fail "src/components/ui/$name.stories.tsx missing"
done
[ -f src/components/ui/sonner.stories.tsx ] || fail "src/components/ui/sonner.stories.tsx missing (toast)"

[ -f e2e/shell.spec.ts ] || fail "e2e/shell.spec.ts missing"
grep -q "This page hit an error" e2e/shell.spec.ts || fail "shell.spec.ts does not test the error boundary is absent on normal nav"

[ -f e2e/storybook-visual.spec.ts ] || fail "e2e/storybook-visual.spec.ts missing"
grep -q "AxeBuilder" e2e/storybook-visual.spec.ts || fail "storybook-visual.spec.ts does not run axe on the primitive stories"
grep -q "toHaveScreenshot" e2e/storybook-visual.spec.ts || fail "storybook-visual.spec.ts does not take dark-mode screenshots"

SNAPSHOT_DIR="e2e/storybook-visual.spec.ts-snapshots"
[ -d "$SNAPSHOT_DIR" ] || fail "$SNAPSHOT_DIR missing — dark-mode baselines were never generated"
SNAPSHOT_COUNT=$(find "$SNAPSHOT_DIR" -name '*.png' | wc -l | tr -d ' ')
[ "$SNAPSHOT_COUNT" -ge 11 ] || fail "expected at least 11 committed dark-mode baselines, found $SNAPSHOT_COUNT"
for f in "$SNAPSHOT_DIR"/*.png; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 || fail "$f exists on disk but is not committed"
done

echo "check-phase-3: PASS"
echo "check-phase-3: NOTE — baselines in $SNAPSHOT_DIR were generated on win32, not in CI's Linux container. See docs/BLOCKERS.md."
