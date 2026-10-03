#!/usr/bin/env bash
# Creates a new app from the ui-foundation template, ready for its first
# entity plan: template/ at the given tag, depending on
# @tristan2828/ui-foundation at that same version. The steps in
# docs/create-an-app.md; scripts/consume-test.sh runs this same script, so
# the documented path is the tested one.
#
# Usage (from the folder the app should be created *in*):
#   bash create-app.sh <app-name> <tag>
#   e.g. bash create-app.sh game-list v3.0.0
#
# For testing an unreleased commit (consume-test.sh sets both):
#   FOUNDATION_REPO_DIR  copy template/ from this local clone (`git archive`)
#                        instead of downloading the tag from GitHub
#   FOUNDATION_TARBALL   install the package from this `npm pack` tarball
#                        instead of from npm
#
# Needs: Node/npm, git, curl and tar (Git Bash on Windows). Stops at the
# first failure. Doesn't touch anything outside ./<app-name>.
set -euo pipefail

REPO="Tristan2828/ui-foundation"
PACKAGE="@tristan2828/ui-foundation"
fail() { echo "create-app: $1" >&2; exit 1; }

APP_NAME="${1:-}"
REF="${2:-}"
[ -n "$APP_NAME" ] && [ -n "$REF" ] || fail "usage: bash create-app.sh <app-name> <tag>   (e.g. game-list v3.0.0)"
[[ "$APP_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "app name must be kebab-case (lowercase letters, digits, dashes): '$APP_NAME'"
[ ! -e "$APP_NAME" ] || fail "./$APP_NAME already exists — pick another name or remove it first"
git config user.email >/dev/null || [ -n "${GIT_AUTHOR_EMAIL:-}" ] ||
  fail "git has no user.email — run: git config --global user.email you@example.com (and user.name)"

mkdir "$APP_NAME"
if [ -n "${FOUNDATION_REPO_DIR:-}" ]; then
  echo "create-app: copying template/ at $REF from $FOUNDATION_REPO_DIR"
  git -C "$FOUNDATION_REPO_DIR" archive "$REF" template | tar -x --strip-components=1 -C "$APP_NAME" ||
    fail "can't read template/ at '$REF' in $FOUNDATION_REPO_DIR"
else
  # A tag or SHA, never a branch: those URLs are immutable, so there's no
  # CDN staleness to reason about.
  echo "create-app: downloading template/ at $REF"
  curl -fsSL --retry 4 --retry-delay 2 --retry-all-errors "https://codeload.github.com/$REPO/tar.gz/$REF" |
    tar -xz --strip-components=2 -C "$APP_NAME" --wildcards '*/template/*' ||
    fail "can't download template/ at '$REF' — is it a real tag of $REPO?"
fi
cd "$APP_NAME"
[ -f package.json ] || fail "the template at $REF has no package.json — is $REF older than v3.0.0? Apps before 3.0 were created with the shadcn registry"

# The app's own name, and the package at exactly the release the template
# came from (a caret range, so patch releases arrive with `npm update`).
if [ -n "${FOUNDATION_TARBALL:-}" ]; then
  SPEC="file:$FOUNDATION_TARBALL"
elif [[ "$REF" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  SPEC="^${BASH_REMATCH[1]}"
else
  fail "'$REF' isn't a release tag (vX.Y.Z); to test a commit, set FOUNDATION_REPO_DIR and FOUNDATION_TARBALL (scripts/consume-test.sh does)"
fi
APP_NAME="$APP_NAME" SPEC="$SPEC" PACKAGE="$PACKAGE" node -e "
const fs = require('fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.name = process.env.APP_NAME
pkg.dependencies[process.env.PACKAGE] = process.env.SPEC
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
"
sed -i "s#<title>UI Foundation</title>#<title>$APP_NAME</title>#" index.html

echo "create-app: npm install ($PACKAGE $SPEC)"
npm install --no-audit --no-fund

# The app's CI and deploys install with `npm ci`, so the lockfile just
# written must be one it accepts. It isn't always: npm 11.7.0 once wrote a
# lock whose nested ajv packages (under @modelcontextprotocol/sdk and
# @redocly/ajv) `npm ci` rejected, and a second `npm install` rewrote it
# into one that passes. So: prove it, repair once, else stop.
echo "create-app: npm ci (the new package-lock.json must install as written)"
if ! npm ci --no-audit --no-fund; then
  echo "create-app: npm ci rejected the new package-lock.json; running npm install once more" >&2
  npm install --no-audit --no-fund
  npm ci --no-audit --no-fund || fail "npm ci still rejects package-lock.json after a second npm install"
fi

# The template's synced files came from the same release as the package,
# so this only confirms it; a mismatch means the release itself is broken.
npx ui-foundation sync --check

git init -q
git add -A
git commit -q -m "Create $APP_NAME from $REPO template $REF"

echo "create-app: done — ./$APP_NAME, from the $REF template with $PACKAGE $SPEC, committed."
echo "create-app: next, docs/create-an-app.md step 3 (npm run verify)."
