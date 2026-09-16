#!/usr/bin/env bash
# Consumes the ui-foundation registry from a fresh app, the way a real
# consuming project would — the actual test of "is this reusable," per
# docs/BUILD-PLAN.md Phase 7 ("Foundation never gets used" is the risk
# register's top row).
#
# Usage:
#   scripts/consume-test.sh --install-only [ref]
#     Scaffold a throwaway Vite app in a temp dir, run
#     `shadcn add <repo>/starter#<ref>`, and type-check. No edits, no
#     entity, no agent — this is what scripts/check-phase-6.sh runs.
#     `ref` defaults to the latest git tag (falls back to v1.0.0).
#
#   scripts/consume-test.sh <ref> <EntityName>
#     The full Phase 7 dogfood run (install, then launch a fresh agent
#     with `/new-entity <EntityName>` and no memory of this repo). Not
#     implemented yet — Phase 7 scope, not Phase 6's.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="Tristan2828/ui-foundation"
fail() { echo "consume-test: $1" >&2; exit 1; }

VITE_VERSION=$(node -p "require('./deps-allowlist.json').tools.vite")
SHADCN_VERSION=$(node -p "require('./deps-allowlist.json').tools.shadcn")

INSTALL_ONLY=false
REF=""
for arg in "$@"; do
  case "$arg" in
    --install-only) INSTALL_ONLY=true ;;
    *) [ -z "$REF" ] && REF="$arg" ;;
  esac
done

if [ "$INSTALL_ONLY" != true ]; then
  fail "full dogfood mode (fresh agent + /new-entity) is Phase 7 scope and is not implemented yet. Use --install-only."
fi

[ -n "$REF" ] || REF=$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0")

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
APP="$WORKDIR/consume-test-app"

echo "consume-test: scaffolding a fresh Vite app ($VITE_VERSION) at $APP"
npm create vite@"$VITE_VERSION" "$APP" -- --template react-ts --yes >/dev/null 2>&1 ||
  npm create vite@"$VITE_VERSION" "$APP" -- --template react-ts

cd "$APP"
echo "consume-test: npm install"
npm install --silent

echo "consume-test: npx shadcn@$SHADCN_VERSION init"
npx --yes shadcn@"$SHADCN_VERSION" init -t vite -b base -p nova -y

echo "consume-test: npx shadcn@$SHADCN_VERSION add $REPO/starter#$REF"
npx --yes shadcn@"$SHADCN_VERSION" add "$REPO/starter#$REF" --yes

# Plain `tsc --noEmit` against a solution-style tsconfig (what both this
# repo's own Phase 1 scaffold and a fresh `create vite` produce) checks
# zero files and exits 0 unconditionally — a silent no-op discovered the
# hard way in this repo's own Phase 4 (docs/phases/phase-4.md). `tsc -b`
# is the command that actually type-checks a solution-style project.
echo "consume-test: tsc -b"
npx tsc -b

echo "consume-test: PASS — $REPO/starter#$REF installs into a fresh app and type-checks clean"
