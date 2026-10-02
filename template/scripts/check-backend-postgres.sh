#!/usr/bin/env bash
# The backend against a real Postgres (the docker-compose.yml one), end to
# end: `npm run verify`, the backend's own gate (mypy, pytest, spec
# conformance — backend/scripts/verify.sh), then a live server exercised
# with curl (auth, per-user ownership, widget create/update) and the
# MSW-independent Playwright specs with VITE_API=real.
#
# Not part of CI: needs Docker running locally. pytest runs on SQLite,
# which can't see Postgres-only behavior (timezone-aware columns, enums,
# asyncpg parameter binding) — every bug of that class this repo has had
# was only caught here. Run it for any backend change.
#
# Only shell.spec, smoke.spec and the mock-mode banner suite run against
# the real backend: the other specs force loading/empty/error states through MSW
# overrides that don't exist with VITE_API=real (a deliberate scope
# decision). The banner suite flips there: it asserts no banner, which is
# what catches a mock bundle shipped as the real one.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

fail() { echo "check-backend-postgres: $1" >&2; exit 1; }

# Always the throwaway docker-compose.yml Postgres, never whatever
# backend/.env points at (possibly a cloud database like Supabase) — this script registers test
# users and runs migrations, which shouldn't land in a real database.
# python-dotenv doesn't override variables already set, so these win.
export DATABASE_URL="postgresql+asyncpg://ui_foundation:ui_foundation@localhost:5432/ui_foundation"
export DATABASE_SSL=false
unset DATABASE_SSL_CA_FILE

echo "check-backend-postgres: npm run verify"
npm run verify || fail "npm run verify failed"

echo "check-backend-postgres: backend verify (mypy, pytest, spec conformance)"
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

echo "check-backend-postgres: starting Postgres (docker compose)"
docker compose up -d postgres
for i in $(seq 1 30); do
  docker compose ps postgres --format '{{.Health}}' | grep -q healthy && break
  [ "$i" -eq 30 ] && fail "postgres did not become healthy within 60s"
  sleep 2
done

echo "check-backend-postgres: alembic upgrade head"
(cd backend && "../$PY" -m alembic upgrade head) || fail "alembic upgrade head failed"

echo "check-backend-postgres: every table and column has a COMMENT ON (AGENTS.md Hard Rules)"
(cd backend && "../$PY" scripts/check_db_comments.py) || fail "a table or column has no comment"

echo "check-backend-postgres: starting uvicorn on :8000"
mkdir -p logs # gitignored, so absent in a fresh clone
# `exec` replaces the subshell with uvicorn itself, so $! is uvicorn's own
# PID — without it, $! is the subshell wrapping it, and killing that can
# leave uvicorn running as an orphan.
(cd backend && exec "../$PY" -m uvicorn app.main:app --port 8000 >"$REPO_ROOT/logs/backend-postgres-uvicorn.log" 2>&1) &
UVICORN_PID=$!
for i in $(seq 1 30); do
  # /api/categories now requires auth (Phase 10) — 401 still proves uvicorn
  # is up and enforcing the contract; `curl -f` alone would treat that 401
  # as "not ready yet" and this loop would never break.
  status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/categories 2>/dev/null || echo "000")
  { [ "$status" = "200" ] || [ "$status" = "401" ]; } && break
  [ "$i" -eq 30 ] && fail "backend did not respond on :8000 within 30s — see logs/backend-postgres-uvicorn.log"
  sleep 1
done

echo "check-backend-postgres: unauthenticated request is rejected (Phase 10)"
unauth_status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/widgets)
[ "$unauth_status" = "401" ] || fail "GET /api/widgets with no session cookie returned $unauth_status, expected 401"

