#!/usr/bin/env bash
# Exit criteria for Phase 13 — Storybook Controls/Autodocs Polish
# (docs/BUILD-PLAN.md). Chains onto check-phase-9.sh: kitchen-sink stays
# retired and the base Storybook config/stories still exist — this phase
# only changes what's inside the 12 stories that replaced it.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-13: $1" >&2; exit 1; }

echo "check-phase-13: chaining onto check-phase-9.sh"
scripts/check-phase-9.sh || fail "check-phase-9.sh failed"

echo "check-phase-13: npm run verify (lint, tsc, vitest, Playwright incl. storybook-visual.spec.ts)"
npm run verify || fail "npm run verify failed"

echo "check-phase-13: every story declares argTypes (a story with zero controls was not rewritten)"
for name in button badge card input sidebar sheet tooltip separator skeleton spinner empty sonner; do
  f="src/components/ui/$name.stories.tsx"
  [ -f "$f" ] || fail "$f missing"
  grep -q "argTypes" "$f" || fail "$f has no argTypes — was it rewritten for Controls?"
done

echo "check-phase-13: @storybook/addon-docs is registered and allowlisted"
grep -q "@storybook/addon-docs" .storybook/main.ts || fail ".storybook/main.ts does not register @storybook/addon-docs"
grep -q "@storybook/addon-docs" deps-allowlist.json || fail "@storybook/addon-docs missing from deps-allowlist.json"
grep -q "@storybook/addon-docs" package.json || fail "@storybook/addon-docs missing from package.json"

echo "check-phase-13: storybook build succeeds and produces a Docs page"
npx storybook build -o storybook-static-check-phase-13 --quiet || fail "storybook build failed"
[ -f storybook-static-check-phase-13/index.json ] || fail "storybook build output has no index.json"
node -e "
  const idx = require('./storybook-static-check-phase-13/index.json');
  const hasDocs = Object.values(idx.entries).some((e) => e.type === 'docs');
  if (!hasDocs) { console.error('no entry of type \"docs\" in index.json'); process.exit(1); }
" || fail "storybook build produced no Docs entry for any primitive"
rm -rf storybook-static-check-phase-13

echo "check-phase-13: PASS"
