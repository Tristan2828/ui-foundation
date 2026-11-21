#!/usr/bin/env bash
# The docs-only detector's cases, run in CI by verify.yml's harness-perf job
# (and by hand: bash .github/scripts/docs-only.test.sh). The pulls API and
# git are stubbed, so it needs no network and no token.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
script="$here/docs-only.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
failures=0

expect() { # name, expected, actual
  if [ "$2" = "$3" ]; then
    echo "ok   $1"
  else
    echo "FAIL $1: expected '$2', got '$3'"
    failures=$((failures + 1))
  fi
}

classify() { printf '%s' "$1" | bash "$script" --classify; }

expect "docs only" docs-only "$(classify $'docs/ARCHITECTURE.md\nREADME.md\nCHANGELOG.md\n.claude/settings.json\n')"
expect "one path outside the docs" run "$(classify $'docs/a.md\npackages/ui-foundation/src/index.ts\n')"
expect "an empty list" run "$(classify '')"
expect "Markdown below the root" run "$(classify $'scripts/fixtures/entity-plans/widget.md\n')"
expect "shipped conventions" run "$(classify $'packages/ui-foundation/conventions/AGENTS.md\n')"
expect "the template's agent files" run "$(classify $'template/.claude/settings.json\n')"
expect "a root file that isn't Markdown" run "$(classify $'package.json\n')"
expect "a workflow" run "$(classify $'.github/workflows/verify.yml\n')"
expect "a name that only starts like docs" run "$(classify $'docs.json\n')"

# The decide path, with gh and git stubbed on PATH.
mkdir -p "$work/bin"
run_decide() { # event, event JSON; prints the run= line or "failed"
  printf '%s' "$2" > "$work/event.json"
  : > "$work/output"
  if PATH="$work/bin:$PATH" GITHUB_EVENT_NAME="$1" GITHUB_EVENT_PATH="$work/event.json" \
    GITHUB_REPOSITORY=o/r GITHUB_SHA=abc GITHUB_OUTPUT="$work/output" FULL="${FULL:-false}" \
    bash "$script" > /dev/null 2>&1; then
    cat "$work/output"
  else
    echo failed
  fi
}
stub_gh() { # files TSV, changed_files count, exit status of the file listing
  cat > "$work/bin/gh" <<EOF
#!/usr/bin/env bash
case "\$*" in
  *pulls/*/files*) printf '$1'; exit $3 ;;
  *) echo $2 ;;
esac
EOF
  chmod +x "$work/bin/gh"
}
pr='{"pull_request":{"number":7}}'

stub_gh 'docs/a.md\t\nREADME.md\t\n' 2 0
expect "a docs-only PR" run=false "$(run_decide pull_request "$pr")"
stub_gh 'packages/ui-foundation/src/a.ts\tdocs/a.ts\n' 1 0
expect "a file renamed out of docs/" run=true "$(run_decide pull_request "$pr")"
stub_gh 'docs/b.md\tpackages/ui-foundation/src/b.ts\n' 1 0
expect "a file renamed into docs/" run=true "$(run_decide pull_request "$pr")"
stub_gh '' 0 0
expect "a PR with no files" run=true "$(run_decide pull_request "$pr")"
stub_gh 'docs/a.md\t\n' 3001 0
expect "a list shorter than the PR says" run=true "$(run_decide pull_request "$pr")"
stub_gh 'docs/a.md\t\n' 1 1
expect "the file listing fails" failed "$(run_decide pull_request "$pr")"
stub_gh 'docs/a.md\t\n' 1 0
expect "a PR with no number" failed "$(run_decide pull_request '{}')"
expect "FULL=true on a docs-only PR" run=true "$(FULL=true run_decide pull_request "$pr")"

cat > "$work/bin/git" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  fetch) [ "${*: -1}" != "missing" ] ;;
  diff) printf 'docs/a.md\n' ;;
esac
EOF
chmod +x "$work/bin/git"
expect "a docs-only push" run=false "$(run_decide push '{"before":"1234"}')"
expect "a push with no earlier commit" run=true "$(run_decide push '{"before":"0000000000000000000000000000000000000000"}')"
expect "a push with no before" run=true "$(run_decide push '{}')"
expect "a push whose before can't be fetched" failed "$(run_decide push '{"before":"missing"}')"
expect "workflow_dispatch" run=true "$(run_decide workflow_dispatch '{}')"

if [ "$failures" -gt 0 ]; then
  echo "$failures case(s) failed."
  exit 1
fi
echo "All cases pass."