echo "check-backend-postgres: registering a duplicate email is a 422 field error, not a 409 (Phase 11)"
DUP_BODY=$(mktemp)
dup_status=$(curl -s -o "$DUP_BODY" -w '%{http_code}' -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@example.com","name":"Someone Else","password":"a-strong-password"}')
[ "$dup_status" = "422" ] || fail "registering dev@example.com again returned $dup_status, expected 422 — got: $(cat "$DUP_BODY")"
grep -q '"email"' "$DUP_BODY" || fail "duplicate-email 422 body has no field error naming 'email': $(cat "$DUP_BODY")"
rm -f "$DUP_BODY"

echo "check-backend-postgres: a fresh registration can call an authenticated endpoint immediately, no separate login (Phase 11)"
COOKIE_JAR=$(mktemp)
# A unique email per run — Postgres data persists across invocations (no
# reset between runs, unlike the SQLite pytest fixture), so a fixed address
# would 422 as "already registered" on the second run of this script.
FRESH_EMAIL="check-backend-postgres-$(date +%s)-$$@example.com"
register_status=$(curl -s -c "$COOKIE_JAR" -o /dev/null -w '%{http_code}' -X POST http://localhost:8000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$FRESH_EMAIL\",\"name\":\"Check Phase 8\",\"password\":\"a-strong-password\"}")
[ "$register_status" = "200" ] || fail "fresh registration returned $register_status, expected 200"
WIDGETS_BODY=$(mktemp)
widgets_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGETS_BODY" -w '%{http_code}' http://localhost:8000/api/widgets)
[ "$widgets_status" = "200" ] || fail "GET /api/widgets with a freshly-registered session returned $widgets_status, expected 200 — auto-login is broken"

echo "check-backend-postgres: a fresh registration sees none of the seeded user's widgets (per-user ownership, migration 0003)"
grep -q '"total":0' "$WIDGETS_BODY" || fail "freshly-registered user can see other users' widgets: $(cat "$WIDGETS_BODY")"
seed_widget_status=$(curl -s -b "$COOKIE_JAR" -o /dev/null -w '%{http_code}' http://localhost:8000/api/widgets/1)
[ "$seed_widget_status" = "404" ] || fail "GET /api/widgets/1 (the seeded user's widget) as a fresh user returned $seed_widget_status, expected 404"

# Every check above only *reads* widgets, and pytest runs on SQLite, which
# ignores column timezone-awareness — so nothing had ever written a
# timestamp column through the ORM against real Postgres. That's how
# Phase 10's Session.expires_at bug (tz-naive ORM mapping vs. a tz-aware
# column) hid until a real login; Widget.available_from is the same class.
echo "check-backend-postgres: create and update a widget against real Postgres (audit Phase C)"
WIDGET_BODY=$(mktemp)
create_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' -X POST http://localhost:8000/api/widgets \
  -H 'Content-Type: application/json' \
  -d '{"name":"Phase C widget","categoryId":1,"status":"draft","availableFrom":"2026-09-18T00:00:00Z","price":"12.50","description":"written by check-backend-postgres","tags":["seasonal","fragile"]}')
[ "$create_status" = "201" ] || fail "POST /api/widgets returned $create_status, expected 201 — got: $(cat "$WIDGET_BODY") (see logs/backend-postgres-uvicorn.log)"
widget_id=$(node -p "String(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).id)" "$WIDGET_BODY")
update_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' -X PATCH "http://localhost:8000/api/widgets/$widget_id" \
  -H 'Content-Type: application/json' \
  -d '{"availableFrom":"2026-10-01T12:30:00Z"}')
[ "$update_status" = "200" ] || fail "PATCH /api/widgets/$widget_id returned $update_status, expected 200 — got: $(cat "$WIDGET_BODY")"
grep -q '"availableFrom":"2026-10-01T12:30:00' "$WIDGET_BODY" || fail "PATCH didn't round-trip availableFrom: $(cat "$WIDGET_BODY")"

# Tags (Phase G): a Postgres enum through a join table — the same bug class
# as 0001's enum and Phase C's datetime, invisible to SQLite-backed pytest.
echo "check-backend-postgres: tags create, replace and any-of filter against real Postgres (Phase G)"
tags_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' -X PATCH "http://localhost:8000/api/widgets/$widget_id"   -H 'Content-Type: application/json' -d '{"tags":["featured","bulky"]}')
[ "$tags_status" = "200" ] || fail "PATCH tags returned $tags_status — got: $(cat "$WIDGET_BODY")"
grep -q '"tags":\["bulky","featured"\]' "$WIDGET_BODY" || fail "PATCH didn't replace tags (expected [bulky, featured] in display order): $(cat "$WIDGET_BODY")"
filter_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' "http://localhost:8000/api/widgets?tags=featured&tags=fragile")
[ "$filter_status" = "200" ] || fail "GET /api/widgets?tags=... returned $filter_status — got: $(cat "$WIDGET_BODY")"
grep -q "\"id\":$widget_id," "$WIDGET_BODY" || fail "tags filter didn't return widget $widget_id: $(cat "$WIDGET_BODY")"
none_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' "http://localhost:8000/api/widgets?tags=fragile")
grep -q '"total":0' "$WIDGET_BODY" || fail "tags=fragile should match nothing after the replace (status $none_status): $(cat "$WIDGET_BODY")"

# inStock (3.4.0): migration 0006's server default, a PATCH and the filter,
# against the real column type rather than SQLite's integer-backed boolean.
echo "check-backend-postgres: inStock default, update and filter against real Postgres (3.4.0)"
seed_stock_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' "http://localhost:8000/api/widgets/$widget_id")
[ "$seed_stock_status" = "200" ] || fail "GET widget $widget_id returned $seed_stock_status"
grep -q '"inStock":true' "$WIDGET_BODY" || fail "a widget created without inStock should be in stock: $(cat "$WIDGET_BODY")"
stock_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' -X PATCH "http://localhost:8000/api/widgets/$widget_id" -H 'Content-Type: application/json' -d '{"inStock":false}')
[ "$stock_status" = "200" ] || fail "PATCH inStock returned $stock_status — got: $(cat "$WIDGET_BODY")"
grep -q '"inStock":false' "$WIDGET_BODY" || fail "PATCH didn't set inStock to false: $(cat "$WIDGET_BODY")"
curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" "http://localhost:8000/api/widgets?inStock=false"
grep -q "\"id\":$widget_id," "$WIDGET_BODY" || fail "inStock=false filter didn't return widget $widget_id: $(cat "$WIDGET_BODY")"
curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" "http://localhost:8000/api/widgets?inStock=true"
grep -q '"total":0' "$WIDGET_BODY" || fail "inStock=true should match nothing for this user now: $(cat "$WIDGET_BODY")"

# extraCategoryIds (3.5.0): a join table with two foreign keys (migration
# 0007), the any-of filter, an unknown id as a 422 rather than a
# foreign-key 500, and GET /categories?ids=... for naming them.
echo "check-backend-postgres: extraCategoryIds links, filter, unknown id and categories?ids against real Postgres (3.5.0)"
links_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' -X PATCH "http://localhost:8000/api/widgets/$widget_id" -H 'Content-Type: application/json' -d '{"extraCategoryIds":[3,2]}')
[ "$links_status" = "200" ] || fail "PATCH extraCategoryIds returned $links_status — got: $(cat "$WIDGET_BODY")"
grep -q '"extraCategoryIds":\[2,3\]' "$WIDGET_BODY" || fail "PATCH didn't store extraCategoryIds [2,3] (ascending): $(cat "$WIDGET_BODY")"
curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" "http://localhost:8000/api/widgets?extraCategoryIds=3"
grep -q "\"id\":$widget_id," "$WIDGET_BODY" || fail "extraCategoryIds=3 filter didn't return widget $widget_id: $(cat "$WIDGET_BODY")"
unknown_status=$(curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" -w '%{http_code}' -X PATCH "http://localhost:8000/api/widgets/$widget_id" -H 'Content-Type: application/json' -d '{"extraCategoryIds":[9999]}')
[ "$unknown_status" = "422" ] || fail "an unknown extraCategoryIds id returned $unknown_status, expected 422: $(cat "$WIDGET_BODY")"
curl -s -b "$COOKIE_JAR" -o "$WIDGET_BODY" "http://localhost:8000/api/categories?ids=3&ids=9999"
grep -q '"id":3' "$WIDGET_BODY" && ! grep -q '"id":1,' "$WIDGET_BODY" || fail "categories?ids=3 should return only category 3: $(cat "$WIDGET_BODY")"
rm -f "$COOKIE_JAR" "$WIDGETS_BODY" "$WIDGET_BODY"

echo "check-backend-postgres: VITE_API=real npx playwright test (MSW-independent specs only)"
VITE_API=real npx playwright test e2e/shell.spec.ts e2e/smoke.spec.ts e2e/mock-mode-banner.spec.ts ||
  fail "Playwright failed against the real backend"

echo "check-backend-postgres: PASS"
