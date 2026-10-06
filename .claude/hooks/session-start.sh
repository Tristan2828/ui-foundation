#!/bin/bash
# Claude Code cloud sessions only: make `npm run verify` and
# `npm run verify:backend` runnable from the first prompt.
#
# 1. npm install (the root postinstall builds the package).
# 2. template/backend/.venv with the backend's dev extras.
# 3. Browsers. The cloud image ships Playwright browsers at whatever
#    revision it was built with (/opt/pw-browsers), and this repo pins its
#    own @playwright/test. When the pinned revision isn't installed, and
#    `playwright install` isn't an option there, this maps the revision
#    Playwright asks for onto the installed one, in a directory of its own
#    (~/.cache/ui-foundation-pw), and points PLAYWRIGHT_BROWSERS_PATH at it
#    for the session. /opt is never written. When the pinned revision is
#    there, nothing is mapped.
#
# Idempotent; safe on every start, resume and compact.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
log() { echo "session-start: $1" >&2; }

log "npm install"
npm install --no-audit --no-fund >&2

if command -v python3 >/dev/null 2>&1; then
  log "template/backend/.venv"
  (
    cd template/backend
    if command -v uv >/dev/null 2>&1; then
      [ -x .venv/bin/python ] || uv venv -q .venv
      uv pip install -q --python .venv/bin/python -e ".[dev]" >&2
    else
      [ -x .venv/bin/python ] || python3 -m venv .venv
      .venv/bin/python -m pip install -q -e ".[dev]" >&2
    fi
  )
fi

INSTALLED="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
MAPPED="${HOME:?}/.cache/ui-foundation-pw"
# A resumed session may already point at the map; read the real browsers.
[ "$INSTALLED" != "$MAPPED" ] || INSTALLED=/opt/pw-browsers
# Revisions the pinned Playwright wants, as "name revision" lines.
# Read by path: the package's `exports` don't expose browsers.json.
WANTED=$(node -e '
  const b = JSON.parse(require("fs").readFileSync("node_modules/playwright-core/browsers.json", "utf8")).browsers
  for (const x of b) if (x.name === "chromium" || x.name === "chromium-headless-shell") console.log(x.name, x.revision)
' 2>/dev/null || true)
[ -n "$WANTED" ] || log "can't read node_modules/playwright-core/browsers.json; browsers left as they are"

# The newest installed directory for a browser, e.g. chromium-1194.
newest() { ls -d "$INSTALLED/$1"-[0-9]* 2>/dev/null | sort -t- -k2 -n | tail -1; }
# The first file that exists, from candidate paths under a directory.
first() { local dir=$1; shift; for f in "$@"; do [ -x "$dir/$f" ] && { echo "$dir/$f"; return; }; done; }

need_map=false
while read -r name revision; do
  [ -n "$name" ] || continue
  dir="${name//-/_}-$revision"
  [ -d "$INSTALLED/$dir" ] || need_map=true
done <<< "$WANTED"

if [ "$need_map" = true ] && [ -n "$WANTED" ]; then
  log "pinned browser revision not in $INSTALLED; mapping it onto the installed one in $MAPPED"
  rm -rf -- "$MAPPED"
  mkdir -p "$MAPPED"
  while read -r name revision; do
    [ -n "$name" ] || continue
    prefix="${name//-/_}"
    source_dir=$(newest "$prefix")
    [ -n "$source_dir" ] || { log "no installed $prefix to map; browser tests will need it"; continue; }
    target="$MAPPED/$prefix-$revision"
    mkdir -p "$target"
    if [ "$name" = "chromium" ]; then
      binary=$(first "$source_dir" chrome-linux64/chrome chrome-linux/chrome)
      [ -n "$binary" ] || { log "no chrome binary in $source_dir"; continue; }
      mkdir -p "$target/chrome-linux64"
      ln -sfn "$binary" "$target/chrome-linux64/chrome"
    else
      binary=$(first "$source_dir" chrome-headless-shell-linux64/chrome-headless-shell chrome-linux/headless_shell)
      [ -n "$binary" ] || { log "no headless shell binary in $source_dir"; continue; }
      mkdir -p "$target/chrome-headless-shell-linux64"
      ln -sfn "$binary" "$target/chrome-headless-shell-linux64/chrome-headless-shell"
    fi
    touch "$target/INSTALLATION_COMPLETE" "$target/DEPENDENCIES_VALIDATED"
  done <<< "$WANTED"
  for other in "$INSTALLED"/ffmpeg-*; do [ -e "$other" ] && ln -sfn "$other" "$MAPPED/$(basename "$other")"; done
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PLAYWRIGHT_BROWSERS_PATH=\"$MAPPED\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

log "done"
