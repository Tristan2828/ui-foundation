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
      '@': path.resolve(__dirname, './src'),
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
    "baseUrl": ".",
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
c.compilerOptions.baseUrl = '.';
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
  src/styles/theme.css \
  src/components/app/app-shell.tsx src/components/app/data-table.tsx \
  src/components/app/entity-form.tsx src/components/app/error-state.tsx \
  src/components/app/route-error-boundary.tsx \
  src/api/contracts.ts src/api/transport/index.ts src/api/query-client.ts \
  src/auth/auth-context.ts src/auth/auth-provider.tsx src/auth/use-auth.ts \
; do
  [ -f "$f" ] || fail "expected file missing after install: $f"
done

# Plain `tsc --noEmit` against a solution-style tsconfig (what both this
# repo's own Phase 1 scaffold and a fresh `create vite` produce) checks
# zero files and exits 0 unconditionally — a silent no-op discovered the
# hard way in this repo's own Phase 4 (docs/phases/phase-4.md). `tsc -b`
# is the command that actually type-checks a solution-style project.
echo "consume-test: tsc -b"
npx tsc -b

echo "consume-test: PASS — $REPO/starter#$REF installs into a fresh app and type-checks clean"
