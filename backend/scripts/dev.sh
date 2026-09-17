#!/usr/bin/env bash
# One-command backend dev startup: Postgres (Docker), venv, migrations,
# then the API server in the foreground. Replaces the five manual steps
# in the README's Backend section with one. Run from anywhere; paths are
# resolved relative to this script.
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose -f ../docker-compose.yml up -d --wait

if [ ! -d .venv ]; then
  python -m venv .venv
fi

PY=".venv/Scripts/python"
if [ ! -x "$PY" ]; then PY=".venv/bin/python"; fi

"$PY" -m pip install -e ".[dev]" -q
"$PY" -m alembic upgrade head

echo "backend/scripts/dev.sh: http://localhost:8000 (Ctrl+C to stop; Postgres keeps running via Docker)"
exec "$PY" -m uvicorn app.main:app --reload
