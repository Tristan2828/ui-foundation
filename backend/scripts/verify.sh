#!/usr/bin/env bash
# Backend verify gate (Phase 8 item 7): mypy is the compiler-equivalent
# check; pytest exercises app wiring against SQLite (see tests/conftest.py
# for why, and its limits — it does not replace the Postgres-backed run in
# scripts/check-phase-8.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

PY=".venv/Scripts/python"
if [ ! -x "$PY" ]; then PY=".venv/bin/python"; fi
if [ ! -x "$PY" ]; then PY="$(command -v python)"; fi

"$PY" -m mypy app scripts/check_spec_conformance.py scripts/set_password.py
"$PY" -m pytest -q
"$PY" scripts/check_spec_conformance.py

echo "backend verify: PASS"
