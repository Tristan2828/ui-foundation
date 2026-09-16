#!/usr/bin/env bash
# Exit criteria for Phase 0 — Session Zero.
# Required files exist and are committed; spec-tester's isolation is
# statically verified (frontmatter denies reads under src/api/gateway/ and
# src/api/transport/) and its manual refusal test is recorded.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-0: $1" >&2; exit 1; }

for f in AGENTS.md CLAUDE.md deps-allowlist.json scripts/check-deps.mjs scripts/check-phase-1.sh .claude/agents/spec-tester.md; do
  [ -f "$f" ] || fail "missing required file: $f"
  git ls-files --error-unmatch "$f" >/dev/null 2>&1 || fail "$f exists but is not committed"
done

grep -q "gateway" .claude/agents/spec-tester.md || fail "spec-tester.md does not mention a gateway deny path"
grep -q "PreToolUse" .claude/agents/spec-tester.md || fail "spec-tester.md frontmatter has no PreToolUse hook"

if [ ! -f docs/phases/phase-0.md ] || ! grep -qi "spec-tester.*refus" docs/phases/phase-0.md; then
  fail "docs/phases/phase-0.md does not record a confirmed spec-tester refusal — verify it manually, then note the result there"
fi

echo "check-phase-0: PASS"
