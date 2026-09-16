#!/usr/bin/env bash
# Exit criteria for Phase 1 — Scaffold and Tokens.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-1: $1" >&2; exit 1; }

[ -f package.json ] || fail "package.json missing — run npm create vite first (Phase 1 step 1)"

npm run verify || fail "npm run verify failed"

[ -f src/styles/theme.css ] || fail "src/styles/theme.css missing"
grep -q -- "--primary:" src/styles/theme.css || fail "theme.css has no layer-2 semantic tokens (e.g. --primary)"
grep -q "^.dark {" src/styles/theme.css || fail "theme.css has no dark variant"

FIXTURE="src/__check_phase_1_token_fixture.tsx"
printf 'export const Bad = () => <div className="bg-blue-500" />\n' > "$FIXTURE"
if npx eslint "$FIXTURE" > /tmp/check-phase-1-lint.txt 2>&1; then
  rm -f "$FIXTURE" /tmp/check-phase-1-lint.txt
  fail "token lint rule did not fail on a bg-blue-500 fixture"
fi
rm -f "$FIXTURE" /tmp/check-phase-1-lint.txt

echo "check-phase-1: PASS"
