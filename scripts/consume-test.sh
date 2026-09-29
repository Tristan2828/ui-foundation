#!/usr/bin/env bash
# Creates a fresh app from this checkout the way a real one is created —
# scripts/create-app.sh, template/ and the package as `npm pack` builds it —
# and runs that app's own gates. The test of "is this reusable": it proves
# the package installs from its tarball (not the workspace link), that its
# entry points, CSS and CLI work from node_modules, and that the template
# stands on its own outside this repo.
#
# Usage:
#   scripts/consume-test.sh --install-only
#     Create the app and run its full `verify` (codegen, sync --check,
#     contract, deps, tsc, lint, unit tests, Playwright — the only thing
#     that loads the /testing entry point from node_modules the way Node
#     does), then check the real-mode build is mock-free. Run by the `package` workflow on every PR that
#     touches the package, the template or this script.
#
#   scripts/consume-test.sh <EntityName>
#     The Fresh UI Build: create the app, then a *fresh* agent (a new
#     process in a directory it has never seen) adds <EntityName> from its
#     plan fixture with one instruction, and the app's full `verify` must
#     pass. On demand, not a release gate: run it when the playbook or a
#     composite changes in a way that could confuse a fresh agent. The
#     transcript is kept under logs/consume-test/ — a PASS counts only
#     after reading it (the agent used this version and reported no
#     workarounds).
#
# Tests the committed HEAD. Uncommitted changes to the package or template
# are refused, so a result always belongs to a commit.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
fail() { echo "consume-test: $1" >&2; exit 1; }

INSTALL_ONLY=false
ENTITY=""
for arg in "$@"; do
  case "$arg" in
    --install-only) INSTALL_ONLY=true ;;
    *) ENTITY="$arg" ;;
  esac
done
[ "$INSTALL_ONLY" = true ] || [ -n "$ENTITY" ] ||
  fail "usage: consume-test.sh --install-only | consume-test.sh <EntityName>"

if [ -n "$(git status --porcelain -- packages/ui-foundation template scripts/create-app.sh)" ]; then
  fail "uncommitted changes under packages/ui-foundation, template/ or scripts/create-app.sh — commit first, so the result belongs to a SHA"
fi
SHA=$(git rev-parse HEAD)

WORKDIR=$(mktemp -d)
APP="$WORKDIR/consume-test-app"
# KEEP_APP=1 keeps the created app (path printed at the end).
KEEP=${KEEP_APP:+true}; KEEP=${KEEP:-false}
cleanup() { [ "$KEEP" = true ] || rm -rf "$WORKDIR"; }
trap cleanup EXIT

# npm on Windows can't read a Git Bash path like /tmp/...; cygpath gives
# it C:/... instead. A no-op elsewhere.
native() { cygpath -m "$1" 2>/dev/null || printf '%s' "$1"; }

echo "consume-test: npm pack @tristan2828/ui-foundation at $SHA"
TARBALL_NAME=$(npm pack -w @tristan2828/ui-foundation --pack-destination "$(native "$WORKDIR")" --silent | tail -1)
TARBALL="$(native "$WORKDIR")/$TARBALL_NAME"
[ -f "$WORKDIR/$TARBALL_NAME" ] || fail "npm pack produced no tarball"

# The published file list is the package's `files` field — check the
# tarball carries what apps need, since a workspace link would hide a
# missing entry.
# Listed once into a file: grep -q on a live tar pipe exits early, tar
# gets SIGPIPE, and pipefail turns a match into a failure.
tar -tzf "$WORKDIR/$TARBALL_NAME" > "$WORKDIR/tarball-files.txt"
for f in package/dist/index.js package/dist/index.d.ts package/dist/components/ui/button.js \
  package/dist/gateway.js package/dist/mocks/index.js package/dist/testing/index.js \
  package/styles/index.css package/styles/theme.css package/eslint/index.js \
  package/bin/ui-foundation.mjs package/conventions/AGENTS.md package/openapi/foundation.yaml; do
  grep -qx "$f" "$WORKDIR/tarball-files.txt" || fail "the packed tarball is missing $f"
done
if grep -qE '^package/(src|tests|e2e)/' "$WORKDIR/tarball-files.txt"; then
  fail "the packed tarball ships source or tests — check the package's \"files\""
fi

# `npm publish` normalises package.json more strictly than `npm pack`, and
# silently drops what it rejects — once, the `ui-foundation` bin, which
# every app's verify runs. A dry run needs no login; any correction fails.
echo "consume-test: npm publish --dry-run (no auto-corrections allowed)"
PUBLISH_OUT=$(npm publish -w @tristan2828/ui-foundation --dry-run --provenance=false 2>&1) ||
  fail "npm publish --dry-run failed: $PUBLISH_OUT"
if printf '%s' "$PUBLISH_OUT" | grep -q "errors corrected"; then
  printf '%s\n' "$PUBLISH_OUT" | grep -A5 "errors corrected" >&2
  fail "npm would auto-correct package.json on publish — fix packages/ui-foundation/package.json (npm pkg fix shows how)"
fi

