#!/usr/bin/env bash
# Creates a new app on the ui-foundation registry, ready for its first
# entity plan. The steps in docs/create-an-app.md; scripts/consume-test.sh
# runs this same script on every release, so the path is always tested.
#
# Usage (from the folder the app should be created *in*):
#   bash create-app.sh <app-name> <tag>
#   e.g. bash create-app.sh game-list v2.1.0
#
# Needs: Node/npm, git, curl, and Git Bash on Windows. Stops at the first
# failure. Doesn't touch anything outside ./<app-name>.
set -euo pipefail

REPO="Tristan2828/ui-foundation"
fail() { echo "create-app: $1" >&2; exit 1; }

APP_NAME="${1:-}"
REF="${2:-}"
[ -n "$APP_NAME" ] && [ -n "$REF" ] || fail "usage: bash create-app.sh <app-name> <tag>   (e.g. game-list v2.1.0)"
[[ "$APP_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "app name must be kebab-case (lowercase letters, digits, dashes): '$APP_NAME'"
[ ! -e "$APP_NAME" ] || fail "./$APP_NAME already exists — pick another name or remove it first"
git config user.email >/dev/null || [ -n "${GIT_AUTHOR_EMAIL:-}" ] ||
  fail "git has no user.email — run: git config --global user.email you@example.com (and user.name)"

# Tool versions come from deps-allowlist.json *at the ref being installed*,
# so a pinned tag always gets the versions it was tested with — no copy of
# the foundation repo needed. Tags and SHAs are immutable, so no CDN staleness.
ALLOWLIST=$(curl -fsSL --retry 4 --retry-delay 2 --retry-all-errors "https://raw.githubusercontent.com/$REPO/$REF/deps-allowlist.json") ||
  fail "can't fetch deps-allowlist.json at '$REF' — is it a real tag or commit SHA of $REPO?"
VITE_VERSION=$(printf '%s' "$ALLOWLIST" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).tools.vite)")
SHADCN_VERSION=$(printf '%s' "$ALLOWLIST" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync(0,'utf8')).tools.shadcn)")

# A relative name, not an absolute path: `npm create vite` mis-joins an
# absolute path with the cwd on Windows/Git Bash.
echo "create-app: scaffolding Vite $VITE_VERSION (react-ts) in ./$APP_NAME"
npm create vite@"$VITE_VERSION" "$APP_NAME" -- --template react-ts --yes
cd "$APP_NAME"
npm install --silent

# shadcn init refuses to run without Tailwind and the @ alias.
echo "create-app: adding Tailwind and the @ alias"
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

echo "create-app: shadcn $SHADCN_VERSION init"
npx --yes shadcn@"$SHADCN_VERSION" init -t vite -b base -p nova -y

# --overwrite is right here, on a fresh scaffold, and never again: on an
# app with its own entities it would reset them to the demo
# (docs/consuming.md, "Taking a later release").
echo "create-app: installing $REPO/starter#$REF"
npx --yes shadcn@"$SHADCN_VERSION" add "$REPO/starter#$REF" --yes --overwrite

# MSW's service worker is a generated file the registry can't ship; the
# app runs on mock data until it has a backend.
echo "create-app: generating the MSW service worker"
npx msw init public/ --save

git init -q
git add -A
git commit -q -m "Scaffold from $REPO starter#$REF"

echo "create-app: done — ./$APP_NAME, installed from starter#$REF and committed."
echo "create-app: next, docs/create-an-app.md step 3 (Step 0 of docs/add-an-entity.md, then npm run verify)."
