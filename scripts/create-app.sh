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
# Needs: Node/npm, git, curl and tar. Runs in Git Bash on Windows, and on
# macOS and Linux: no GNU-only flags (BSD sed and bsdtar differ). Stops at
# the first failure. Doesn't touch anything outside ./<app-name>, apart
# from a temporary folder for the download.
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
# The backend package's reference migrations at the same ref, if it has
# them (packages/backend-foundation, 4.25.0 on), for the step after npm.
BACKEND_PACKAGE="packages/backend-foundation"
REFERENCE_MIGRATIONS="$BACKEND_PACKAGE/src/foundation_backend/migrations"
DOWNLOAD="$(mktemp -d)"
trap 'rm -rf "$DOWNLOAD"' EXIT
if [ -n "${FOUNDATION_REPO_DIR:-}" ]; then
  echo "create-app: copying template/ at $REF from $FOUNDATION_REPO_DIR"
  git -C "$FOUNDATION_REPO_DIR" archive "$REF" template | tar -x --strip-components=1 -C "$APP_NAME" ||
    fail "can't read template/ at '$REF' in $FOUNDATION_REPO_DIR"
  mkdir "$DOWNLOAD/repo"
  git -C "$FOUNDATION_REPO_DIR" archive "$REF" "$BACKEND_PACKAGE" 2>/dev/null | tar -x -C "$DOWNLOAD/repo" 2>/dev/null || true
else
  # A tag or SHA, never a branch: those URLs are immutable, so there's no
  # CDN staleness to reason about.
  # The whole archive, then its template/: picking template/ out with a
  # pattern needs GNU tar's --wildcards, which macOS's bsdtar lacks.
  echo "create-app: downloading template/ at $REF"
  curl -fsSL --retry 4 --retry-delay 2 --retry-all-errors "https://codeload.github.com/$REPO/tar.gz/$REF" |
    tar -xz -C "$DOWNLOAD" ||
    fail "can't download template/ at '$REF' — is it a real tag of $REPO?"
  cp -R "$DOWNLOAD"/*/template/. "$APP_NAME"/ ||
    fail "the archive of '$REF' has no template/"
  mv "$DOWNLOAD"/*/ "$DOWNLOAD/repo"
fi
cd "$APP_NAME"
[ -f package.json ] || fail "the template at $REF has no package.json — is $REF older than v3.0.0? Apps before 3.0 were created with the shadcn registry"

# The app's own name, and the package at exactly the release the template
# came from (a caret range, so patch releases arrive with `npm update`).
# Installed as exactly that version (INSTALL), saved as the caret range:
# a bare `npm install` of the range would take the newest 3.x instead,
# whose synced conventions aren't this template's (sync --check below).
if [ -n "${FOUNDATION_TARBALL:-}" ]; then
  SPEC="file:$FOUNDATION_TARBALL"
  INSTALL=()
  # Not on PyPI: a test app pins the commit's own version, and nothing
  # installs its backend (consume-test.sh checks the pin is written).
  BACKEND_VERSION=$(sed -n 's/^version = "\(.*\)"$/\1/p' "$DOWNLOAD/repo/$BACKEND_PACKAGE/pyproject.toml" 2>/dev/null || true)
elif [[ "$REF" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  SPEC="^${BASH_REMATCH[1]}"
  INSTALL=("$PACKAGE@${BASH_REMATCH[1]}")
  BACKEND_VERSION="${BASH_REMATCH[1]}"
else
  fail "'$REF' isn't a release tag (vX.Y.Z); to test a commit, set FOUNDATION_REPO_DIR and FOUNDATION_TARBALL (scripts/consume-test.sh does)"
fi
APP_NAME="$APP_NAME" SPEC="$SPEC" PACKAGE="$PACKAGE" node -e "
const fs = require('fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.name = process.env.APP_NAME
pkg.dependencies[process.env.PACKAGE] = process.env.SPEC
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
// Here rather than sed -i, whose in-place syntax differs on macOS.
const html = fs.readFileSync('index.html', 'utf8')
fs.writeFileSync('index.html', html.replace('<title>UI Foundation</title>', '<title>' + process.env.APP_NAME + '</title>'))
"

# The backend's foundation package (PyPI ui-foundation-backend) at exactly
# the same release: the template lists it unpinned, which only works inside
# the ui-foundation repo. Templates before 4.25.0 don't list it.
if grep -q '^  "ui-foundation-backend",$' backend/pyproject.toml; then
  [ -n "$BACKEND_VERSION" ] || fail "can't tell which ui-foundation-backend version '$REF' is"
  echo "create-app: backend/pyproject.toml pins ui-foundation-backend==$BACKEND_VERSION"
  BACKEND_VERSION="$BACKEND_VERSION" node -e "
const fs = require('fs')
const toml = fs.readFileSync('backend/pyproject.toml', 'utf8')
fs.writeFileSync('backend/pyproject.toml', toml.replace(/^  \"ui-foundation-backend\",$/m, '  \"ui-foundation-backend==' + process.env.BACKEND_VERSION + '\",'))
"
fi

# The package's reference migrations (its tables), each only where the
# template has no revision of that number: while the template carries its
# own (it does today), this copies nothing.
if [ -d "$DOWNLOAD/repo/$REFERENCE_MIGRATIONS" ]; then
  for migration in "$DOWNLOAD/repo/$REFERENCE_MIGRATIONS"/[0-9]*.py; do
    [ -e "$migration" ] || continue
    number="$(basename "$migration")"; number="${number%%_*}"
    if ! ls backend/migrations/versions/"${number}"_*.py >/dev/null 2>&1; then
      echo "create-app: backend/migrations/versions/$(basename "$migration") (from $BACKEND_PACKAGE)"
      cp "$migration" backend/migrations/versions/
    fi
  done
fi

echo "create-app: npm install ($PACKAGE $SPEC${INSTALL[0]:+, installing ${INSTALL[0]}})"
npm install --no-audit --no-fund ${INSTALL[@]+"${INSTALL[@]}"}

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
