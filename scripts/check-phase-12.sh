#!/usr/bin/env bash
# Exit criteria for Phase 12 — Cloud Postgres Support (docs/BUILD-PLAN.md).
# Additive, not a replacement: docker-compose.yml stays the default local
# path, proven at the end of this script by chaining onto check-phase-8.sh
# unmodified. This script's own job is proving DATABASE_SSL against a real
# hosted Postgres instance — something no script can provision. The
# developer must set CLOUD_DATABASE_URL to their own instance first, the
# same "a human must actually do this part" shape check-phase-8.sh's Docker
# step has. See docs/cloud-postgres.md.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

fail() { echo "check-phase-12: $1" >&2; exit 1; }

[ -n "${CLOUD_DATABASE_URL:-}" ] ||
  fail "CLOUD_DATABASE_URL is not set — provision a hosted Postgres instance and set it first. See docs/cloud-postgres.md"

# Each cloud-pointed command below runs in its own subshell with these
# exported there, not at this script's top level — check-phase-8.sh runs
# later in this same process to prove the *local* Docker path still works,
# and it must not inherit a DATABASE_URL pointed at the cloud instance.
set_cloud_env() {
  export DATABASE_URL="$CLOUD_DATABASE_URL"
  export DATABASE_SSL=true
  # Optional: a provider-issued CA bundle for verifying the TLS cert
  # (needed on Supabase specifically — see docs/cloud-postgres.md's SSL
  # section). Unset is fine for a provider whose Postgres cert chains to a
  # publicly trusted CA.
  if [ -n "${CLOUD_DATABASE_SSL_CA_FILE:-}" ]; then
    export DATABASE_SSL_CA_FILE="$CLOUD_DATABASE_SSL_CA_FILE"
  fi
}

PY="backend/.venv/Scripts/python"
[ -x "$PY" ] || PY="backend/.venv/bin/python"
[ -x "$PY" ] || fail "backend/.venv not found — run: cd backend && python -m venv .venv && .venv/*/pip install -e '.[dev]'"

echo "check-phase-12: alembic upgrade head against CLOUD_DATABASE_URL"
(set_cloud_env && cd backend && "../$PY" -m alembic upgrade head) ||
  fail "alembic upgrade head against CLOUD_DATABASE_URL failed — if this is a pooled connection string, try the direct-connection port instead; if it's a cert verification error, see docs/cloud-postgres.md's SSL section"

echo "check-phase-12: backend/scripts/verify.sh against CLOUD_DATABASE_URL"
(set_cloud_env && cd backend && bash scripts/verify.sh) ||
  fail "backend/scripts/verify.sh failed against CLOUD_DATABASE_URL"

UVICORN_PID=""
cleanup() { [ -n "$UVICORN_PID" ] && kill "$UVICORN_PID" 2>/dev/null || true; }
trap cleanup EXIT

echo "check-phase-12: starting uvicorn on :8001 against CLOUD_DATABASE_URL"
# Port 8001, not 8000 — check-phase-8.sh runs later in this same script and
# uses :8000 itself; running both at once on the same port would collide.
(set_cloud_env && cd backend && exec "../$PY" -m uvicorn app.main:app --port 8001 >"$REPO_ROOT/logs/phase-12-uvicorn.log" 2>&1) &
UVICORN_PID=$!
for i in $(seq 1 30); do
  # 401 still proves the app is up and enforcing the contract (same reason
  # check-phase-8.sh accepts it) — `curl -f` alone would treat that as
  # "not ready" and this loop would never break.
  status=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/api/categories 2>/dev/null || echo "000")
  { [ "$status" = "200" ] || [ "$status" = "401" ]; } && break
  [ "$i" -eq 30 ] && fail "backend did not respond on :8001 within 30s against CLOUD_DATABASE_URL — see logs/phase-12-uvicorn.log"
  sleep 1
done
kill "$UVICORN_PID" 2>/dev/null || true
UVICORN_PID=""

echo "check-phase-12: confirming the local Docker Compose path still works unmodified"
scripts/check-phase-8.sh || fail "check-phase-8.sh failed — the cloud-Postgres addition must not have broken the local one"

echo "check-phase-12: PASS"
