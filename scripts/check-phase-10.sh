#!/usr/bin/env bash
# Exit criteria for Phase 10 — Real Auth (docs/BUILD-PLAN.md). Session-cookie
# auth against a seeded user, zero new dependency. Deliberately thin: rather
# than re-implementing check-phase-8.sh's Docker/Postgres/uvicorn lifecycle
# to prove the real backend enforces auth, this chains onto it (same
# "cumulative, don't re-run the expensive thing twice" pattern check-phase-8
# itself used for check-phase-5) — it already runs backend/scripts/verify.sh
# (mypy, pytest incl. test_auth.py, spec conformance) and, as of this phase,
# asserts an unauthenticated GET /api/widgets returns 401 against a real
# Postgres-backed server.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { echo "check-phase-10: $1" >&2; exit 1; }

echo "check-phase-10: npm run verify (lint, tsc, vitest, Playwright incl. e2e/auth.spec.ts, against MSW)"
npm run verify || fail "npm run verify failed"

echo "check-phase-10: chaining onto check-phase-8.sh for the real-backend proof"
scripts/check-phase-8.sh || fail "check-phase-8.sh failed"

echo "check-phase-10: PASS"
