#!/usr/bin/env bash
# Exit criteria for Phase 4 — Reference Screens.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-4: $1" >&2; exit 1; }

# Cumulative: Phase 4 must not have broken Phases 1-3 (also runs `npm run
# verify`, which covers this phase's own Playwright specs too).
scripts/check-phase-3.sh

[ -f src/components/app/data-table.tsx ] || fail "src/components/app/data-table.tsx missing"
[ -f src/components/app/entity-form.tsx ] || fail "src/components/app/entity-form.tsx missing"
[ -f src/routes/widgets/widgets-table.tsx ] || fail "src/routes/widgets/widgets-table.tsx missing (Screen A)"
[ -f src/routes/widgets/widget-form.tsx ] || fail "src/routes/widgets/widget-form.tsx missing (Screen B)"

# widgets-table.tsx and widget-form.tsx must actually consume the composites,
# not just sit next to them — the plan's whole point is "thin consumers".
grep -q "DataTable" src/routes/widgets/widgets-table.tsx ||
  fail "widgets-table.tsx does not appear to use the DataTable composite"
grep -q "EntityForm" src/routes/widgets/widget-form.tsx ||
  fail "widget-form.tsx does not appear to use the EntityForm composite"

# One Playwright spec per screen, with named tests for all five required
# states — the script greps for the test names (docs/BUILD-PLAN.md Phase 4
# exit criteria), not just that the files exist.
declare -a STATES=("loading" "empty" "error" "validation" "success")

check_spec_states() {
  local spec="$1"
  [ -f "$spec" ] || fail "$spec missing"
  for state in "${STATES[@]}"; do
    grep -q "test('$state:" "$spec" || fail "$spec has no test named '$state: ...'"
  done
}

check_spec_states "e2e/widgets-table.spec.ts"
check_spec_states "e2e/widget-form.spec.ts"

# The states must be forced through MSW handler overrides (Phase 4 step 5),
# not asserted against whatever the default mock data happens to do.
grep -q "__msw\|addInitScript" e2e/widgets-table.spec.ts ||
  fail "e2e/widgets-table.spec.ts does not appear to force states via MSW overrides"
grep -q "__msw\|addInitScript" e2e/widget-form.spec.ts ||
  fail "e2e/widget-form.spec.ts does not appear to force states via MSW overrides"

echo "check-phase-4: PASS"
