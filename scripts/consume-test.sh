#!/usr/bin/env bash
# Consumes the ui-foundation registry from a fresh app, the way a real
# consuming project would — the actual test of "is this reusable," per
# docs/BUILD-PLAN.md Phase 7 ("Foundation never gets used" is the risk
# register's top row).
#
# Usage:
#   scripts/consume-test.sh --install-only [ref]
#     Scaffold a throwaway Vite app in a temp dir, run
#     `shadcn add <repo>/starter#<ref>`, then type-check (app + shipped
#     tests) and lint the result. No edits, no
#     entity, no agent — this is what scripts/check-phase-6.sh runs.
#     `ref` defaults to the latest git tag (falls back to v1.0.0).
#
#   scripts/consume-test.sh <ref> <EntityName>
#     The full Phase 7 dogfood run: install, then launch a *fresh* agent
#     (no memory of this repo — a new process in a directory it has never
#     seen) with a single instruction, `/new-entity <EntityName>`, and run
#     `npm run verify` in the result. Exits non-zero if the agent run
#     fails/times out or verify fails afterward. The transcript is always
#     preserved under logs/consume-test/ for review — see
#     docs/BUILD-PLAN.md Phase 7 step 2 ("read the transcript for every
#     question the agent asked...").
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

REPO="Tristan2828/ui-foundation"
fail() { echo "consume-test: $1" >&2; exit 1; }

VITE_VERSION=$(node -p "require('./deps-allowlist.json').tools.vite")
SHADCN_VERSION=$(node -p "require('./deps-allowlist.json').tools.shadcn")

INSTALL_ONLY=false
POSITIONAL=()
for arg in "$@"; do
  case "$arg" in
    --install-only) INSTALL_ONLY=true ;;
    *) POSITIONAL+=("$arg") ;;
  esac
done

REF="${POSITIONAL[0]:-}"
ENTITY="${POSITIONAL[1]:-}"
if [ "$INSTALL_ONLY" != true ]; then
  [ -n "$ENTITY" ] || fail "full dogfood mode requires an entity name: consume-test.sh <ref> <EntityName>"
fi
[ -n "$REF" ] || REF=$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0")

