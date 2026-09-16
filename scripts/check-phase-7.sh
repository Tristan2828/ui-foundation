#!/usr/bin/env bash
# Exit criteria for Phase 7 — Dogfood. This is the project's definition of
# done (docs/BUILD-PLAN.md Scope Ceiling): a fresh agent with no memory of
# this repo builds a new entity screen entirely from the published
# registry, with zero edits to the foundation, and `npm run verify` passes
# in the result.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-7: $1" >&2; exit 1; }

# Cumulative: Phase 7 must not have broken Phases 1-6 (also runs `npm run
# verify` and re-validates the published registry, transitively).
scripts/check-phase-6.sh

TAG=$(git describe --tags --exact-match HEAD 2>/dev/null || true)
[ -n "$TAG" ] ||
  fail "HEAD is not tagged. Tag the foundation fix (v1.1.0) and push before running this check."

git ls-remote --tags origin "refs/tags/$TAG" | grep -q "$TAG" ||
  fail "tag $TAG exists locally but was not found on origin — push it first: git push origin $TAG"

ENTITY="${CHECK_PHASE_7_ENTITY:-Invoice}"
echo "check-phase-7: consume-test.sh $TAG $ENTITY (fresh-agent dogfood run against the published tag)"
scripts/consume-test.sh "$TAG" "$ENTITY" || fail "consume-test.sh dogfood run failed — see logs/consume-test/"

echo "check-phase-7: PASS"
