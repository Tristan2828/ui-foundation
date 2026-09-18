#!/usr/bin/env bash
# Exit criteria for Phase 8 — Backend (optional; docs/BUILD-PLAN.md). Three
# assertions, in order: Phases 1-5 (verify, tokens) still pass; the
# backend's own gate (mypy, pytest, spec conformance — no database needed
# for any of these, see backend/scripts/verify.sh); and a real
# Postgres-backed run of the app end to end.
#
# Originally had two more (registry-shipped paths and src/api/gateway/
# transport unchanged since v1.1.0), proving Phase 8 itself introduced no
# registry or ACL change. Both were one-time claims about Phase 8's own
# diff, already recorded in docs/phases/phase-8.md — not standing
# regression tests. Retired in Phase 10, which legitimately changes both
# (a new auth gateway file, registry-shipped auth UI) — kept, they would
# fail forever on every commit after Phase 10, the same reason Phase 9
# rewrote check-phase-3.sh/check-phase-5.sh's kitchen-sink assertions
# instead of leaving them permanently red.
#
# The Postgres assertion needs Docker Desktop running locally — it is not
# part of `npm run verify` or CI (see docs/phases/phase-8.md for why: the
# existing widgets-table/widget-form Playwright specs force loading/empty/
# error/validation states through MSW overrides that do not exist when
# VITE_API=real, so only the MSW-independent specs — shell, smoke — run
# here; this is a deliberate scope decision, not a gap).
#
# Phase 11 (self-service registration) added two more assertions to this
# same live-server section, the same way Phase 10 added the unauthenticated-
# 401 check below — check-phase-11.sh chains onto this script rather than
# re-running the Docker/Postgres/uvicorn lifecycle a second time.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

fail() { echo "check-phase-8: $1" >&2; exit 1; }

# Always the throwaway docker-compose.yml Postgres, never whatever
# backend/.env points at (Supabase by default) — this script registers test
# users and runs migrations, which shouldn't land in a real database.
# python-dotenv doesn't override variables already set, so these win.
export DATABASE_URL="postgresql+asyncpg://ui_foundation:ui_foundation@localhost:5432/ui_foundation"
export DATABASE_SSL=false
unset DATABASE_SSL_CA_FILE

# Cumulative: Phase 8 must not have broken Phases 1-5.
scripts/check-phase-5.sh

echo "check-phase-8: backend verify (mypy, pytest, spec conformance)"
bash backend/scripts/verify.sh || fail "backend/scripts/verify.sh failed"

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

echo "check-phase-8: registering a duplicate email is a 422 field error, not a 409 (Phase 11)"
DUP_BODY=$(mktemp)
dup_status=$(curl -s -o "$DUP_BODY" -w '%{http_code}' -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","name":"Someone Else","password":"a-strong-password"}')
[ "$dup_status" = "422" ] || fail "registering dev@example.com again returned $dup_status, expected 422 — got: $(cat "$DUP_BODY")"
grep -q '"email"' "$DUP_BODY" || fail "duplicate-email 422 body has no field error naming 'email': $(cat "$DUP_BODY")"
rm -f "$DUP_BODY"

echo "check-phase-8: a fresh registration can call an authenticated endpoint immediately, no separate login (Phase 11)"
COOKIE_JAR=$(mktemp)
# A unique email per run — Postgres data persists across invocations (no
# reset between runs, unlike the SQLite pytest fixture), so a fixed address
# would 422 as "already registered" on the second run of this script.
FRESH_EMAIL="check-phase-8-register-$(date +%s)-$$@example.com"
register_status=$(curl -s -c "$COOKIE_JAR" -o /dev/null -w '%{http_code}' -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$FRESH_EMAIL\",\"name\":\"Check Phase 8\",\"password\":\"a-strong-password\"}")
[ "$register_status" = "200" ] || fail "fresh registration returned $register_status, expected 200"
WIDGETS_BODY=$(mktemp)
widgets_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGETS_BODY" -w '%{http_code}' http://localhost:8000/api/widgets)
[ "$widgets_status" = "200" ] || fail "GET /api/widgets with a freshly-registered session returned $widgets_status, expected 200 — auto-login is broken"

echo "check-phase-8: a fresh registration sees none of the seeded user's widgets (per-user ownership, migration 0003)"
grep -q '"total":0' "$WIDGETS_BODY" || fail "freshly-registered user can see other users' widgets: $(cat "$WIDGETS_BODY")"
seed_widget_status=$(curl -s -b "$COOKIE_JAR" -o /dev/null -w '%{http_code}' http://localhost:8000/api/widgets/1)
[ "$seed_widget_status" = "404" ] || fail "GET /api/widgets/1 (the seeded user's widget) as a fresh user returned $seed_widget_status, expected 404"
rm -f "$COOKIE_JAR" "$WIDGETS_BODY"

echo "check-phase-8: VITE_API=real npx playwright test (MSW-independent specs only)"
VITE_API=real npx playwright test e2e/shell.spec.ts e2e/smoke.spec.ts ||
  fail "Playwright failed against the real backend"

echo "check-phase-8: PASS"
