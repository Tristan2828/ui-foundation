#!/usr/bin/env bash
# Exit criteria for Phase 9 — Storybook (replaces the kitchen-sink route
# everywhere: dev route, registry.json's `starter` item, the permanent
# Phase 3/5 regression scripts, and consume-test.sh's expected-file list.
# See docs/phases/phase-9.md).
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-9: $1" >&2; exit 1; }

# Cumulative: Phase 9 must not have broken Phases 1-5 — and, since
# check-phase-3.sh/check-phase-5.sh were themselves rewritten to check
# Storybook instead of kitchen-sink, this doubles as the regression check
# on that rewrite: if it silently broke either script's own logic (e.g. a
# typo'd path), this fails here rather than shipping unnoticed.
scripts/check-phase-5.sh

echo "check-phase-9: kitchen-sink is fully retired"
[ -f src/routes/kitchen-sink.tsx ] && fail "src/routes/kitchen-sink.tsx still exists"
grep -q "kitchen-sink" registry.json && fail "registry.json still references kitchen-sink.tsx" || true
grep -rq "KitchenSinkRoute\|kitchen-sink" src/App.tsx src/components/app/app-shell.tsx &&
  fail "App.tsx or app-shell.tsx still references kitchen-sink" || true

echo "check-phase-9: Storybook config and stories exist"
[ -f .storybook/main.ts ] || fail ".storybook/main.ts missing"
[ -f .storybook/preview.ts ] || fail ".storybook/preview.ts missing"
for name in button badge card input sidebar sheet tooltip separator skeleton spinner empty; do
  [ -f "src/components/ui/$name.stories.tsx" ] || fail "src/components/ui/$name.stories.tsx missing"
done
[ -f src/components/ui/sonner.stories.tsx ] || fail "src/components/ui/sonner.stories.tsx missing (toast)"

echo "check-phase-9: registry.json ships the Storybook files and deps"
node -e "
  const r = require('./registry.json');
  const starter = r.items.find(i => i.name === 'starter');
  const paths = starter.files.map(f => f.path);
  const need = ['.storybook/main.ts', '.storybook/preview.ts', 'e2e/storybook-visual.spec.ts'];
  for (const p of need) if (!paths.includes(p)) { console.error('missing from starter.files: ' + p); process.exit(1); }
  for (const dep of ['storybook', '@storybook/react-vite']) {
    if (!starter.devDependencies.includes(dep)) { console.error('missing from starter.devDependencies: ' + dep); process.exit(1); }
  }
" || fail "registry.json's starter item is missing Storybook files or dependencies"

echo "check-phase-9: registry validates"
npx --yes shadcn@4.21.0 registry validate registry.json || fail "registry validate failed"

echo "check-phase-9: consume-test.sh's expected-file list matches"
grep -q "storybook-visual.spec.ts" scripts/consume-test.sh || fail "consume-test.sh does not expect e2e/storybook-visual.spec.ts"
grep -q ".storybook/main.ts" scripts/consume-test.sh || fail "consume-test.sh does not expect .storybook/main.ts"
grep -q "kitchen-sink" scripts/consume-test.sh && fail "consume-test.sh still references kitchen-sink.tsx" || true

echo "check-phase-9: dark-mode baselines committed"
SNAPSHOT_DIR="e2e/storybook-visual.spec.ts-snapshots"
[ -d "$SNAPSHOT_DIR" ] || fail "$SNAPSHOT_DIR missing — dark-mode baselines were never generated"
SNAPSHOT_COUNT=$(find "$SNAPSHOT_DIR" -name '*.png' | wc -l | tr -d ' ')
[ "$SNAPSHOT_COUNT" -ge 12 ] || fail "expected at least 12 committed dark-mode baselines, found $SNAPSHOT_COUNT"
for f in "$SNAPSHOT_DIR"/*.png; do
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 || fail "$f exists on disk but is not committed"
done

echo "check-phase-9: PASS"
