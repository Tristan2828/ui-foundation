#!/usr/bin/env bash
# The package's gate: mypy strict over the package (as the template's gate
# checks app/, not its tests), then pytest (SQLite). Root
# `npm run verify:backend` runs this, then the template's
# backend/scripts/verify.sh.
#
# Python: the repo's one backend venv, template/backend/.venv, where both
# are installed editable in one pip call (README.md "In this repo"), else
# this folder's own .venv, else whatever `python` is.
set -euo pipefail
cd "$(dirname "$0")/.."

PY=""
for candidate in ../../template/backend/.venv/Scripts/python ../../template/backend/.venv/bin/python \
  .venv/Scripts/python .venv/bin/python; do
  if [ -x "$candidate" ]; then PY="$candidate"; break; fi
done
[ -n "$PY" ] || PY="$(command -v python)"

"$PY" -m mypy src
"$PY" -m pytest -q

echo "backend-foundation verify: PASS"
