#!/usr/bin/env bash
# Exit criteria for Phase 6 — Registry.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-6: $1" >&2; exit 1; }

# Cumulative: Phase 6 must not have broken Phases 1-5 (also runs `npm run
# verify`, transitively via check-phase-1.sh).
scripts/check-phase-5.sh

REPO="Tristan2828/ui-foundation"

[ -f docs/add-an-entity.md ] || fail "docs/add-an-entity.md missing"
[ -f .claude/skills/new-entity/SKILL.md ] || fail ".claude/skills/new-entity/SKILL.md missing"
grep -q "^name: new-entity" .claude/skills/new-entity/SKILL.md ||
  fail "new-entity SKILL.md frontmatter missing 'name'"
grep -q "^description:" .claude/skills/new-entity/SKILL.md ||
  fail "new-entity SKILL.md frontmatter missing 'description'"

# Scope ceiling: exactly three registry items (docs/BUILD-PLAN.md Scope
# Ceiling), not counted by eye.
[ -f registry.json ] || fail "registry.json missing"
ITEM_COUNT=$(node -p "String(require('./registry.json').items.length)")
[ "$ITEM_COUNT" = "3" ] ||
  fail "registry.json must expose exactly 3 items (conventions, theme, starter); found $ITEM_COUNT"
for item in conventions theme starter; do
  node -e "if (!require('./registry.json').items.some(i => i.name === '$item')) process.exit(1)" ||
    fail "registry.json has no '$item' item"
done

echo "check-phase-6: validating registry.json structurally"
npx --yes shadcn@4.21.0 registry validate registry.json || fail "registry validate (local file) failed"

# The remaining checks validate the *published* registry, not the working
# tree — HEAD must already be tagged and pushed. Tagging v1.0.0 is this
# phase's own step 7; do it, push (commits + tag), then run this script.
TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || true)
[ -n "$TAG" ] ||
  fail "HEAD is not tagged. Tag v1.0.0 and push before running this check (commit + tag)."

git ls-remote --tags origin "refs/tags/$TAG" | grep -q "$TAG" ||
  fail "tag $TAG exists locally but was not found on origin — push it first: git push origin $TAG"

echo "check-phase-6: validating $REPO#$TAG on GitHub"
npx --yes shadcn@4.21.0 registry validate "$REPO#$TAG" || fail "registry validate ($REPO#$TAG) failed"

echo "check-phase-6: consume-test.sh --install-only $TAG"
scripts/consume-test.sh --install-only "$TAG" || fail "consume-test.sh --install-only failed"

echo "check-phase-6: PASS"