export GIT_AUTHOR_NAME=consume-test GIT_AUTHOR_EMAIL=consume-test@localhost
export GIT_COMMITTER_NAME=consume-test GIT_COMMITTER_EMAIL=consume-test@localhost
echo "consume-test: scripts/create-app.sh consume-test-app (template at $SHA, package from the tarball)"
cd "$WORKDIR"
FOUNDATION_REPO_DIR="$REPO_ROOT" FOUNDATION_TARBALL="$TARBALL" bash "$REPO_ROOT/scripts/create-app.sh" consume-test-app "$SHA"
cd "$APP"

# Installed, not linked: a symlink here would mean the workspace leaked in.
[ ! -L node_modules/@tristan2828/ui-foundation ] || fail "the package is a symlink — expected an install from the tarball"

echo "consume-test: npm run verify in the new app"
npm run verify

# VITE_API is baked in at build time, so a plain `npm run build` bundles
# MSW — a deployed app would then serve mock data while looking normal.
# `build:real` + `.env.real` (both in the template) are the escape; prove
# the real bundle has no MSW, and — as the negative control — that the
# default one does, or the grep proves nothing.
echo "consume-test: build:real must produce a bundle with no MSW in it"
npx vite build --mode real --outDir dist-real >/dev/null
if grep -rql "mockServiceWorker" dist-real/assets 2>/dev/null; then
  fail "a --mode real bundle still contains MSW — .env.real/build:real is not taking effect"
fi
npx vite build --outDir dist-mock >/dev/null
grep -rql "mockServiceWorker" dist-mock/assets >/dev/null 2>&1 ||
  fail "the default build has no MSW either — the mock-free check above is vacuous"
rm -rf dist-real dist-mock

if [ "$INSTALL_ONLY" = true ]; then
  echo "consume-test: PASS — an app created from $SHA installs the packed package, and its verify passes"
  [ "$KEEP" = true ] && echo "consume-test: kept the app at $APP"
  exit 0
fi

# --- Fresh UI Build: a fresh agent adds an entity, then the full verify ---
#
# "Fresh" means a new `claude` process in a directory it has never seen.
# Everything it knows about the foundation comes from what the app
# contains (AGENTS.md, docs/foundation/, the new-entity skill, spec-tester)
# — exactly what a real app's agent sees. The playbook never guesses an
# entity: hand it the plan a developer would have written.
ENTITY_KEBAB=$(printf '%s' "$ENTITY" | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g' | tr '[:upper:]' '[:lower:]')
PLAN_FIXTURE="$REPO_ROOT/scripts/fixtures/entity-plans/$ENTITY_KEBAB.md"
[ -f "$PLAN_FIXTURE" ] || fail "no entity plan fixture for $ENTITY — add $PLAN_FIXTURE (format: docs/foundation/entity-plan-template.md)"
mkdir -p docs/entities
cp "$PLAN_FIXTURE" "docs/entities/$ENTITY_KEBAB.md"
git add docs/entities && git commit -q -m "Entity plan: $ENTITY"

STAMP=$(date +%Y%m%d-%H%M%S)
LOGDIR="$REPO_ROOT/logs/consume-test/${SHA:0:12}-${ENTITY}-${STAMP}"
mkdir -p "$LOGDIR"
TRANSCRIPT="$LOGDIR/transcript.jsonl"

# AGENT_PROMPT overrides the instruction. The default is Claude Code's
# /new-entity shortcut; a plain request (AGENT_PROMPT="Add an Invoice
# entity to this app.") tests what any AI tool relies on instead: AGENTS.md
# routing it to docs/foundation/add-an-entity.md.
AGENT_PROMPT="${AGENT_PROMPT:-/new-entity $ENTITY}"
echo "consume-test: launching a fresh agent in $APP — $AGENT_PROMPT"
echo "consume-test: transcript -> $TRANSCRIPT"

# No turn limit exists in the CLI, so `timeout` is the budget.
# --dangerously-skip-permissions: acceptEdits still prompts for Bash (npm,
# vitest, playwright) with nobody to answer, which hangs forever headless;
# $APP is a disposable temp directory, so a full bypass is safe there.
# MSYS_NO_PATHCONV=1: Git Bash otherwise rewrites "/new-entity" into a
# Windows path before claude.exe sees it.
AGENT_EXIT=0
MSYS_NO_PATHCONV=1 timeout 3600 claude -p "$AGENT_PROMPT" \
  --dangerously-skip-permissions \
  --output-format stream-json --verbose \
  > "$TRANSCRIPT" 2> "$LOGDIR/stderr.log" || AGENT_EXIT=$?

if [ "$AGENT_EXIT" -ne 0 ]; then
  KEEP=true
  cp -r "$APP" "$LOGDIR/app" 2>/dev/null || true
  fail "fresh agent run exited $AGENT_EXIT (124 = timed out after 3600s) — transcript: $TRANSCRIPT, app snapshot: $LOGDIR/app"
fi

echo "consume-test: fresh agent finished — running npm run verify in the app"
if ! npm run verify 2>&1 | tee "$LOGDIR/verify.log"; then
  KEEP=true
  cp -r "$APP" "$LOGDIR/app" 2>/dev/null || true
  fail "npm run verify failed after the agent added $ENTITY — transcript: $TRANSCRIPT, verify log: $LOGDIR/verify.log, app snapshot: $LOGDIR/app"
fi

echo "consume-test: Fresh UI Build PASS — a fresh agent built $ENTITY in an app created from $SHA; npm run verify passes. Read the transcript before counting it: $TRANSCRIPT"