# raw.githubusercontent.com serves files with Cache-Control: max-age=300,
# so a *branch* ref tested within ~5 minutes of a push can install a mix
# of new and stale files (seen in audit Phase A: new use-mobile.ts, stale
# SKILL.md). Tags and commit SHAs are immutable URLs and can't go stale.
if ! [[ "$REF" =~ ^v[0-9] || "$REF" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "consume-test: WARNING — '$REF' looks like a branch; GitHub may serve files cached up to 5 min old. Prefer a commit SHA (git rev-parse HEAD)." >&2
fi

WORKDIR=$(mktemp -d)
APP="$WORKDIR/consume-test-app"
KEEP=false
cleanup() { [ "$KEEP" = true ] || rm -rf "$WORKDIR"; }
trap cleanup EXIT

# `npm create vite` mis-joins an absolute path with the caller's cwd on
# Windows/Git Bash when passed as an argument (it prints the right target
# in its own banner, then mkdirs the cwd + that path concatenated). `cd`
# into WORKDIR first and pass a relative name instead of fighting it.
echo "consume-test: scaffolding a fresh Vite app ($VITE_VERSION) at $APP"
cd "$WORKDIR"
npm create vite@"$VITE_VERSION" consume-test-app -- --template react-ts --yes

cd "$APP"
echo "consume-test: npm install"
npm install --silent

# `create vite`'s react-ts template ships with no Tailwind and no `@`
# alias — this repo's own Phase 1 added both by hand before `shadcn init`
# would run (init refuses without them). Reproduce that minimum, not the
# rest of this repo's setup: only Tailwind + the alias unblock init, and
# these are throwaway-app files, not this repo's own pinned deps.
echo "consume-test: installing Tailwind and configuring the @ alias (Phase 1's prerequisite for shadcn init)"
npm install --silent tailwindcss @tailwindcss/vite

cat > vite.config.ts <<'EOF'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
EOF

cat > tsconfig.json <<'EOF'
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ],
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
EOF

node -e "
const fs = require('fs');
const p = 'tsconfig.app.json';
const c = JSON.parse(fs.readFileSync(p, 'utf8').replace(/\/\*.*?\*\//gs, ''));
c.compilerOptions.paths = { '@/*': ['./src/*'] };
fs.writeFileSync(p, JSON.stringify(c, null, 2));
"

sed -i '1i @import "tailwindcss";' src/index.css

echo "consume-test: npx shadcn@$SHADCN_VERSION init"
npx --yes shadcn@"$SHADCN_VERSION" init -t vite -b base -p nova -y

echo "consume-test: npx shadcn@$SHADCN_VERSION add $REPO/starter#$REF"
npx --yes shadcn@"$SHADCN_VERSION" add "$REPO/starter#$REF" --yes --overwrite

# `add`'s overwrite prompts are non-interactive-safe with --yes/--overwrite
# above, but confirm the files actually landed rather than trusting a
# silent tsc pass — an empty install would type-check clean too, since
# nothing would import the missing modules.
for f in \
  AGENTS.md CLAUDE.md docs/add-an-entity.md \
  .claude/skills/new-entity/SKILL.md .claude/agents/spec-tester.md \
  .claude/hooks/deny-impl-read.mjs scripts/check-deps.mjs \
  src/styles/theme.css src/index.css \
  src/components/app/app-shell.tsx src/components/app/data-table.tsx \
  src/components/app/entity-form.tsx src/components/app/error-state.tsx \
  src/components/app/route-error-boundary.tsx \
  src/components/theme-provider.tsx src/hooks/use-mobile.ts \
  src/components/ui/button.stories.tsx src/components/ui/badge.stories.tsx \
  src/components/ui/card.stories.tsx src/components/ui/input.stories.tsx \
  src/components/ui/sidebar.stories.tsx src/components/ui/sheet.stories.tsx \
  src/components/ui/tooltip.stories.tsx src/components/ui/separator.stories.tsx \
  src/components/ui/skeleton.stories.tsx src/components/ui/spinner.stories.tsx \
  src/components/ui/empty.stories.tsx src/components/ui/sonner.stories.tsx \
  .storybook/main.ts .storybook/preview.ts \
  src/api/contracts.ts src/api/transport/index.ts src/api/query-client.ts \
  src/api/gateway/errors.ts src/api/gateway/widgets.ts src/api/gateway/categories.ts \
  src/auth/auth-context.ts src/auth/auth-provider.tsx src/auth/use-auth.ts \
  src/api/gateway/auth.ts \
  src/main.tsx src/App.tsx src/routes/home.tsx \
  src/routes/login.tsx src/routes/login-schema.ts \
  src/routes/register.tsx src/routes/register-schema.ts src/routes/return-path.ts \
  tests/gateway/auth.test.ts tests/return-path.test.ts e2e/auth.spec.ts e2e/register.spec.ts \
  src/mocks/browser.ts src/mocks/server.ts src/mocks/data.ts \
  src/mocks/handlers.ts src/mocks/e2e-hooks.ts \
  src/routes/widgets/use-widgets.ts src/routes/widgets/use-categories.ts \
  src/routes/widgets/widget-schema.ts src/routes/widgets/widgets-columns.tsx \
  src/routes/widgets/widgets-table.tsx src/routes/widgets/widget-form.tsx \
  src/routes/widgets/delete-widget-action.tsx \
  tests/gateway/widgets.test.ts tests/gateway/categories.test.ts \
  tests/mocks/conformance.test.ts tests/widget-schema.test.ts \
  e2e/global.d.ts e2e/msw-contract.spec.ts e2e/shell.spec.ts \
  e2e/storybook-visual.spec.ts e2e/smoke.spec.ts \
  e2e/widget-form.spec.ts e2e/widgets-table.spec.ts \
  vitest.config.ts playwright.config.ts tsconfig.test.json openapi.yaml \
; do
  [ -f "$f" ] || fail "expected file missing after install: $f"
done

# Existing isn't enough: until audit Phase A, starter pulled these through
# an unpinned registryDependency, so they arrived from main no matter which
# ref was installed — and every check above still passed. Compare them to
# the same files at $REF (CRLF-insensitive: git's working-copy conversion).
for f in AGENTS.md docs/add-an-entity.md .claude/skills/new-entity/SKILL.md deps-allowlist.json; do
  expected=$(git -C "$REPO_ROOT" show "$REF:$f" 2>/dev/null || git -C "$REPO_ROOT" show "origin/$REF:$f") ||
    fail "can't read $f at $REF from the local repo (fetch first?)"
  [ "$(tr -d '\r' < "$f")" = "$(printf '%s' "$expected" | tr -d '\r')" ] ||
    fail "$f installed from starter#$REF doesn't match $REF's own copy — a registry item is resolving from a different ref"
done

# MSW's browser worker (src/mocks/browser.ts, imported unconditionally by
# main.tsx unless VITE_API=real) needs a generated service-worker script in
# public/ to actually intercept requests — registry.json can't ship this
# (it's a generated artifact, not source), so it's part of getting MSW
# running at all, same as `npm install` itself.
echo "consume-test: npx msw init public/ --save"
npx msw init public/ --save

# `verify:fast`'s `git diff --exit-code -- src/api/schema.d.ts` needs an
# actual repo to diff against, and the entity playbook's own "commit,
# then stop" BLOCKERS.md instruction (AGENTS.md Scope and Stopping) needs
# one to act on. A real consuming app has this from the moment it's
# created; `npm create vite` does not do it automatically.
echo "consume-test: git init (verify:fast's git diff check and the entity playbook's commit step both need a real repo)"
git init -q
git config user.email "consume-test@localhost"
git config user.name "consume-test"
git add -A
git commit -q -m "Initial scaffold: fresh Vite app + $REPO/starter#$REF"

if [ "$INSTALL_ONLY" = true ]; then
  # src/api/schema.d.ts is generated from openapi.yaml (openapi-typescript),
  # never shipped as a file — the widgets reference files that DO ship all
  # import it. A real consumer's first /new-entity run generates it as its
  # own Step 0 (docs/add-an-entity.md); --install-only has no agent to do
  # that, so it runs the generator directly here, the same way it fakes
  # the Tailwind/alias setup above, to get a meaningful type-check at all.
  echo "consume-test: npx openapi-typescript openapi.yaml (schema.d.ts is generated, not shipped — see comment above)"
  npx openapi-typescript openapi.yaml -o src/api/schema.d.ts

  # Plain `tsc --noEmit` against a solution-style tsconfig (what both this
  # repo's own Phase 1 scaffold and a fresh `create vite` produce) checks
  # zero files and exits 0 unconditionally — a silent no-op discovered the
  # hard way in this repo's own Phase 4 (docs/phases/phase-4.md). `tsc -b`
  # is the command that actually type-checks a solution-style project.
  echo "consume-test: tsc -b"
  npx tsc -b

  # The root tsconfig a fresh app has doesn't reference tsconfig.test.json,
  # so `tsc -b` never sees tests/ or e2e/ — the playbook's Step 0
  # verify:fast adds this same call for the same reason.
  echo "consume-test: tsc -p tsconfig.test.json (shipped tests/ and e2e/)"
  npx tsc -p tsconfig.test.json

  # A lint failure in a shipped or registry-dependency file (e.g. upstream
  # shadcn's use-mobile.ts vs. react-hooks' set-state-in-effect rule) fails
  # every consumer's first verify, but is invisible to tsc.
  echo "consume-test: eslint (the shipped eslint.config.js, as verify runs it)"
  npx eslint . --max-warnings 0

  echo "consume-test: PASS — $REPO/starter#$REF installs into a fresh app and type-checks and lints clean"
  exit 0
fi

# --- Phase 7 dogfood mode: a fresh agent, /new-entity, then verify ---
#
# "Fresh" here means a new `claude` process started in a directory it has
# never seen before — not a flag. $APP has no session history with this
# repo; everything the agent knows about the foundation's conventions
# comes from what the registry actually installed (AGENTS.md, CLAUDE.md,
# the new-entity skill, spec-tester) — same as a real consumer would see.
STAMP=$(date +%Y%m%d-%H%M%S)
LOGDIR="$REPO_ROOT/logs/consume-test/${REF}-${ENTITY}-${STAMP}"
mkdir -p "$LOGDIR"
TRANSCRIPT="$LOGDIR/transcript.jsonl"

echo "consume-test: launching a fresh agent in $APP — /new-entity $ENTITY"
echo "consume-test: transcript -> $TRANSCRIPT"

# No --max-turns flag exists in this Claude Code CLI version (2.1.273) —
# docs/BUILD-PLAN.md's run-phase.sh reference assumed one does. A wall-clock
# budget via `timeout` is the stand-in; see docs/phases/phase-7.md.
#
# --dangerously-skip-permissions: the plan's reference loop uses
# `--permission-mode acceptEdits`, but that mode still prompts for Bash
# (npm install, gen:api, vitest, playwright) with no one to answer, which
# hangs forever headless. $APP is a disposable temp directory the fresh
# agent has never touched before, not this repo, so a full bypass is
# scoped to something safe to bypass on.
# MSYS_NO_PATHCONV=1: Git Bash on Windows rewrites a leading-slash argument
# into an absolute Windows path before claude.exe ever sees it — without
# this, "/new-entity Invoice" arrives as the literal string
# "C:/Program Files/Git/new-entity Invoice", which is not a slash-command
# at all. Confirmed by a first real dogfood run: the fresh agent correctly
# diagnosed the mangling itself and refused to hand-replicate the skill's
# steps (disable-model-invocation working as designed) rather than
# guessing — but the run was wasted on a test-harness bug, not a
# foundation one. See docs/phases/phase-7.md.
AGENT_EXIT=0
MSYS_NO_PATHCONV=1 timeout 3600 claude -p "/new-entity $ENTITY" \
  --dangerously-skip-permissions \
  --output-format stream-json --verbose \
  > "$TRANSCRIPT" 2> "$LOGDIR/stderr.log" || AGENT_EXIT=$?

if [ "$AGENT_EXIT" -ne 0 ]; then
  KEEP=true
  cp -r "$APP" "$LOGDIR/app" 2>/dev/null || true
  fail "fresh agent run exited $AGENT_EXIT (124 = timed out after 3600s) — transcript: $TRANSCRIPT, app snapshot: $LOGDIR/app"
fi

echo "consume-test: fresh agent finished — running npm run verify in the consuming app"
if ! (cd "$APP" && npm run verify) 2>&1 | tee "$LOGDIR/verify.log"; then
  KEEP=true
  cp -r "$APP" "$LOGDIR/app" 2>/dev/null || true
  fail "npm run verify failed in the consuming app after /new-entity $ENTITY — transcript: $TRANSCRIPT, verify log: $LOGDIR/verify.log, app snapshot: $LOGDIR/app"
fi

echo "consume-test: PASS — a fresh agent with no memory of this repo built $ENTITY entirely from $REPO/starter#$REF, npm run verify passes. Transcript: $TRANSCRIPT"
