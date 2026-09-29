#!/usr/bin/env bash
# One-command backend dev startup: venv, migrations, then the API server in
# the foreground. Replaces the manual steps in the README's Backend section
# with one. Run from anywhere; paths are resolved relative to this script.
#
# The database is whatever DATABASE_URL (backend/.env) points at — the local
# Docker Compose Postgres by default, which this starts for you. Point it at
# a hosted database (Supabase is the cloud choice, docs/cloud-postgres.md)
# and Docker is skipped; --local forces the local one regardless of .env.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--local" ]; then
  export DATABASE_URL="postgresql+asyncpg://ui_foundation:ui_foundation@localhost:5432/ui_foundation"
  export DATABASE_SSL=false
fi

if [ ! -d .venv ]; then
  python -m venv .venv
fi

PY=".venv/Scripts/python"
if [ ! -x "$PY" ]; then PY=".venv/bin/python"; fi

"$PY" -m pip install -e ".[dev]" -q

DB_HOST=$("$PY" -c "from sqlalchemy.engine import make_url; from app.config import DATABASE_URL; print(make_url(DATABASE_URL).host or '')")
case "$DB_HOST" in
  localhost|127.0.0.1|"")
    echo "backend/scripts/dev.sh: DATABASE_URL is local — starting Docker Compose Postgres"
    docker compose -f ../docker-compose.yml up -d --wait
    ;;
  *)
    echo "backend/scripts/dev.sh: using hosted Postgres at $DB_HOST"
    ;;
esac

"$PY" -m alembic upgrade head

echo "backend/scripts/dev.sh: http://localhost:8000 (Ctrl+C to stop)"
exec "$PY" -m uvicorn app.main:app --reload
