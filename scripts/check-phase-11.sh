#!/usr/bin/env bash
# Exit criteria for Phase 11 — Self-Service Registration (docs/BUILD-PLAN.md).
# Deliberately thin, same shape check-phase-10.sh used for the same reason:
# rather than re-implementing check-phase-8.sh's Docker/Postgres/uvicorn
# lifecycle to prove registration works against a real backend, this chains
# onto it — check-phase-8.sh itself now runs the two Phase 11 assertions
# (duplicate email -> 422 with a populated fieldErrors.email; a fresh
# registration can call an authenticated endpoint with no separate login)
# in its live-server section, right after Phase 10's unauthenticated-401
# check.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-11: $1" >&2; exit 1; }

echo "check-phase-11: npm run verify (lint, tsc, vitest incl. gateway/mock-conformance register tests, Playwright incl. e2e/register.spec.ts, against MSW)"
npm run verify || fail "npm run verify failed"

echo "check-phase-11: chaining onto check-phase-8.sh for the real-backend registration proof"
scripts/check-phase-8.sh || fail "check-phase-8.sh failed"

echo "check-phase-11: PASS"
