#!/usr/bin/env bash
# Exit criteria for Phase 8 — Backend (optional; docs/BUILD-PLAN.md). Four
# assertions, in order: Phases 1-5 (verify, tokens) still pass; nothing
# the registry ships has changed since v1.1.0 (Phase 8 adds backend/ and
# local-only frontend config — it does not touch the registry, so this is
# the honest cumulative check, not check-phase-6/7.sh's "HEAD must be a
# freshly-tagged commit" + a full fresh-agent dogfood rebuild, which
# proves nothing new for a phase that ships no registry change); the
# backend's own gate (mypy, pytest, spec conformance — no database needed
# for any of these, see backend/scripts/verify.sh); the gateway/transport
# boundary is untouched since v1.1.0 ("if the gateway needed changes, the
# contract was wrong"); and a real Postgres-backed run of the app end to
# end.
#
# The last assertion needs Docker Desktop running locally — it is not
# part of `npm run verify` or CI (see docs/phases/phase-8.md for why: the
# existing widgets-table/widget-form Playwright specs force loading/empty/
# error/validation states through MSW overrides that do not exist when
# VITE_API=real, so only the MSW-independent specs — shell, smoke — run
# here; this is a deliberate scope decision, not a gap).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

fail() { echo "check-phase-8: $1" >&2; exit 1; }

# Cumulative: Phase 8 must not have broken Phases 1-5.
scripts/check-phase-5.sh

echo "check-phase-8: registry-shipped paths unchanged since v1.1.0"
git diff --exit-code v1.1.0 -- registry.json docs/add-an-entity.md .claude .codex src config ||
  fail "a registry-shipped path changed since v1.1.0 — if Phase 8 needed to touch the registry, re-run check-phase-6.sh/7.sh (tag, validate, dogfood) instead of this shortcut"

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
# `exec` replaces the subshell with uvicorn itself, so $! is uvicorn's own
# PID — without it, $! is the subshell wrapping it, and killing that can
# leave uvicorn running as an orphan.
(cd backend && exec "../$PY" -m uvicorn app.main:app --port 8000 >"$REPO_ROOT/logs/phase-8-uvicorn.log" 2>&1) &
UVICORN_PID=$!
for i in $(seq 1 30); do
  # /api/categories now requires auth (Phase 10) — 401 still proves uvicorn
  # is up and enforcing the contract; `curl -f` alone would treat that 401
  # as "not ready yet" and this loop would never break.
  status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/categories 2>/dev/null || echo "000")
  { [ "$status" = "200" ] || [ "$status" = "401" ]; } && break
  [ "$i" -eq 30 ] && fail "backend did not respond on :8000 within 30s — see logs/phase-8-uvicorn.log"
  sleep 1
done

echo "check-phase-8: unauthenticated request is rejected (Phase 10)"
unauth_status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/widgets)
[ "$unauth_status" = "401" ] || fail "GET /api/widgets with no session cookie returned $unauth_status, expected 401"

echo "check-phase-8: VITE_API=real npx playwright test (MSW-independent specs only)"
VITE_API=real npx playwright test e2e/shell.spec.ts e2e/smoke.spec.ts ||
  fail "Playwright failed against the real backend"

echo "check-phase-8: PASS"
