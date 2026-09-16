#!/usr/bin/env bash
# Exit criteria for Phase 8 — Backend (optional; docs/BUILD-PLAN.md). Three
# assertions, in order: the backend's own gate (mypy, pytest, spec
# conformance — no database needed for any of these, see
# backend/scripts/verify.sh), the gateway/transport boundary is untouched
# since v1.1.0 ("if the gateway needed changes, the contract was wrong"),
# and a real Postgres-backed run of the app end to end.
#
# The third assertion needs Docker Desktop running locally — it is not
# part of `npm run verify` or CI (see docs/phases/phase-8.md for why: the
# existing widgets-table/widget-form Playwright specs force loading/empty/
# error/validation states through MSW overrides that do not exist when
# VITE_API=real, so only the MSW-independent specs — shell, smoke — run
# here; this is a deliberate scope decision, not a gap).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

fail() { echo "check-phase-8: $1" >&2; exit 1; }

# Cumulative: Phase 8 must not have broken Phases 1-7.
scripts/check-phase-7.sh

echo "check-phase-8: backend verify (mypy, pytest, spec conformance)"
bash backend/scripts/verify.sh || fail "backend/scripts/verify.sh failed"

echo "check-phase-8: gateway/transport diff against v1.1.0"
git diff --exit-code v1.1.0 -- src/api/gateway src/api/transport ||
  fail "src/api/gateway or src/api/transport changed since v1.1.0 — if the gateway needed changes, the contract was wrong"

command -v docker >/dev/null 2>&1 ||
  fail "Docker is required for the Postgres-backed run and is not installed — see docs/BLOCKERS.md"
docker compose version >/dev/null 2>&1 ||
  fail "'docker compose' is required and is not available — see docs/BLOCKERS.md"

PY="backend/.venv/Scripts/python"
[ -x "$PY" ] || PY="backend/.venv/bin/python"
[ -x "$PY" ] || fail "backend/.venv not found — run: cd backend && python -m venv .venv && .venv/*/pip install -e '.[dev]'"

UVICORN_PID=""
cleanup() {
  [ -n "$UVICORN_PID" ] && kill "$UVICORN_PID" 2>/dev/null || true
  docker compose down >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "check-phase-8: starting Postgres (docker compose)"
docker compose up -d postgres
for i in $(seq 1 30); do
  docker compose ps postgres --format '{{.Health}}' | grep -q healthy && break
  [ "$i" -eq 30 ] && fail "postgres did not become healthy within 60s"
  sleep 2
done

echo "check-phase-8: alembic upgrade head"
(cd backend && "../$PY" -m alembic upgrade head) || fail "alembic upgrade head failed"

echo "check-phase-8: starting uvicorn on :8000"
(cd backend && "../$PY" -m uvicorn app.main:app --port 8000 >"$REPO_ROOT/logs/phase-8-uvicorn.log" 2>&1) &
UVICORN_PID=$!
for i in $(seq 1 30); do
  curl -sf http://localhost:8000/api/categories >/dev/null 2>&1 && break
  [ "$i" -eq 30 ] && fail "backend did not respond on :8000 within 30s — see logs/phase-8-uvicorn.log"
  sleep 1
done

echo "check-phase-8: VITE_API=real npx playwright test (MSW-independent specs only)"
VITE_API=real npx playwright test e2e/shell.spec.ts e2e/smoke.spec.ts ||
  fail "Playwright failed against the real backend"

echo "check-phase-8: PASS"
